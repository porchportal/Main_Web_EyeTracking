// DotCaptureUtil.js
// Utility functions for dot capture and preview display

// Show preview of captured images
export const showImagePreview = (screenImage, webcamImage, dotPosition) => {
    // Create a preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'capture-preview-container';
    previewContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      display: flex;
      gap: 10px;
      background-color: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    `;
    
    // Add screen capture preview if available
    if (screenImage) {
      const screenPreview = document.createElement('div');
      screenPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const screenImg = document.createElement('img');
      screenImg.src = screenImage;
      screenImg.style.cssText = `
        max-width: 200px;
        max-height: 150px;
        border: 2px solid white;
        border-radius: 4px;
      `;
      
      const screenLabel = document.createElement('div');
      screenLabel.textContent = 'Screen Capture';
      screenLabel.style.cssText = `
        color: white;
        font-size: 12px;
        margin-top: 5px;
      `;
      
      screenPreview.appendChild(screenImg);
      screenPreview.appendChild(screenLabel);
      previewContainer.appendChild(screenPreview);
    }
    
    // Add webcam capture preview if available
    if (webcamImage) {
      const webcamPreview = document.createElement('div');
      webcamPreview.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;
      
      const webcamImg = document.createElement('img');
      webcamImg.src = webcamImage;
      webcamImg.style.cssText = `
        max-width: 200px;
        max-height: 150px;
        border: 2px solid white;
        border-radius: 4px;
      `;
      
      const webcamLabel = document.createElement('div');
      webcamLabel.textContent = 'Webcam Capture';
      webcamLabel.style.cssText = `
        color: white;
        font-size: 12px;
        margin-top: 5px;
      `;
      
      webcamPreview.appendChild(webcamImg);
      webcamPreview.appendChild(webcamLabel);
      previewContainer.appendChild(webcamPreview);
    }
    
    // Add info about dot position
    if (dotPosition) {
      const positionInfo = document.createElement('div');
      positionInfo.textContent = `Dot position: x=${Math.round(dotPosition.x)}, y=${Math.round(dotPosition.y)}`;
      positionInfo.style.cssText = `
        color: #ffcc00;
        font-size: 12px;
        position: absolute;
        top: -20px;
        left: 10px;
      `;
      previewContainer.appendChild(positionInfo);
    }
    
    // Add the preview to the document
    document.body.appendChild(previewContainer);
    
    return previewContainer;
  };
  
  // Create and append a countdown element above a dot
  export const createDotCountdown = (position, canvasRect) => {
    // Create the countdown element directly above the dot
    const countdownElement = document.createElement('div');
    countdownElement.className = 'forced-countdown';
    
    // Position it above the dot (calculate absolute position considering the canvas position)
    const absoluteX = canvasRect.left + position.x;
    const absoluteY = canvasRect.top + position.y;
    
    countdownElement.style.cssText = `
      position: fixed;
      left: ${absoluteX}px;
      top: ${absoluteY - 60}px;
      transform: translateX(-50%);
      color: red;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 0 10px white, 0 0 20px white;
      z-index: 9999;
      background-color: rgba(255, 255, 255, 0.8);
      border: 2px solid red;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(countdownElement);
    
    return countdownElement;
  };
  
  // Draw a red dot on the canvas
  export const drawRedDot = (ctx, x, y, radius = 12) => {
    // Draw the dot with a glow effect
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
    
    // Add glow effect to the dot
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    return { x, y };
  };
  
  // Initialize the canvas for drawing
  export const initializeCanvas = (canvas, parent) => {
    if (!canvas || !parent) return false;
    
    // Set canvas dimensions to match parent
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    
    // Clear canvas and set white background
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return true;
  };
  
  // Generate a random position on the canvas
  export const getRandomPosition = (canvas, padding = 40) => {
    if (!canvas) return { x: 100, y: 100 }; // Fallback position
    
    const width = canvas.width || 400;  // Fallback if width is 0
    const height = canvas.height || 300; // Fallback if height is 0
    
    return {
      x: Math.floor(Math.random() * (width - 2 * padding)) + padding,
      y: Math.floor(Math.random() * (height - 2 * padding)) + padding
    };
  };