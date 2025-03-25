// mock-mode.js - Used for testing without backend
export const ENABLE_MOCK_MODE = false; // Set to false to use real backend

// Mock camera processing function to simulate backend processing
export const mockProcessFrame = (videoElement, options) => {
  // Create a canvas to draw the frame
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size to match video
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  // Draw the current video frame
  ctx.drawImage(videoElement, 0, 0);
  
  // Apply visual effects based on options
  if (options.showHeadPose) {
    drawMockHeadPose(ctx, canvas.width, canvas.height);
  }
  
  if (options.showBoundingBox) {
    drawMockBoundingBox(ctx, canvas.width, canvas.height);
  }
  
  if (options.showMask) {
    drawMockMask(ctx, canvas.width, canvas.height);
  }
  
  // Generate mock metrics
  const faceDetected = Math.random() > 0.1; // 90% chance of face detected
  const metrics = faceDetected ? generateMockMetrics() : { face_detected: false };
  
  // Convert canvas to base64
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  const base64Data = dataUrl.split(',')[1];
  
  // Return mock response
  return {
    success: true,
    metrics,
    image: base64Data
  };
};

// Helper to draw a mock head pose
const drawMockHeadPose = (ctx, width, height) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const time = Date.now() / 1000;
  
  // Draw X axis (red)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + 100 * Math.sin(time), centerY);
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw Y axis (green)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX, centerY + 100 * Math.sin(time + 1));
  ctx.strokeStyle = 'green';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw Z axis (blue)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + 50 * Math.sin(time + 2), centerY - 50 * Math.cos(time + 2));
  ctx.strokeStyle = 'blue';
  ctx.lineWidth = 3;
  ctx.stroke();
};

// Helper to draw a mock bounding box
const drawMockBoundingBox = (ctx, width, height) => {
  const boxSize = Math.min(width, height) * 0.4;
  const leftX = (width - boxSize) / 2;
  const topY = (height - boxSize) / 2;
  
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 2;
  ctx.strokeRect(leftX, topY, boxSize, boxSize);
  
  // Draw corner markers
  ctx.fillStyle = 'yellow';
  const markerSize = 8;
  
  // Top left
  ctx.fillRect(leftX - markerSize/2, topY - markerSize/2, markerSize, markerSize);
  // Top right
  ctx.fillRect(leftX + boxSize - markerSize/2, topY - markerSize/2, markerSize, markerSize);
  // Bottom left
  ctx.fillRect(leftX - markerSize/2, topY + boxSize - markerSize/2, markerSize, markerSize);
  // Bottom right
  ctx.fillRect(leftX + boxSize - markerSize/2, topY + boxSize - markerSize/2, markerSize, markerSize);
};

// Helper to draw a mock face mask
const drawMockMask = (ctx, width, height) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.2;
  
  // Draw semi-transparent face mask
  ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw eyes
  const eyeRadius = radius * 0.15;
  const eyeOffsetX = radius * 0.3;
  const eyeOffsetY = radius * 0.1;
  
  // Left eye
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Right eye
  ctx.beginPath();
  ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw mouth
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY + radius * 0.2, radius * 0.4, 0.2, Math.PI - 0.2);
  ctx.stroke();
};

// Generate mock metrics
const generateMockMetrics = () => {
  const time = Date.now() / 1000;
  
  return {
    face_detected: true,
    head_pose: {
      pitch: Math.sin(time) * 20,
      yaw: Math.sin(time + 1) * 30,
      roll: Math.sin(time + 2) * 15
    },
    eye_centers: {
      left: [100, 100],
      right: [140, 100]
    }
  };
};