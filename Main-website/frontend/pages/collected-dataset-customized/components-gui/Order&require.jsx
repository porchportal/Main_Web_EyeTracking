import React, { useState, useEffect } from 'react';
import styles from '../styles/Order&require.module.css';
import {
  getCheckMarkStatus,
  CheckMarkRenderer,
  loadProgressFromStorage,
  isProgressDataStale,
  clearAllStateDataWithCompletion
} from './count&mark.js';

const OrderRequire = ({
  isHydrated,
  showOrderRequire,
  orderRequireMessage,
  orderRequireList = [],
  isManualShow = false, // New prop to indicate if this is a manual show (user clicked button)
  clickedButtons = new Set(), // Track which buttons have been clicked
  currentUserId = null // Current user ID for settings access
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [animationState, setAnimationState] = useState('hidden');

  // Function to clear all state data (can be called from parent component)
  const clearAllState = () => {
    const result = clearAllStateDataWithCompletion(currentUserId);
    return result;
  };

  // Expose clearAllState function to parent component via useEffect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.clearOrderRequireState = clearAllState;
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete window.clearOrderRequireState;
      }
    };
  }, [currentUserId]);

  // Load progress from localStorage when component mounts or userId changes
  useEffect(() => {
    if (currentUserId && isHydrated) {
      const progressData = loadProgressFromStorage(currentUserId);
      
      // Check if data is stale (older than 24 hours)
      if (isProgressDataStale(progressData, 24)) {
        return;
      }
      
      // Update progress if we have valid data
      if (progressData.buttonClickCount > 0 || progressData.parsedImages.length > 0) {
        // Note: The actual progress values are managed by CanvasImage manager
        // This is just for logging and potential UI updates
      }
    }
  }, [currentUserId, isHydrated]);

  useEffect(() => {
    if (showOrderRequire) {
      setIsVisible(true);
      setAnimationState('visible');
      
      // Only auto-hide if this is NOT a manual show (user clicked button)
      // If it's a manual show, let the user control when to hide it
      if (!isManualShow) {
        // Auto-hide after 8 seconds only for automatic shows
        const timer = setTimeout(() => {
          setAnimationState('hidden');
          setTimeout(() => setIsVisible(false), 300); // Wait for animation to complete
        }, 8000);
        return () => clearTimeout(timer);
      }
    } else {
      setAnimationState('hidden');
      setTimeout(() => setIsVisible(false), 300); // Wait for animation to complete
    }
  }, [showOrderRequire, isManualShow]);

  // Check if Canvas Metrics is visible to adjust positioning
  const isCanvasMetricsVisible = () => {
    if (typeof window !== 'undefined') {
      const metricsDisplay = document.querySelector('.metrics-display');
      if (!metricsDisplay) return false;
      
      // Check if element is visible by checking computed styles
      const computedStyle = window.getComputedStyle(metricsDisplay);
      const isDisplayed = computedStyle.display !== 'none';
      const isOpaque = parseFloat(computedStyle.opacity) > 0;
      const isVisible = computedStyle.visibility !== 'hidden';
      
      return isDisplayed && isOpaque && isVisible;
    }
    return false;
  };

  const [canvasMetricsVisible, setCanvasMetricsVisible] = useState(false);

  useEffect(() => {
    const checkMetricsVisibility = () => {
      const isVisible = isCanvasMetricsVisible();
      setCanvasMetricsVisible(prev => {
        // Only update state if the value actually changed to prevent unnecessary re-renders
        if (prev !== isVisible) {
          return isVisible;
        }
        return prev;
      });
    };

    // Initial check
    checkMetricsVisibility();

    // Use MutationObserver to watch for changes in the metrics display
    let observer;
    if (typeof window !== 'undefined') {
      const metricsDisplay = document.querySelector('.metrics-display');
      if (metricsDisplay) {
        observer = new MutationObserver(() => {
          checkMetricsVisibility();
        });
        
        observer.observe(metricsDisplay, {
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }
    }

    // Fallback interval for cases where MutationObserver doesn't catch changes
    const interval = setInterval(checkMetricsVisibility, 1000);
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
      clearInterval(interval);
    };
  }, []);

  // Order&require.jsx is now deprecated - all UI is shown in displayResponse.jsx
  // This component only maintains the clearAllState functionality for backward compatibility
  if (!isHydrated || !isVisible) {
    return null;
  }

  // Don't render any UI - everything is now shown in displayResponse.jsx
  return null;
};

export default OrderRequire;