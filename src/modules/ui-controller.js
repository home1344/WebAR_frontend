/**
 * UI Controller
 * Manages all UI elements and user feedback
 */

export class UIController {
  constructor() {
    this.loadingScreen = document.getElementById('loading-screen');
    this.unsupportedScreen = document.getElementById('unsupported-screen');
    this.arScene = document.getElementById('ar-scene');
    this.uiOverlay = document.getElementById('ui-overlay');
    this.instructions = document.getElementById('instructions');
    this.progressFill = document.getElementById('progress-fill');
    this.progressText = document.getElementById('progress-text');
    this.loadingText = document.getElementById('loading-text');
    this.startArBtn = document.getElementById('start-ar-btn');
    this.loadingState = document.getElementById('loading-state');
    this.toastContainer = document.getElementById('toast-container');
    this.surfaceStatus = document.getElementById('surface-status');
    
    this.instructionTimeout = null;
    this.currentInstructionState = null; // Track current instruction state
  }

  /**
   * Show loading screen
   */
  showLoadingScreen() {
    this.loadingScreen.classList.add('visible');
    this.loadingScreen.classList.remove('hidden');
  }

  /**
   * Hide loading screen
   */
  hideLoadingScreen() {
    this.loadingScreen.classList.remove('visible');
    setTimeout(() => {
      this.loadingScreen.classList.add('hidden');
    }, 300);
  }

  /**
   * Hide Start AR button
   */
  hideStartButton() {
    if (this.startArBtn) {
      this.startArBtn.classList.add('hidden');
    }
  }

  /**
   * Show Start AR button
   */
  showStartButton() {
    if (this.startArBtn) {
      this.startArBtn.classList.remove('hidden');
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    if (this.loadingState) {
      this.loadingState.classList.remove('hidden');
    }
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    if (this.loadingState) {
      this.loadingState.classList.add('hidden');
    }
  }

  /**
   * Update loading text
   */
  updateLoadingText(text) {
    if (this.loadingText) {
      this.loadingText.textContent = text;
    }
  }

  /**
   * Update loading progress
   */
  updateProgress(percent) {
    const clampedPercent = Math.min(100, Math.max(0, percent));
    
    if (this.progressFill) {
      this.progressFill.style.width = `${clampedPercent}%`;
    }
    
    if (this.progressText) {
      this.progressText.textContent = `${Math.round(clampedPercent)}%`;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.updateLoadingText(message);
    this.hideLoadingState();
    this.showStartButton();
  }

  /**
   * Show unsupported screen
   */
  showUnsupportedScreen() {
    this.unsupportedScreen.classList.add('visible');
    this.unsupportedScreen.classList.remove('hidden');
    this.hideLoadingScreen();
  }

  /**
   * Hide unsupported screen
   */
  hideUnsupportedScreen() {
    this.unsupportedScreen.classList.remove('visible');
    this.unsupportedScreen.classList.add('hidden');
  }

  /**
   * Show AR UI
   */
  showARUI() {
    this.arScene.classList.remove('hidden');
    this.uiOverlay.classList.remove('hidden');
    
    // Show initial instructions (persistent until reticle appears)
    this.showInstructions('Point your device at the floor and move it around slowly', {
      duration: 0, // Persistent until surface detected
      icon: 'scan',
      state: 'scanning'
    });
  }

  /**
   * Update instructions for surface detected state
   */
  showSurfaceDetectedInstructions() {
    // Show "Tap to place your property" when surface is detected (reticle visible)
    this.showInstructions('Tap to place your property', {
      duration: 0, // Persistent until model is placed
      icon: 'tap',
      state: 'surface_detected'
    });
  }

  /**
   * Show loading instructions
   */
  showLoadingInstructions(modelName = 'model') {
    this.showInstructions(`Loading ${modelName}...`, {
      duration: 0,
      icon: 'loading',
      state: 'loading'
    });
  }

  /**
   * Show success instructions
   */
  showSuccessInstructions(message, duration = 10000) {
    this.showInstructions(message, {
      duration,
      icon: 'success',
      state: 'success'
    });
  }

  /**
   * Hide AR UI
   */
  hideARUI() {
    this.arScene.classList.add('hidden');
    this.uiOverlay.classList.add('hidden');
  }

  /**
   * Show instructions with optional auto-hide
   * @param {string} text - The instruction text
   * @param {object} options - Options for instruction display
   * @param {number} options.duration - Auto-hide duration in ms (0 = persistent)
   * @param {string} options.icon - Icon type: 'scan', 'tap', 'loading', 'success'
   * @param {string} options.state - State identifier to prevent duplicate updates
   */
  showInstructions(text, options = {}) {
    const { duration = 0, icon = 'scan', state = null } = options;
    
    // Prevent redundant updates for same state
    if (state && this.currentInstructionState === state) {
      return;
    }
    this.currentInstructionState = state;
    
    const instructionEl = this.instructions.querySelector('p');
    if (instructionEl) {
      instructionEl.textContent = text;
    }
    
    // Update icon based on type
    this.updateInstructionIcon(icon);
    
    this.instructions.classList.add('visible');
    
    // Clear existing timeout
    if (this.instructionTimeout) {
      clearTimeout(this.instructionTimeout);
      this.instructionTimeout = null;
    }
    
    // Auto-hide after duration (0 = stay visible)
    if (duration > 0) {
      this.instructionTimeout = setTimeout(() => {
        this.hideInstructions();
      }, duration);
    }
  }

  /**
   * Update instruction icon
   */
  updateInstructionIcon(iconType) {
    const iconContainer = this.instructions.querySelector('.instruction-icon');
    if (!iconContainer) return;
    
    const icons = {
      scan: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
      tap: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>',
      loading: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>',
      success: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
    };
    
    iconContainer.innerHTML = icons[iconType] || icons.scan;
  }

  /**
   * Hide instructions
   */
  hideInstructions() {
    this.instructions.classList.remove('visible');
    this.currentInstructionState = null;
    
    if (this.instructionTimeout) {
      clearTimeout(this.instructionTimeout);
      this.instructionTimeout = null;
    }
  }

  /**
   * Show modern toast message with icon
   * @param {string} message - Toast message
   * @param {string} type - Toast type: 'info', 'success', 'error', 'warning'
   * @param {object} options - Additional options
   * @param {string} options.title - Optional title
   * @param {number} options.duration - Display duration in ms
   */
  showToast(message, type = 'info', options = {}) {
    const { title = null, duration = 3500 } = options;
    
    // Get toast container or fallback to overlay
    const container = this.toastContainer || this.uiOverlay;
    
    // Icon SVGs for each type
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>'
    };
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Build toast content
    let toastHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
    `;
    
    if (title) {
      toastHTML += `<div class="toast-title">${title}</div>`;
    }
    toastHTML += `<div class="toast-message">${message}</div>`;
    toastHTML += '</div>';
    
    toast.innerHTML = toastHTML;
    
    // Add to container
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('visible');
      });
    });
    
    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 400);
    }, duration);
    
    return toast;
  }

  /**
   * Update model status
   */
  updateModelStatus(status) {
    const modelStatus = document.getElementById('model-status');
    if (modelStatus) {
      modelStatus.textContent = status;
    }
  }

  /**
   * Toggle debug info
   */
  toggleDebugInfo() {
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
      debugInfo.classList.toggle('hidden');
    }
  }

  /**
   * Show gallery
   */
  showGallery() {
    const gallery = document.getElementById('gallery-modal');
    if (gallery) {
      gallery.classList.remove('hidden');
      gallery.classList.add('visible');
    }
  }

  /**
   * Hide gallery
   */
  hideGallery() {
    const gallery = document.getElementById('gallery-modal');
    if (gallery) {
      gallery.classList.remove('visible');
      setTimeout(() => {
        gallery.classList.add('hidden');
      }, 300);
    }
  }

  /**
   * Update layer toggle visibility
   */
  updateLayerToggles(layers) {
    const layerToggles = document.getElementById('layer-toggles');
    const layerButtons = document.getElementById('layer-buttons');
    
    if (!layers || layers.length === 0) {
      layerToggles.classList.add('hidden');
      return;
    }
    
    layerToggles.classList.remove('hidden');
    
    // Clear existing buttons
    layerButtons.innerHTML = '';
    
    // Create buttons for each layer
    layers.forEach(layer => {
      const button = document.createElement('button');
      button.className = 'layer-btn';
      button.textContent = layer.name;
      button.dataset.node = layer.node;
      
      // Set initial state
      if (!layer.hidden) {
        button.classList.add('active');
      }
      
      layerButtons.appendChild(button);
    });
  }

  /**
   * Create loading indicator for model with cancel button
   * @param {Function} onCancel - Callback when cancel button is clicked
   */
  createModelLoadingIndicator(onCancel = null) {
    const indicator = document.createElement('div');
    indicator.className = 'model-loading-indicator';
    indicator.dataset.currentStage = '0';
    indicator.innerHTML = `
      <div class="loading-bg loading-bg-active" data-stage="0" style="background-image: url('/rendering/rendering00.png')"></div>
      <div class="loading-bg" data-stage="25" style="background-image: url('/rendering/rendering25.png')"></div>
      <div class="loading-bg" data-stage="50" style="background-image: url('/rendering/rendering50.png')"></div>
      <div class="loading-bg" data-stage="75" style="background-image: url('/rendering/rendering75.png')"></div>
      <button class="cancel-load-btn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="loading-bottom-content">
        <span class="progress-percent">0%</span>
        <div class="progress">
          <div class="progress-bar" style="width: 0%"></div>
        </div>
        <p>Loading model...</p>
        <div class="spinner"></div>
      </div>
    `;
    
    // Add cancel button handler if provided
    const cancelBtn = indicator.querySelector('.cancel-load-btn');
    if (cancelBtn && onCancel) {
      cancelBtn.addEventListener('click', onCancel);
    }
    
    this.uiOverlay.appendChild(indicator);
    return indicator;
  }

  /**
   * Update model loading progress
   */
  updateModelLoadingProgress(indicator, percent, receivedBytes = null) {
    const progressBar = indicator.querySelector('.progress-bar');
    const progressPercent = indicator.querySelector('.progress-percent');
    
    if (percent < 0) {
      // Indeterminate mode (no Content-Length header)
      if (progressBar) {
        progressBar.classList.add('indeterminate');
        progressBar.style.width = '100%';
      }
      if (progressPercent) {
        // Show downloaded size
        if (receivedBytes) {
          const sizeMB = (receivedBytes / (1024 * 1024)).toFixed(1);
          progressPercent.textContent = `${sizeMB} MB`;
        } else {
          progressPercent.textContent = 'Downloading...';
        }
      }
      
      // Cycle background images based on received bytes
      let newStage;
      if (!receivedBytes || receivedBytes < 500000) {
        newStage = '0';
      } else if (receivedBytes < 2000000) {
        newStage = '25';
      } else if (receivedBytes < 5000000) {
        newStage = '50';
      } else {
        newStage = '75';
      }
      
      if (indicator.dataset.currentStage !== newStage) {
        indicator.dataset.currentStage = newStage;
        const bgLayers = indicator.querySelectorAll('.loading-bg');
        bgLayers.forEach(layer => {
          if (layer.dataset.stage === newStage) {
            layer.classList.add('loading-bg-active');
          } else {
            layer.classList.remove('loading-bg-active');
          }
        });
      }
      return;
    }
    
    // Determinate mode (has Content-Length)
    if (progressBar) {
      progressBar.classList.remove('indeterminate');
      progressBar.style.width = `${percent}%`;
    }
    
    if (progressPercent) {
      progressPercent.textContent = `${Math.round(percent)}%`;
    }
    
    // Determine which background stage to show based on progress
    let newStage;
    if (percent < 25) {
      newStage = '0';
    } else if (percent < 50) {
      newStage = '25';
    } else if (percent < 75) {
      newStage = '50';
    } else {
      newStage = '75';
    }
    
    // Only update if stage changed (avoid redundant DOM updates)
    if (indicator.dataset.currentStage !== newStage) {
      indicator.dataset.currentStage = newStage;
      const bgLayers = indicator.querySelectorAll('.loading-bg');
      bgLayers.forEach(layer => {
        if (layer.dataset.stage === newStage) {
          layer.classList.add('loading-bg-active');
        } else {
          layer.classList.remove('loading-bg-active');
        }
      });
    }
  }

  /**
   * Remove model loading indicator
   */
  removeModelLoadingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
      indicator.classList.add('fade-out');
      setTimeout(() => {
        indicator.remove();
      }, 300);
    }
  }

  /**
   * Enable or disable UI controls during loading or other restricted states
   * @param {boolean} enabled - Whether controls should be enabled
   */
  setControlsEnabled(enabled) {
    const galleryBtn = document.getElementById('gallery-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const logBtn = document.getElementById('log-btn');
    const closeAppBtn = document.getElementById('close-app-btn');
    const surfaceStatus = this.surfaceStatus;
    const layerButtons = document.querySelectorAll('#layer-buttons button');

    // Hide/show buttons during loading
    if (galleryBtn) {
      galleryBtn.disabled = !enabled;
      galleryBtn.classList.toggle('loading-hidden', !enabled);
    }
    if (reloadBtn) {
      reloadBtn.disabled = !enabled;
      reloadBtn.classList.toggle('loading-hidden', !enabled);
    }
    if (logBtn) {
      logBtn.disabled = !enabled;
      logBtn.classList.toggle('loading-hidden', !enabled);
    }
    if (closeAppBtn) {
      closeAppBtn.classList.toggle('loading-hidden', !enabled);
    }
    if (surfaceStatus) {
      surfaceStatus.classList.toggle('loading-hidden', !enabled);
    }
    
    // Hide Layer button and close popup during loading
    const layerToggleBtn = document.getElementById('layer-toggle-btn');
    if (layerToggleBtn && !enabled) {
      layerToggleBtn.classList.add('hidden');
    }
    const layerPopup = document.getElementById('layer-toggles');
    if (layerPopup && !enabled) {
      layerPopup.classList.remove('visible');
      layerPopup.classList.add('hidden');
    }
    
    // Disable layer buttons
    layerButtons.forEach(btn => {
      btn.disabled = !enabled;
      btn.classList.toggle('disabled', !enabled);
    });
  }
}
