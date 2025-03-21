import React from 'react';

const TopBar = () => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-mint-100 border-b border-gray-200">
      <div className="flex items-center mb-2 sm:mb-0">
        <h1 className="text-2xl font-bold mr-8">Logo</h1>
        
        <div className="flex items-center mx-2">
          <span className="mr-2 text-sm">Time(s):</span>
          <input 
            type="text" 
            value="1" 
            className="w-12 h-8 text-center bg-mint-200 rounded"
            readOnly
          />
        </div>
        
        <div className="flex items-center mx-2">
          <span className="mr-2 text-sm">Delay(s):</span>
          <input 
            type="text" 
            value="3" 
            className="w-12 h-8 text-center bg-mint-200 rounded"
            readOnly
          />
        </div>
      </div>
      
      <div className="flex justify-end">
        <button className="bg-mint-500 p-2 rounded">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TopBar;