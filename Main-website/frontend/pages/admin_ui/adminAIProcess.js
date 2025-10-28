// adminAIProcess.js
// Admin AI Process component for processing eye tracking data

import React, { useState, useEffect, useRef } from 'react';
import styles from './style/adminAIProcess.module.css';

// Import API functions from process_set
import {
  checkBackendConnection,
  checkProcessingStatus,
  processFiles,
  getCurrentUserId
} from '../process_set/processApi';

// Import dataset reader utilities from process_set
import { 
  datasetReader, 
  readFile, 
  preloadFiles, 
  readFileFromFolder, 
  preloadFilesFromFolder,
  getFilesList,
  checkFilesCompleteness,
  checkFilesNeedProcessing,
  previewFile
} from '../process_set/readDataset';

// Import UI components from process_set
import {
  FilePreviewPanel,
  FileList,
  ActionButtons,
  Notification,
  ProcessSummary,
  ProcessingProgress,
  EnhanceFaceToggle
} from '../process_set/sectionPreview';

const AdminAIProcess = ({ userId, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [files, setFiles] = useState({ capture: [], enhance: [] });
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('captures');
  const [previewImageData, setPreviewImageData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [enhanceFace, setEnhanceFace] = useState(false);
  const [captureLoaded, setCaptureLoaded] = useState(false);
  const [filesChecked, setFilesChecked] = useState(false);
  const [isProcessReady, setIsProcessReady] = useState(false);

  // Use the global notification function from NotiMessage component in parent (admin.js)
  // The parent page exposes window.showNotification globally
  const showNotification = (message, type = 'info') => {
    if (typeof window !== 'undefined' && window.showNotification) {
      console.log(`[AdminAIProcess] Showing notification: "${message}" (type: ${type})`);
      window.showNotification(message, type);
    } else {
      // Fallback to console if notification system isn't ready
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };

  // Check backend connection using process_set function
  const checkConnection = async () => {
    setLoading(true);
    const result = await checkBackendConnection();

    if (result.success && result.connected) {
      setBackendConnected(true);
      // Removed notification - will show summary after loadFiles completes
    } else {
      showNotification('Cannot connect to backend server', 'error');
      setBackendConnected(false);
    }
    setLoading(false);
  };
  // Load files using process_set functions
  const loadFiles = async (showNotif = false) => {
    console.log(`[AdminAIProcess] loadFiles called with showNotif=${showNotif}`);
    if (!userId) return;

    setLoading(true);
    try {
      // Get files list from all three folders using process_set functions
      const captureResult = await getFilesList('captures', userId);
      const enhanceResult = await getFilesList('enhance', userId);
      const completeResult = await getFilesList('complete', userId);
      
      if (captureResult.success || enhanceResult.success || completeResult.success) {
        const organizedFiles = {
          capture: captureResult.success ? captureResult.files.map(file => {
            // Handle both old format (string) and new format (object)
            if (typeof file === 'string') {
              return {
                filename: file,
                path: `/captures/${userId}/${file}`,
                file_type: file.split('.').pop(),
                size: 0
              };
            } else {
              return {
                filename: file.filename,
                path: file.path || `/captures/${userId}/${file.filename}`,
                file_type: file.file_type || file.filename.split('.').pop(),
                size: file.size || 0
              };
            }
          }) : [],
          enhance: enhanceResult.success ? enhanceResult.files.map(file => {
            // Handle both old format (string) and new format (object)
            if (typeof file === 'string') {
              return {
                filename: file,
                path: `/enhance/${userId}/${file}`,
                file_type: file.split('.').pop(),
                size: 0
              };
            } else {
              return {
                filename: file.filename,
                path: file.path || `/enhance/${userId}/${file.filename}`,
                file_type: file.file_type || file.filename.split('.').pop(),
                size: file.size || 0
              };
            }
          }) : [],
          complete: completeResult.success ? completeResult.files.map(file => {
            // Handle both old format (string) and new format (object)
            if (typeof file === 'string') {
              return {
                filename: file,
                path: `/complete/${userId}/${file}`,
                file_type: file.split('.').pop(),
                size: 0
              };
            } else {
              return {
                filename: file.filename,
                path: file.path || `/complete/${userId}/${file.filename}`,
                file_type: file.file_type || file.filename.split('.').pop(),
                size: file.size || 0
              };
            }
          }) : []
        };
        
        setFiles(organizedFiles);
        setCaptureLoaded(captureResult.success && captureResult.files.length > 0);

        // Check file completeness using process_set function
        const completenessResult = await checkFilesCompleteness(userId);

        // Check if processing is needed using process_set function
        const processingResult = await checkFilesNeedProcessing(userId, enhanceFace);
        if (processingResult.success) {
          setIsProcessReady(processingResult.needsProcessing);
          setFilesChecked(true);
        }

        // Show single summary notification only when explicitly requested
        if (showNotif && completenessResult.success && processingResult.success) {
          if (completenessResult.totalSets === 0) {
            showNotification('No capture files found', 'info');
          } else if (processingResult.needsProcessing) {
            showNotification(`Files loaded: ${processingResult.filesToProcess} sets need processing`, 'info');
          } else {
            showNotification('Files loaded: All sets are processed', 'success');
          }
        }
      } else {
        if (showNotif) {
          showNotification('Error loading files', 'error');
        }
      }
    } catch (error) {
      console.error('Error loading files:', error);

      // Only show error notifications when explicitly requested
      if (showNotif) {
        // Provide user-friendly message for 503 errors
        if (error.message && (error.message.includes('503') || error.message.includes('Service temporarily unavailable'))) {
          showNotification('Backend is busy processing images. Please wait a moment and try again.', 'info');
        } else {
          showNotification('Error loading files: ' + error.message, 'error');
        }
      }
    }
    setLoading(false);
  };

  // Handle file selection using process_set functions
  const handleFileSelect = async (filename, folder = 'captures') => {
    setSelectedFile(filename);
    setSelectedFolder(folder);
    setPreviewImageData(null);
    
    try {
      // Use process_set function to load file preview
      const result = await readFileFromFolder(filename, folder, userId, true);
      
      if (result.success) {
        setPreviewImageData({
          data: result.data,
          type: result.type
        });
      } else {
        showNotification('Error loading preview: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error in handleFileSelect:', error);
      showNotification('Error loading preview: ' + error.message, 'error');
    }
  };

  // Process files using process_set function
  const processFilesLocal = async () => {
    if (!captureLoaded) {
      showNotification('Please load capture dataset first', 'info');
      return;
    }
    
    if (!filesChecked) {
      showNotification('Please check files first', 'info');
      return;
    }
    
    if (!isProcessReady) {
      showNotification('No files need processing', 'info');
      return;
    }
    
    if (isProcessing) {
      showNotification('Processing is already in progress', 'info');
      return;
    }
    
    setIsProcessing(true);
    showNotification('Processing started...', 'info');
    
    try {
      // Get the processing status using process_set function
      const result = await checkFilesNeedProcessing(userId, enhanceFace);
      if (!result.success) {
        throw new Error('Failed to get processing status');
      }

      if (!result.setsNeedingProcessing || result.setsNeedingProcessing.length === 0) {
        showNotification('No files need processing', 'info');
        setIsProcessing(false);
        return;
      }

      // Initialize progress data
      setProgressData({
        currentSet: 0,
        totalSets: result.setsNeedingProcessing.length,
        processedSets: [],
        currentFile: '',
        progress: 0,
        status: 'processing',
        message: 'Starting processing...'
      });

      // Use process_set function to process files
      const processResult = await processFiles(result.setsNeedingProcessing, userId, enhanceFace);

      if (!processResult.success) {
        const errorMessage = processResult.error || processResult.message || 'Processing failed';
        console.error('Processing failed:', {
          error: processResult.error,
          message: processResult.message,
          details: processResult
        });
        throw new Error(errorMessage);
      }

      // The progress polling will handle updating the progress bar in real-time
      // and will show completion notification when processing is done
      // We don't need to manually update progress data here since polling handles it

    } catch (error) {
      console.error('Error during processing:', {
        error: error.message,
        stack: error.stack,
        userId: userId,
        enhanceFace: enhanceFace
      });

      // Provide more detailed error messages
      let errorMessage = error.message || 'Error during processing';

      if (error.message?.includes('Backend service unavailable')) {
        errorMessage = 'The image processing service is not running. Please start the backend service and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Processing took too long and timed out. Please try processing fewer files at once.';
      } else if (error.message?.includes('Server error (500)')) {
        errorMessage = 'Server error occurred. Please check the console for more details and try again.';
      }

      showNotification(errorMessage, 'error');

      // On error, immediately stop processing and clear progress
      setIsProcessing(false);
      setProgressData(null);
    }
    // Note: We don't clear isProcessing and progressData in finally block
    // because the progress polling will handle completion detection
  };

  // Handle enhance face toggle
  const handleEnhanceFaceToggle = () => {
    setEnhanceFace(!enhanceFace);
  };

  // Handle close
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Add progress polling effect
  useEffect(() => {
    let progressInterval = null;
    let hasShownCompletion = false; // Track if we've already shown completion notification

    if (isProcessing) {
      // Set up interval to check processing progress when processing is active
      progressInterval = setInterval(async () => {
        try {
          const result = await checkProcessingStatus(userId);

          // Handle case where processing is not running anymore
          if (result.success && result.isProcessing === false && result.progress === null) {
            console.log('Processing no longer active, cleaning up...');
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            setIsProcessing(false);
            setProgressData(null);
            await loadFiles();
            return;
          }

          // Check if we have progress data and update accordingly
          if (result.progress && typeof result.progress === 'object') {
            // Handle completion status FIRST before updating progress data
            if (result.progress.status === 'completed' && !hasShownCompletion) {
              console.log('Processing completed!');
              hasShownCompletion = true; // Mark as shown

              // Stop polling immediately
              if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
              }

              // Show final completion state briefly
              setProgressData({
                currentSet: result.progress.currentSet || 0,
                totalSets: result.progress.totalSets || 0,
                processedSets: result.progress.processedSets || [],
                currentFile: result.progress.currentFile || '',
                progress: 100,
                status: 'completed',
                message: '✓ Processing completed successfully!',
                userId: userId,
                timestamp: Date.now()
              });

              showNotification('Processing completed successfully!', 'success');

              // Clear state after 1 second and refresh files
              setTimeout(async () => {
                setIsProcessing(false);
                setProgressData(null);
                await loadFiles();
              }, 1000);

              return;
            }
            // Handle error status (only show notification once)
            else if (result.progress.status === 'error' && !hasShownCompletion) {
              console.error('Processing error:', result.progress.message);
              hasShownCompletion = true; // Mark as shown

              // Stop polling immediately
              if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
              }

              showNotification('Processing failed: ' + result.progress.message, 'error');

              // Clear state after 2 seconds
              setTimeout(() => {
                setIsProcessing(false);
                setProgressData(null);
              }, 2000);

              return;
            }

            // Only update progress data if NOT completed/error
            if (result.progress.status !== 'completed' && result.progress.status !== 'error') {
              const newProgressData = {
                currentSet: result.progress.currentSet || 0,
                totalSets: result.progress.totalSets || 0,
                processedSets: result.progress.processedSets || [],
                currentFile: result.progress.currentFile || '',
                progress: result.progress.progress || 0,
                status: result.progress.status || 'unknown',
                message: result.progress.message || 'Processing...',
                userId: userId,
                timestamp: Date.now()
              };
              setProgressData(newProgressData);
            }
          } else if (result.success && result.isProcessing === false) {
            // If processing is not running and no progress data, stop polling
            console.log('No progress data and processing stopped');
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            setIsProcessing(false);
            setProgressData(null);
            await loadFiles();
          }
        } catch (error) {
          console.error('Error in progress polling:', error);
          // Don't stop polling on error, just log it
        }
      }, 1500); // Check every 1.5 seconds for more responsive updates
    }

    // Clean up interval when isProcessing changes or component unmounts
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [isProcessing, userId]);

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      checkConnection();
      loadFiles();
    }
  }, [userId]);

  // Only update process ready state when enhanceFace changes (no refetch needed)
  useEffect(() => {
    if (userId && filesChecked && captureLoaded) {
      // Just check if processing is needed without reloading files
      const checkProcessingNeeded = async () => {
        const processingResult = await checkFilesNeedProcessing(userId, enhanceFace);
        if (processingResult.success) {
          setIsProcessReady(processingResult.needsProcessing);
        }
      };
      checkProcessingNeeded();
    }
  }, [enhanceFace, userId, filesChecked, captureLoaded]);

  return (
    <div className={`${styles.aiProcessSection} ${isClosing ? styles.closing : ''}`}>
      <div className={styles.processHeader}>
        <h2>AI Process - Eye Tracking Data</h2>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
      </div>

      <div className={styles.processContent}>
        {/* Status Display */}
        <div className={styles.statusDisplay}>
          <div className={styles.statusIndicator}>
            <span>User ID:</span>
            <span className={userId ? styles.statusConnected : styles.statusDisconnected}>
              {userId ? userId.substring(0, 8) + '...' : 'Not Available'}
            </span>
          </div>
          
          <div className={styles.statusIndicator}>
            <span>Backend:</span>
            <span className={backendConnected ? styles.statusConnected : styles.statusDisconnected}>
              {backendConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className={styles.statusIndicator}>
            <span>Capture Dataset:</span>
            <span className={captureLoaded ? styles.statusConnected : styles.statusDisconnected}>
              {captureLoaded ? 'Loaded' : 'Not Loaded'}
            </span>
          </div>
          
          <div className={styles.statusIndicator}>
            <span>Files Checked:</span>
            <span className={filesChecked ? styles.statusConnected : styles.statusDisconnected}>
              {filesChecked ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div className={styles.statusIndicator}>
            <span>Processing Status:</span>
            <span className={isProcessReady && captureLoaded && filesChecked ? styles.statusReady : styles.statusNotReady}>
              {isProcessReady && captureLoaded && filesChecked ? 'Ready' : 'Not Ready'}
            </span>
          </div>
        </div>

        {/* Processing Progress */}
        {isProcessing && progressData && (
          <div className={styles.processingProgress}>
            <h3>Processing Progress</h3>
            <div className={styles.progressInfo}>
              <span className={styles.progressMessage}>{progressData.message}</span>
              <span className={styles.progressPercent}>{progressData.progress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${progressData.progress}%`,
                  transition: 'width 0.3s ease-in-out'
                }}
              ></div>
            </div>
            <div className={styles.progressDetails}>
              <span className={styles.progressSets}>
                Sets: {progressData.processedSets?.length || 0} / {progressData.totalSets}
              </span>
              {progressData.currentFile && (
                <span className={styles.progressFile}>
                  Current: {progressData.currentFile}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className={styles.mainContent}>
          <div className={styles.leftPanel}>
            {/* File List - Match sectionPreview.js design */}
            <div className={styles.fileList}>
              <div className={styles.fileListHeader}>
                <div className={styles.headerTopRow}>
                  <h3>Files</h3>
                  <div className={styles.folderSelector}>
                    {files.capture && Array.isArray(files.capture) && files.capture.length > 0 && (
                      <button 
                        className={`${styles.folderButton} ${selectedFolder === 'captures' ? styles.activeFolder : ''}`}
                        onClick={() => setSelectedFolder('captures')}
                      >
                        Capture ({files.capture.length})
                      </button>
                    )}
                    {files.enhance && Array.isArray(files.enhance) && files.enhance.length > 0 && (
                      <button 
                        className={`${styles.folderButton} ${selectedFolder === 'enhance' ? styles.activeFolder : ''}`}
                        onClick={() => setSelectedFolder('enhance')}
                      >
                        Enhance ({files.enhance.length})
                      </button>
                    )}
                    {files.complete && Array.isArray(files.complete) && files.complete.length > 0 && (
                      <button 
                        className={`${styles.folderButton} ${selectedFolder === 'complete' ? styles.activeFolder : ''}`}
                        onClick={() => setSelectedFolder('complete')}
                      >
                        Complete ({files.complete.length})
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.enhanceToggleContainer}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={enhanceFace}
                      onChange={handleEnhanceFaceToggle}
                    />
                    Enhance Face Detection
                  </label>
                </div>
              </div>
              
              {loading ? (
                <div className={styles.loading}>Loading files...</div>
              ) : (
                <div className={styles.tabContent}>
                  {selectedFolder === 'captures' ? (
                    <>
                      {files.capture?.length > 0 ? (
                        <ul className={styles.fileListItems}>
                          {files.capture.map((file) => (
                            <li 
                              key={file.filename} 
                              className={`${styles.fileListItem} ${selectedFile === file.filename ? styles.fileItemSelected : ''}`}
                              onClick={() => handleFileSelect(file.filename, 'captures')}
                              title={`Click to preview ${file.filename}`}
                            >
                              <div className={styles.fileInfo}>
                                <div className={styles.fileHeader}>
                                  <span className={styles.fileIcon}>🖼️</span>
                                  <span className={styles.fileName}>{file.filename}</span>
                                </div>
                                <span className={styles.filePath}>{file.path}</span>
                                <span className={styles.fileDetails}>
                                  {file.file_type?.toUpperCase() || 'UNKNOWN'} - {file.size ? (file.size / 1024).toFixed(1) + ' KB' : '0 KB'}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className={styles.noFiles}>No capture files found.</div>
                      )}
                    </>
                  ) : selectedFolder === 'enhance' ? (
                    <>
                      {files.enhance?.length > 0 ? (
                        <ul className={styles.fileListItems}>
                          {files.enhance.map((file) => (
                            <li 
                              key={file.filename} 
                              className={`${styles.fileListItem} ${selectedFile === file.filename ? styles.fileItemSelected : ''}`}
                              onClick={() => handleFileSelect(file.filename, 'enhance')}
                              title={`Click to preview ${file.filename}`}
                            >
                              <div className={styles.fileInfo}>
                                <div className={styles.fileHeader}>
                                  <span className={styles.fileIcon}>✨</span>
                                  <span className={styles.fileName}>{file.filename}</span>
                                </div>
                                <span className={styles.filePath}>{file.path}</span>
                                <span className={styles.fileDetails}>
                                  {file.file_type?.toUpperCase() || 'UNKNOWN'} - {file.size ? (file.size / 1024).toFixed(1) + ' KB' : '0 KB'}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className={styles.noFiles}>No enhanced files found.</div>
                      )}
                    </>
                  ) : (
                    <>
                      {files.complete?.length > 0 ? (
                        <ul className={styles.fileListItems}>
                          {files.complete.map((file) => (
                            <li 
                              key={file.filename} 
                              className={`${styles.fileListItem} ${selectedFile === file.filename ? styles.fileItemSelected : ''}`}
                              onClick={() => handleFileSelect(file.filename, 'complete')}
                              title={`Click to preview ${file.filename}`}
                            >
                              <div className={styles.fileInfo}>
                                <div className={styles.fileHeader}>
                                  <span className={styles.fileIcon}>✅</span>
                                  <span className={styles.fileName}>{file.filename}</span>
                                </div>
                                <span className={styles.filePath}>{file.path}</span>
                                <span className={styles.fileDetails}>
                                  {file.file_type?.toUpperCase() || 'UNKNOWN'} - {file.size ? (file.size / 1024).toFixed(1) + ' KB' : '0 KB'}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className={styles.noFiles}>No complete files found.</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className={styles.controls}>
              <div className={styles.buttonGroup}>
                <button
                  className={styles.actionButton}
                  onClick={() => loadFiles(true)}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Check Files'}
                </button>
                
                <button 
                  className={styles.processButton}
                  onClick={processFilesLocal}
                  disabled={!isProcessReady || isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Process Files'}
                </button>
              </div>
            </div>
          </div>
          
          <div className={styles.rightPanel}>
            {/* File Preview */}
            <div className={styles.filePreview}>
              <h3>File Preview</h3>
              {selectedFile && previewImageData ? (
                <div className={styles.previewContainer}>
                  <div className={styles.previewHeader}>
                    <h4>{selectedFile}</h4>
                    <span className={styles.folderBadge}>{selectedFolder}</span>
                  </div>
                  
                  {previewImageData.type === 'image' ? (
                    <div className={styles.imagePreview}>
                      <img 
                        src={previewImageData.data} 
                        alt={selectedFile}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div className={styles.imageError} style={{ display: 'none' }}>
                        Image preview not available
                      </div>
                    </div>
                  ) : (
                    <div className={styles.textPreview}>
                      <pre>{previewImageData.data}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.noPreview}>
                  <p>Select a file to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAIProcess;
