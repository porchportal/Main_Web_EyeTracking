import React from 'react';

const DisplayResponse = ({ width, height, distance }) => {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-3 mt-4 max-w-xs" 
         style={{ borderRadius: '7px' }}>
      <div className="text-sm text-center font-roboto">
        <p>W: {width || '---'} (pixels) H: {height || '---'} (pixels)</p>
        <p>Distance: {distance || '---'} (cm)</p>
      </div>
    </div>
  );
};

export default DisplayResponse;