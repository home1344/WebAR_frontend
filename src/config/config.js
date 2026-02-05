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
      url: '/models/House 0.gltf',
      thumbnail: '/thumbnails/house-0.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house1a',
      name: 'House 1A',
      url: '/models/House 1a.glb',
      thumbnail: '/thumbnails/house-1a.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house1b',
      name: 'House 1B',
      url: '/models/House 1b.glb',
      thumbnail: '/thumbnails/house-1b.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house1c',
      name: 'House 1C',
      url: '/models/House 1c.glb',
      thumbnail: '/thumbnails/house-1c.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house1d',
      name: 'House 1D',
      url: '/models/House 1d.glb',
      thumbnail: '/thumbnails/house-1d.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house2',
      name: 'House 2',
      url: '/models/house 2.glb',
      thumbnail: '/thumbnails/house-2.png',
      defaultScale: '1 1 1',
      targetSizeMeters: 0.5,
      layers: []
    },
    {
      id: 'house3',
      name: 'House 3',
      url: '/models/house 3.glb',
      thumbnail: '/thumbnails/house-3.png',
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
