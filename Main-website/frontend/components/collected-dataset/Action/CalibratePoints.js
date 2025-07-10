// CalibratePoints.js
// Utility for generating and managing calibration points on a canvas

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
 * Draw a calibration point on a canvas
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} options - Optional settings (color, radius)
 * @returns {Object} Point position object {x, y}
 */
export const drawCalibrationPoint = (canvas, x, y, options = {}) => {
  if (!canvas) return { x, y };

  const ctx = canvas.getContext('2d');
  const color = options.color || 'red';
  const radius = options.radius || 8;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Glow effect
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  return { x, y };
};

/**
 * Draw all calibration points on a canvas (for debugging/visualization)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} points - Array of point objects
 * @param {number} activeIndex - Index of the currently active point
 */
export const drawCalibrationGrid = (canvas, points, activeIndex = -1) => {
  if (!canvas || !points || !points.length) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  points.forEach((point, index) => {
    const isActive = index === activeIndex;

    ctx.beginPath();
    ctx.arc(point.x, point.y, isActive ? 8 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'red' : 'rgba(0, 102, 204, 0.7)';
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${index + 1}`, point.x, point.y);

    if (isActive && point.label) {
      ctx.font = '12px Arial';
      ctx.fillText(point.label, point.x, point.y - 20);
    }
  });

  // Draw connecting lines (optional)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = 'rgba(0, 102, 204, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
};

// Optional: Default export all for convenience
export default {
  generateCalibrationPoints,
  drawCalibrationPoint,
  drawCalibrationGrid
};