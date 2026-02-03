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
      
      // Setup Start AR button
      this.setupStartButton();
      
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

  setupStartButton() {
    const startBtn = document.getElementById('start-ar-btn');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
        this.logger.event('USER_ACTION', 'Start AR button clicked');
        
        // Hide button and show loading state
        this.uiController.hideStartButton();
        this.uiController.showLoadingState();
        
        // Start AR session with user interaction
        await this.startARSession();
      });
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
    // Gallery button
    document.getElementById('gallery-btn').addEventListener('click', () => {
      this.gallery.show();
    });
    
    // Clear button
    document.getElementById('clear-btn').addEventListener('click', () => {
      this.clearModel();
    });
    
    // Reload button
    document.getElementById('reload-btn').addEventListener('click', () => {
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
            if (isDetected && !this.surfaceDetected) {
              this.surfaceDetected = true;
              this.onSurfaceDetected();
            } else if (!isDetected && this.surfaceDetected) {
              this.surfaceDetected = false;
              this.onSurfaceLost();
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
    const startTime = Date.now();
    this.logger.event('USER_ACTION', 'Model selected from gallery', { 
      modelName: modelConfig.name,
      modelId: modelConfig.id,
      url: modelConfig.url,
      timestamp: startTime
    });
    this.logger.logModelLoad(modelConfig.name, modelConfig.url);
    this.gallery.hide();
    
    if (this.currentModel) {
      this.clearModel();
    }
    
    // Show loading instructions with model name
    this.uiController.showLoadingInstructions(modelConfig.name);
    
    try {
      const modelUrl = modelConfig.url;
      await this.loadAndPlaceModel(modelUrl, modelConfig);
      
      const loadTime = Date.now() - startTime;
      this.logger.logModelLoaded(modelConfig.name, { loadTime });
      
    } catch (error) {
      this.logger.logModelError(modelConfig.name, error, {
        url: modelConfig.url,
        httpStatus: error.message.match(/HTTP (\d+)/)?.[1],
        loadTime: Date.now() - startTime
      });
      this.uiController.showToast('Failed to load model', 'error', { title: 'Error' });
      this.uiController.hideInstructions();
    }
  }

  async loadAndPlaceModel(url, config) {
    const container = document.getElementById('model-container');
    const startTime = Date.now();
    
    // Show loading indicator
    const loadingIndicator = this.uiController.createModelLoadingIndicator();
    this.logger.info('MODEL_LOAD', 'Starting model fetch', { 
      url,
      fullUrl: new URL(url, window.location.origin).href,
      modelName: config.name,
      modelId: config.id,
      timestamp: startTime
    });
    
    let modelUrl = url;
    
    try {
      // Use ModelLoader to fetch with progress tracking
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
    
    // Create model entity with the loaded object URL
    const modelEntity = document.createElement('a-entity');
    modelEntity.setAttribute('id', 'current-model');
    modelEntity.setAttribute('gltf-model', modelUrl);
    modelEntity.setAttribute('scale', config.defaultScale || '1 1 1');
    
    // Add to container at last hit position or wait for tap
    if (this.arSession.lastHitPosition) {
      const pos = this.arSession.lastHitPosition;
      modelEntity.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      this.logger.info('MODEL_PLACE', 'Placing at last hit position', this.arSession.lastHitPosition);
    } else {
      // Don't place model until we have a hit position
      this.logger.warning('MODEL_PLACE', 'No hit position available, waiting for surface detection');
      // Model will be placed when user taps on detected surface
    }
    
    container.appendChild(modelEntity);
    this.currentModel = modelEntity;
    
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
        // Compute bounding box in model's local coordinates (before any scene transforms)
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        const modelSize = new THREE.Vector3();
        boundingBox.getSize(modelSize);
        const modelCenter = new THREE.Vector3();
        boundingBox.getCenter(modelCenter);
        
        // Log raw model dimensions (in model's native units)
        this.logger.info('MODEL_BOUNDS', 'Raw model bounding box (native units)', {
          min: { x: boundingBox.min.x, y: boundingBox.min.y, z: boundingBox.min.z },
          max: { x: boundingBox.max.x, y: boundingBox.max.y, z: boundingBox.max.z },
          size: { x: modelSize.x, y: modelSize.y, z: modelSize.z },
          center: { x: modelCenter.x, y: modelCenter.y, z: modelCenter.z },
          note: 'If size >> 1, model was likely authored in cm/mm. If size << 1, model may be too small.'
        });
        
        // Fix 4: Normalize model scale to real-world meters
        // Target: largest dimension should be approximately targetSizeMeters
        const targetSizeMeters = config.targetSizeMeters || 0.5; // Default 0.5m (50cm) for preview
        const largestDimension = Math.max(modelSize.x, modelSize.y, modelSize.z);
        
        if (largestDimension > 0) {
          const scaleFactor = targetSizeMeters / largestDimension;
          
          // Apply uniform scale
          modelEntity.setAttribute('scale', `${scaleFactor} ${scaleFactor} ${scaleFactor}`);
          
          this.logger.info('MODEL_SCALE', 'Model scale normalized to real-world meters', {
            rawLargestDimension: largestDimension,
            targetSizeMeters: targetSizeMeters,
            appliedScaleFactor: scaleFactor,
            finalSizeMeters: {
              x: modelSize.x * scaleFactor,
              y: modelSize.y * scaleFactor,
              z: modelSize.z * scaleFactor
            }
          });
          
          // Fix 5: Adjust model Y position so its bottom sits on the floor plane
          // The floor plane is at the hit-test Y position
          // We need to offset the model up by (boundingBox.min.y * scaleFactor) to sit on floor
          const floorOffset = -boundingBox.min.y * scaleFactor;
          
          // Store floor offset for use when placing model
          modelEntity.dataset.floorOffset = floorOffset;
          
          this.logger.info('MODEL_PIVOT', 'Floor offset calculated', {
            boundingBoxMinY: boundingBox.min.y,
            scaleFactor: scaleFactor,
            floorOffsetMeters: floorOffset,
            note: 'Model will be raised by this amount to sit on detected surface'
          });
        }
      }
      
      this.logger.logModelLoaded(config.name || 'Unknown');
      
      // Show success toast
      this.uiController.showToast(`${config.name} loaded successfully`, 'success', { title: 'Model Ready' });
      
      if (this.arSession.lastHitPosition) {
        this.uiController.showSuccessInstructions('Pinch to scale, drag to rotate', 4000);
      } else {
        this.uiController.showSurfaceDetectedInstructions();
      }
      
      // Apply gesture handler
      this.gestureHandler.attachToModel(modelEntity);
    });
    
    // Listen for model error (A-Frame failed to parse glTF)
    modelEntity.addEventListener('model-error', (e) => {
      this.uiController.removeModelLoadingIndicator(loadingIndicator);
      this.logger.error('MODEL_LOAD', 'A-Frame model parsing error', { 
        error: e.detail?.message || e.detail || 'Unknown error',
        url: url
      });
      this.uiController.showToast('Model file may be corrupted', 'error', { title: 'Loading Error' });
      this.uiController.hideInstructions();
    });
  }

  async onPlaceModel(position) {
    this.logger.logModelPlacement(position);
    
    // Only place model if one has been selected from gallery
    if (this.currentModel) {
      // Get floor offset calculated during model-loaded (Fix 5)
      const floorOffset = parseFloat(this.currentModel.dataset.floorOffset) || 0;
      
      // Apply floor offset to Y position so model sits on the detected surface
      const adjustedY = position.y + floorOffset;
      const posString = `${position.x} ${adjustedY} ${position.z}`;
      
      this.currentModel.setAttribute('position', posString);
      this.currentModel.setAttribute('visible', 'true');
      
      // Get camera position for origin logging
      const camera = document.getElementById('camera');
      const cameraWorldPos = new THREE.Vector3();
      if (camera && camera.object3D) {
        camera.object3D.getWorldPosition(cameraWorldPos);
      }
      
      // Get model's current scale and compute final world-space bounds
      const modelScale = this.currentModel.getAttribute('scale');
      const mesh = this.currentModel.getObject3D('mesh');
      let worldBounds = null;
      if (mesh) {
        const worldBox = new THREE.Box3().setFromObject(mesh);
        const worldSize = new THREE.Vector3();
        worldBox.getSize(worldSize);
        worldBounds = {
          min: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
          max: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
          size: { x: worldSize.x, y: worldSize.y, z: worldSize.z }
        };
      }
      
      // Detailed origin logging as requested
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
      
      this.logger.event('MODEL_PLACE', 'Model position updated with floor offset', {
        hitPosition: position,
        floorOffset: floorOffset,
        finalPosition: { x: position.x, y: adjustedY, z: position.z }
      });
      
      this.uiController.showSuccessInstructions('Pinch to scale, drag to rotate', 4000);
    } else {
      // Prompt user to select a model from gallery
      this.uiController.showToast('Please select a model from the gallery', 'info');
      this.uiController.showToast('I am Danylo. This is my Telegram - @danylo_podolskyi. Please reach out to me.', 'danger');
    }
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

  clearModel() {
    if (this.currentModel) {
      this.logger.event('USER_ACTION', 'Clear model requested');
      this.currentModel.parentNode.removeChild(this.currentModel);
      this.currentModel = null;
      
      // Hide layer controls
      document.getElementById('layer-toggles').classList.add('hidden');
      
      this.logger.info('MODEL', 'Model cleared');
      this.uiController.showToast('Model cleared', 'info');
      
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

  reloadModel() {
    if (this.currentModel) {
      this.logger.event('USER_ACTION', 'Reload model requested');
      const modelUrl = this.currentModel.getAttribute('gltf-model');
      const position = this.currentModel.getAttribute('position');
      const scale = this.currentModel.getAttribute('scale');
      
      // Clear and reload
      this.clearModel();
      
      // Recreate model
      const modelEntity = document.createElement('a-entity');
      modelEntity.setAttribute('id', 'current-model');
      modelEntity.setAttribute('gltf-model', modelUrl);
      modelEntity.setAttribute('position', position);
      modelEntity.setAttribute('scale', scale);
      
      document.getElementById('model-container').appendChild(modelEntity);
      this.currentModel = modelEntity;
      
      this.gestureHandler.attachToModel(modelEntity);
      this.logger.info('MODEL', 'Model reloaded', { url: modelUrl });
      this.uiController.showToast('Model reloaded', 'success');
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
