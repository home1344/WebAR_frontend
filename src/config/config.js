/**
 * Application Configuration
 * Central configuration for models, server endpoints, and app settings
 */

export const CONFIG = {
  // Server configuration
  server: {
    // Model server URL - will be updated for production
    modelBaseUrl: '/models/',
    // Enable CORS
    cors: true,
    // Request timeout in ms
    timeout: 30000
  },
  
  // Model configurations - URLs must match actual filenames in public/models/
  models: [
    {
      id: 'house2',
      name: 'House 2',
      url: '/models/house_2.glb',
      thumbnail: null,
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    }
  ],
  
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
      min: 0.001,
      max: 100.0,
      speed: 0.01
    }
  },
  
  // Performance settings
  performance: {
    // Max file size in MB
    maxModelSize: 50,
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
