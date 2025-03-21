import React from 'react';
import { useRouter } from 'next/router';

const TopBar = ({ isCompactMode }) => {
  const router = useRouter();
  
  return (
    <div className="bg-white p-4">
      <div className="flex flex-col">
        <h1 
          className="text-4xl font-bold mb-4 cursor-pointer"
          onClick={() => router.push('/')}
        >
          Logo
        </h1>
        
        <div className="flex items-center justify-between">
          <div className="w-full max-w-5xl mx-auto grid grid-cols-3 gap-4">
            {/* Left column - time and delay controls */}
            <div className="flex flex-col">
              <div className="flex items-center mb-3">
                <span className="w-20 text-sm font-medium">{isCompactMode ? 'T:' : 'Time(s):'}</span>
                <div 
                  className="w-12 h-8 flex items-center justify-center rounded-md" 
                  style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
                >
                  <span>1</span>
                </div>
              </div>
              
              <div className="flex items-center">
                <span className="w-20 text-sm font-medium">{isCompactMode ? 'D:' : 'Delay(s):'}</span>
                <div 
                  className="w-12 h-8 flex items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
                >
                  <span>3</span>
                </div>
              </div>
            </div>

            {/* Middle column - first group of buttons */}
            <div className="flex flex-col gap-2">
              <button
                className="py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? 'SRandom' : 'Set Random'}
              </button>
              <button
                className="py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? 'Calibrate' : 'Set Calibrate'}
              </button>
            </div>

            {/* Middle-right column - second group of buttons */}
            <div className="flex flex-col gap-2">
              <button
                className="py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? 'Random' : 'Random Dot'}
              </button>
              <button
                className="py-2 px-4 rounded-md text-sm"
                style={{ backgroundColor: 'rgba(124, 255, 218, 0.5)' }}
              >
                {isCompactMode ? 'Clear' : 'Clear All'}
              </button>
            </div>
          </div>

          {/* Action buttons on the right */}
          <div className="flex flex-col ml-4 gap-2">
            <button 
              className="p-2 rounded-md"
              style={{ backgroundColor: 'rgba(124, 255, 183, 1)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            
            <button 
              className="p-2 rounded-md"
              style={{ backgroundColor: 'rgba(124, 255, 183, 0.3)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;