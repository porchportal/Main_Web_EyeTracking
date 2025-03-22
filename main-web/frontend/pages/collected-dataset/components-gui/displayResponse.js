import React from 'react';

const DisplayResponse = ({ width, height, distance }) => {
  return (
    <div className="metrics-display">
      <p>W: {width} (pixels) H: {height} (pixels)</p>
      <p>Distance: {distance} (cm)</p>
    </div>
  );
};

export default DisplayResponse;