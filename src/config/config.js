/**
 * Application Configuration
 * Central configuration for models, server endpoints, and app settings
 * 
 * Supports two modes:
 * 1. Backend API mode: fetches config from /api/config at runtime
 * 2. Fallback mode: uses hardcoded defaults when API is unavailable
 *
 * In production, set VITE_API_BASE_URL to the backend origin
 * (e.g. https://api.ardemo.co.za) so API and asset requests reach
 * the correct server. During development, the Vite proxy handles this.
 */

// Backend origin — empty string in dev (Vite proxy), absolute URL in production
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// Default rendering images used when a model has no per-model rendering images
// Empty by default — backend config should always provide per-model rendering images
const DEFAULT_RENDERING_IMAGES = [];

// Hardcoded fallback config (used when backend API is unreachable)
const FALLBACK_CONFIG = {
  // Server configuration
  server: {
    // Model server URL — prefixed with API_BASE_URL so assets resolve to backend
    modelBaseUrl: `${API_BASE_URL}/uploads/models/`,
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
 * Prefix a path with API_BASE_URL when it is a server-relative path
 * (starts with /uploads, /defaults, or /api) and API_BASE_URL is set.
 * Already-absolute URLs (http/https) are returned as-is.
 */
function resolveAssetUrl(path) {
  if (!path || !API_BASE_URL) return path;
  if (/^https?:\/\//i.test(path)) return path;           // already absolute
  if (/^\/(uploads|defaults|api)\//i.test(path)) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

function normalizeModels(config) {
  if (config && Array.isArray(config.models)) {
    config.models = config.models.map(model => ({
      ...model,
      url: resolveAssetUrl(model.url),
      thumbnail: resolveAssetUrl(model.thumbnail),
      renderingImages: Array.isArray(model.renderingImages)
        ? model.renderingImages.map(resolveAssetUrl)
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
  
  const configUrl = `${API_BASE_URL}/api/config`;
  try {
    console.log(`[CONFIG] Fetching config from ${configUrl}`);
    const response = await fetch(configUrl, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON but received ${contentType}`);
    }
    const apiConfig = await response.json();
    // Merge with fallback so missing sections have safe defaults
    _configCache = normalizeModels(mergeConfig(FALLBACK_CONFIG, apiConfig));
    console.log('[CONFIG] Loaded from backend API');
    return _configCache;
  } catch (e) {
    console.warn(`[CONFIG] Backend API unavailable (${configUrl}), using fallback config:`, e.message);
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
  const configUrl = `${API_BASE_URL}/api/config`;
  try {
    console.log(`[CONFIG] Refreshing config from ${configUrl}`);
    const response = await fetch(configUrl, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON but received ${contentType}`);
    }
    const apiConfig = await response.json();
    const oldCache = _configCache;
    _configCache = normalizeModels(mergeConfig(FALLBACK_CONFIG, apiConfig));
    console.log('[CONFIG] Refreshed from backend API');
    return { config: _configCache, previousConfig: oldCache };
  } catch (e) {
    console.warn(`[CONFIG] Failed to refresh config (${configUrl}):`, e.message);
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

// Export defaults and helpers for use by other modules
export { DEFAULT_RENDERING_IMAGES, API_BASE_URL, resolveAssetUrl };
