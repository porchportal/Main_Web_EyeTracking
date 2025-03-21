import React, { useState, useEffect } from 'react';

const ActionButton = ({ text, abbreviatedText, onClick, customClass = '' }) => {
  const [isAbbreviated, setIsAbbreviated] = useState(false);
  
  // Check window size and set abbreviated mode
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsAbbreviated(width < 768);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize(); // Initial call
      
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  return (
    <button
      onClick={onClick}
      className={`transition-colors py-2 px-2 md:px-4 rounded-md text-xs md:text-sm font-medium ${customClass}`}
      style={{ 
        backgroundColor: 'rgba(124, 255, 218, 0.5)', 
        borderRadius: '7px'
      }}
    >
      {isAbbreviated ? abbreviatedText : text}
    </button>
  );
};

const ActionButtonGroup = ({ triggerCameraAccess, isCompactMode }) => {
  const handlePreviewClick = () => {
    triggerCameraAccess();
  };

  // Button configurations with both full and abbreviated text
  const buttons = [
    { text: "Set Random", abbreviatedText: "SRandom" },
    { text: "Random Dot", abbreviatedText: "Random" },
    { text: "Set Calibrate", abbreviatedText: "Calibrate" },
    { text: "Clear All", abbreviatedText: "Clear" },
    { divider: true },
    { text: "Draw Head pose", abbreviatedText: "Head pose" },
    { text: "Show Bounding Box", abbreviatedText: "☐ Box" },
    { text: "Show Preview", abbreviatedText: "Preview", onClick: handlePreviewClick },
    { text: "😷 Show Mask", abbreviatedText: "😷 Mask" },
    { text: "Parameters", abbreviatedText: "Values" }
  ];

  // We'll use different layouts for mobile and desktop
  return isCompactMode ? (
    // Mobile layout - 2x5 grid
    <div className="grid grid-cols-2 gap-2 mb-4">
      {buttons.filter(b => !b.divider).map((button, index) => (
        <ActionButton 
          key={index}
          text={button.text}
          abbreviatedText={button.abbreviatedText}
          onClick={button.onClick || (() => {})}
          isCompactMode={isCompactMode}
        />
      ))}
    </div>
  ) : (
    // Desktop layout - more spacious layout with divider
    <div className="space-y-2 mb-4">
      <div className="grid grid-cols-2 gap-2">
        <ActionButton 
          text="Set Random"
          abbreviatedText="SRandom" 
          isCompactMode={isCompactMode}
        />
        <ActionButton 
          text="Random Dot"
          abbreviatedText="Random" 
          isCompactMode={isCompactMode}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ActionButton 
          text="Set Calibrate"
          abbreviatedText="Calibrate" 
          isCompactMode={isCompactMode}
        />
        <ActionButton 
          text="Clear All"
          abbreviatedText="Clear" 
          isCompactMode={isCompactMode}
        />
      </div>
      
      <hr className="my-3 border-gray-200" />
      
      <div className="grid grid-cols-2 gap-2">
        <ActionButton 
          text="Draw Head pose"
          abbreviatedText="Head pose" 
          isCompactMode={isCompactMode}
        />
        <ActionButton 
          text="Show Bounding Box"
          abbreviatedText="☐ Box" 
          isCompactMode={isCompactMode}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ActionButton 
          text="Show Preview"
          abbreviatedText="Preview"
          onClick={handlePreviewClick}
          isCompactMode={isCompactMode}
        />
        <ActionButton 
          text="😷 Show Mask"
          abbreviatedText="😷 Mask" 
          isCompactMode={isCompactMode}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ActionButton 
          text="Parameters"
          abbreviatedText="Values" 
          isCompactMode={isCompactMode}
        />
        <div></div> {/* Empty space for alignment */}
      </div>
    </div>
  );
};

export { ActionButton, ActionButtonGroup };