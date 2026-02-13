/**
 * Application Configuration
 * Central configuration for models, server endpoints, and app settings
 * 
 * Supports two modes:
 * 1. Backend API mode: fetches config from /api/config at runtime
 * 2. Fallback mode: uses hardcoded defaults when API is unavailable
 */

// Default rendering images used when a model has no per-model rendering images
// Empty by default — backend config should always provide per-model rendering images
const DEFAULT_RENDERING_IMAGES = [];

// Hardcoded fallback config (used when backend API is unreachable)
const FALLBACK_CONFIG = {
  // Server configuration
  server: {
    // Model server URL - will be updated for production
    modelBaseUrl: '/uploads/models/',
    // Enable CORS
    cors: true,
    // Request timeout in ms
    timeout: 30000
  },
  
  // Model configurations — always fetched from backend via /api/config
  // Empty fallback: no models available when backend is unreachable
  models: [],
  
  // AR Configuration
  ar: {
    // Hit test settings
    hitTest: {
      type: 'horizontal',
      maxDistance: 10,
      minConfidence: 0.5
    },
    // Anchor settings
    anchor: {
      persistent: true
    },
    // Light estimation
    lightEstimation: true
  },
  
  // UI Configuration
  ui: {
    // Show debug info in development
    showDebug: false,
    // Instruction display time in ms
    instructionTimeout: 5000,
    // Loading screen minimum display time
    minLoadingTime: 1000
  },
  
  // Gesture Configuration
  gestures: {
    // Rotation settings
    rotation: {
      enabled: true,
      speed: 0.5,
      axis: 'y' // Rotate around Y axis only
    },
    // Scale settings
    scale: {
      enabled: true,
      minFactor: 1,   // 
      maxFactor: 10.0,    // Can grow to 5x normalized base size
      speed: 1.0  // Direct 1:1 pinch-to-scale ratio for responsive feel
    },
    // Pinch-rotate settings (two-finger twist)
    pinchRotate: {
      enabled: true,
      speed: 1.0
    }
  },
  
  // Performance settings
  performance: {
    // Max file size in MB
    maxModelSize: 100,
    // Recommended file size in MB
    recommendedModelSize: 20,
    // Texture resolution limit
    maxTextureSize: 2048,
    // Shadow settings
    shadows: true,
    // Anti-aliasing
    antialias: true
  }
};

// Cached config instance (populated by loadConfig)
let _configCache = null;

/**
 * Ensure every model in the config has a valid renderingImages array.
 * Falls back to DEFAULT_RENDERING_IMAGES if missing or incomplete.
 */
function normalizeModels(config) {
  if (config && Array.isArray(config.models)) {
    config.models = config.models.map(model => ({
      ...model,
      renderingImages: Array.isArray(model.renderingImages)
        ? model.renderingImages
        : DEFAULT_RENDERING_IMAGES
    }));
  }
  return config;
}

/**
 * Load configuration from backend API with fallback to hardcoded defaults.
 * Caches the result for subsequent calls.
 * @returns {Promise<object>} The application config
 */
export async function loadConfig() {
  if (_configCache) return _configCache;
  
  try {
    const response = await fetch('/api/config', {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const apiConfig = await response.json();
    // Merge with fallback so missing sections have safe defaults
    _configCache = normalizeModels(mergeConfig(FALLBACK_CONFIG, apiConfig));
    console.log('[CONFIG] Loaded from backend API');
    return _configCache;
  } catch (e) {
    console.warn('[CONFIG] Backend API unavailable, using fallback config:', e.message);
    _configCache = normalizeModels({ ...FALLBACK_CONFIG });
    return _configCache;
  }
}

/**
 * Re-fetch configuration from backend, bypassing cache.
 * Used by the refresh button to pick up model/image changes.
 * @returns {Promise<object>} The refreshed config
 */
export async function refreshConfig() {
  try {
    const response = await fetch('/api/config', {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const apiConfig = await response.json();
    const oldCache = _configCache;
    _configCache = normalizeModels(mergeConfig(FALLBACK_CONFIG, apiConfig));
    console.log('[CONFIG] Refreshed from backend API');
    return { config: _configCache, previousConfig: oldCache };
  } catch (e) {
    console.warn('[CONFIG] Failed to refresh config:', e.message);
    throw e;
  }
}

/**
 * Get the current config synchronously.
 * Returns cached config if loadConfig() was called, otherwise returns fallback.
 * @returns {object} The application config
 */
export function getConfig() {
  return _configCache || normalizeModels({ ...FALLBACK_CONFIG });
}

/**
 * Shallow-merge backend config over fallback defaults.
 * Ensures every top-level section (server, ar, ui, gestures, performance)
 * exists even if the backend omits it.
 */
function mergeConfig(fallback, apiResponse) {
  return {
    ...fallback,
    ...apiResponse,
    // Deep-merge server so individual keys aren't lost
    server: { ...fallback.server, ...(apiResponse.server || {}) }
  };
}

// Export defaults for use by other modules
export { DEFAULT_RENDERING_IMAGES };
