import React, { useState, useEffect, useCallback } from 'react';
import { 
  saveProgressToStorage, 
  loadProgressFromStorage, 
  clearProgressFromStorage,
  isProgressDataStale 
} from './count&mark.js';

class CanvasImageManager {
  constructor() {
    this.canvas = null;
    this.currentImage = null;
    this.isInitialized = false;
    this.notificationShown = false;
    this.imageCache = new Map();
    this.lastUserId = null;
    this.lastNotificationTime = null;
    this.buttonClickCount = 0; // Track total button clicks
    this.currentImageTimes = 1; // Times for current image
    this.parsedImages = []; // Store parsed images with times
    this.userId = null; // Current user ID for localStorage
    this.currentImageIndex = 0; // Current image index in the array
    this.onImageComplete = null; // Callback for when image is complete
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

  // Clear canvas without setting yellow background (yellow is handled in index.js)
  clearCanvas() {
    if (!this.canvas) return;
    
    const ctx = this.optimizedContext || this.canvas.getContext('2d');
    
    // Clear canvas completely
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Reset current image since we're clearing everything
    this.currentImage = null;
  }

  // Force clear canvas and reset image state
  forceClearCanvas() {
    this.clearCanvas();
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
              // Draw image on canvas (yellow background is handled in index.js)
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
              // Draw image on canvas (yellow background is handled in index.js)
              this.drawImageOnCanvas(fallbackImg);
              this.currentImage = imagePath;
            }, 100);
            
            resolve(true);
          };
          
          fallbackImg.onerror = (fallbackError) => {
            // Clear canvas on image load error (yellow background is handled in index.js)
            this.clearCanvas();
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
            this.clearCanvas();
            if (onError) {
              onError(`Image load timeout: ${imagePath}`);
            }
            resolve(false);
          }
        }, 10000); // 10 second timeout
      });
    } catch (error) {
      // Clear canvas on error (yellow background is handled in index.js)
      this.clearCanvas();
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
    
    // Draw the image centered on the canvas
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

  // Parse image path to extract times number and path
  parseImagePath(imagePath) {
    if (!imagePath || typeof imagePath !== 'string') {
      return { times: 1, path: imagePath, originalPath: imagePath };
    }
    
    // Parse the format "[times]-path"
    if (imagePath.includes('-')) {
      const pathMatch = imagePath.match(/^\[(\d+)\]-(.+)$/);
      if (pathMatch) {
        return {
          times: parseInt(pathMatch[1], 10),
          path: pathMatch[2],
          originalPath: imagePath
        };
      }
    }
    
    // Fallback for simple paths
    return {
      times: 1,
      path: imagePath,
      originalPath: imagePath
    };
  }

  // Get all parsed images with times information
  getAllParsedImages(imageBackgroundPaths) {
    if (!imageBackgroundPaths || !Array.isArray(imageBackgroundPaths)) {
      return [];
    }
    
    return imageBackgroundPaths.map((path, index) => {
      const parsed = this.parseImagePath(path);
      return {
        ...parsed,
        index: index
      };
    });
  }

  // Set user ID for localStorage operations
  setUserId(userId) {
    this.userId = userId;
  }

  // Set callback for when image is complete
  setOnImageComplete(callback) {
    this.onImageComplete = callback;
  }

  // Get current image index
  getCurrentImageIndex() {
    return this.currentImageIndex;
  }

  // Set current image index
  setCurrentImageIndex(index) {
    if (index >= 0 && index < this.parsedImages.length) {
      this.currentImageIndex = index;
      this.currentImageTimes = this.parsedImages[index].times;
      this.buttonClickCount = 0; // Reset button count for new image
      this.saveProgressToStorage();
      console.log(`Switched to image index ${index}, times: ${this.currentImageTimes}, button count reset to 0`);
    }
  }

  // Check if current image is complete
  isCurrentImageComplete() {
    return this.buttonClickCount >= this.currentImageTimes;
  }

  // Move to next image if current is complete
  async moveToNextImage() {
    console.log(`🔍 moveToNextImage called - Current index: ${this.currentImageIndex}, Total images: ${this.parsedImages.length}`);
    
    if (!this.isCurrentImageComplete()) {
      console.log(`❌ Current image not complete yet: ${this.buttonClickCount}/${this.currentImageTimes}`);
      return false; // Current image not complete yet
    }

    const nextIndex = this.currentImageIndex + 1;
    console.log(`📈 Next index would be: ${nextIndex}`);
    
    if (nextIndex >= this.parsedImages.length) {
      console.log('🏁 All images completed!');
      // All images are complete
      if (this.onImageComplete) {
        this.onImageComplete('all_complete');
      }
      return false;
    }

    // Move to next image
    console.log(`🔄 Setting current image index to: ${nextIndex}`);
    this.setCurrentImageIndex(nextIndex);
    const nextImage = this.parsedImages[nextIndex];
    
    console.log(`📸 Moving to image ${nextIndex + 1}: ${nextImage.path} (times: ${nextImage.times})`);
    
    // Load the next image
    const success = await this.setImageBackground(nextImage.path);
    if (success) {
      console.log(`✅ Successfully switched to next image: ${nextImage.path}`);
      if (this.onImageComplete) {
        this.onImageComplete('image_switched', {
          previousIndex: this.currentImageIndex - 1,
          currentIndex: this.currentImageIndex,
          imagePath: nextImage.path,
          times: nextImage.times
        });
      }
      return true;
    } else {
      console.error(`❌ Failed to load next image: ${nextImage.path}`);
      return false;
    }
  }

  // Reset to first image
  async resetToFirstImage() {
    if (this.parsedImages.length === 0) {
      return false;
    }

    this.setCurrentImageIndex(0);
    const firstImage = this.parsedImages[0];
    
    // Load the first image
    const success = await this.setImageBackground(firstImage.path);
    if (success) {
      console.log(`Reset to first image: ${firstImage.path}`);
      return true;
    } else {
      console.error(`Failed to load first image: ${firstImage.path}`);
      return false;
    }
  }

  // Track button click and update progress
  async trackButtonClick(buttonName, imageBackgroundPaths = null) {
    // Increment button click count
    this.buttonClickCount++;
    
    // Update parsed images if provided
    if (imageBackgroundPaths) {
      this.parsedImages = this.getAllParsedImages(imageBackgroundPaths);
      
      // Update current image times if we have parsed images
      if (this.parsedImages.length > 0) {
        this.currentImageTimes = this.parsedImages[this.currentImageIndex].times;
      }
    }
    
    // Save progress to localStorage
    this.saveProgressToStorage();
    
    console.log(`🔄 Button clicked: ${buttonName}, Total clicks: ${this.buttonClickCount}, Current image times: ${this.currentImageTimes}`);
    console.log(`📊 Current image index: ${this.currentImageIndex}, Total images: ${this.parsedImages.length}`);
    
    // Check if current image is complete and move to next image
    if (this.isCurrentImageComplete()) {
      console.log(`✅ Image ${this.currentImageIndex + 1} completed! Moving to next image...`);
      console.log(`📋 Parsed images available:`, this.parsedImages.map((img, idx) => `${idx}: ${img.path} (${img.times} times)`));
      
      const movedToNext = await this.moveToNextImage();
      
      if (movedToNext) {
        // Reset button click count for the new image
        this.buttonClickCount = 0;
        this.saveProgressToStorage();
        console.log(`🎯 Successfully switched to image ${this.currentImageIndex + 1}, reset button count to 0`);
      } else {
        console.log(`❌ Failed to switch to next image`);
      }
    } else {
      console.log(`⏳ Image not complete yet: ${this.buttonClickCount}/${this.currentImageTimes}`);
    }
  }

  // Get current progress information
  getProgressInfo() {
    return {
      buttonClickCount: this.buttonClickCount,
      currentImageTimes: this.currentImageTimes,
      progress: this.currentImageTimes > 0 ? `${this.buttonClickCount}/${this.currentImageTimes}` : '0/0',
      isComplete: this.buttonClickCount >= this.currentImageTimes,
      parsedImages: this.parsedImages,
      currentImageIndex: this.currentImageIndex,
      totalImages: this.parsedImages.length,
      currentImagePath: this.parsedImages[this.currentImageIndex]?.path || null
    };
  }

  // Save progress to localStorage
  saveProgressToStorage() {
    const progressData = {
      buttonClickCount: this.buttonClickCount,
      currentImageTimes: this.currentImageTimes,
      parsedImages: this.parsedImages,
      currentImageIndex: this.currentImageIndex,
      timestamp: Date.now()
    };
    
    if (typeof window !== 'undefined') {
      try {
        const storageKey = this.userId ? `progress_${this.userId}` : 'progress';
        localStorage.setItem(storageKey, JSON.stringify(progressData));
        console.log('Saved progress to localStorage:', progressData);
      } catch (error) {
        console.error('Error saving progress to localStorage:', error);
      }
    }
  }

  // Load progress from localStorage
  loadProgressFromStorage() {
    const progressData = loadProgressFromStorage(this.userId);
    
    // Check if data is stale (older than 24 hours)
    if (isProgressDataStale(progressData, 24)) {
      console.log('Progress data is stale, resetting to default');
      this.buttonClickCount = 0;
      this.currentImageTimes = 1;
      this.parsedImages = [];
      this.currentImageIndex = 0;
      return;
    }
    
    // Restore progress data
    this.buttonClickCount = progressData.buttonClickCount || 0;
    this.currentImageTimes = progressData.currentImageTimes || 1;
    this.parsedImages = progressData.parsedImages || [];
    this.currentImageIndex = progressData.currentImageIndex || 0;
    
    // Ensure current image index is valid
    if (this.currentImageIndex >= this.parsedImages.length) {
      this.currentImageIndex = 0;
    }
    
    // Update current image times based on current index
    if (this.parsedImages.length > 0 && this.currentImageIndex < this.parsedImages.length) {
      this.currentImageTimes = this.parsedImages[this.currentImageIndex].times;
    }
    
    console.log('Loaded progress from localStorage:', {
      buttonClickCount: this.buttonClickCount,
      currentImageTimes: this.currentImageTimes,
      parsedImagesCount: this.parsedImages.length,
      currentImageIndex: this.currentImageIndex
    });
  }

  // Reset button click count
  resetButtonClickCount() {
    this.buttonClickCount = 0;
    this.saveProgressToStorage(); // Save the reset state
    console.log('Button click count reset');
  }

  // Update image background paths and reset progress
  updateImageBackgroundPaths(imageBackgroundPaths) {
    this.parsedImages = this.getAllParsedImages(imageBackgroundPaths);
    
    // Reset to first image when paths change
    this.currentImageIndex = 0;
    
    if (this.parsedImages.length > 0) {
      this.currentImageTimes = this.parsedImages[0].times;
    } else {
      this.currentImageTimes = 1;
    }
    
    // Reset button click count when image paths change
    this.buttonClickCount = 0;
    
    // Save the reset progress to localStorage
    this.saveProgressToStorage();
    
    console.log('Updated image background paths:', this.parsedImages);
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

    // Update parsed images and reset progress when background paths change
    this.updateImageBackgroundPaths(imageBackgroundPaths);

    if (!enableBackgroundChange) {
      // Clear canvas if background change is disabled - NO IMAGE LOADING
      this.clearCanvas();
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
      
      // Clear canvas as fallback (yellow background is handled in index.js)
      this.clearCanvas();
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
      
      // Clear canvas as fallback (yellow background is handled in index.js)
      this.clearCanvas();
      return;
    }

    // Set user ID for localStorage operations
    if (userId) {
      this.setUserId(userId);
    }

    // Load progress from localStorage to restore state
    this.loadProgressFromStorage();

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
      // Clear canvas if image loading failed (yellow background is handled in index.js)
      this.clearCanvas();
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

  // Force redraw current image (useful for debugging and ensuring image is restored)
  forceRedrawCurrentImage() {
    if (!this.currentImage || !this.canvas) {
      return false;
    }
    
    const cachedImage = this.imageCache.get(this.currentImage);
    if (cachedImage) {
      this.drawImageOnCanvas(cachedImage);
      return true;
    } else {
      // If no cached image, try to reload it
      return this.setImageBackground(this.currentImage);
    }
  }

  // Debug function to get current state
  getDebugInfo() {
    return {
      currentImage: this.currentImage,
      hasImage: this.hasImageBackground(),
      cacheSize: this.imageCache.size,
      canvasDimensions: this.canvas ? `${this.canvas.width}x${this.canvas.height}` : 'No canvas',
      isInitialized: this.isInitialized,
      cachedImages: Array.from(this.imageCache.keys())
    };
  }

  // Force check MongoDB settings for image restoration
  forceCheckMongoDBSettings(settings, userId) {
    if (!this.currentImage && settings && userId) {
      this.handleCanvasBackgroundFromSettings(settings, userId);
    }
  }

  // Handle tab visibility changes - preserve image state
  handleTabVisibilityChange(isVisible) {
    if (isVisible) {
      // Tab became visible - restore image if we had one
      if (this.currentImage && this.canvas) {
        // Small delay to ensure canvas is ready
        setTimeout(() => {
          this.forceRedrawCurrentImage();
        }, 50);
      }
    }
    // When tab becomes hidden, we don't need to do anything special
    // The image state is preserved in memory
  }

  // Resize handler for canvas
  handleResize(settings = null, userId = null) {
    if (!this.canvas) return;

    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    
    // Check if dimensions actually changed to avoid unnecessary redraws
    if (this.canvas.width === newWidth && this.canvas.height === newHeight) {
      return;
    }

    // Store current image before resize
    const currentImagePath = this.currentImage;
    const cachedImage = currentImagePath ? this.imageCache.get(currentImagePath) : null;

    // Update canvas dimensions to match window size
    this.canvas.width = newWidth;
    this.canvas.height = newHeight;

    // Ensure canvas is visible and properly layered after resize
    this.ensureCanvasVisibility();

    // Always redraw the image if we have one, regardless of cache status
    if (currentImagePath) {
      if (cachedImage) {
        // Use cached image for immediate redraw
        this.drawImageOnCanvas(cachedImage);
        this.currentImage = currentImagePath; // Ensure current image is set
      } else {
        // If no cached image, reload the image
        this.setImageBackground(currentImagePath).then((success) => {
          if (!success) {
            this.clearCanvas();
          }
        });
      }
    } else {
      // No current image - check if we should load from MongoDB settings
      if (settings && userId) {
        this.handleCanvasBackgroundFromSettings(settings, userId);
      } else {
        // No image, clear canvas (yellow background is handled in index.js)
        this.clearCanvas();
      }
    }
  }

  // Handle canvas background from MongoDB settings (for resize restoration)
  async handleCanvasBackgroundFromSettings(settings, userId) {
    if (!settings || !userId) {
      return;
    }

    let userSettings = settings[userId];
    
    // If no settings found for the specific user, try to find any available user settings
    if (!userSettings) {
      const availableUserIds = Object.keys(settings);
      if (availableUserIds.length > 0) {
        const firstUserId = availableUserIds[0];
        userSettings = settings[firstUserId];
      }
    }
    
    if (!userSettings) {
      this.clearCanvas();
      return;
    }

    const enableBackgroundChange = userSettings.enable_background_change || false;
    const imageBackgroundPaths = userSettings.image_background_paths || [];

    if (!enableBackgroundChange) {
      this.clearCanvas();
      return;
    }

    if (!imageBackgroundPaths || imageBackgroundPaths.length === 0) {
      this.clearCanvas();
      return;
    }

    // Try to get the first image path
    const firstImagePath = this.getFirstImagePath(imageBackgroundPaths);
    if (!firstImagePath) {
      this.clearCanvas();
      return;
    }

    const success = await this.setImageBackground(firstImagePath);
    if (!success) {
      this.clearCanvas();
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
      
      // Set user ID for localStorage operations
      canvasImageManager.setUserId(effectiveUserId);
      
      // Load progress from localStorage
      canvasImageManager.loadProgressFromStorage();
      
      // Only load default image if background change is enabled
      setTimeout(() => {
        // Check if background change is enabled before loading default image
        const userSettings = settings?.[effectiveUserId];
        const enableBackgroundChange = userSettings?.enable_background_change || false;
        
        if (enableBackgroundChange) {
          // Load image on canvas (yellow background is handled in index.js)
          canvasImageManager.setImageBackground('/Overall_porch.png');
        } else {
          // Background change is disabled, clear canvas (yellow background is handled in index.js)
          canvasImageManager.clearCanvas();
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
      // No settings for user, clear canvas (yellow background is handled in index.js)
      canvasImageManager.clearCanvas();
      return;
    }

    const enableBackgroundChange = userSettings.enable_background_change || false;
    const imageBackgroundPaths = userSettings.image_background_paths || [];

    // Check if background change is enabled
    if (!enableBackgroundChange) {
      // Background change is disabled, clear canvas (yellow background is handled in index.js)
      canvasImageManager.clearCanvas();
      canvasImageManager.currentImage = null; // Ensure no image is set
      return;
    }

    // Background change is enabled, check if we have image paths
    if (!imageBackgroundPaths || imageBackgroundPaths.length === 0) {
      // No image paths available, clear canvas (yellow background is handled in index.js)
      canvasImageManager.clearCanvas();
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
    clearCanvas: () => canvasImageManager.clearCanvas(),
    setImageBackground: (imagePath) => canvasImageManager.setImageBackground(imagePath),
    getCurrentImage: () => canvasImageManager.getCurrentImage(),
    hasImageBackground: () => canvasImageManager.hasImageBackground(),
    forceClearCanvas: () => canvasImageManager.forceClearCanvas(),
    forceRedrawCurrentImage: () => canvasImageManager.forceRedrawCurrentImage(),
    getDebugInfo: () => canvasImageManager.getDebugInfo(),
    handleResize: (settings, userId) => canvasImageManager.handleResize(settings, userId),
    forceCheckMongoDBSettings: (settings, userId) => canvasImageManager.forceCheckMongoDBSettings(settings, userId),
    handleTabVisibilityChange: (isVisible) => canvasImageManager.handleTabVisibilityChange(isVisible),
    // New button tracking functionality
    trackButtonClick: (buttonName, imageBackgroundPaths) => canvasImageManager.trackButtonClick(buttonName, imageBackgroundPaths),
    getProgressInfo: () => canvasImageManager.getProgressInfo(),
    resetButtonClickCount: () => canvasImageManager.resetButtonClickCount(),
    updateImageBackgroundPaths: (imageBackgroundPaths) => canvasImageManager.updateImageBackgroundPaths(imageBackgroundPaths),
    getAllParsedImages: (imageBackgroundPaths) => canvasImageManager.getAllParsedImages(imageBackgroundPaths),
    // Progress localStorage functionality
    saveProgressToStorage: () => canvasImageManager.saveProgressToStorage(),
    loadProgressFromStorage: () => canvasImageManager.loadProgressFromStorage(),
    setUserId: (userId) => canvasImageManager.setUserId(userId),
    // Image switching functionality
    setOnImageComplete: (callback) => canvasImageManager.setOnImageComplete(callback),
    getCurrentImageIndex: () => canvasImageManager.getCurrentImageIndex(),
    setCurrentImageIndex: (index) => canvasImageManager.setCurrentImageIndex(index),
    isCurrentImageComplete: () => canvasImageManager.isCurrentImageComplete(),
    moveToNextImage: () => canvasImageManager.moveToNextImage(),
    resetToFirstImage: () => canvasImageManager.resetToFirstImage()
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
      
      // Set user ID for localStorage operations
      canvasImageManager.setUserId(effectiveUserId);
      
      // Load progress from localStorage
      canvasImageManager.loadProgressFromStorage();
      
      // Only load default image if background change is enabled
      setTimeout(() => {
        // Check if background change is enabled before loading default image
        const userSettings = settings?.[effectiveUserId];
        const enableBackgroundChange = userSettings?.enable_background_change || false;
        
        if (enableBackgroundChange) {
          // Load image on canvas (yellow background is handled in index.js)
          canvasImageManager.setImageBackground('/Overall_porch.png');
        } else {
          // Background change is disabled, clear canvas (yellow background is handled in index.js)
          canvasImageManager.clearCanvas();
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
      // No settings for user, clear canvas (yellow background is handled in index.js)
      setOverlayImagePath(null);
      if (canvasImageManager) {
        canvasImageManager.clearCanvas();
      }
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
        canvasImageManager.clearCanvas();
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
    clearCanvas: () => canvasImageManager.clearCanvas(),
    setImageOverlay: (imagePath) => canvasImageManager.setImageOverlay(imagePath),
    clearImageOverlay: () => canvasImageManager.clearImageOverlay(),
    getOverlayImagePath: () => canvasImageManager.getOverlayImagePath(),
    forceClearCanvas: () => canvasImageManager.forceClearCanvas(),
    forceRedrawCurrentImage: () => canvasImageManager.forceRedrawCurrentImage(),
    getDebugInfo: () => canvasImageManager.getDebugInfo(),
    handleResize: (settings, userId) => canvasImageManager.handleResize(settings, userId),
    forceCheckMongoDBSettings: (settings, userId) => canvasImageManager.forceCheckMongoDBSettings(settings, userId),
    handleTabVisibilityChange: (isVisible) => canvasImageManager.handleTabVisibilityChange(isVisible),
    // New button tracking functionality
    trackButtonClick: (buttonName, imageBackgroundPaths) => canvasImageManager.trackButtonClick(buttonName, imageBackgroundPaths),
    getProgressInfo: () => canvasImageManager.getProgressInfo(),
    resetButtonClickCount: () => canvasImageManager.resetButtonClickCount(),
    updateImageBackgroundPaths: (imageBackgroundPaths) => canvasImageManager.updateImageBackgroundPaths(imageBackgroundPaths),
    getAllParsedImages: (imageBackgroundPaths) => canvasImageManager.getAllParsedImages(imageBackgroundPaths),
    // Progress localStorage functionality
    saveProgressToStorage: () => canvasImageManager.saveProgressToStorage(),
    loadProgressFromStorage: () => canvasImageManager.loadProgressFromStorage(),
    setUserId: (userId) => canvasImageManager.setUserId(userId),
    // Image switching functionality
    setOnImageComplete: (callback) => canvasImageManager.setOnImageComplete(callback),
    getCurrentImageIndex: () => canvasImageManager.getCurrentImageIndex(),
    setCurrentImageIndex: (index) => canvasImageManager.setCurrentImageIndex(index),
    isCurrentImageComplete: () => canvasImageManager.isCurrentImageComplete(),
    moveToNextImage: () => canvasImageManager.moveToNextImage(),
    resetToFirstImage: () => canvasImageManager.resetToFirstImage()
  };
};

// Export the manager class for direct use
export default CanvasImageManager;
export { ImageOverlay, EnhancedCanvasImageManager };