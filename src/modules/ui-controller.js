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
    
    this.instructionTimeout = null;
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
    
    // Show initial instructions
    this.showInstructions('Scan the floor to detect a surface');
  }

  /**
   * Hide AR UI
   */
  hideARUI() {
    this.arScene.classList.add('hidden');
    this.uiOverlay.classList.add('hidden');
  }

  /**
   * Show instructions with auto-hide
   */
  showInstructions(text, duration = 5000) {
    const instructionEl = this.instructions.querySelector('p');
    if (instructionEl) {
      instructionEl.textContent = text;
    }
    
    this.instructions.classList.add('visible');
    
    // Clear existing timeout
    if (this.instructionTimeout) {
      clearTimeout(this.instructionTimeout);
    }
    
    // Auto-hide after duration
    if (duration > 0) {
      this.instructionTimeout = setTimeout(() => {
        this.hideInstructions();
      }, duration);
    }
  }

  /**
   * Hide instructions
   */
  hideInstructions() {
    this.instructions.classList.remove('visible');
    
    if (this.instructionTimeout) {
      clearTimeout(this.instructionTimeout);
      this.instructionTimeout = null;
    }
  }

  /**
   * Show toast message
   */
  showToast(message, type = 'info', duration = 3000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to overlay
    this.uiOverlay.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
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
   * Create loading indicator for model
   */
  createModelLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'model-loading-indicator';
    indicator.innerHTML = `
      <div class="spinner"></div>
      <p>Loading model...</p>
      <div class="progress">
        <div class="progress-bar" style="width: 0%"></div>
      </div>
      <span class="progress-percent">0%</span>
    `;
    
    this.uiOverlay.appendChild(indicator);
    return indicator;
  }

  /**
   * Update model loading progress
   */
  updateModelLoadingProgress(indicator, percent) {
    const progressBar = indicator.querySelector('.progress-bar');
    const progressPercent = indicator.querySelector('.progress-percent');
    
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    
    if (progressPercent) {
      progressPercent.textContent = `${Math.round(percent)}%`;
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
}
