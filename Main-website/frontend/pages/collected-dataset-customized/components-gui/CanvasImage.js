import React, { useState, useEffect, useCallback } from 'react';

class CanvasImageManager {
  constructor() {
    this.canvas = null;
    this.currentImage = null;
    this.isInitialized = false;
    this.notificationShown = false;
    this.imageCache = new Map();
    this.lastUserId = null;
    this.lastNotificationTime = null;
  }

  // Initialize the canvas image manager
  initialize(canvas) {
    if (!canvas) return false;
    
    this.canvas = canvas;
    this.isInitialized = true;
    console.log('CanvasImageManager initialized');
    return true;
  }

  // Set yellow background (default)
  setYellowBackground() {
    if (!this.canvas) return;
    
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.currentImage = null;
    console.log('Canvas set to yellow background');
  }

  // Load and set image background
  async setImageBackground(imagePath, onError = null) {
    if (!this.canvas || !imagePath) return false;

    try {
      // Check cache first
      if (this.imageCache.has(imagePath)) {
        const cachedImage = this.imageCache.get(imagePath);
        this.drawImageOnCanvas(cachedImage);
        this.currentImage = imagePath;
        console.log('Canvas image set from cache:', imagePath);
        return true;
      }

      // Create new image
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if needed
      
      return new Promise((resolve) => {
        img.onload = () => {
          // Cache the image
          this.imageCache.set(imagePath, img);
          
          // Draw on canvas
          this.drawImageOnCanvas(img);
          this.currentImage = imagePath;
          console.log('Canvas image loaded and set:', imagePath);
          resolve(true);
        };

        img.onerror = (error) => {
          console.error('Failed to load canvas image:', imagePath, error);
          if (onError) {
            onError(`Failed to load image: ${imagePath}`);
          }
          resolve(false);
        };

        // Set image source
        img.src = imagePath;
      });
    } catch (error) {
      console.error('Error setting canvas image:', error);
      if (onError) {
        onError(`Error loading image: ${error.message}`);
      }
      return false;
    }
  }

  // Draw image on canvas with proper scaling
  drawImageOnCanvas(img) {
    if (!this.canvas || !img) return;

    const ctx = this.canvas.getContext('2d');
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Calculate scaling to fit image while maintaining aspect ratio
    const imgAspect = img.width / img.height;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight, drawX, drawY;

    if (imgAspect > canvasAspect) {
      // Image is wider than canvas
      drawHeight = canvasHeight;
      drawWidth = canvasHeight * imgAspect;
      drawX = (canvasWidth - drawWidth) / 2;
      drawY = 0;
    } else {
      // Image is taller than canvas
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgAspect;
      drawX = 0;
      drawY = (canvasHeight - drawHeight) / 2;
    }

    // Draw the image
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  // Get first image from image_background_paths array
  getFirstImagePath(imageBackgroundPaths) {
    if (!imageBackgroundPaths || !Array.isArray(imageBackgroundPaths) || imageBackgroundPaths.length === 0) {
      return null;
    }

    // Get the first image path
    const firstPath = imageBackgroundPaths[0];
    
    // Parse the format "[times]-path" to extract just the path
    if (typeof firstPath === 'string' && firstPath.includes('-')) {
      const pathMatch = firstPath.match(/^\[\d+\]-(.+)$/);
      if (pathMatch) {
        return pathMatch[1];
      }
    }
    
    // If it doesn't match the expected format, return as is
    return firstPath;
  }

  // Check if image path is default or empty
  isDefaultOrEmptyImagePath(imageBackgroundPaths) {
    if (!imageBackgroundPaths || !Array.isArray(imageBackgroundPaths) || imageBackgroundPaths.length === 0) {
      return true;
    }

    const firstPath = imageBackgroundPaths[0];
    if (!firstPath) {
      return true;
    }

    // Check if it's the default background path
    if (typeof firstPath === 'string') {
      // Parse the format "[times]-path" to extract just the path
      if (firstPath.includes('-')) {
        const pathMatch = firstPath.match(/^\[\d+\]-(.+)$/);
        if (pathMatch) {
          const actualPath = pathMatch[1];
          return actualPath === '/backgrounds/default.jpg' || actualPath === 'backgrounds/default.jpg';
        }
      }
      // Direct path check
      return firstPath === '/backgrounds/default.jpg' || firstPath === 'backgrounds/default.jpg';
    }

    return false;
  }

  // Handle canvas background based on settings
  async handleCanvasBackground(enableBackgroundChange, imageBackgroundPaths, onNotification = null, userId = null) {
    if (!this.isInitialized) {
      console.warn('CanvasImageManager not initialized');
      return;
    }

    if (!enableBackgroundChange) {
      // Set yellow background if background change is disabled
      this.setYellowBackground();
      return;
    }

    // Background change is enabled, check if it's default or empty
    const isDefaultOrEmpty = this.isDefaultOrEmptyImagePath(imageBackgroundPaths);
    
    if (isDefaultOrEmpty) {
      // Default or empty image paths, show notification
      // Check if we should show notification (only once per user session or after 5 seconds)
      const now = Date.now();
      const shouldShowNotification = 
        this.lastUserId !== userId || 
        !this.lastNotificationTime || 
        (now - this.lastNotificationTime) > 5000; // 5 seconds

      if (shouldShowNotification && onNotification) {
        this.lastUserId = userId;
        this.lastNotificationTime = now;
        onNotification('Using default background image. Please configure custom images in admin settings.');
      }
      
      // Set yellow background as fallback
      this.setYellowBackground();
      return;
    }

    // Try to get the first image path
    const firstImagePath = this.getFirstImagePath(imageBackgroundPaths);
    
    if (!firstImagePath) {
      // No valid images available, show notification
      const now = Date.now();
      const shouldShowNotification = 
        this.lastUserId !== userId || 
        !this.lastNotificationTime || 
        (now - this.lastNotificationTime) > 5000; // 5 seconds

      if (shouldShowNotification && onNotification) {
        this.lastUserId = userId;
        this.lastNotificationTime = now;
        onNotification('No valid background images available. Canvas will remain yellow.');
      }
      
      // Set yellow background as fallback
      this.setYellowBackground();
      return;
    }

    // Try to load the first image
    const success = await this.setImageBackground(firstImagePath, (error) => {
      // Check if we should show notification for image loading errors
      const now = Date.now();
      const shouldShowNotification = 
        this.lastUserId !== userId || 
        !this.lastNotificationTime || 
        (now - this.lastNotificationTime) > 5000; // 5 seconds

      if (shouldShowNotification && onNotification) {
        this.lastUserId = userId;
        this.lastNotificationTime = now;
        onNotification(`Failed to load background image: ${error}`);
      }
    });

    if (!success) {
      // Fallback to yellow background if image loading failed
      this.setYellowBackground();
    }
  }

  // Clear image cache
  clearCache() {
    this.imageCache.clear();
    console.log('Canvas image cache cleared');
  }

  // Get current image path
  getCurrentImage() {
    return this.currentImage;
  }

  // Check if canvas has image background
  hasImageBackground() {
    return this.currentImage !== null;
  }

  // Resize handler for canvas
  handleResize() {
    if (!this.canvas || !this.currentImage) return;

    // If we have an image background, redraw it with new dimensions
    const cachedImage = this.imageCache.get(this.currentImage);
    if (cachedImage) {
      this.drawImageOnCanvas(cachedImage);
    } else {
      // Fallback to yellow background
      this.setYellowBackground();
    }
  }

  // Cleanup
  destroy() {
    this.canvas = null;
    this.currentImage = null;
    this.isInitialized = false;
    this.notificationShown = false;
    this.lastUserId = null;
    this.lastNotificationTime = null;
    this.clearCache();
    console.log('CanvasImageManager destroyed');
  }
}

// React hook for canvas image management
export const useCanvasImage = (canvas, userId, settings, adminUserId = null) => {
  const [canvasImageManager] = useState(() => new CanvasImageManager());
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  
  // Use adminUserId if available, otherwise fall back to userId
  const effectiveUserId = adminUserId || userId;

  // Initialize canvas image manager
  useEffect(() => {
    if (canvas && !canvasImageManager.isInitialized) {
      canvasImageManager.initialize(canvas);
    }
  }, [canvas, canvasImageManager]);

  // Handle notification display
  const showNotificationMessage = useCallback((message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setShowNotification(false);
      setNotificationMessage('');
    }, 5000);
  }, []);

  // Update canvas background based on settings
  useEffect(() => {
    if (!canvas || !effectiveUserId || !settings || !canvasImageManager.isInitialized) {
      return;
    }

    const userSettings = settings[effectiveUserId];
    if (!userSettings) {
      // No settings for user, use default yellow background
      canvasImageManager.setYellowBackground();
      return;
    }

    const enableBackgroundChange = userSettings.enable_background_change || false;
    const imageBackgroundPaths = userSettings.image_background_paths || [];

    console.log('Canvas background settings:', {
      effectiveUserId,
      enableBackgroundChange,
      imageBackgroundPaths
    });

    // Handle canvas background
    canvasImageManager.handleCanvasBackground(
      enableBackgroundChange,
      imageBackgroundPaths,
      showNotificationMessage,
      effectiveUserId
    );
  }, [canvas, effectiveUserId, settings, canvasImageManager, showNotificationMessage]);

  // Handle canvas resize
  useEffect(() => {
    if (!canvas) return;

    const handleResize = () => {
      canvasImageManager.handleResize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvas, canvasImageManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      canvasImageManager.destroy();
    };
  }, [canvasImageManager]);

  return {
    canvasImageManager,
    showNotification,
    notificationMessage,
    setYellowBackground: () => canvasImageManager.setYellowBackground(),
    setImageBackground: (imagePath) => canvasImageManager.setImageBackground(imagePath),
    getCurrentImage: () => canvasImageManager.getCurrentImage(),
    hasImageBackground: () => canvasImageManager.hasImageBackground()
  };
};

// Export the manager class for direct use
export default CanvasImageManager;
