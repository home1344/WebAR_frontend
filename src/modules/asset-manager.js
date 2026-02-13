/**
 * Asset Manager
 * Handles pre-downloading and caching of images (thumbnails, rendering images)
 * from the backend as blob URLs for offline/instant access.
 */

import { getLogger } from './logger.js';

export class AssetManager {
  constructor() {
    this.imageCache = new Map(); // originalUrl -> blobUrl
    this.logger = getLogger();
  }

  /**
   * Pre-download all images for the given models.
   * Downloads thumbnails and rendering images as blob URLs.
   * @param {Array} models - Array of model configs from backend
   */
  async preloadAllImages(models) {
    if (!models || models.length === 0) return;

    const urls = new Set();
    for (const model of models) {
      if (model.thumbnail) urls.add(model.thumbnail);
      if (Array.isArray(model.renderingImages)) {
        model.renderingImages.forEach(url => urls.add(url));
      }
    }

    this.logger.info('ASSET_MANAGER', `Pre-downloading ${urls.size} images...`);

    const results = await Promise.allSettled(
      [...urls].map(url => this._downloadImage(url))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    this.logger.info('ASSET_MANAGER', 'Image pre-download complete', {
      total: urls.size,
      succeeded,
      failed
    });
  }

  /**
   * Download a single image and cache as blob URL.
   * @param {string} url - Image URL to download
   */
  async _downloadImage(url) {
    if (this.imageCache.has(url)) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      this.imageCache.set(url, blobUrl);
    } catch (error) {
      this.logger.warning('ASSET_MANAGER', `Failed to download image: ${url}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get cached blob URL for an image, or return original URL as fallback.
   * @param {string} originalUrl - Original image URL
   * @returns {string} Blob URL or original URL
   */
  getBlobUrl(originalUrl) {
    return this.imageCache.get(originalUrl) || originalUrl;
  }

  /**
   * Resolve an array of image URLs to their cached blob URLs.
   * @param {Array<string>} urls - Array of original image URLs
   * @returns {Array<string>} Array of blob URLs (or originals as fallback)
   */
  resolveBlobUrls(urls) {
    if (!Array.isArray(urls)) return urls;
    return urls.map(url => this.getBlobUrl(url));
  }

  /**
   * Refresh assets based on config changes.
   * Downloads new images, revokes removed images.
   * @param {Array} oldModels - Previous model list
   * @param {Array} newModels - Updated model list
   */
  async refreshAssets(oldModels, newModels) {
    const oldUrls = this._collectImageUrls(oldModels);
    const newUrls = this._collectImageUrls(newModels);

    // Revoke blob URLs for removed images
    let revokedCount = 0;
    for (const url of oldUrls) {
      if (!newUrls.has(url) && this.imageCache.has(url)) {
        URL.revokeObjectURL(this.imageCache.get(url));
        this.imageCache.delete(url);
        revokedCount++;
      }
    }

    // Download new images
    const toDownload = [...newUrls].filter(u => !this.imageCache.has(u));
    if (toDownload.length > 0) {
      this.logger.info('ASSET_MANAGER', `Downloading ${toDownload.length} new images...`);
      await Promise.allSettled(toDownload.map(u => this._downloadImage(u)));
    }

    this.logger.info('ASSET_MANAGER', 'Asset refresh complete', {
      revoked: revokedCount,
      downloaded: toDownload.length,
      cached: this.imageCache.size
    });
  }

  /**
   * Collect all image URLs from a models array.
   * @param {Array} models - Model config array
   * @returns {Set<string>} Set of image URLs
   */
  _collectImageUrls(models) {
    const urls = new Set();
    if (!models) return urls;
    for (const model of models) {
      if (model.thumbnail) urls.add(model.thumbnail);
      if (Array.isArray(model.renderingImages)) {
        model.renderingImages.forEach(url => urls.add(url));
      }
    }
    return urls;
  }

  /**
   * Clear all cached assets and revoke blob URLs.
   */
  clearAll() {
    for (const [, blobUrl] of this.imageCache) {
      URL.revokeObjectURL(blobUrl);
    }
    this.imageCache.clear();
    this.logger.info('ASSET_MANAGER', 'All cached assets cleared');
  }

  /**
   * Get cache statistics.
   */
  getCacheStats() {
    return {
      cachedImages: this.imageCache.size
    };
  }
}
