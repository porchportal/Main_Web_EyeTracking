import React from 'react';

const DisplayResponse = ({ width, height, distance }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mt-4 max-w-xs ml-auto">
      <div className="text-sm text-center">
        <p>W: {width || '---'} (pixels) H: {height || '---'} (pixels)</p>
        <p>Distance: {distance || '---'} (cm)</p>
      </div>
    </div>
  );
};

export default DisplayResponse;