/**
 * Gallery Manager
 * Handles model selection UI and gallery interface
 */

export class Gallery {
  constructor(models, onSelectCallback, assetManager = null) {
    this.models = models;
    this.onSelect = onSelectCallback;
    this.assetManager = assetManager;
    this.enabled = true; // Controls whether gallery selection is allowed
    
    this.galleryModal = document.getElementById('gallery-modal');
    this.modelGrid = document.getElementById('model-grid');
    this.galleryBtn = document.getElementById('gallery-btn');
    this.closeBtn = document.getElementById('close-gallery');
    
    this.init();
  }

  init() {
    // Setup event listeners
    this.galleryBtn?.addEventListener('click', () => this.show());
    this.closeBtn?.addEventListener('click', () => this.hide());
    
    // Close on background click
    this.galleryModal?.addEventListener('click', (e) => {
      if (e.target === this.galleryModal) {
        this.hide();
      }
    });
    
    // Build gallery grid
    this.buildGallery();
  }

  /**
   * Build the gallery grid with model cards
   */
  buildGallery() {
    if (!this.modelGrid) return;
    
    // Clear existing content
    this.modelGrid.innerHTML = '';
    
    // Create model cards
    this.models.forEach(model => {
      const card = this.createModelCard(model);
      this.modelGrid.appendChild(card);
    });
  }

  /**
   * Create a model card element
   */
  createModelCard(model) {
    const card = document.createElement('div');
    card.className = 'model-card';
    card.dataset.modelId = model.id;
    
    // Create thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'model-thumbnail';
    
    if (model.thumbnail) {
      const img = document.createElement('img');
      img.src = this.assetManager ? this.assetManager.getBlobUrl(model.thumbnail) : model.thumbnail;
      img.alt = model.name;
      img.onerror = () => {
        // Fallback to placeholder if image fails to load
        thumbnail.innerHTML = this.getPlaceholderIcon();
      };
      thumbnail.appendChild(img);
    } else {
      // Use placeholder icon
      thumbnail.innerHTML = this.getPlaceholderIcon();
    }
    
    // Create model name
    const name = document.createElement('div');
    name.className = 'model-name';
    name.textContent = model.name;
    
    // Create model info
    const info = document.createElement('div');
    info.className = 'model-info';
    
    if (model.layers && model.layers.length > 0) {
      const layerBadge = document.createElement('span');
      layerBadge.className = 'layer-badge';
      layerBadge.textContent = `${model.layers.length} layers`;
      info.appendChild(layerBadge);
    }
    
    // Assemble card
    card.appendChild(thumbnail);
    card.appendChild(name);
    if (info.children.length > 0) {
      card.appendChild(info);
    }
    
    // Add click handler
    card.addEventListener('click', () => {
      this.selectModel(model);
    });
    
    return card;
  }

  /**
   * Get placeholder icon SVG
   */
  getPlaceholderIcon() {
    return `
      <svg class="placeholder-icon" viewBox="0 0 100 100" fill="currentColor">
        <rect x="20" y="40" width="60" height="40" rx="2"/>
        <polygon points="30,40 50,25 70,40"/>
        <rect x="35" y="50" width="10" height="15"/>
        <rect x="55" y="50" width="10" height="15"/>
      </svg>
    `;
  }

  /**
   * Select a model
   */
  selectModel(model) {
    // If gallery is disabled (e.g., during loading), ignore selection
    if (!this.enabled) {
      console.log('Gallery: Selection ignored - gallery disabled');
      return;
    }
    
    console.log('Gallery: Model selected', model.name);
    
    // Mark as selected
    const cards = this.modelGrid.querySelectorAll('.model-card');
    cards.forEach(card => {
      if (card.dataset.modelId === model.id) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
    
    // Call selection callback
    if (this.onSelect) {
      this.onSelect(model);
    }
    
    // Close gallery after short delay
    setTimeout(() => {
      this.hide();
    }, 300);
  }

  /**
   * Show gallery
   */
  show() {
    if (this.galleryModal) {
      this.galleryModal.classList.remove('hidden');
      setTimeout(() => {
        this.galleryModal.classList.add('visible');
      }, 10);
    }
  }

  /**
   * Hide gallery
   */
  hide() {
    if (this.galleryModal) {
      this.galleryModal.classList.remove('visible');
      setTimeout(() => {
        this.galleryModal.classList.add('hidden');
      }, 300);
    }
  }

  /**
   * Update models list
   */
  updateModels(models, assetManager = null) {
    this.models = models;
    if (assetManager) this.assetManager = assetManager;
    this.buildGallery();
  }

  /**
   * Get current selected model ID
   */
  getSelectedModelId() {
    const selectedCard = this.modelGrid?.querySelector('.model-card.selected');
    return selectedCard?.dataset.modelId || null;
  }

  /**
   * Clear selection
   */
  clearSelection() {
    const cards = this.modelGrid?.querySelectorAll('.model-card');
    cards?.forEach(card => {
      card.classList.remove('selected');
    });
  }

  /**
   * Enable or disable gallery selection
   * @param {boolean} enabled - Whether gallery selection should be allowed
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    // Visually indicate disabled state on model cards
    const cards = this.modelGrid?.querySelectorAll('.model-card');
    cards?.forEach(card => {
      card.classList.toggle('disabled', !enabled);
    });
    
    console.log(`Gallery: ${enabled ? 'enabled' : 'disabled'}`);
  }
}
