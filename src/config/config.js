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
      id: 'house0',
      name: 'House 0',
      url: '/models/House0.gltf',
      thumbnail: '/thumbnails/preview0.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house1',
      name: 'House 1',
      url: '/models/House1.gltf',
      thumbnail: '/thumbnails/preview1.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house2',
      name: 'House 2',
      url: '/models/House2.gltf',
      thumbnail: '/thumbnails/preview2.png',
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
