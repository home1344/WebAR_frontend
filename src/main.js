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
  }

  async init() {
    try {
      console.log('WebAR App: Initializing...');
      
      // Initialize UI controller first
      this.uiController = new UIController();
      
      // Check WebXR support
      if (!await this.checkWebXRSupport()) {
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
      console.log('WebAR App: Initialization complete - waiting for user to start AR');
      
    } catch (error) {
      console.error('WebAR App: Initialization failed', error);
      this.uiController.showError(`Error: ${error.message}`);
    }
  }

  setupStartButton() {
    const startBtn = document.getElementById('start-ar-btn');
    if (startBtn) {
      startBtn.addEventListener('click', async () => {
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
      if (!window.isSecureContext) {
        this.uiController.showError('WebXR requires HTTPS (or localhost). Open the HTTPS URL and accept the certificate.');
        return;
      }

      this.uiController.updateLoadingText('Checking WebXR support...');
      this.uiController.updateProgress(20);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.uiController.updateLoadingText('Initializing AR session...');
      this.uiController.updateProgress(50);
      
      await this.arSession.start();
      
      this.uiController.updateLoadingText('Starting AR...');
      this.uiController.updateProgress(100);
      
    } catch (error) {
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
    console.log('AR Session started');
    this.uiController.hideLoadingScreen();
    this.uiController.showARUI();
    this.uiController.showInstructions('Scan the floor to detect a surface');
  }

  onSessionEnded() {
    console.log('AR Session ended');
    this.uiController.hideARUI();
    this.uiController.showLoadingScreen();
  }

  async onModelSelect(modelConfig) {
    console.log('Model selected:', modelConfig.name);
    this.gallery.hide();
    
    if (this.currentModel) {
      this.clearModel();
    }
    
    // Load and place the selected model
    this.uiController.showInstructions('Loading model...');
    
    try {
      const modelUrl = modelConfig.url;
      await this.loadAndPlaceModel(modelUrl, modelConfig);
      
    } catch (error) {
      console.error('Failed to load model:', error);
      this.uiController.showInstructions('Failed to load model. Try another one.');
    }
  }

  async loadAndPlaceModel(url, config) {
    const container = document.getElementById('model-container');
    
    // Create model entity
    const modelEntity = document.createElement('a-entity');
    modelEntity.setAttribute('id', 'current-model');
    modelEntity.setAttribute('gltf-model', url);
    modelEntity.setAttribute('scale', config.defaultScale || '1 1 1');
    modelEntity.setAttribute('model-gestures', '');
    
    // Add to container at last hit position
    if (this.arSession.lastHitPosition) {
      modelEntity.setAttribute('position', this.arSession.lastHitPosition);
    }
    
    container.appendChild(modelEntity);
    this.currentModel = modelEntity;
    
    // Setup layer controls if model has layers
    if (config.layers && config.layers.length > 0) {
      this.setupLayerControls(config.layers);
    }
    
    // Listen for model loaded
    modelEntity.addEventListener('model-loaded', () => {
      console.log('Model loaded successfully');
      this.uiController.showInstructions('Model placed. Use gestures to rotate and scale.');
      
      // Apply gesture handler
      this.gestureHandler.attachToModel(modelEntity);
    });
    
    // Listen for model error
    modelEntity.addEventListener('model-error', (e) => {
      console.error('Model loading error:', e.detail);
      this.uiController.showInstructions('Error loading model');
    });
  }

  async onPlaceModel(position) {
    if (!this.currentModel && CONFIG.models.length > 0) {
      // Load first model by default
      const firstModel = CONFIG.models[0];
      await this.onModelSelect(firstModel);
    }
    
    // Update model position if already exists
    if (this.currentModel) {
      this.currentModel.setAttribute('position', position);
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
      this.currentModel.parentNode.removeChild(this.currentModel);
      this.currentModel = null;
      
      // Hide layer controls
      document.getElementById('layer-toggles').classList.add('hidden');
      
      this.uiController.showInstructions('Model cleared. Select a new model from the gallery.');
    }
  }

  reloadModel() {
    if (this.currentModel) {
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
      modelEntity.setAttribute('model-gestures', '');
      
      document.getElementById('model-container').appendChild(modelEntity);
      this.currentModel = modelEntity;
      
      this.gestureHandler.attachToModel(modelEntity);
      this.uiController.showInstructions('Model reloaded');
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
