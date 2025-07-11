// CalibratePoints.jsx
// Utility for generating and managing calibration points on a canvas

import React from 'react';

/**
 * Get canvas management utilities from global scope (from actionButton.js)
 * @returns {Object} Canvas utilities object
 */
const getCanvasUtils = () => {
  if (typeof window !== 'undefined') {
    return {
      canvasUtils: window.canvasUtils,
      canvasManager: window.canvasManager
    };
  }
  return { canvasUtils: null, canvasManager: null };
};

/**
 * Get or create canvas using the canvas management system from actionButton.js
 * @returns {HTMLCanvasElement} Canvas element
 */
const getCanvas = () => {
  const { canvasUtils, canvasManager } = getCanvasUtils();
  
  // First try to use canvasUtils from actionButton.js
  if (canvasUtils && typeof canvasUtils.getCanvas === 'function') {
    return canvasUtils.getCanvas();
  }
  
  // Fallback to canvasManager
  if (canvasManager && typeof canvasManager.getCanvas === 'function') {
    return canvasManager.getCanvas() || canvasManager.createCanvas();
  }
  
  // Fallback to direct query
  return document.querySelector('#tracking-canvas');
};

/**
 * Transform canvas coordinates to viewport coordinates when in fullscreen
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} point - {x, y} point coordinates
 * @returns {Object} Transformed point coordinates
 */
const transformCoordinates = (canvas, point) => {
  if (!canvas || !point) return point;
  
  // Check if canvas is in fullscreen mode
  const isFullscreen = canvas.style.position === 'fixed' && 
                      (canvas.style.width === '100vw' || canvas.style.width === '100%');
  
  if (isFullscreen) {
    // Get the canvas's bounding rect to understand its position in the viewport
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate the scale factors
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;
    
    // Transform the coordinates
    const transformedPoint = {
      x: point.x * scaleX + canvasRect.left,
      y: point.y * scaleY + canvasRect.top,
      label: point.label
    };
    
    console.log('Coordinate transformation in CalibratePoints:', {
      original: point,
      transformed: transformedPoint,
      canvasRect,
      scale: { x: scaleX, y: scaleY }
    });
    
    return transformedPoint;
  }
  
  // If not fullscreen, return original coordinates
  return point;
};

/**
 * Draw dot using the canvas management system
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Dot radius
 * @returns {boolean} Success status
 */
const drawDotWithCanvasManager = (x, y, radius = 12) => {
  const { canvasUtils } = getCanvasUtils();
  
  if (canvasUtils && typeof canvasUtils.drawDot === 'function') {
    return canvasUtils.drawDot(x, y, radius);
  }
  
  // Fallback: manually draw dot
  const canvas = getCanvas();
  if (canvas) {
    const ctx = canvas.getContext('2d');
    drawCalibrationPointLegacy(ctx, x, y, radius);
    return true;
  }
  return false;
};

/**
 * Clear canvas using the canvas management system
 */
const clearCanvasWithManager = () => {
  const { canvasUtils, canvasManager } = getCanvasUtils();
  
  if (canvasUtils && typeof canvasUtils.clear === 'function') {
    canvasUtils.clear();
    return;
  }
  
  if (canvasManager && typeof canvasManager.clear === 'function') {
    canvasManager.clear();
    return;
  }
  
  // Fallback: manually clear canvas
  const canvas = getCanvas();
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
};

/**
 * Generate a grid of calibration points based on canvas dimensions
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Array} Array of point objects with x,y coordinates
 */
export const generateCalibrationPoints = (width, height) => {
  if (!width || !height || width <= 0 || height <= 0) {
    console.error("generateCalibrationPoints: Invalid canvas dimensions", { width, height });
    return [];
  }

  const conditionalRound = (dimension, percentage) => Math.round(dimension * percentage);

  // Outer frame (12% from edges)
  const xLeftOuter = conditionalRound(width, 0.12);
  const xRightOuter = width - xLeftOuter;
  const yTopOuter = conditionalRound(height, 0.12);
  const yBottomOuter = height - yTopOuter;

  // Inner frame (26% from edges)
  const xLeftInner = conditionalRound(width, 0.26);
  const xRightInner = width - xLeftInner;
  const yTopInner = conditionalRound(height, 0.26);
  const yBottomInner = height - yTopInner;

  const xCenter = Math.floor(width / 2);
  const yCenter = Math.floor(height / 2);

  return [
    // Outer frame (8 points)
    { x: xLeftOuter, y: yTopOuter, label: "Outer Top-Left" },
    { x: xCenter, y: yTopOuter, label: "Outer Top-Center" },
    { x: xRightOuter, y: yTopOuter, label: "Outer Top-Right" },
    { x: xLeftOuter, y: yCenter, label: "Outer Middle-Left" },
    { x: xRightOuter, y: yCenter, label: "Outer Middle-Right" },
    { x: xLeftOuter, y: yBottomOuter, label: "Outer Bottom-Left" },
    { x: xCenter, y: yBottomOuter, label: "Outer Bottom-Center" },
    { x: xRightOuter, y: yBottomOuter, label: "Outer Bottom-Right" },

    // Inner frame (8 points)
    { x: xLeftInner, y: yTopInner, label: "Inner Top-Left" },
    { x: xCenter, y: yTopInner, label: "Inner Top-Center" },
    { x: xRightInner, y: yTopInner, label: "Inner Top-Right" },
    { x: xLeftInner, y: yCenter, label: "Inner Middle-Left" },
    { x: xRightInner, y: yCenter, label: "Inner Middle-Right" },
    { x: xLeftInner, y: yBottomInner, label: "Inner Bottom-Left" },
    { x: xCenter, y: yBottomInner, label: "Inner Bottom-Center" },
    { x: xRightInner, y: yBottomInner, label: "Inner Bottom-Right" }
  ];
};

/**
 * Draw a calibration point on a canvas using the canvas management system
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} options - Optional settings (color, radius)
 * @returns {Object} Point position object {x, y}
 */
export const drawCalibrationPoint = (x, y, options = {}) => {
  const radius = options.radius || 12; // Use standard radius
  const success = drawDotWithCanvasManager(x, y, radius);
  return { x, y, success };
};

/**
 * Legacy function for backward compatibility (draws directly on canvas context)
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Dot radius
 * @returns {Object} Point position object {x, y}
 */
export const drawCalibrationPointLegacy = (ctx, x, y, radius = 12) => {
  if (!ctx) return { x, y };

  const canvas = ctx.canvas;
  
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'yellow';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw the dot with a bright red color
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'red';
  ctx.fill();
  
  // Add glow effect for better visibility
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Add a second larger glow for even better visibility
  ctx.beginPath();
  ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  console.log(`Drew calibration point at (${x}, ${y}) with radius ${radius}`);
  return { x, y };
};

/**
 * Draw all calibration points on a canvas (for debugging/visualization)
 * @param {Array} points - Array of point objects
 * @param {number} activeIndex - Index of the currently active point
 */
export const drawCalibrationGrid = (points, activeIndex = -1) => {
  if (!points || !points.length) return;

  const canvas = getCanvas();
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  clearCanvasWithManager();

  points.forEach((point, index) => {
    const isActive = index === activeIndex;
    const radius = isActive ? 12 : 6; // Use standard radius for active, smaller for inactive

    // Draw the point
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'red' : 'rgba(0, 102, 204, 0.7)';
    ctx.fill();

    // Add glow effect for active points
    if (isActive) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Draw point number
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${index + 1}`, point.x, point.y);

    // Draw label for active point
    if (isActive && point.label) {
      ctx.font = '12px Arial';
      ctx.fillStyle = 'black';
      ctx.fillText(point.label, point.x, point.y - 25);
    }
  });

  // Draw connecting lines (optional)
  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = 'rgba(0, 102, 204, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
};

/**
 * Clear all calibration points from canvas
 */
export const clearCalibrationPoints = () => {
  clearCanvasWithManager();
};

// Default export for React compatibility
const CalibratePoints = () => null; // This is a utility file, so we don't need to render anything

export default CalibratePoints; 