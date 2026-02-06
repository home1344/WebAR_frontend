/**
 * AR Session Manager
 * Handles WebXR session lifecycle and hit testing
 */

import { getLogger } from './logger.js';

export class ARSession {
  constructor(onPlaceCallback, onStartCallback, onEndCallback) {
    this.session = null;
    this.referenceSpace = null;
    this.viewerSpace = null;
    this.hitTestSource = null;
    this.hitTestAvailable = false;
    this.scene = null;
    this.renderer = null;
    this.lastHitPosition = null;
    this.logger = getLogger();
    this.lastHitLogTime = 0;
    this.hitLogInterval = 2000; // Log hit status every 2 seconds max
    this.hitTestResultsCount = 0;
    
    // State control flags for reticle and placement
    this.reticleEnabled = true;   // Controls whether reticle can be shown
    this.placementEnabled = true; // Controls whether taps trigger placement
    
    // Placement suppression: prevents accidental placement after UI interactions
    // When a UI button enables placement, we suppress for a short time to avoid
    // the same tap that hit the button from also triggering placement
    this.placementSuppressedUntil = 0;
    
    // Callbacks
    this.onPlace = onPlaceCallback;
    this.onStart = onStartCallback;
    this.onEnd = onEndCallback;
    
    // Bind methods
    this.onSelect = this.onSelect.bind(this);
    this.onSessionEnd = this.onSessionEnd.bind(this);
    
    // Improvement 3: Reusable objects to avoid GC churn
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    
    this.init();
  }

  init() {
    // Get A-Frame scene and renderer
    this.scene = document.querySelector('a-scene');
    if (!this.scene) {
      throw new Error('A-Frame scene not found');
    }
    
    // Store reference for hit test updates
    this.hitTestMarker = document.getElementById('marker');
  }

  async start() {
    if (this.session) {
      this.logger.warning('AR_SESSION', 'AR session already active');
      return;
    }
    
    // Improvement 1: Ensure A-Frame is fully loaded before accessing renderer
    if (!this.scene.hasLoaded) {
      this.logger.info('AR_SESSION', 'Waiting for A-Frame scene to load...');
      await new Promise((resolve) => this.scene.addEventListener('loaded', resolve, { once: true }));
    }
    
    // Improvement 1: Verify renderer exists
    if (!this.scene.renderer) {
      throw new Error('A-Frame renderer not available (scene.renderer is null)');
    }
    
    try {
      const overlayRoot = document.getElementById('ui-overlay');

      const sessionInitCandidates = [
        {
          requiredFeatures: ['hit-test'],
          optionalFeatures: ['dom-overlay'],
          ...(overlayRoot ? { domOverlay: { root: overlayRoot } } : {})
        },
        {
          requiredFeatures: ['hit-test'],
          optionalFeatures: []
        }
      ];

      this.logger.info('AR_SESSION', 'Requesting AR session', {
        candidates: sessionInitCandidates.length,
        hasOverlay: !!overlayRoot
      });

      let lastError = null;
      let attemptNumber = 0;
      for (const sessionInit of sessionInitCandidates) {
        try {
          attemptNumber++;
          this.logger.info('AR_SESSION', `Attempt ${attemptNumber}: Requesting session`, sessionInit);
          this.session = await navigator.xr.requestSession('immersive-ar', sessionInit);
          this.logger.success('AR_SESSION', `Session created on attempt ${attemptNumber}`);
          break;
        } catch (err) {
          lastError = err;
          this.logger.warning('AR_SESSION', `Attempt ${attemptNumber} failed`, {
            error: err.message,
            name: err.name
          });
          if (err && err.name === 'NotSupportedError') {
            continue;
          }
          throw err;
        }
      }

      if (!this.session) {
        throw lastError || new Error('Failed to start AR session');
      }
      
      // Configure session
      try {
        await this.configureSession();
      } catch (error) {
        try {
          await this.session.end();
        } catch (_) {
          // ignore
        }
        this.session = null;
        throw error;
      }
      
      // Improvement 1: Use local variable for cleaner code
      const renderer = this.scene.renderer;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local');
      
      // Improvement 1: setSession may return a Promise in some Three.js builds
      await renderer.xr.setSession(this.session);
      
      // Start render loop
      renderer.setAnimationLoop(this.onXRFrame.bind(this));
      
      // Setup event listeners
      this.session.addEventListener('select', this.onSelect);
      this.session.addEventListener('end', this.onSessionEnd);
      
      // Notify session started
      if (this.onStart) {
        this.onStart();
      }
      
      console.log('AR Session started successfully');
      
    } catch (error) {
      console.error('Failed to start AR session:', error);
      throw error;
    }
  }

  async configureSession() {
    this.logger.info('AR_CONFIG', 'Configuring AR session...');
    
    // Create reference space - MUST match A-Frame's webxr referenceSpaceType (set to 'local' in index.html)
    // This ensures hit-test poses are in the same coordinate system as A-Frame rendering
    this.referenceSpace = await this.session.requestReferenceSpace('local');
    this.viewerSpace = await this.session.requestReferenceSpace('viewer');
    
    // Log reference space configuration for debugging coordinate systems
    this.logger.info('AR_CONFIG', 'Reference spaces created', { 
      hitTestPoseSpace: 'local',
      viewerSpace: 'viewer',
      aframeConfiguredSpace: 'local',
      note: 'All coordinate systems should now be aligned to local reference space'
    });
    
    // Setup hit test source
    if (!this.session.requestHitTestSource) {
      this.hitTestAvailable = false;
      this.logger.error('HIT_TEST', 'Hit-test API not available on this session');
      throw new Error('Hit-test is not available in this AR session. Install/enable Google Play Services for AR (ARCore) and try again.');
    }

    const hitTestOptionsInit = {
      space: this.viewerSpace
    };

    if (typeof XRRay !== 'undefined') {
      hitTestOptionsInit.offsetRay = new XRRay();
      this.logger.info('HIT_TEST', 'Using XRRay for hit-test offset');
    }

    try {
      this.hitTestSource = await this.session.requestHitTestSource(hitTestOptionsInit);
      this.hitTestAvailable = true;
      this.logger.success('HIT_TEST', 'Hit-test source created successfully');
    } catch (error) {
      this.hitTestAvailable = false;
      this.logger.error('HIT_TEST', 'Failed to create hit-test source', { error: error.message });
      throw new Error('Failed to enable hit-test for AR session. Make sure Google Play Services for AR (ARCore) is installed/enabled, then retry.');
    }
    
    // Frame loop will be started by renderer.setAnimationLoop in start()
    this.logger.info('AR_CONFIG', 'AR session configured successfully');
  }

  onXRFrame(time, frame) {
    // Fix 2: No need to manually schedule next frame - renderer.setAnimationLoop handles this
    if (!frame) return; // Safety check
    const session = frame.session;
    
    // Perform hit test
    if (this.hitTestSource && frame) {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(this.referenceSpace);
        
        if (pose) {
          // Update hit marker position
          this.updateHitMarker(pose);
          
          // Store last hit position
          const transform = pose.transform;
          this.lastHitPosition = {
            x: transform.position.x,
            y: transform.position.y,
            z: transform.position.z
          };
          
          // Update UI status
          this.updateHitTestStatus(true);
          
          // Throttled logging for hit detection
          this.hitTestResultsCount = hitTestResults.length;
          if (time - this.lastHitLogTime > this.hitLogInterval) {
            this.logger.logHitTestStatus(true, this.lastHitPosition, this.hitTestResultsCount);
            this.lastHitLogTime = time;
          }
        }
      } else {
        // No hit detected - clear stale position to prevent placing model at old location
        this.lastHitPosition = null;
        
        this.updateHitTestStatus(false);
        this.hideHitMarker();
        
        // Throttled logging for no hit
        this.hitTestResultsCount = 0;
        if (time - this.lastHitLogTime > this.hitLogInterval) {
          this.logger.logHitTestStatus(false, null, 0);
          this.lastHitLogTime = time;
        }
      }
    }
    
    // Update FPS counter if debug mode
    this.updateDebugInfo(time);
    
    // Fix 3: Explicitly render the scene within the XR frame
    this.scene.renderer.render(this.scene.object3D, this.scene.camera);
  }

  updateHitMarker(pose) {
    // Improvement 3 & 4: Check both marker and object3D exist
    if (!this.hitTestMarker?.object3D) return;
    
    // If reticle is disabled, hide it and return
    if (!this.reticleEnabled) {
      this.hideHitMarker();
      return;
    }
    
    const t = pose.transform;
    
    // Improvement 3: Reuse temp objects to avoid GC churn
    this._tmpPos.set(t.position.x, t.position.y, t.position.z);
    this.hitTestMarker.object3D.position.copy(this._tmpPos);
    
    this.hitTestMarker.setAttribute('visible', true);
    
    // Update rotation from hit pose quaternion
    const o = t.orientation;
    if (o) {
      this._tmpQuat.set(o.x, o.y, o.z, o.w);
      this.hitTestMarker.object3D.quaternion.copy(this._tmpQuat);
    }
  }

  hideHitMarker() {
    if (this.hitTestMarker) {
      this.hitTestMarker.setAttribute('visible', false);
    }
  }

  onSelect(event) {
    // If placement is disabled, ignore taps entirely
    if (!this.placementEnabled) {
      this.logger.info('USER_ACTION', 'Tap ignored - placement disabled');
      return;
    }
    
    // Check placement suppression cooldown (prevents UI tap from also triggering placement)
    const now = performance.now();
    if (now < this.placementSuppressedUntil) {
      this.logger.info('USER_ACTION', 'Tap ignored - placement cooldown active', {
        remainingMs: Math.round(this.placementSuppressedUntil - now)
      });
      return;
    }
    
    // Place model at hit location
    let placePosition = this.lastHitPosition;
    
    // Fix 8: Fallback to marker position if lastHitPosition is null but marker is visible
    // This can happen due to brief hit-test drop between frames
    if (!placePosition && this.hitTestMarker?.object3D && this.hitTestMarker.getAttribute('visible')) {
      const markerPos = this.hitTestMarker.object3D.position;
      placePosition = { x: markerPos.x, y: markerPos.y, z: markerPos.z };
      this.logger.info('USER_ACTION', 'Using marker position as fallback', { position: placePosition });
    }
    
    if (placePosition && this.onPlace) {
      this.logger.event('USER_ACTION', 'Screen tap - placing model', { position: placePosition });
      this.onPlace(placePosition);
      
      // Hide marker after placement
      this.hideHitMarker();
    } else {
      this.logger.warning('USER_ACTION', 'Screen tap but no valid hit position available');
    }
  }

  updateHitTestStatus(active) {
    // Improvement 4: Defensive null checks throughout
    
    // Update debug status (if visible)
    const statusEl = document.getElementById('hit-test-status');
    if (statusEl) {
      statusEl.textContent = active ? 'active' : 'searching...';
      statusEl.className = active ? 'active' : '';
    }
    
    // Update surface status badge (always visible)
    const surfaceStatus = document.getElementById('surface-status');
    if (!surfaceStatus) return;
    
    const indicator = surfaceStatus.querySelector('.status-indicator');
    const statusText = surfaceStatus.querySelector('.status-text');
    
    if (active) {
      surfaceStatus.classList.add('detected');
      if (indicator) {
        indicator.classList.remove('searching');
        indicator.classList.add('detected');
      }
      if (statusText) {
        statusText.textContent = 'Surface detected';
      }
    } else {
      surfaceStatus.classList.remove('detected');
      if (indicator) {
        indicator.classList.remove('detected');
        indicator.classList.add('searching');
      }
      if (statusText) {
        statusText.textContent = 'Searching for surface...';
      }
    }
  }

  updateDebugInfo(time) {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo && !debugInfo.classList.contains('hidden')) {
      // Calculate FPS
      if (!this.lastTime) this.lastTime = time;
      const delta = time - this.lastTime;
      const fps = Math.round(1000 / delta);
      this.lastTime = time;
      
      const fpsEl = document.getElementById('fps');
      if (fpsEl) {
        fpsEl.textContent = fps;
      }
    }
  }

  async end() {
    if (this.session) {
      await this.session.end();
    }
  }

  onSessionEnd() {
    this.logger.info('AR_SESSION', 'AR session ended');
    
    // Improvement 2: Remove session listeners (prevents memory leaks on restart)
    try {
      this.session?.removeEventListener('select', this.onSelect);
      this.session?.removeEventListener('end', this.onSessionEnd);
    } catch (_) { /* ignore */ }
    
    // Stop render loop and clear XR session from renderer
    if (this.scene?.renderer) {
      this.scene.renderer.setAnimationLoop(null);
      try { this.scene.renderer.xr.setSession(null); } catch (_) { /* ignore */ }
    }
    
    // Improvement 2: Cancel hit test source if supported
    if (this.hitTestSource?.cancel) {
      try { this.hitTestSource.cancel(); } catch (_) { /* ignore */ }
    }
    
    // Improvement 6: Reset marker explicitly
    this.lastHitPosition = null;
    this.hideHitMarker();
    if (this.hitTestMarker?.object3D) {
      this.hitTestMarker.object3D.position.set(0, 0, 0);
      this.hitTestMarker.object3D.quaternion.set(0, 0, 0, 1);
    }
    
    // Clean up references
    this.session = null;
    this.referenceSpace = null;
    this.viewerSpace = null;
    this.hitTestSource = null;
    
    // Notify session ended
    if (this.onEnd) {
      this.onEnd();
    }
  }

  // Improvement 5: Implement pause/resume properly
  pause() {
    if (this.scene?.renderer) {
      this.scene.renderer.setAnimationLoop(null);
      this.logger.info('AR_SESSION', 'AR session paused');
    }
  }

  resume() {
    if (this.session && this.scene?.renderer) {
      this.scene.renderer.setAnimationLoop(this.onXRFrame.bind(this));
      this.logger.info('AR_SESSION', 'AR session resumed');
    }
  }

  /**
   * Enable or disable reticle visibility
   * @param {boolean} enabled - Whether reticle should be shown when surface detected
   */
  setReticleEnabled(enabled) {
    this.reticleEnabled = enabled;
    if (!enabled) {
      this.hideHitMarker();
    }
    this.logger.info('AR_SESSION', `Reticle ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable placement (tap to place)
   * @param {boolean} enabled - Whether taps should trigger placement
   */
  setPlacementEnabled(enabled) {
    this.placementEnabled = enabled;
    this.logger.info('AR_SESSION', `Placement ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Suppress placement for a short duration (prevents UI tap from triggering placement)
   * Call this BEFORE enabling placement after a UI interaction
   * @param {number} durationMs - Duration to suppress placement in milliseconds
   */
  suppressPlacement(durationMs = 300) {
    this.placementSuppressedUntil = performance.now() + durationMs;
    this.logger.info('AR_SESSION', `Placement suppressed for ${durationMs}ms`);
  }
}
