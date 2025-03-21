import React from 'react';
import { useRouter } from 'next/router';

const TopBar = ({ isCompactMode }) => {
  const router = useRouter();
  
  return (
    <div className="bg-white w-full">
      <div className="flex flex-row items-center p-2">
        {/* Logo section - Left side */}
        <div className="flex flex-col mr-8">
          <h1 
            className="text-4xl font-bold cursor-pointer"
            onClick={() => router.push('/')}
          >
            Logo
          </h1>
        </div>
        
        {/* Time & Delay section */}
        <div className="flex flex-col mr-4">
          <div className="flex items-center mb-2">
            <span className="mr-2">T:</span>
            <div 
              className="w-12 h-8 flex items-center justify-center rounded-md" 
              style={{ backgroundColor: '#7CFFDA' }}
            >
              <span>1</span>
            </div>
          </div>
          
          <div className="flex items-center">
            <span className="mr-2">D:</span>
            <div 
              className="w-12 h-8 flex items-center justify-center rounded-md"
              style={{ backgroundColor: '#7CFFDA' }}
            >
              <span>3</span>
            </div>
          </div>
        </div>
        
        {/* First column of buttons */}
        <div className="flex flex-col mr-2">
          <button
            className="mb-2 py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            SRandom
          </button>
          
          <button
            className="py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            Calibrate
          </button>
        </div>
        
        {/* Second column of buttons */}
        <div className="flex flex-col mr-2">
          <button
            className="mb-2 py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            Random
          </button>
          
          <button
            className="py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            Clear
          </button>
        </div>
        
        {/* Vertical divider */}
        <div className="border-l border-gray-300 h-20 mx-4"></div>
        
        {/* Third column of buttons */}
        <div className="flex flex-col mr-2">
          <button
            className="mb-2 py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            Head pose
          </button>
          
          <button
            className="py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            Preview
          </button>
        </div>
        
        {/* Fourth column of buttons */}
        <div className="flex flex-col mr-2">
          <button
            className="mb-2 py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            ☐ Box
          </button>
          
          <button
            className="py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            😊 Mask
          </button>
        </div>
        
        {/* Fifth column of buttons */}
        <div className="flex flex-col mr-4">
          <button
            className="mb-2 py-2 px-4 rounded-md opacity-0"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            {/* Invisible placeholder for alignment */}
          </button>
          
          <button
            className="py-2 px-4 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            Values
          </button>
        </div>
        
        {/* Empty section for spacing */}
        <div className="flex-grow">
          {/* This creates space before the action buttons */}
        </div>
        
        {/* Action buttons on the right */}
        <div className="flex flex-col">
          <button 
            className="mb-2 p-2 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          
          <button 
            className="p-2 rounded-md"
            style={{ backgroundColor: '#7CFFDA' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Light mint divider */}
      <div className="w-full h-1" style={{ backgroundColor: '#7CFFDA', opacity: 0.3 }}></div>
    </div>
  );
};

export default TopBar;