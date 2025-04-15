// pages/process_set/processApi.js - API functions for process_set

// Check if the backend is connected
export const checkBackendConnection = async () => {
    try {
      const response = await fetch('/api/check-backend-connection');
      const data = await response.json();
      return { success: true, connected: data.connected };
    } catch (error) {
      console.error('Error checking backend connection:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Get list of files from both capture and enhance folders
  export const getFilesList = async () => {
    try {
      const response = await fetch('/api/for-process-folder/file-api?operation=list');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting files list:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Check file completeness (if webcam, screen, and parameter files exist for each set)
  export const checkFilesCompleteness = async () => {
    try {
      const response = await fetch('/api/for-process-folder/file-api?operation=check-completeness');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking files completeness:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Preview a specific file
  export const previewFile = async (filename) => {
    try {
      const response = await fetch(`/api/for-process-folder/preview-api?filename=${encodeURIComponent(filename)}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error previewing file:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Process files - trigger the Python script to process files
  export const processFiles = async (setNumbers) => {
    try {
      const response = await fetch('/api/for-process-folder/process-status-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setNumbers }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error processing files:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Compare files between capture and enhance folders
  export const compareFileCounts = async () => {
    try {
      const response = await fetch('/api/for-process-folder/file-api?operation=compare');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error comparing file counts:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Check if processing is currently running
  export const checkProcessingStatus = async () => {
    try {
      const response = await fetch('/api/for-process-folder/process-status-api');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking processing status:', error);
      return { success: false, error: error.message };
    }
  };