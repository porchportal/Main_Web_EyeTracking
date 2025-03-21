import React from 'react';
import { useRouter } from 'next/router';

const TopBar = () => {
  const router = useRouter();
  
  return (
    <div className="p-0 m-0">
      {/* Logo */}
      <div className="mb-2">
        <h1 
          className="text-4xl font-bold cursor-pointer"
          onClick={() => router.push('/')}
        >
          Logo
        </h1>
      </div>
      
      {/* Time input - full width */}
      <div className="mb-2">
        <span className="block mb-1">T:</span>
        <div 
          className="w-full h-8 flex items-center px-2" 
          style={{ backgroundColor: '#7CFFDA' }}
        >
          <span>1</span>
        </div>
      </div>
      
      {/* Delay input - full width */}
      <div className="mb-2">
        <span className="block mb-1">D:</span>
        <div 
          className="w-full h-8 flex items-center px-2"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          <span>3</span>
        </div>
      </div>
      
      {/* First row of buttons */}
      <div className="flex mb-2">
        <button
          className="mr-1 py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          SRandom
        </button>
        <button
          className="py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          Calibrate
        </button>
      </div>
      
      {/* Second row of buttons */}
      <div className="flex mb-2">
        <button
          className="mr-1 py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          Random
        </button>
        <button
          className="py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          Clear
        </button>
      </div>
      
      {/* Third row of buttons */}
      <div className="flex mb-2">
        <button
          className="mr-1 py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          Head pose
        </button>
        <button
          className="py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          Preview
        </button>
      </div>
      
      {/* Fourth row of buttons */}
      <div className="flex mb-2">
        <button
          className="mr-1 py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          ☐ Box
        </button>
        <button
          className="py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          😊 Mask
        </button>
      </div>
      
      {/* Fifth row - Values button */}
      <div className="flex mb-2">
        <button
          className="py-1 px-2 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          Values
        </button>
      </div>
      
      {/* Menu buttons */}
      <div className="flex mb-2">
        <button 
          className="mr-1 p-1 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          <span>≡</span>
        </button>
        
        <button 
          className="p-1 border border-black"
          style={{ backgroundColor: '#7CFFDA' }}
        >
          <span>◯</span>
        </button>
      </div>
    </div>
  );
};

export default TopBar;