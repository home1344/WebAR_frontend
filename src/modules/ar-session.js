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
    
    // Callbacks
    this.onPlace = onPlaceCallback;
    this.onStart = onStartCallback;
    this.onEnd = onEndCallback;
    
    // Bind methods
    this.onSelect = this.onSelect.bind(this);
    this.onSessionEnd = this.onSessionEnd.bind(this);
    
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
      
      // Start render loop
      this.scene.renderer.xr.enabled = true;
      this.scene.renderer.xr.setReferenceSpaceType('local'); // Fix 1: Force renderer to use 'local' space
      this.scene.renderer.xr.setSession(this.session);
      
      // Fix 2: Use renderer's animation loop instead of manual requestAnimationFrame
      this.scene.renderer.setAnimationLoop(this.onXRFrame.bind(this));
      
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
    if (!this.hitTestMarker) return;
    
    const transform = pose.transform;
    
    // Use WebXR coordinates directly (consistent with lastHitPosition)
    const position = {
      x: transform.position.x,
      y: transform.position.y,
      z: transform.position.z
    };
    
    // Update marker position in world space
    this.hitTestMarker.object3D.position.set(position.x, position.y, position.z);
    this.hitTestMarker.setAttribute('visible', true);
    
    // Update rotation from hit pose quaternion
    const orientation = transform.orientation;
    if (orientation) {
      this.hitTestMarker.object3D.quaternion.set(
        orientation.x,
        orientation.y,
        orientation.z,
        orientation.w
      );
    }
  }

  hideHitMarker() {
    if (this.hitTestMarker) {
      this.hitTestMarker.setAttribute('visible', false);
    }
  }

  onSelect(event) {
    // Place model at hit location
    if (this.lastHitPosition && this.onPlace) {
      this.logger.event('USER_ACTION', 'Screen tap - placing model', { position: this.lastHitPosition });
      this.onPlace(this.lastHitPosition);
      
      // Hide marker after placement
      this.hideHitMarker();
    } else {
      this.logger.warning('USER_ACTION', 'Screen tap but no valid hit position available');
    }
  }

  updateHitTestStatus(active) {
    // Update debug status (if visible)
    const statusEl = document.getElementById('hit-test-status');
    if (statusEl) {
      statusEl.textContent = active ? 'active' : 'searching...';
      statusEl.className = active ? 'active' : '';
    }
    
    // Update surface status badge (always visible)
    const surfaceStatus = document.getElementById('surface-status');
    if (surfaceStatus) {
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
    
    // Update instructions only on first detection (handled by UIController)
    // The instruction update is now managed by the main app to avoid conflicts
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
    
    // Fix 4: Stop the animation loop when session ends
    if (this.scene && this.scene.renderer) {
      this.scene.renderer.setAnimationLoop(null);
    }
    
    // Clean up
    this.session = null;
    this.referenceSpace = null;
    this.viewerSpace = null;
    this.hitTestSource = null;
    this.lastHitPosition = null;
    
    // Notify session ended
    if (this.onEnd) {
      this.onEnd();
    }
  }

  pause() {
    // Pause session if needed
    console.log('AR Session paused');
  }

  resume() {
    // Resume session if needed
    console.log('AR Session resumed');
  }
}
