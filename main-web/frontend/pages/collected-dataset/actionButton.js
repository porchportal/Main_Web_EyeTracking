import React from 'react';

const ActionButton = ({ text, onClick, customClass = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`bg-mint-200 hover:bg-mint-300 transition-colors py-2 px-4 rounded-md text-sm font-medium ${customClass}`}
    >
      {text}
    </button>
  );
};

const ActionButtonGroup = ({ triggerCameraAccess }) => {
  const handlePreviewClick = () => {
    triggerCameraAccess();
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
      <div className="col-span-2 md:col-span-3 flex justify-between border-r border-gray-300 pr-2">
        <ActionButton text="Set Random" />
        <ActionButton text="Random Dot" />
      </div>
      
      <div className="col-span-2 md:col-span-3 flex justify-between border-r border-gray-300 pr-2 mt-2">
        <ActionButton text="Set Calibrate" />
        <ActionButton text="Clear All" />
      </div>
      
      <div className="col-span-2 md:col-span-3 flex justify-between mt-2">
        <ActionButton text="Head pose" onClick={() => {}} />
        <ActionButton text="□ Box" customClass="mx-2" />
      </div>
      
      <div className="col-span-2 md:col-span-3 flex justify-between mt-2">
        <ActionButton text="Preview" onClick={handlePreviewClick} />
        <ActionButton text="😊 Mask" customClass="mx-2" />
        <ActionButton text="Values" />
      </div>
    </div>
  );
};

export { ActionButton, ActionButtonGroup };