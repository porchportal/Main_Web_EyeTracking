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

// Import notification component from admin UI
import NotiMessage from './notiMessage';

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

  // Fallback notification function
  const showNotificationFallback = (message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // You could also show an alert or console log as fallback
    if (type === 'error') {
      console.error(message);
    } else if (type === 'success') {
      console.log('✓', message);
    } else {
      console.info(message);
    }
  };

  // Safe notification function that checks for global function first
  const safeShowNotification = (message, type = 'info') => {
    if (window.showNotification && typeof window.showNotification === 'function') {
      window.showNotification(message, type);
    } else {
      showNotificationFallback(message, type);
    }
  };

  // Check backend connection using process_set function
  const checkConnection = async () => {
    setLoading(true);
    const result = await checkBackendConnection();
    
    if (result.success && result.connected) {
      setBackendConnected(true);
      safeShowNotification('Backend connected successfully', 'success');
    } else {
      safeShowNotification('Cannot connect to backend server', 'error');
      setBackendConnected(false);
    }
    setLoading(false);
  };

  // Use showNotification from process_set hook

  // Use functions from process_set - no need to redefine them

  // Load files using process_set functions
  const loadFiles = async () => {
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
        if (completenessResult.success) {
          if (completenessResult.totalSets === 0) {
            safeShowNotification('No capture files found', 'info');
          } else if (completenessResult.isComplete) {
            safeShowNotification('All file sets are complete', 'success');
          } else {
            safeShowNotification(`Warning: ${completenessResult.missingFiles} files are missing from sets`, 'info');
          }
        }
        
        // Check if processing is needed using process_set function
        const processingResult = await checkFilesNeedProcessing(userId);
        if (processingResult.success) {
          setIsProcessReady(processingResult.needsProcessing);
          setFilesChecked(true);
          
          if (processingResult.totalSets === 0) {
            safeShowNotification('No files available for processing', 'info');
          } else if (processingResult.needsProcessing) {
            safeShowNotification(`${processingResult.filesToProcess} sets need processing`, 'info');
          } else {
            safeShowNotification('All sets are processed', 'success');
          }
        }
      } else {
        safeShowNotification('Error loading files', 'error');
      }
    } catch (error) {
      console.error('Error loading files:', error);
      safeShowNotification('Error loading files: ' + error.message, 'error');
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
        safeShowNotification('Error loading preview: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error in handleFileSelect:', error);
      safeShowNotification('Error loading preview: ' + error.message, 'error');
    }
  };

  // Process files using process_set function
  const processFilesLocal = async () => {
    if (!captureLoaded) {
      safeShowNotification('Please load capture dataset first', 'info');
      return;
    }
    
    if (!filesChecked) {
      safeShowNotification('Please check files first', 'info');
      return;
    }
    
    if (!isProcessReady) {
      safeShowNotification('No files need processing', 'info');
      return;
    }
    
    if (isProcessing) {
      safeShowNotification('Processing is already in progress', 'info');
      return;
    }
    
    setIsProcessing(true);
    safeShowNotification('Processing started...', 'info');
    
    try {
      // Get the processing status using process_set function
      const result = await checkFilesNeedProcessing(userId);
      if (!result.success) {
        throw new Error('Failed to get processing status');
      }

      if (!result.setsNeedingProcessing || result.setsNeedingProcessing.length === 0) {
        safeShowNotification('No files need processing', 'info');
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
        throw new Error(processResult.error || 'Processing failed');
      }

      // Update progress with results
      const processedSets = processResult.data.results
        .filter(r => r.status === 'success')
        .map(r => r.setNumber);

      setProgressData(prev => ({
        ...prev,
        processedSets,
        progress: Math.round((processedSets.length / prev.totalSets) * 100),
        status: 'completed',
        message: `Processed ${processResult.data.processedCount} of ${processResult.data.totalSets} sets`
      }));

      // Show notifications for any errors
      processResult.data.results
        .filter(r => r.status === 'error')
        .forEach(r => {
          safeShowNotification(r.message, 'error');
        });

      // Show completion notification
      safeShowNotification('Processing completed successfully', 'success');
      
      // Refresh the files list
      await loadFiles();
      
    } catch (error) {
      console.error('Error during processing:', error);
      safeShowNotification(error.message || 'Error during processing', 'error');
    } finally {
      setIsProcessing(false);
      setProgressData(null);
    }
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

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      checkConnection();
      loadFiles();
    }
  }, [userId]);

  return (
    <div className={`${styles.aiProcessSection} ${isClosing ? styles.closing : ''}`}>
      <div className={styles.processHeader}>
        <h2>AI Process - Eye Tracking Data</h2>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
      </div>
      
      {/* Notification Component from admin UI */}
      <NotiMessage />
      
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
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${progressData.progress}%` }}
              ></div>
            </div>
            <p>{progressData.message}</p>
            <p>Processed: {progressData.processedSets.length} / {progressData.totalSets}</p>
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
                  onClick={loadFiles}
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
