/**
 * Gesture Handler
 * Manages touch gestures for model manipulation (rotate, scale)
 */

import { CONFIG } from '../config/config.js';

export class GestureHandler {
  constructor() {
    this.model = null;
    this.isRotating = false;
    this.isScaling = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.lastDistance = 0;
    this.initialScale = null;
    this.baseScale = 1;     // Normalized base scale for relative clamping
    this.lastAngle = null;  // For pinch-rotate
    
    // Gesture configuration
    this.config = CONFIG.gestures;
    
    // Bind methods
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
  }

  /**
   * Attach gesture handlers to a model
   */
  attachToModel(modelEntity) {
    if (this.model) {
      this.detach();
    }
    
    this.model = modelEntity;
    
    // Get initial scale
    const scale = this.model.getAttribute('scale');
    this.initialScale = {
      x: scale.x,
      y: scale.y,
      z: scale.z
    };
    
    // Store base scale for relative clamping (uniform, use x component)
    this.baseScale = scale.x;
    
    // Add touch event listeners
    document.addEventListener('touchstart', this.onTouchStart, { passive: false });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false });
    document.addEventListener('touchend', this.onTouchEnd);
    
    console.log('Gesture handler attached to model');
  }

  /**
   * Detach gesture handlers
   */
  detach() {
    document.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    
    this.model = null;
    this.isRotating = false;
    this.isScaling = false;
    
    console.log('Gesture handler detached');
  }

  /**
   * Handle touch start
   */
  onTouchStart(event) {
    if (!this.model) return;
    
    // Check if touching the UI overlay
    if (this.isTouchingUI(event.target)) {
      return;
    }
    
    event.preventDefault();
    
    const touches = event.touches;
    
    if (touches.length === 1) {
      // Single touch - start rotation
      if (this.config.rotation.enabled) {
        this.isRotating = true;
        this.lastTouchX = touches[0].clientX;
        this.lastTouchY = touches[0].clientY;
      }
    } else if (touches.length === 2) {
      // Two touches - start scaling and pinch-rotate
      this.isRotating = false;
      if (this.config.scale.enabled) {
        this.isScaling = true;
        this.lastDistance = this.getDistance(touches[0], touches[1]);
      }
      // Initialize angle for pinch-rotate
      if (this.config.pinchRotate?.enabled) {
        this.lastAngle = this.getAngle(touches[0], touches[1]);
      }
    }
  }

  /**
   * Handle touch move
   */
  onTouchMove(event) {
    if (!this.model) return;
    
    // Check if touching the UI overlay
    if (this.isTouchingUI(event.target)) {
      return;
    }
    
    event.preventDefault();
    
    const touches = event.touches;
    
    if (this.isRotating && touches.length === 1) {
      // Rotate model (single finger drag)
      this.handleRotation(touches[0]);
    } else if (touches.length === 2) {
      // Two finger gestures: scale and pinch-rotate
      if (this.isScaling) {
        this.handleScale(touches[0], touches[1]);
      }
      if (this.config.pinchRotate?.enabled) {
        this.handlePinchRotate(touches[0], touches[1]);
      }
    }
  }

  /**
   * Handle touch end
   */
  onTouchEnd(event) {
    if (!this.model) return;
    
    const touches = event.touches;
    
    if (touches.length === 0) {
      // All touches ended
      this.isRotating = false;
      this.isScaling = false;
    } else if (touches.length === 1) {
      // One touch remaining - switch to rotation
      if (this.config.rotation.enabled) {
        this.isScaling = false;
        this.isRotating = true;
        this.lastTouchX = touches[0].clientX;
        this.lastTouchY = touches[0].clientY;
      }
      // Reset pinch-rotate angle
      this.lastAngle = null;
    }
  }

  /**
   * Handle rotation gesture
   */
  handleRotation(touch) {
    const deltaX = touch.clientX - this.lastTouchX;
    const deltaY = touch.clientY - this.lastTouchY;
    
    // Get current rotation
    const rotation = this.model.getAttribute('rotation');
    
    // Apply rotation based on configured axis
    const rotationSpeed = this.config.rotation.speed;
    
    if (this.config.rotation.axis === 'y') {
      // Rotate around Y axis only
      rotation.y -= deltaX * rotationSpeed;
    } else if (this.config.rotation.axis === 'xy') {
      // Rotate around both X and Y
      rotation.y -= deltaX * rotationSpeed;
      rotation.x += deltaY * rotationSpeed;
    }
    
    // Apply rotation
    this.model.setAttribute('rotation', rotation);
    
    // Update last position
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
  }

  /**
   * Handle scale gesture (responsive pinch-to-scale)
   */
  handleScale(touch1, touch2) {
    const distance = this.getDistance(touch1, touch2);
    
    if (this.lastDistance === 0) {
      this.lastDistance = distance;
      return;
    }
    
    // Calculate scale factor - direct ratio for responsive feel
    const rawScaleFactor = distance / this.lastDistance;
    const scaleSpeed = this.config.scale.speed;
    
    // Apply scale directly (scaleSpeed = 1.0 means 1:1 pinch ratio)
    const scaleFactor = 1 + (rawScaleFactor - 1) * scaleSpeed;
    
    // Get current scale
    const scale = this.model.getAttribute('scale');
    
    // Apply uniform scale
    const newScale = {
      x: scale.x * scaleFactor,
      y: scale.y * scaleFactor,
      z: scale.z * scaleFactor
    };
    
    // Clamp scale relative to base scale (consistent feel across all models)
    const minScale = this.baseScale * (this.config.scale.minFactor || 0.2);
    const maxScale = this.baseScale * (this.config.scale.maxFactor || 5.0);
    
    newScale.x = Math.max(minScale, Math.min(maxScale, newScale.x));
    newScale.y = Math.max(minScale, Math.min(maxScale, newScale.y));
    newScale.z = Math.max(minScale, Math.min(maxScale, newScale.z));
    
    // Apply new scale
    this.model.setAttribute('scale', newScale);
    
    // Update last distance
    this.lastDistance = distance;
  }

  /**
   * Handle pinch-rotate gesture (two-finger twist)
   */
  handlePinchRotate(touch1, touch2) {
    const currentAngle = this.getAngle(touch1, touch2);
    
    if (this.lastAngle === null) {
      this.lastAngle = currentAngle;
      return;
    }
    
    // Calculate angle delta
    let deltaAngle = currentAngle - this.lastAngle;
    
    // Handle angle wrap-around
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    
    // Apply rotation around Y axis
    const rotationSpeed = this.config.pinchRotate?.speed || 1.0;
    const rotation = this.model.getAttribute('rotation');
    rotation.y -= deltaAngle * rotationSpeed;
    
    this.model.setAttribute('rotation', rotation);
    this.lastAngle = currentAngle;
  }

  /**
   * Calculate angle between two touch points (in degrees)
   */
  getAngle(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  /**
   * Calculate distance between two touch points
   */
  getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if touching UI element
   */
  isTouchingUI(target) {
    // Check if target or its parents are UI elements
    let element = target;
    while (element) {
      if (element.classList && (
        element.classList.contains('ui-btn') ||
        element.classList.contains('gallery-modal') ||
        element.classList.contains('controls-panel') ||
        element.classList.contains('layer-popup-overlay') ||
        element.classList.contains('layer-popup') ||
        element.classList.contains('layer-btn') ||
        element.classList.contains('ar-logo') ||
        element.classList.contains('close-app-btn') ||
        element.id === 'ui-overlay' ||
        element.id === 'ar-logo'
      )) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  }

  /**
   * Reset model to initial scale
   */
  resetScale() {
    if (this.model && this.initialScale) {
      this.model.setAttribute('scale', this.initialScale);
    }
  }

  /**
   * Reset model rotation
   */
  resetRotation() {
    if (this.model) {
      this.model.setAttribute('rotation', '0 0 0');
    }
  }
}
