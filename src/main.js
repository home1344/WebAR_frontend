/**
 * WebAR Floor Placement Application
 * Main entry point - orchestrates the AR experience
 */

import { ARSession } from './modules/ar-session.js';
import { ModelLoader } from './modules/model-loader.js';
import { UIController } from './modules/ui-controller.js';
import { GestureHandler } from './modules/gesture-handler.js';
import { Gallery } from './modules/gallery.js';
import { CONFIG } from './config/config.js';
import { getLogger } from './modules/logger.js';
import './components/ar-components.js';

class WebARApp {
  constructor() {
    this.arSession = null;
    this.modelLoader = null;
    this.uiController = null;
    this.gestureHandler = null;
    this.gallery = null;
    this.currentModel = null;
    this.isInitialized = false;
    this.logger = null;
    
    // Track placement state
    this.modelIsPlaced = false;
    
    // State machine flags
    this.isModelLoading = false;   // True while a model is being fetched/parsed
    this.isRepositioning = false;  // True when user pressed reload and is repositioning
    
    // Store current model config for repositioning
    this.currentModelConfig = null;
    
    // Model entity cache: Map of modelId -> { entity, config, isReady }
    // This caches parsed A-Frame entities to avoid re-parsing on model switch
    this.modelEntityCache = new Map();
    
    // Track active model ID for cache management
    this.activeModelId = null;
    
    // Track previous model state for cancel functionality
    this.previousModelState = null;
    
    // Store last placed hit position for "switch in place" functionality
    // This is the RAW hit-test Y (before floor offset) so we can recompute
    // correct placement for different models with different floor offsets
    this.lastPlacedHitPosition = null;
    
    // Pending "switch in place" intent for non-cached models
    // When set, model-loaded handler will place the model at this position
    this.pendingSwitchInPlace = null;
    
    // Current loading indicator reference (for cancel)
    this.currentLoadingIndicator = null;
    
    // Flag to track if loading was cancelled
    this.loadingCancelled = false;
  }

  async init() {
    try {
      // Initialize logger first
      this.logger = getLogger();
      this.logger.info('APP_INIT', 'WebAR App initializing...');
      
      // Initialize UI controller first
      this.uiController = new UIController();
      
      // Check WebXR support
      const webxrSupported = await this.checkWebXRSupport();
      this.logger.logWebXRSupport(webxrSupported);
      if (!webxrSupported) {
        this.logger.warning('APP_INIT', 'WebXR not supported on this device/browser');
        this.uiController.showUnsupportedScreen();
        return;
      }
      
      // Initialize modules
      this.modelLoader = new ModelLoader(CONFIG.models);
      this.gallery = new Gallery(CONFIG.models, this.onModelSelect.bind(this));
      
      // Wait for A-Frame to be ready
      await this.waitForAFrame();
      
      // Initialize AR session (but don't start it yet)
      this.arSession = new ARSession(
        this.onPlaceModel.bind(this),
        this.onSessionStarted.bind(this),
        this.onSessionEnded.bind(this)
      );
      
      // Initialize gesture handler
      this.gestureHandler = new GestureHandler();
      
      // Setup UI event handlers
      this.setupEventHandlers();
      
      // Setup tap-anywhere-to-start (replaces Start AR button)
      this.setupTapToStart();
      
      this.isInitialized = true;
      this.logger.success('APP_INIT', 'Initialization complete - waiting for user to start AR', {
        modelsAvailable: CONFIG.models.length,
        config: {
          hitTestEnabled: true,
          gesturesEnabled: true
        }
      });
      
    } catch (error) {
      console.error('WebAR App: Initialization failed', error);
      this.logger?.logError('APP_INIT', error);
      this.uiController.showError(`Error: ${error.message}`);
    }
  }

  /**
   * Setup tap-anywhere-to-start AR (replaces Start AR button)
   * WebXR requires user gesture, so we use tap on loading screen
   */
  setupTapToStart() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      // Add tap instruction text
      const tapInstruction = document.createElement('p');
      tapInstruction.className = 'tap-instruction';
      tapInstruction.textContent = 'Telegram:@DanyloPodolskyi, WhatsApp +380 50 838 0613';
      loadingScreen.querySelector('.loading-content').appendChild(tapInstruction);
      
      // One-time tap listener to start AR
      const startOnTap = async (event) => {
        // Prevent double-tap issues
        event.preventDefault();
        event.stopPropagation();
        
        this.logger.event('USER_ACTION', 'Tap to start AR');
        
        // Remove the listener immediately to prevent multiple triggers
        loadingScreen.removeEventListener('click', startOnTap);
        loadingScreen.removeEventListener('touchend', startOnTap);
        
        // Show loading state
        this.uiController.showLoadingState();
        
        // Start AR session with user interaction (gesture requirement satisfied)
        await this.startARSession();
      };
      
      loadingScreen.addEventListener('click', startOnTap);
      loadingScreen.addEventListener('touchend', startOnTap);
    }
  }

  async checkWebXRSupport() {
    if (!navigator.xr) {
      console.warn('WebXR not supported');
      return false;
    }
    
    try {
      const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
      console.log('WebXR AR support:', isSupported);
      return isSupported;
    } catch (error) {
      console.error('Error checking WebXR support:', error);
      return false;
    }
  }

  async waitForAFrame() {
    return new Promise((resolve) => {
      const scene = document.querySelector('a-scene');
      
      const onLoaded = () => {
        // Fix Three.js useLegacyLights deprecation warning
        // A-Frame 1.5.0 uses Three.js r158+ which deprecated this property
        if (scene.renderer && 'useLegacyLights' in scene.renderer) {
          // The property is deprecated, just ignore it - A-Frame handles lighting internally
          console.log('WebAR: Three.js renderer configured');
        }
        resolve();
      };
      
      if (scene.hasLoaded) {
        onLoaded();
      } else {
        scene.addEventListener('loaded', onLoaded);
      }
    });
  }

  setupEventHandlers() {
    // Gallery button - guarded by loading state
    document.getElementById('gallery-btn').addEventListener('click', () => {
      if (this.isModelLoading) {
        this.logger.info('USER_ACTION', 'Gallery ignored - model loading');
        return;
      }
      this.gallery.show();
    });
    
    // Reload button - guarded by loading state
    document.getElementById('reload-btn').addEventListener('click', () => {
      if (this.isModelLoading) {
        this.logger.info('USER_ACTION', 'Reload ignored - model loading');
        return;
      }
      this.reloadModel();
    });
  }

  async startARSession() {
    try {
      this.logger.info('AR_SESSION', 'Starting AR session...');
      
      if (!window.isSecureContext) {
        this.logger.error('AR_SESSION', 'Not in secure context', { protocol: window.location.protocol });
        this.uiController.showError('WebXR requires HTTPS (or localhost). Open the HTTPS URL and accept the certificate.');
        return;
      }

      this.uiController.updateLoadingText('Checking WebXR support...');
      this.uiController.updateProgress(20);
      this.logger.info('AR_SESSION', 'Checking WebXR support...');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.uiController.updateLoadingText('Initializing AR session...');
      this.uiController.updateProgress(50);
      this.logger.info('AR_SESSION', 'Requesting AR session with hit-test...');
      
      await this.arSession.start();
      
      this.uiController.updateLoadingText('Starting AR...');
      this.uiController.updateProgress(100);
      this.logger.logSessionStart({ hitTest: true, domOverlay: true });
      
    } catch (error) {
      this.logger.logError('AR_SESSION', error);
      console.error('Failed to start AR session:', error);
      if (error?.name === 'NotSupportedError') {
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          this.uiController.showError('WebXR AR requires HTTPS. Open the https:// URL (not http://) and accept the certificate warning, then try again.');
        } else {
          this.uiController.showError('This device/browser does not support the required AR session configuration (hit-test). Make sure Google Play Services for AR is installed/enabled, then retry.');
        }
      } else {
        this.uiController.showError(`Failed to start AR: ${error.message}`);
      }
    }
  }

  onSessionStarted() {
    this.logger.success('AR_SESSION', 'AR session started successfully');
    this.uiController.hideLoadingScreen();
    this.uiController.showARUI();
    // Initial instructions are shown by showARUI() with proper state
    
    // Track surface detection state for instruction updates
    this.surfaceDetected = false;
    this.setupSurfaceDetectionListener();
    
    // Auto-load first model from the gallery
    this.autoLoadFirstModel();
  }

  /**
   * Setup listener for surface detection state changes
   */
  setupSurfaceDetectionListener() {
    // Monitor surface status badge for state changes
    const surfaceStatus = document.getElementById('surface-status');
    if (surfaceStatus) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            const isDetected = surfaceStatus.classList.contains('detected');
            // Always update surface detection state and UI instructions
            if (isDetected !== this.surfaceDetected) {
              this.surfaceDetected = isDetected;
              if (isDetected) {
                this.onSurfaceDetected();
              } else {
                this.onSurfaceLost();
              }
            }
          }
        });
      });
      observer.observe(surfaceStatus, { attributes: true });
    }
  }

  /**
   * Called when surface is first detected
   */
  onSurfaceDetected() {
    if (!this.currentModel) {
      this.uiController.showSurfaceDetectedInstructions();
    }
  }

  /**
   * Called when surface is lost
   */
  onSurfaceLost() {
    if (!this.currentModel) {
      this.uiController.showInstructions('Move your phone slowly to scan the floor', {
        duration: 0,
        icon: 'scan',
        state: 'scanning'
      });
    }
  }

  onSessionEnded() {
    this.logger.logSessionEnd();
    this.uiController.hideARUI();
    this.uiController.showLoadingScreen();
  }

  async onModelSelect(modelConfig) {
    // Ignore if already loading
    if (this.isModelLoading) {
      this.logger.info('USER_ACTION', 'Model selection ignored - already loading');
      return;
    }
    
    const startTime = Date.now();
    this.logger.event('USER_ACTION', 'Model selected from gallery', { 
      modelName: modelConfig.name,
      modelId: modelConfig.id,
      url: modelConfig.url,
      timestamp: startTime
    });
    this.gallery.hide();
    
    // Detect "switch in place" intent: if a model was already placed at a known position,
    // the new model should appear at the same spot without requiring rescan/tap
    const shouldSwitchInPlace = this.modelIsPlaced && this.lastPlacedHitPosition && !this.isRepositioning;
    
    if (shouldSwitchInPlace) {
      this.logger.info('MODEL_SWITCH', 'Switch in place mode - will place at previous location', {
        lastHitPosition: this.lastPlacedHitPosition
      });
    }
    
    // Check if this model is already cached (parsed and ready)
    const cachedModel = this.modelEntityCache.get(modelConfig.id);
    
    if (cachedModel && cachedModel.isReady) {
      // INSTANT SWITCH: Model is already parsed, just swap visibility
      this.logger.info('MODEL_CACHE', 'Using cached model entity - instant switch', { 
        modelId: modelConfig.id 
      });
      
      // Store previous state before switching (for potential future use)
      this.savePreviousModelState();
      
      // Hide current model (don't remove - it's cached)
      this.hideCurrentModel();
      
      // Activate cached model
      this.activateCachedModel(modelConfig.id, cachedModel);
      
      // Show success immediately
      this.uiController.showToast(`${modelConfig.name} ready`, 'success', { title: 'Model Ready' });
      
      if (shouldSwitchInPlace) {
        // SWITCH IN PLACE: Place the new model at the stored hit position
        const floorOffset = parseFloat(cachedModel.entity.dataset.floorOffset) || 0;
        const adjustedY = this.lastPlacedHitPosition.y + floorOffset;
        const posString = `${this.lastPlacedHitPosition.x} ${adjustedY} ${this.lastPlacedHitPosition.z}`;
        
        this.currentModel.setAttribute('position', posString);
        this.currentModel.setAttribute('visible', 'true');
        this.modelIsPlaced = true;
        
        // Keep reticle and placement disabled (model is already placed)
        this.arSession.setReticleEnabled(false);
        this.arSession.setPlacementEnabled(false);
        
        // Attach gesture handler
        this.gestureHandler.attachToModel(this.currentModel);
        
        this.uiController.showSuccessInstructions('Pinch to scale, drag to rotate', 4000);
        
        this.logger.info('MODEL_SWITCH', 'Cached model placed in place', {
          position: posString,
          floorOffset: floorOffset
        });
      } else {
        // Normal flow: enable placement for reticle tap
        // Use suppression to prevent gallery tap from triggering placement
        this.arSession.suppressPlacement(300);
        this.arSession.setReticleEnabled(true);
        this.arSession.setPlacementEnabled(true);
        
        // Show appropriate instruction
        if (this.surfaceDetected) {
          this.uiController.showSurfaceDetectedInstructions();
        } else {
          this.uiController.showInstructions('Move your phone slowly to scan the floor', {
            duration: 0,
            icon: 'scan',
            state: 'scanning'
          });
        }
      }
      
      return;
    }
    
    // NOT CACHED: Need to load and parse model
    this.logger.logModelLoad(modelConfig.name, modelConfig.url);
    
    // Store previous model state BEFORE hiding (for cancel restore)
    this.savePreviousModelState();
    
    // Hide current model if exists (don't remove - keep in cache)
    this.hideCurrentModel();
    
    // Store pending switch-in-place intent if applicable
    if (shouldSwitchInPlace) {
      this.pendingSwitchInPlace = {
        hitPosition: { ...this.lastPlacedHitPosition },
        modelId: modelConfig.id
      };
      this.logger.info('MODEL_SWITCH', 'Stored pending switch-in-place intent', {
        modelId: modelConfig.id
      });
    } else {
      this.pendingSwitchInPlace = null;
    }
    
    // Reset cancel flag
    this.loadingCancelled = false;
    
    // Lock UI during loading
    this.isModelLoading = true;
    this.uiController.setControlsEnabled(false);
    this.gallery.setEnabled(false);
    
    // Disable placement during loading
    this.arSession.setPlacementEnabled(false);
    
    // Show loading instructions
    this.uiController.showLoadingInstructions(modelConfig.name);
    
    try {
      const modelUrl = modelConfig.url;
      await this.loadAndCacheModel(modelUrl, modelConfig);
      
      // Check if loading was cancelled
      if (this.loadingCancelled) {
        this.logger.info('MODEL_LOAD', 'Loading completed but was cancelled, ignoring result');
        return;
      }
      
      const loadTime = Date.now() - startTime;
      this.logger.logModelLoaded(modelConfig.name, { loadTime, cached: false });
      
    } catch (error) {
      // Check if this was a cancel (not a real error)
      if (this.loadingCancelled) {
        this.logger.info('MODEL_LOAD', 'Loading cancelled by user');
        return;
      }
      
      this.logger.logModelError(modelConfig.name, error, {
        url: modelConfig.url,
        httpStatus: error.message.match(/HTTP (\d+)/)?.[1],
        loadTime: Date.now() - startTime
      });
      this.uiController.showToast('Failed to load model', 'error', { title: 'Error' });
      this.uiController.hideInstructions();
      
      // Re-enable reticle/placement on error
      // Use suppression in case user is still touching the screen
      this.arSession.suppressPlacement(300);
      this.arSession.setReticleEnabled(true);
      this.arSession.setPlacementEnabled(true);
    } finally {
      if (!this.loadingCancelled) {
        this.isModelLoading = false;
        this.uiController.setControlsEnabled(true);
        this.gallery.setEnabled(true);
      }
    }
  }

  /**
   * Save current model state for potential restore on cancel
   */
  savePreviousModelState() {
    if (this.currentModel && this.activeModelId) {
      this.previousModelState = {
        modelId: this.activeModelId,
        config: this.currentModelConfig,
        wasPlaced: this.modelIsPlaced,
        position: this.currentModel.getAttribute('position'),
        scale: this.currentModel.getAttribute('scale'),
        rotation: this.currentModel.getAttribute('rotation')
      };
      this.logger.info('MODEL_STATE', 'Saved previous model state', { 
        modelId: this.activeModelId 
      });
    } else {
      this.previousModelState = null;
    }
  }

  /**
   * Cancel current model loading and restore previous state
   */
  cancelModelLoading() {
    if (!this.isModelLoading) {
      this.logger.info('USER_ACTION', 'Cancel ignored - not loading');
      return;
    }
    
    this.logger.event('USER_ACTION', 'Model loading cancelled by user');
    
    // Set cancel flag
    this.loadingCancelled = true;
    
    // Remove loading indicator
    if (this.currentLoadingIndicator) {
      this.uiController.removeModelLoadingIndicator(this.currentLoadingIndicator);
      this.currentLoadingIndicator = null;
    }
    
    // Cancel the model loader's current fetch
    this.modelLoader.cancelCurrentLoad?.();
    
    // Remove the partially loaded entity if it exists
    if (this.currentModel && !this.modelEntityCache.get(this.activeModelId)?.isReady) {
      // Entity was created but not fully loaded - remove it
      this.currentModel.parentNode?.removeChild(this.currentModel);
      this.modelEntityCache.delete(this.activeModelId);
    }
    
    // Restore previous model state
    if (this.previousModelState) {
      const cached = this.modelEntityCache.get(this.previousModelState.modelId);
      if (cached && cached.isReady) {
        this.logger.info('MODEL_STATE', 'Restoring previous model', { 
          modelId: this.previousModelState.modelId 
        });
        
        // Activate the previous model
        this.currentModel = cached.entity;
        this.currentModelConfig = this.previousModelState.config;
        this.activeModelId = this.previousModelState.modelId;
        
        // Restore position/scale/rotation if it was placed
        if (this.previousModelState.wasPlaced) {
          this.currentModel.setAttribute('position', this.previousModelState.position);
          this.currentModel.setAttribute('scale', this.previousModelState.scale);
          this.currentModel.setAttribute('rotation', this.previousModelState.rotation);
          this.currentModel.setAttribute('visible', 'true');
          this.modelIsPlaced = true;
          
          // Re-attach gesture handler
          this.gestureHandler.attachToModel(this.currentModel);
          
          // Setup layer controls if needed
          if (this.previousModelState.config?.layers?.length > 0) {
            this.setupLayerControls(this.previousModelState.config.layers);
          }
        }
        
        this.uiController.showToast('Loading cancelled', 'info');
      }
    } else {
      // No previous model - just reset to initial state
      this.currentModel = null;
      this.activeModelId = null;
      this.uiController.showToast('Loading cancelled', 'info');
    }
    
    // Reset loading state
    this.isModelLoading = false;
    this.uiController.setControlsEnabled(true);
    this.gallery.setEnabled(true);
    this.uiController.hideInstructions();
    
    // Re-enable reticle/placement
    // Use suppression to prevent cancel button tap from triggering placement
    this.arSession.suppressPlacement(300);
    this.arSession.setReticleEnabled(true);
    this.arSession.setPlacementEnabled(true);
    
    // Show appropriate instruction
    if (this.surfaceDetected) {
      this.uiController.showSurfaceDetectedInstructions();
    }
    
    // Clear previous state
    this.previousModelState = null;
  }

  /**
   * Hide current model without removing it (keeps it in cache)
   */
  hideCurrentModel() {
    if (this.currentModel) {
      // Detach gesture handler from current model
      this.gestureHandler?.detach();
      
      // Hide the model but keep it in DOM (cached)
      this.currentModel.setAttribute('visible', 'false');
      
      // Reset placement state
      this.modelIsPlaced = false;
      
      // Hide layer controls (will be re-shown for new model if it has layers)
      document.getElementById('layer-toggles').classList.add('hidden');
      
      this.logger.info('MODEL_CACHE', 'Current model hidden (cached)', { 
        modelId: this.activeModelId 
      });
    }
  }

  /**
   * Activate a cached model entity
   */
  activateCachedModel(modelId, cachedModel) {
    this.currentModel = cachedModel.entity;
    this.currentModelConfig = cachedModel.config;
    this.activeModelId = modelId;
    this.modelIsPlaced = false;
    
    // Model stays hidden until user taps reticle to place
    this.currentModel.setAttribute('visible', 'false');
    
    // Setup layer controls if model has layers
    if (cachedModel.config.layers && cachedModel.config.layers.length > 0) {
      this.setupLayerControls(cachedModel.config.layers);
    }
    
    this.logger.info('MODEL_CACHE', 'Cached model activated', { modelId });
  }

  /**
   * Load a model and cache the parsed entity for instant switching
   * @param {string} url - Model URL
   * @param {object} config - Model configuration
   */
  async loadAndCacheModel(url, config) {
    const container = document.getElementById('model-container');
    const startTime = Date.now();
    
    // Show loading indicator with cancel button
    const loadingIndicator = this.uiController.createModelLoadingIndicator(
      () => this.cancelModelLoading()
    );
    this.currentLoadingIndicator = loadingIndicator;
    
    this.logger.info('MODEL_LOAD', 'Starting model fetch', { 
      url,
      fullUrl: new URL(url, window.location.origin).href,
      modelName: config.name,
      modelId: config.id,
      timestamp: startTime
    });
    
    let modelUrl = url;
    
    try {
      // Use ModelLoader to fetch with progress tracking (downloads are cached)
      modelUrl = await this.modelLoader.loadModel(url, (progress, received, total) => {
        this.uiController.updateModelLoadingProgress(loadingIndicator, progress);
        this.logger.info('MODEL_LOAD', `Loading progress: ${progress}%`, { received, total });
      });
      
      this.logger.success('MODEL_LOAD', 'Model fetched successfully', { objectUrl: modelUrl });
      
    } catch (fetchError) {
      this.logger.logModelError(config.name, fetchError);
      this.uiController.removeModelLoadingIndicator(loadingIndicator);
      this.uiController.showInstructions('Failed to download model. Check network connection.');
      throw fetchError;
    }
    
    // Create model entity with unique ID based on model config ID
    const modelEntity = document.createElement('a-entity');
    modelEntity.setAttribute('id', `model-${config.id}`);
    modelEntity.setAttribute('gltf-model', modelUrl);
    modelEntity.setAttribute('scale', config.defaultScale || '1 1 1');
    
    // Hide model until user taps to place it
    modelEntity.setAttribute('visible', 'false');
    
    // Position at origin initially
    modelEntity.setAttribute('position', '0 0 0');
    this.logger.info('MODEL_LOAD', 'Model entity created, awaiting A-Frame parse');
    
    container.appendChild(modelEntity);
    
    // Set as current model and track active ID
    this.currentModel = modelEntity;
    this.currentModelConfig = config;
    this.activeModelId = config.id;
    
    // Add to cache as "loading" (not ready yet)
    this.modelEntityCache.set(config.id, {
      entity: modelEntity,
      config: config,
      isReady: false
    });
    
    // Setup layer controls if model has layers
    if (config.layers && config.layers.length > 0) {
      this.setupLayerControls(config.layers);
    }
    
    // Listen for model loaded (A-Frame parsed the glTF)
    modelEntity.addEventListener('model-loaded', () => {
      this.uiController.removeModelLoadingIndicator(loadingIndicator);
      
      // Get the Three.js mesh for bounding box calculation
      const mesh = modelEntity.getObject3D('mesh');
      if (mesh) {
        // Ensure world matrices are up-to-date before computing bounding box
        mesh.updateWorldMatrix(true, true);
        
        // Compute bounding box in world coordinates
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        const modelSize = new THREE.Vector3();
        boundingBox.getSize(modelSize);
        const modelCenter = new THREE.Vector3();
        boundingBox.getCenter(modelCenter);
        
        // Log raw model dimensions
        this.logger.info('MODEL_BOUNDS', 'Raw model bounding box (native units)', {
          min: { x: boundingBox.min.x, y: boundingBox.min.y, z: boundingBox.min.z },
          max: { x: boundingBox.max.x, y: boundingBox.max.y, z: boundingBox.max.z },
          size: { x: modelSize.x, y: modelSize.y, z: modelSize.z },
          center: { x: modelCenter.x, y: modelCenter.y, z: modelCenter.z }
        });
        
        // Normalize model scale to real-world meters
        const targetSizeMeters = config.targetSizeMeters || 0.5;
        const largestDimension = Math.max(modelSize.x, modelSize.y, modelSize.z);
        
        if (largestDimension > 0) {
          const scaleFactor = targetSizeMeters / largestDimension;
          
          // Apply uniform scale
          modelEntity.setAttribute('scale', `${scaleFactor} ${scaleFactor} ${scaleFactor}`);
          
          // Force Three.js to update matrices after scale change
          modelEntity.object3D.updateMatrixWorld(true);
          
          // Recompute bounding box AFTER scale is applied
          const scaledBoundingBox = new THREE.Box3().setFromObject(mesh);
          const scaledSize = new THREE.Vector3();
          scaledBoundingBox.getSize(scaledSize);
          
          this.logger.info('MODEL_SCALE', 'Model scale normalized', {
            rawLargestDimension: largestDimension,
            targetSizeMeters: targetSizeMeters,
            appliedScaleFactor: scaleFactor,
            finalSizeMeters: { x: scaledSize.x, y: scaledSize.y, z: scaledSize.z }
          });
          
          // Calculate floor offset from SCALED bounding box
          const floorOffset = -scaledBoundingBox.min.y;
          const maxReasonableOffset = 5.0;
          const clampedFloorOffset = Math.min(Math.abs(floorOffset), maxReasonableOffset) * Math.sign(floorOffset);
          
          // Store floor offset for placement
          modelEntity.dataset.floorOffset = clampedFloorOffset;
          
          this.logger.info('MODEL_PIVOT', 'Floor offset calculated', {
            scaledBoundingBoxMinY: scaledBoundingBox.min.y,
            clampedFloorOffset: clampedFloorOffset
          });
        }
      }
      
      // IMPORTANT: Mark entity as ready in cache
      const cachedEntry = this.modelEntityCache.get(config.id);
      if (cachedEntry) {
        cachedEntry.isReady = true;
        this.logger.info('MODEL_CACHE', 'Model cached and ready for instant switching', { 
          modelId: config.id,
          cacheSize: this.modelEntityCache.size
        });
      }
      
      this.logger.logModelLoaded(config.name || 'Unknown');
      
      // Show success toast
      this.uiController.showToast(`${config.name} loaded successfully`, 'success', { title: 'Model Ready' });
      
      // Check for pending switch-in-place intent
      if (this.pendingSwitchInPlace && this.pendingSwitchInPlace.modelId === config.id) {
        // SWITCH IN PLACE: Place the new model at the stored hit position
        const floorOffset = parseFloat(modelEntity.dataset.floorOffset) || 0;
        const hitPos = this.pendingSwitchInPlace.hitPosition;
        const adjustedY = hitPos.y + floorOffset;
        const posString = `${hitPos.x} ${adjustedY} ${hitPos.z}`;
        
        modelEntity.setAttribute('position', posString);
        modelEntity.setAttribute('visible', 'true');
        this.modelIsPlaced = true;
        
        // Keep reticle and placement disabled (model is already placed)
        this.arSession.setReticleEnabled(false);
        this.arSession.setPlacementEnabled(false);
        
        // Attach gesture handler
        this.gestureHandler.attachToModel(modelEntity);
        
        this.uiController.showSuccessInstructions('Pinch to scale, drag to rotate', 4000);
        
        this.logger.info('MODEL_SWITCH', 'Non-cached model placed in place', {
          position: posString,
          floorOffset: floorOffset
        });
        
        // Clear pending intent
        this.pendingSwitchInPlace = null;
      } else {
        // Normal flow: enable reticle and placement now that model is ready
        // Use suppression to prevent any lingering tap from triggering placement
        this.arSession.suppressPlacement(300);
        this.arSession.setReticleEnabled(true);
        this.arSession.setPlacementEnabled(true);
        
        // Show appropriate instruction based on surface detection
        if (this.surfaceDetected) {
          this.uiController.showSurfaceDetectedInstructions();
        } else {
          this.uiController.showInstructions('Move your phone slowly to scan the floor', {
            duration: 0,
            icon: 'scan',
            state: 'scanning'
          });
        }
      }
    });
    
    // Listen for model error
    modelEntity.addEventListener('model-error', (e) => {
      this.uiController.removeModelLoadingIndicator(loadingIndicator);
      this.logger.error('MODEL_LOAD', 'A-Frame model parsing error', { 
        error: e.detail?.message || e.detail || 'Unknown error',
        url: url
      });
      
      // Remove failed model from cache
      this.modelEntityCache.delete(config.id);
      
      this.uiController.showToast('Model file may be corrupted', 'error', { title: 'Loading Error' });
      this.uiController.hideInstructions();
    });
  }

  async onPlaceModel(position) {
    this.logger.logModelPlacement(position);
    
    // Placement is now controlled by ARSession.placementEnabled
    // This function is only called when placement is allowed
    
    // Check if model exists
    if (!this.currentModel) {
      this.uiController.showToast('Please select a model from the gallery', 'info');
      return;
    }
    
    // Mesh-ready guard - prevent placement before model-loaded fires
    const mesh = this.currentModel.getObject3D('mesh');
    if (!mesh) {
      this.logger.warning('MODEL_PLACE', 'Model mesh not ready yet, waiting for load');
      this.uiController.showToast('Model still loading...', 'info');
      return;
    }
    
    // Get floor offset calculated during model-loaded
    const floorOffset = parseFloat(this.currentModel.dataset.floorOffset) || 0;
    
    // Apply floor offset to Y position so model sits on the detected surface
    const adjustedY = position.y + floorOffset;
    const posString = `${position.x} ${adjustedY} ${position.z}`;
    
    this.currentModel.setAttribute('position', posString);
    this.currentModel.setAttribute('visible', 'true');
    this.modelIsPlaced = true;  // Mark as placed
    
    // Store raw hit position for "switch in place" functionality
    // This allows switching models while keeping them at the same surface position
    this.lastPlacedHitPosition = { x: position.x, y: position.y, z: position.z };
    
    // CRITICAL: Disable reticle and placement after model is placed
    // This prevents multiple placements and hides the reticle
    this.arSession.setReticleEnabled(false);
    this.arSession.setPlacementEnabled(false);
    
    // Exit repositioning mode if we were in it
    if (this.isRepositioning) {
      this.isRepositioning = false;
      this.logger.info('MODEL_PLACE', 'Exiting repositioning mode');
    }
    
    // Attach gesture handler AFTER placement (not during model-loaded)
    this.gestureHandler.attachToModel(this.currentModel);
    
    // Use Three.js XR camera (not A-Frame entity) for accurate position
    const cameraWorldPos = new THREE.Vector3();
    if (this.arSession.scene.camera) {
      this.arSession.scene.camera.getWorldPosition(cameraWorldPos);
    }
    
    // Fix 5: Capture stable reference before RAF to prevent race condition if model cleared
    const placedModel = this.currentModel;
    
    // Defer bounding box calculation to next frame after A-Frame applies attributes
    requestAnimationFrame(() => {
      // Guard against model being cleared before RAF executes
      if (!this.currentModel || this.currentModel !== placedModel) return;
      
      // Get model's current scale and compute final world-space bounds
      const modelScale = placedModel.getAttribute('scale');
      const rafMesh = placedModel.getObject3D('mesh');
      let worldBounds = null;
      if (rafMesh) {
        const worldBox = new THREE.Box3().setFromObject(rafMesh);
        const worldSize = new THREE.Vector3();
        worldBox.getSize(worldSize);
        worldBounds = {
          min: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
          max: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
          size: { x: worldSize.x, y: worldSize.y, z: worldSize.z }
        };
      }
      
      // Detailed origin logging
      this.logger.info('COORDINATE_ORIGINS', 'Model placement coordinate details', {
        localReferenceSpaceOrigin: {
          description: 'Origin of WebXR local reference space (session start position)',
          position: { x: 0, y: 0, z: 0 },
          note: 'All coordinates are relative to this origin'
        },
        hitTestPosition: {
          description: 'Hit-test detected surface position in local reference space',
          raw: { x: position.x, y: position.y, z: position.z },
          units: 'meters'
        },
        modelPlacement: {
          description: 'Final model position after floor offset adjustment',
          rawHitY: position.y,
          floorOffset: floorOffset,
          adjustedPosition: { x: position.x, y: adjustedY, z: position.z },
          units: 'meters'
        },
        modelScale: {
          description: 'Applied scale factor (converts model units to meters)',
          scale: modelScale ? { x: modelScale.x, y: modelScale.y, z: modelScale.z } : 'unknown'
        },
        modelWorldBounds: {
          description: 'Model bounding box in world space after placement',
          bounds: worldBounds
        },
        cameraPosition: {
          description: 'Camera position in local reference space at time of placement',
          position: { x: cameraWorldPos.x, y: cameraWorldPos.y, z: cameraWorldPos.z },
          units: 'meters'
        },
        distanceFromCamera: {
          description: 'Distance from camera to model placement point',
          distance: Math.sqrt(
            Math.pow(position.x - cameraWorldPos.x, 2) +
            Math.pow(adjustedY - cameraWorldPos.y, 2) +
            Math.pow(position.z - cameraWorldPos.z, 2)
          ),
          units: 'meters'
        }
      });
    });  // End of requestAnimationFrame
    
    this.logger.event('MODEL_PLACE', 'Model position updated with floor offset', {
      hitPosition: position,
      floorOffset: floorOffset,
      finalPosition: { x: position.x, y: adjustedY, z: position.z }
    });
    
    this.uiController.showSuccessInstructions('Pinch to scale, drag to rotate', 4000);
  }

  setupLayerControls(layers) {
    const layerToggles = document.getElementById('layer-toggles');
    const layerButtons = document.getElementById('layer-buttons');
    
    // Clear existing buttons
    layerButtons.innerHTML = '';
    
    // Create toggle buttons for each layer
    layers.forEach(layer => {
      const button = document.createElement('button');
      button.className = 'layer-btn active';
      button.textContent = layer.name;
      button.dataset.layerName = layer.node;
      button.dataset.active = 'true';
      
      button.addEventListener('click', () => {
        const isActive = button.dataset.active === 'true';
        button.dataset.active = !isActive;
        button.classList.toggle('active');
        this.toggleLayer(layer.node, !isActive);
      });
      
      layerButtons.appendChild(button);
    });
    
    layerToggles.classList.remove('hidden');
  }

  toggleLayer(nodeName, visible) {
    if (!this.currentModel) return;
    
    const model = this.currentModel.getObject3D('mesh');
    if (!model) return;
    
    // Find and toggle the named node
    model.traverse((child) => {
      if (child.name === nodeName) {
        child.visible = visible;
        console.log(`Layer ${nodeName} visibility: ${visible}`);
      }
    });
  }

  /**
   * Clear/hide current model
   * With caching: model is hidden but kept in DOM for instant switching
   * @param {boolean} isModelSwitch - True if clearing for a model switch (suppress UI feedback)
   * @param {boolean} removeFromCache - True to fully remove from cache and DOM (memory cleanup)
   */
  clearModel(isModelSwitch = false, removeFromCache = false) {
    if (this.currentModel) {
      this.logger.event('USER_ACTION', isModelSwitch ? 'Model switch - hiding old model' : 'Clear model requested');
      
      // Detach gesture handlers
      this.gestureHandler?.detach();
      
      if (removeFromCache) {
        // Full removal: remove from DOM and cache
        this.currentModel.parentNode.removeChild(this.currentModel);
        if (this.activeModelId) {
          this.modelEntityCache.delete(this.activeModelId);
          this.logger.info('MODEL_CACHE', 'Model removed from cache', { modelId: this.activeModelId });
        }
      } else {
        // Caching: just hide the model (keep in DOM for instant switching)
        this.currentModel.setAttribute('visible', 'false');
      }
      
      this.currentModel = null;
      this.activeModelId = null;
      
      // Always reset placement state
      this.modelIsPlaced = false;
      
      // Hide layer controls
      document.getElementById('layer-toggles').classList.add('hidden');
      
      this.logger.info('MODEL', removeFromCache ? 'Model removed' : 'Model hidden (cached)');
      
      // Only show toast and reset UI if not switching models
      if (!isModelSwitch) {
        this.uiController.showToast('Model cleared', 'info');
        
        // Re-enable reticle and placement
        // Use suppression to prevent any UI tap from triggering placement
        this.arSession.suppressPlacement(300);
        this.arSession.setReticleEnabled(true);
        this.arSession.setPlacementEnabled(true);
        
        // Reset to scanning state
        if (this.surfaceDetected) {
          this.uiController.showSurfaceDetectedInstructions();
        } else {
          this.uiController.showInstructions('Move your phone slowly to scan the floor', {
            duration: 0,
            icon: 'scan',
            state: 'scanning'
          });
        }
      }
    }
  }

  /**
   * Reposition mode: Hide model, show reticle, allow user to tap to re-place
   * The same model will appear at the new reticle position when tapped
   */
  reloadModel() {
    // Guard: only allow if we have a placed model and not already loading/repositioning
    if (!this.currentModel || !this.modelIsPlaced) {
      this.logger.info('USER_ACTION', 'Reload ignored - no placed model');
      return;
    }
    
    if (this.isModelLoading) {
      this.logger.info('USER_ACTION', 'Reload ignored - model loading');
      return;
    }
    
    if (this.isRepositioning) {
      this.logger.info('USER_ACTION', 'Reload ignored - already repositioning');
      return;
    }
    
    this.logger.event('USER_ACTION', 'Entering reposition mode');
    
    // Enter repositioning mode
    this.isRepositioning = true;
    this.modelIsPlaced = false;
    
    // Detach gesture handler so hidden model doesn't eat touch events
    this.gestureHandler?.detach();
    
    // Hide the model (but keep it in DOM for re-placement)
    this.currentModel.setAttribute('visible', 'false');
    
    // Enable reticle and placement so user can tap to re-place
    // Use suppression to prevent the reposition button tap from triggering placement
    this.arSession.suppressPlacement(300);
    this.arSession.setReticleEnabled(true);
    this.arSession.setPlacementEnabled(true);
    
    // Update instructions
    if (this.surfaceDetected) {
      this.uiController.showSurfaceDetectedInstructions();
    } else {
      this.uiController.showInstructions('Move your phone slowly to scan the floor', {
        duration: 0,
        icon: 'scan',
        state: 'scanning'
      });
    }
    
    this.uiController.showToast('Tap the reticle to reposition', 'info');
    this.logger.info('MODEL', 'Model hidden - awaiting reposition tap');
  }

  /**
   * Auto-load the first model from the gallery
   */
  autoLoadFirstModel() {
    if (CONFIG.models && CONFIG.models.length > 0) {
      const firstModel = CONFIG.models[0];
      this.logger.info('MODEL', 'Auto-loading first model', { modelId: firstModel.id, modelName: firstModel.name });
      this.onModelSelect(firstModel);
    } else {
      this.logger.warning('MODEL', 'No models available for auto-loading');
    }
  }

  // Public method for unsupported browsers to try anyway
  async tryAnyway() {
    this.uiController.hideUnsupportedScreen();
    
    // Initialize AR session if not already done
    if (!this.arSession) {
      try {
        this.uiController.updateLoadingText('Setting up AR session...');
        await this.waitForAFrame();
        
        this.arSession = new ARSession(
          this.onPlaceModel.bind(this),
          this.onSessionStarted.bind(this),
          this.onSessionEnded.bind(this)
        );
        
        this.gestureHandler = new GestureHandler();
        this.setupEventHandlers();
      } catch (error) {
        console.error('Failed to initialize AR session:', error);
        this.uiController.updateLoadingText(`Error: ${error.message}`);
        return;
      }
    }
    
    this.startARSession();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.arApp = new WebARApp();
  window.arApp.init();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.arApp?.arSession) {
    window.arApp.arSession.pause();
  } else if (!document.hidden && window.arApp?.arSession) {
    window.arApp.arSession.resume();
  }
});
