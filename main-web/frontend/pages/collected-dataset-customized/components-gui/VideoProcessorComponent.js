// components-gui/VideoProcessorComponent.js
import React, { useEffect } from 'react';
import useVideoProcessor from './videoProcessor';

const VideoProcessorComponent = () => {
  const processor = useVideoProcessor();
  
  useEffect(() => {
    if (processor) {
      window.videoProcessor = processor;
    }
  }, [processor]);
  
  return null;
};

export default VideoProcessorComponent;