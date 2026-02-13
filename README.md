# WebAR Floor Placement Application

A lightweight, browser-based AR experience built with A-Frame and WebXR for placing 3D architectural models on detected floor surfaces.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ LTS
- HTTPS connection (required for WebXR)
- WebXR-compatible browser on mobile device

### Installation

```bash
# Install dependencies
npm install

# Start development server (HTTPS)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing
1. Open the app on your mobile device at `https://161.97.180.217:3000`
2. Accept the self-signed certificate warning
3. Allow camera permissions when prompted
4. Scan the floor to detect a surface
5. Tap to place a model

## 📱 Supported Devices

### Android
- Chrome 79+
- Samsung Internet 12.0+
- Edge 79+

### iOS
- WebXR Viewer app
- Reality Composer (limited support)

## 📁 Project Structure

```
WebAR/
├── src/
│   ├── main.js              # Application entry point
│   ├── config/
│   │   └── config.js        # Central configuration
│   ├── modules/
│   │   ├── ar-session.js    # WebXR session management
│   │   ├── model-loader.js  # Dynamic GLB loading
│   │   ├── ui-controller.js # UI management
│   │   ├── gesture-handler.js # Touch gestures
│   │   └── gallery.js       # Model gallery
│   ├── components/
│   │   └── ar-components.js # Custom A-Frame components
│   └── styles/
│       └── main.css         # Application styles
├── public/
│   ├── models/              # GLB model files
│   └── assets/              # Images, fonts, etc.
├── index.html               # Main HTML file
├── vite.config.js           # Vite configuration
└── package.json             # Project dependencies
```

## 🎯 Features

### Milestone 1 (Current) ✅
- [x] WebXR floor plane detection
- [x] Tap-to-place functionality
- [x] Dynamic model loading from server
- [x] Loading progress indicators
- [x] Basic UI with gallery button
- [x] HTTPS support for WebXR

### Milestone 2 (Upcoming)
- [ ] Rotation gestures (drag)
- [ ] Scale gestures (pinch)
- [ ] Model gallery interface
- [ ] Clear/reload functionality

### Milestone 3 (Future)
- [ ] Layer toggle system
- [ ] Custom branding
- [ ] Model conversion tools
- [ ] Production deployment

## 🔧 Configuration

Edit `src/config/config.js` to customize:

```javascript
{
  server: {
    modelBaseUrl: '/models/',  // Model server URL
    timeout: 30000             // Request timeout
  },
  models: [...],              // Model definitions
  gestures: {
    rotation: { speed: 0.5 },
    scale: { min: 0.05, max: 2.0 }
  }
}
```

## 🏗️ Adding Models

1. Place GLB files in `public/models/`
2. Add model configuration to `src/config/config.js`:

```javascript
{
  id: 'model-id',
  name: 'Model Name',
  url: '/models/model.glb',
  thumbnail: '/assets/thumbnails/model.jpg',
  defaultScale: '0.1 0.1 0.1',
  layers: [
    { name: 'Roof', node: 'roof' },
    { name: 'Floor 1', node: 'floor1' }
  ]
}
```

## 🔒 Security

For production deployment:
- Use proper SSL certificates (not self-signed)
- Implement CORS headers on model server
- Consider token-based access control for models
- Enable hotlink protection

## 🐛 Debugging

### Enable Debug Mode
```javascript
// In src/config/config.js
ui: {
  showDebug: true
}
```

### Common Issues

**WebXR Not Supported**
- Ensure HTTPS connection
- Check browser compatibility
- Update browser to latest version

**Models Not Loading**
- Check CORS headers
- Verify model URL paths
- Check file size limits

**Hit Test Not Working**
- Ensure good lighting
- Flat, textured surfaces work best
- Grant camera permissions

## 📦 Deployment

### Build for Production
```bash
npm run build
```

### Server Requirements
- Linux VPS recommended
- 50GB+ storage
- HTTPS enabled
- CORS configured
- MIME types for GLB files

### Nginx Configuration
```nginx
location /models/ {
  add_header Access-Control-Allow-Origin *;
  add_header Content-Type model/gltf-binary;
}
```

## 🤝 Development Tips

1. **Testing WebXR**: Use Chrome DevTools remote debugging
2. **Model Optimization**: Keep models under 20MB
3. **Performance**: Test on target devices (Samsung S25)
4. **Gestures**: Prevent page scroll conflicts

## 📄 License

Proprietary - Subject to NDA

## 👥 Contact

For questions or issues, contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Milestone 1 Development
