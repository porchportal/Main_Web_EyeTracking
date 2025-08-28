// delayUI.jsx
// Reusable countdown UI component for delay periods

class DelayUI {
  constructor() {
    this.countdownElement = null;
    console.log('DelayUI: Constructor called - DelayUI instance created');
  }

  // Create countdown display element
  createCountdownDisplay(delay) {
    console.log('DelayUI: createCountdownDisplay called with delay:', delay);
    // Remove existing countdown display if any
    this.removeCountdownDisplay();
    
    const countdownDiv = document.createElement('div');
    countdownDiv.id = 'countdown-display';
    countdownDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      font-family: 'Arial', sans-serif;
      z-index: 9999;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      border: 2px solid #4CAF50;
      min-width: 120px;
    `;
    
    countdownDiv.innerHTML = `
      <div style="font-size: 14px; margin-bottom: 5px; color: #4CAF50;">Next Capture:</div>
      <div id="countdown-number" style="font-size: 24px; color: #ffffff; font-weight: bold;">${delay}s</div>
    `;
    
    document.body.appendChild(countdownDiv);
    this.countdownElement = countdownDiv;
    console.log('DelayUI: Countdown element created and appended to DOM');
  }

  // Update countdown display
  updateCountdownDisplay(seconds) {
    const countdownNumber = document.getElementById('countdown-number');
    if (countdownNumber) {
      countdownNumber.textContent = `${seconds}s`;
      
      // Simple visual feedback for last 2 seconds
      if (seconds <= 1) {
        countdownNumber.style.color = '#ff6b6b';
      } else {
        countdownNumber.style.color = '#ffffff';
      }
    }
  }

  // Remove countdown display
  removeCountdownDisplay() {
    if (this.countdownElement) {
      this.countdownElement.remove();
      this.countdownElement = null;
    } else {
      const existing = document.getElementById('countdown-display');
      if (existing) {
        existing.remove();
      }
    }
  }

  // Start countdown with delay value
  async startCountdown(delay, onComplete) {
    if (!delay || delay <= 0) {
      console.warn('DelayUI: Invalid delay value:', delay);
      if (onComplete) onComplete();
      return;
    }

    try {
      // Create and show initial countdown display
      this.createCountdownDisplay(delay);
      
      // Start countdown from delay value
      for (let i = delay; i > 0; i--) {
        this.updateCountdownDisplay(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Remove countdown display when complete
      this.removeCountdownDisplay();
      
      // Call completion callback
      if (onComplete) {
        onComplete();
      }
      
    } catch (error) {
      console.error('DelayUI: Error during countdown:', error);
      this.removeCountdownDisplay();
      if (onComplete) onComplete();
    }
  }

  // Start countdown after process completion (for SetRandomAction style)
  async startCountdownAfterProcess(delay, onComplete) {
    console.log('DelayUI: startCountdownAfterProcess called with delay:', delay);
    
    if (!delay || delay <= 0) {
      console.warn('DelayUI: Invalid delay value:', delay);
      if (onComplete) onComplete();
      return;
    }

    try {
      console.log('DelayUI: Creating countdown display...');
      // Create and show initial countdown display
      this.createCountdownDisplay(delay);
      
      // Countdown display
      for (let i = delay - 1; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.updateCountdownDisplay(i);
      }
      
      // Remove countdown display
      this.removeCountdownDisplay();
      
      // Call completion callback
      if (onComplete) {
        onComplete();
      }
      
    } catch (error) {
      console.error('DelayUI: Error during countdown:', error);
      this.removeCountdownDisplay();
      if (onComplete) onComplete();
    }
  }

  // Cleanup method for component unmounting
  cleanup() {
    this.removeCountdownDisplay();
  }
}

export default DelayUI;
