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
    if (!canvas) {
      return false;
    }
    
    this.canvas = canvas;
    this.isInitialized = true;
    
    // Optimize canvas context for frequent readback operations
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      // Store the optimized context
      this.optimizedContext = ctx;
    }
    
    return true;
  }

  // Set yellow background (default) - this creates the base layer
  setYellowBackground() {
    if (!this.canvas) return;
    
    const ctx = this.optimizedContext || this.canvas.getContext('2d');
    
    // Clear canvas completely first
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Set yellow background as base layer
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Reset current image since we're clearing everything
    this.currentImage = null;
  }

  // Set yellow background layer only (without clearing image)
  setYellowBackgroundLayer() {
    if (!this.canvas) return;
    
    const ctx = this.optimizedContext || this.canvas.getContext('2d');
    
    // Set yellow background as base layer (don't clear existing content)
    ctx.fillStyle = 'yellow';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Force clear canvas and reset image state
  forceClearCanvas() {
    this.setYellowBackground();
    this.currentImage = null;
  }

  // Convert image path to backend URL
  getBackendImageUrl(imagePath) {
    if (!imagePath) return null;
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // If it's an absolute path starting with /, convert to backend route
    if (imagePath.startsWith('/')) {
      // Remove leading slash and use canvas route
      const filename = imagePath.substring(1);
      return `/api/canvasFront-image/${filename}`;
    }
    
    // For relative paths, assume they're in the canvas directory
    return `/api/canvasFront-image/${imagePath}`;
  }

  // Get fallback URL (direct from public directory)
  getFallbackImageUrl(imagePath) {
    if (!imagePath) return null;
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Return direct path to public directory
    return imagePath;
  }

  // Load and set image background
  async setImageBackground(imagePath, onError = null) {
    if (!this.canvas || !imagePath) {
      return false;
    }

    try {
      // Check cache first
      if (this.imageCache.has(imagePath)) {
        const cachedImage = this.imageCache.get(imagePath);
        this.drawImageOnCanvas(cachedImage);
        this.currentImage = imagePath;
        return true;
      }

      // Validate image path before attempting to load
      if (!this.isValidImagePath(imagePath)) {
        if (onError) {
          onError(`Invalid image path: ${imagePath}`);
        }
        return false;
      }

      // Convert to backend URL
      const backendUrl = this.getBackendImageUrl(imagePath);

      // Create new image
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if needed
      
      return new Promise((resolve) => {
        img.onload = () => {
          // Ensure image is fully loaded
          if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
            // Cache the image using original path as key
            this.imageCache.set(imagePath, img);
            
            // Draw on canvas with a small delay to ensure everything is ready
            setTimeout(() => {
              // First set yellow background layer
              this.setYellowBackgroundLayer();
              // Then draw image on top
              this.drawImageOnCanvas(img);
              this.currentImage = imagePath;
            }, 100);
            
            resolve(true);
          } else {
            resolve(false);
          }
        };

        img.onerror = (error) => {
          // Try fallback URL (direct from public directory)
          const fallbackUrl = this.getFallbackImageUrl(imagePath);
          
          const fallbackImg = new Image();
          fallbackImg.crossOrigin = 'anonymous';
          
          fallbackImg.onload = () => {
            // Cache the image using original path as key
            this.imageCache.set(imagePath, fallbackImg);
            
            // Draw on canvas
            setTimeout(() => {
              // First set yellow background layer
              this.setYellowBackgroundLayer();
              // Then draw image on top
              this.drawImageOnCanvas(fallbackImg);
              this.currentImage = imagePath;
            }, 100);
            
            resolve(true);
          };
          
          fallbackImg.onerror = (fallbackError) => {
            // Fallback to yellow background on image load error
            this.setYellowBackground();
            if (onError) {
              onError(`Failed to load image: ${imagePath}`);
            }
            resolve(false);
          };
          
          fallbackImg.src = fallbackUrl;
        };

        // Set image source with timeout
        img.src = backendUrl;
        
        // Add timeout to prevent hanging
        setTimeout(() => {
          if (!img.complete) {
            this.setYellowBackground();
            if (onError) {
              onError(`Image load timeout: ${imagePath}`);
            }
            resolve(false);
          }
        }, 10000); // 10 second timeout
      });
    } catch (error) {
      // Fallback to yellow background on error
      this.setYellowBackground();
      if (onError) {
        onError(`Error loading image: ${error.message}`);
      }
      return false;
    }
  }

  // Draw image on canvas with proper scaling and centering
  drawImageOnCanvas(img) {
    if (!this.canvas || !img) {
      return;
    }

    // Use optimized context if available, otherwise get regular context
    const ctx = this.optimizedContext || this.canvas.getContext('2d');
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Ensure image is loaded and has valid dimensions
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      return;
    }

    // Calculate responsive image dimensions while maintaining aspect ratio
    const imageAspectRatio = img.naturalWidth / img.naturalHeight;
    const canvasAspectRatio = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight;
    
    // Calculate maximum size that fits within canvas (with some padding)
    const maxWidth = canvasWidth * 0.9; // 90% of canvas width
    const maxHeight = canvasHeight * 0.9; // 90% of canvas height
    
    if (imageAspectRatio > canvasAspectRatio) {
      // Image is wider than canvas - fit to width
      drawWidth = Math.min(maxWidth, img.naturalWidth);
      drawHeight = drawWidth / imageAspectRatio;
      
      // If height exceeds max height, scale down
      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = drawHeight * imageAspectRatio;
      }
    } else {
      // Image is taller than canvas - fit to height
      drawHeight = Math.min(maxHeight, img.naturalHeight);
      drawWidth = drawHeight * imageAspectRatio;
      
      // If width exceeds max width, scale down
      if (drawWidth > maxWidth) {
        drawWidth = maxWidth;
        drawHeight = drawWidth / imageAspectRatio;
      }
    }
    
    // Center the image on canvas
    const drawX = (canvasWidth - drawWidth) / 2;
    const drawY = (canvasHeight - drawHeight) / 2;

    // Save the current context state
    ctx.save();
    
    // Ensure proper image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the image centered on the canvas (on top of yellow background)
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    
    // Add a visible border around the image area for debugging
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
    
    // Ensure canvas allows pointer events to pass through
    if (this.canvas) {
      this.canvas.style.pointerEvents = 'none';
      // Ensure canvas is visible
      this.canvas.style.display = 'block';
      this.canvas.style.visibility = 'visible';
    }
    
    // Restore the context state
    ctx.restore();
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

  // Validate image path
  isValidImagePath(imagePath) {
    if (!imagePath || typeof imagePath !== 'string') {
      return false;
    }

    // Check for common image extensions
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const hasValidExtension = validExtensions.some(ext => 
      imagePath.toLowerCase().endsWith(ext)
    );

    // Check for valid path structure
    const isValidStructure = imagePath.length > 0 && 
      !imagePath.includes('..') && // Prevent directory traversal
      !imagePath.includes('\\'); // Prevent Windows path issues

    // Allow absolute paths starting with / (for backend routes)
    const isAbsolutePath = imagePath.startsWith('/');
    const isRelativePath = !imagePath.startsWith('/') && !imagePath.includes('://');

    return hasValidExtension && isValidStructure && (isAbsolutePath || isRelativePath);
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
      return;
    }

    if (!enableBackgroundChange) {
      // Set yellow background if background change is disabled - NO IMAGE LOADING
      this.setYellowBackground();
      this.currentImage = null; // Ensure no image is set
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
    if (!this.canvas) return;

    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    
    // Check if dimensions actually changed to avoid unnecessary redraws
    if (this.canvas.width === newWidth && this.canvas.height === newHeight) {
      return;
    }

    // Update canvas dimensions to match window size
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;

    // Ensure canvas is visible and properly layered after resize
    this.ensureCanvasVisibility();

    // If we have an image background, redraw it with new dimensions
    if (this.currentImage) {
      const cachedImage = this.imageCache.get(this.currentImage);
      if (cachedImage) {
        // First set yellow background layer
        this.setYellowBackgroundLayer();
        // Then redraw image on top with new dimensions
        this.drawImageOnCanvas(cachedImage);
      } else {
        // Fallback to yellow background
        this.setYellowBackground();
      }
    } else {
      // No image, just set yellow background
      this.setYellowBackground();
    }
  }

  // Force canvas to be visible and on top
  ensureCanvasVisibility() {
    if (!this.canvas) return;
    
    // Force canvas to be visible and properly positioned
    this.canvas.style.display = 'block';
    this.canvas.style.visibility = 'visible';
    this.canvas.style.zIndex = '10';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    
    // Ensure canvas is in the DOM
    if (!document.body.contains(this.canvas)) {
      document.body.appendChild(this.canvas);
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
    this.optimizedContext = null;
    this.clearCache();
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
      
      // Only load default image if background change is enabled
      setTimeout(() => {
        // Check if background change is enabled before loading default image
        const userSettings = settings?.[effectiveUserId];
        const enableBackgroundChange = userSettings?.enable_background_change || false;
        
        if (enableBackgroundChange) {
          // First set yellow background layer
          canvasImageManager.setYellowBackgroundLayer();
          // Then load image on top
          canvasImageManager.setImageBackground('/Overall_porch.png');
        } else {
          // Background change is disabled, only set yellow background
          canvasImageManager.setYellowBackground();
        }
      }, 500);
    }
  }, [canvas, canvasImageManager, settings, effectiveUserId]);

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
      // No settings for user, set yellow background only (no image loading)
      canvasImageManager.setYellowBackground();
      return;
    }

    const enableBackgroundChange = userSettings.enable_background_change || false;
    const imageBackgroundPaths = userSettings.image_background_paths || [];

    // Check if background change is enabled
    if (!enableBackgroundChange) {
      // Background change is disabled, only set yellow background (no image loading)
      canvasImageManager.setYellowBackground();
      canvasImageManager.currentImage = null; // Ensure no image is set
      return;
    }

    // Background change is enabled, check if we have image paths
    if (!imageBackgroundPaths || imageBackgroundPaths.length === 0) {
      // No image paths available, set yellow background only
      canvasImageManager.setYellowBackground();
      return;
    }

    // Handle canvas background (only when enable_background_change is true)
    canvasImageManager.handleCanvasBackground(
      enableBackgroundChange,
      imageBackgroundPaths,
      showNotificationMessage,
      effectiveUserId
    );
  }, [canvas, effectiveUserId, settings, canvasImageManager, showNotificationMessage]);

  // Fallback: Only load default image if background change is enabled and no image is loaded after 3 seconds
  useEffect(() => {
    if (!canvas || !canvasImageManager.isInitialized) return;

    const fallbackTimer = setTimeout(() => {
      // Check if background change is enabled before loading default image
      const userSettings = settings?.[effectiveUserId];
      const enableBackgroundChange = userSettings?.enable_background_change || false;
      
      if (enableBackgroundChange && !canvasImageManager.currentImage) {
        canvasImageManager.setYellowBackgroundLayer();
        canvasImageManager.setImageBackground('/Overall_porch.png');
      }
    }, 3000);

    return () => clearTimeout(fallbackTimer);
  }, [canvas, canvasImageManager, settings, effectiveUserId]);

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
    setYellowBackgroundLayer: () => canvasImageManager.setYellowBackgroundLayer(),
    setImageBackground: (imagePath) => canvasImageManager.setImageBackground(imagePath),
    getCurrentImage: () => canvasImageManager.getCurrentImage(),
    hasImageBackground: () => canvasImageManager.hasImageBackground(),
    forceClearCanvas: () => canvasImageManager.forceClearCanvas()
  };
};

// Image Overlay Component - Separate UI component for image display
const ImageOverlay = ({ canvas, imagePath, isVisible = true }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(null);
  const [imageElement, setImageElement] = useState(null);

  // Load image when imagePath changes
  useEffect(() => {
    if (!imagePath || !canvas) {
      setImageLoaded(false);
      setImageError(null);
      setImageElement(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      setImageElement(img);
      setImageLoaded(true);
      setImageError(null);
    };
    
    img.onerror = (error) => {
      setImageError(`Failed to load image: ${imagePath}`);
      setImageLoaded(false);
      setImageElement(null);
    };
    
    // Convert to backend URL
    const backendUrl = imagePath.startsWith('/') 
      ? `/api/canvasFront-image/${imagePath.substring(1)}`
      : `/api/canvasFront-image/${imagePath}`;
    
    img.src = backendUrl;
  }, [imagePath, canvas]);

  // Draw image on canvas when loaded
  useEffect(() => {
    if (!imageLoaded || !imageElement || !canvas || !isVisible) return;

    const ctx = canvas.getContext('2d');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Calculate responsive image dimensions while maintaining aspect ratio
    const imageAspectRatio = imageElement.naturalWidth / imageElement.naturalHeight;
    const canvasAspectRatio = canvasWidth / canvasHeight;
    
    let drawWidth, drawHeight;
    
    // Calculate maximum size that fits within canvas (with some padding)
    const maxWidth = canvasWidth * 0.9; // 90% of canvas width
    const maxHeight = canvasHeight * 0.9; // 90% of canvas height
    
    if (imageAspectRatio > canvasAspectRatio) {
      // Image is wider than canvas - fit to width
      drawWidth = Math.min(maxWidth, imageElement.naturalWidth);
      drawHeight = drawWidth / imageAspectRatio;
      
      // If height exceeds max height, scale down
      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = drawHeight * imageAspectRatio;
      }
    } else {
      // Image is taller than canvas - fit to height
      drawHeight = Math.min(maxHeight, imageElement.naturalHeight);
      drawWidth = drawHeight * imageAspectRatio;
      
      // If width exceeds max width, scale down
      if (drawWidth > maxWidth) {
        drawWidth = maxWidth;
        drawHeight = drawWidth / imageAspectRatio;
      }
    }
    
    // Center the image on canvas
    const drawX = (canvasWidth - drawWidth) / 2;
    const drawY = (canvasHeight - drawHeight) / 2;

    // Save context state
    ctx.save();
    
    // Ensure proper image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the image centered on the canvas
    ctx.drawImage(imageElement, drawX, drawY, drawWidth, drawHeight);
    
    // Add a visible border around the image area for debugging
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
    
    // Restore context state
    ctx.restore();
  }, [imageLoaded, imageElement, canvas, isVisible]);

  // Clear image when component unmounts or image changes
  useEffect(() => {
    return () => {
      if (canvas && imageLoaded) {
        // Don't clear the entire canvas, just the image area
        // The yellow background should remain
      }
    };
  }, [canvas, imageLoaded]);

  return null; // This is a canvas overlay component, no DOM elements
};

// Enhanced Canvas Image Manager with Image Overlay Support
class EnhancedCanvasImageManager extends CanvasImageManager {
  constructor() {
    super();
    this.imageOverlay = null;
    this.overlayImagePath = null;
  }

  // Set image overlay (separate from background)
  setImageOverlay(imagePath) {
    this.overlayImagePath = imagePath;
    
    if (this.imageOverlay && this.imageOverlay.setImagePath) {
      this.imageOverlay.setImagePath(imagePath);
    }
  }

  // Clear image overlay
  clearImageOverlay() {
    this.overlayImagePath = null;
    
    if (this.imageOverlay && this.imageOverlay.clearImage) {
      this.imageOverlay.clearImage();
    }
  }

  // Get current overlay image path
  getOverlayImagePath() {
    return this.overlayImagePath;
  }

  // Set image overlay reference
  setImageOverlayRef(overlayRef) {
    this.imageOverlay = overlayRef;
  }
}

// Enhanced React hook with image overlay support
export const useCanvasImageWithOverlay = (canvas, userId, settings, adminUserId = null) => {
  const [canvasImageManager] = useState(() => new EnhancedCanvasImageManager());
  const [notificationMessage, setNotificationMessage] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [overlayImagePath, setOverlayImagePath] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  
  // Use adminUserId if available, otherwise fall back to userId
  const effectiveUserId = adminUserId || userId;

  // Initialize canvas image manager
  useEffect(() => {
    if (canvas && !canvasImageManager.isInitialized) {
      canvasImageManager.initialize(canvas);
      
      // Only load default image if background change is enabled
      setTimeout(() => {
        // Check if background change is enabled before loading default image
        const userSettings = settings?.[effectiveUserId];
        const enableBackgroundChange = userSettings?.enable_background_change || false;
        
        if (enableBackgroundChange) {
          // First set yellow background layer
          canvasImageManager.setYellowBackgroundLayer();
          // Then load image on top
          canvasImageManager.setImageBackground('/Overall_porch.png');
        } else {
          // Background change is disabled, only set yellow background
          canvasImageManager.setYellowBackground();
        }
      }, 100);
    }
  }, [canvas, canvasImageManager, settings, effectiveUserId]);

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

  // Update overlay image based on settings
  useEffect(() => {
    if (!canvas || !effectiveUserId || !settings || !canvasImageManager.isInitialized) {
      return;
    }

    const userSettings = settings[effectiveUserId];

    if (!userSettings) {
      // No settings for user, no overlay image (background change disabled by default)
      setOverlayImagePath(null);
      return;
    }

    const enableBackgroundChange = userSettings.enable_background_change || false;
    const imageBackgroundPaths = userSettings.image_background_paths || [];

    // Check if background change is enabled
    if (!enableBackgroundChange) {
      // Background change is disabled, no overlay image
      setOverlayImagePath(null);
      // Also clear any existing image from canvas
      if (canvasImageManager) {
        canvasImageManager.setYellowBackground();
        canvasImageManager.currentImage = null;
      }
      return;
    }

    // Background change is enabled, check if we have image paths
    if (!imageBackgroundPaths || imageBackgroundPaths.length === 0) {
      // No image paths available, no overlay image
      setOverlayImagePath(null);
      return;
    }

    // Try to get the first image path for overlay
    const firstPath = imageBackgroundPaths[0];
    let overlayPath = null;
    
    // Parse the format "[times]-path" to extract just the path
    if (typeof firstPath === 'string' && firstPath.includes('-')) {
      const pathMatch = firstPath.match(/^\[\d+\]-(.+)$/);
      if (pathMatch) {
        overlayPath = pathMatch[1];
      }
    } else {
      overlayPath = firstPath;
    }
    
    if (overlayPath) {
      setOverlayImagePath(overlayPath);
    } else {
      setOverlayImagePath(null);
    }
  }, [canvas, effectiveUserId, settings, canvasImageManager]);

  // Fallback: Only load default overlay if background change is enabled and no image is loaded after 3 seconds
  useEffect(() => {
    if (!canvas || !canvasImageManager.isInitialized) return;

    const fallbackTimer = setTimeout(() => {
      // Check if background change is enabled before loading default overlay
      const userSettings = settings?.[effectiveUserId];
      const enableBackgroundChange = userSettings?.enable_background_change || false;
      
      if (enableBackgroundChange && !overlayImagePath) {
        setOverlayImagePath('/Overall_porch.png');
      }
    }, 3000);

    return () => clearTimeout(fallbackTimer);
  }, [canvas, canvasImageManager, overlayImagePath, settings, effectiveUserId]);

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
    overlayImagePath,
    showOverlay,
    setOverlayImagePath,
    setShowOverlay,
    setYellowBackground: () => canvasImageManager.setYellowBackground(),
    setImageOverlay: (imagePath) => canvasImageManager.setImageOverlay(imagePath),
    clearImageOverlay: () => canvasImageManager.clearImageOverlay(),
    getOverlayImagePath: () => canvasImageManager.getOverlayImagePath(),
    forceClearCanvas: () => canvasImageManager.forceClearCanvas()
  };
};

// Export the manager class for direct use
export default CanvasImageManager;
export { ImageOverlay, EnhancedCanvasImageManager };
