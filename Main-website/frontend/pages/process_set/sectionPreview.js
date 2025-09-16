// pages/process_set/sectionPreview.js - UI components for process_set page
import { useState, useEffect } from 'react';
import styles from './sectionPreview.module.css';
import { datasetReader, isImageFile, isTextFile, getFileType, readImageFromBackend, getImagePreviewUrl } from './readDataset';
import { getCurrentUserId } from './processApi';

// Utility function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FilePreviewPanel = ({ selectedFile, previewImage, previewType, folder = 'captures' }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // Function to load image from backend when selectedFile changes
  useEffect(() => {
    if (!selectedFile) {
      setImageSize({ width: 0, height: 0 });
      setLoadError(null);
      return;
    }

    // If we already have preview data, use it
    if (previewImage && previewType) {
      handleImageLoad(previewImage, previewType);
      return;
    }

    // Otherwise, load from backend
    loadImageFromBackend(selectedFile, folder);
  }, [selectedFile, folder]);

  // Function to load image from backend with fallback
  const loadImageFromBackend = async (filename, folderType) => {
    setIsLoading(true);
    setLoadError(null);
    
    try {
      
      // Get current user ID from backend
      const userId = await getCurrentUserId();
      const result = await readImageFromBackend(filename, userId, folderType);
      
      if (result.success) {
        handleImageLoad(result.data, result.type);
      } else {
        // If file not found in specified folder, try the other folders as fallback
        const fallbackFolders = ['enhance', 'complete', 'captures'].filter(f => f !== folderType);
        
        let fallbackSuccess = false;
        let lastError = result.error;
        
        for (const fallbackFolder of fallbackFolders) {
          const fallbackResult = await readImageFromBackend(filename, userId, fallbackFolder);
          
          if (fallbackResult.success) {
            handleImageLoad(fallbackResult.data, fallbackResult.type);
            fallbackSuccess = true;
            break;
          } else {
            lastError = fallbackResult.error;
          }
        }
        
        if (!fallbackSuccess) {
          // If all folders failed, provide a more helpful error message
          const errorMsg = `File '${filename}' not found in captures, enhance, or complete folders. This might be a file naming or folder structure issue.`;
          setLoadError(errorMsg);
          console.error('Failed to load image from all folders:', {
            originalError: result.error,
            lastError: lastError,
            filename,
            requestedFolder: folderType,
            triedFolders: [folderType, ...fallbackFolders]
          });
        }
      }
    } catch (error) {
      setLoadError(error.message);
      console.error('Error loading image from backend:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle image load and get dimensions
  const handleImageLoad = (imageData, type) => {
    if (type !== 'image' || !imageData) {
      setImageSize({ width: 0, height: 0 });
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      // Use different scaling for screen vs webcam images
      const isScreenImage = selectedFile && selectedFile.includes('screen_');
      const scaleFactor = isScreenImage ? 2 : 1.5; // 1/2 = 50% for screen, 1/1.5 ≈ 67% for webcam
      
      const newSize = {
        width: Math.round(img.width / scaleFactor),
        height: Math.round(img.height / scaleFactor)
      };
      setImageSize(newSize);
      setLoadError(null);
    };
    
    img.onerror = (error) => {
      console.error('Error loading image:', error);
      setLoadError('Failed to load image');
    };
    
    // Handle both base64 data and direct URLs
    if (imageData.startsWith('data:')) {
      img.src = imageData;
    } else if (imageData.startsWith('http') || imageData.startsWith('/')) {
      img.src = imageData;
    } else {
      // Assume it's base64 data without the data: prefix
      img.src = `data:image/jpeg;base64,${imageData}`;
    }
  };

  if (!selectedFile) {
    return (
      <div className={styles.previewPanel}>
        <div className={styles.noPreview}>
          <h3>Preview</h3>
          <p>Select a file from the list to preview it here</p>
          <div className={styles.previewInstructions}>
            <p>• Click on any file in the Capture, Enhance, or Complete tabs</p>
            <p>• Images will be displayed directly</p>
            <p>• CSV files will show as text</p>
          </div>
        </div>
      </div>
    );
  }

  if (!previewImage) {
    return (
      <div className={styles.previewPanel}>
        <div className={styles.noPreview}>
          <h3>Preview</h3>
          <p>Loading preview...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.previewPanel}>
        <div className={styles.noPreview}>
          <h3>Preview: {selectedFile}</h3>
          <p className={styles.errorText}>Error: {loadError}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.previewPanel}>
      <h3>Preview: {selectedFile}</h3>
      <div className={styles.previewContent}>
        {previewType === 'image' ? (
          <div className={styles.imageContainer}>
            <img 
              src={previewImage} 
              alt={selectedFile} 
              className={styles.previewImage}
              style={{
                width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
                height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto'
              }}
            />
            {imageSize.width > 0 && (
              <div className={styles.imageInfo}>
                <span>Size: {imageSize.width} × {imageSize.height}</span>
              </div>
            )}
          </div>
        ) : previewType === 'text' ? (
          <pre className={styles.previewText}>
            {previewImage}
          </pre>
        ) : (
          <div className={styles.noPreview}>
            <p>Unsupported file type</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const FileList = ({ files, onFileSelect, isLoading, enhanceFace, onEnhanceFaceToggle }) => {
  const [selectedFolder, setSelectedFolder] = useState('capture'); // Default to capture folder
  const [fileMetadata, setFileMetadata] = useState(new Map());

  // Auto-select first available folder when files change
  useEffect(() => {
    if (files.capture && Array.isArray(files.capture) && files.capture.length > 0) {
      setSelectedFolder('capture');
    } else if (files.enhance && Array.isArray(files.enhance) && files.enhance.length > 0) {
      setSelectedFolder('enhance');
    } else if (files.complete && Array.isArray(files.complete) && files.complete.length > 0) {
      setSelectedFolder('complete');
    }
  }, [files]);

  // Update file metadata when files change
  useEffect(() => {
    const metadata = new Map();
    
    // Process capture files
    files.capture?.forEach(file => {
      metadata.set(file.filename, {
        ...file,
        fileType: getFileType(file.filename),
        isImage: isImageFile(file.filename),
        isText: isTextFile(file.filename),
        folder: 'captures'
      });
    });
    
    // Process enhance files
    files.enhance?.forEach(file => {
      metadata.set(file.filename, {
        ...file,
        fileType: getFileType(file.filename),
        isImage: isImageFile(file.filename),
        isText: isTextFile(file.filename),
        folder: 'enhance'
      });
    });
    
    // Process complete files
    files.complete?.forEach(file => {
      metadata.set(file.filename, {
        ...file,
        fileType: getFileType(file.filename),
        isImage: isImageFile(file.filename),
        isText: isTextFile(file.filename),
        folder: 'complete'
      });
    });
    
    setFileMetadata(metadata);
  }, [files]);

  // Handle file selection with folder information
  const handleFileClick = (filename) => {
    const metadata = fileMetadata.get(filename);
    const folder = metadata?.folder || 'captures';
    onFileSelect(filename, folder);
  };

  const getFileIcon = (filename) => {
    const metadata = fileMetadata.get(filename);
    if (!metadata) return '📄';
    
    if (metadata.isImage) return '🖼️';
    if (metadata.isText) return '📝';
    return '📄';
  };

  return (
    <div className={styles.fileList}>
      <div className={styles.fileListHeader}>
        <div className={styles.headerTopRow}>
          <h3>Files</h3>
          <div className={styles.folderSelector}>
            {files.capture && Array.isArray(files.capture) && files.capture.length > 0 && (
              <button 
                className={`${styles.folderButton} ${selectedFolder === 'capture' ? styles.activeFolder : ''}`}
                onClick={() => setSelectedFolder('capture')}
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
          <EnhanceFaceToggle 
            isEnabled={enhanceFace} 
            onToggle={onEnhanceFaceToggle} 
          />
        </div>
      </div>
      
      {isLoading ? (
        <div className={styles.loading}>Loading files...</div>
      ) : (
        <div className={styles.tabContent}>
          {selectedFolder === 'capture' ? (
            <>
              {files.capture?.length > 0 ? (
                <ul className={styles.fileListItems}>
                  {files.capture.map((file) => {
                    const metadata = fileMetadata.get(file.filename);
                    return (
                      <li 
                        key={file.filename} 
                        className={styles.fileListItem}
                        onClick={() => handleFileClick(file.filename)}
                        title={`Click to preview ${file.filename}`}
                      >
                        <div className={styles.fileInfo}>
                          <div className={styles.fileHeader}>
                            <span className={styles.fileIcon}>{getFileIcon(file.filename)}</span>
                            <span className={styles.fileName}>{file.filename}</span>
                          </div>
                          <span className={styles.filePath}>{file.path}</span>
                          <span className={styles.fileDetails}>
                            {metadata?.fileType?.toUpperCase() || file.file_type?.toUpperCase() || 'UNKNOWN'} - {formatFileSize(file.size)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={styles.noFiles}>No capture files found.</div>
              )}
            </>
          ) : selectedFolder === 'enhance' ? (
            <>
              {files.enhance?.length > 0 ? (
                <ul className={styles.fileListItems}>
                  {files.enhance.map((file) => {
                    const metadata = fileMetadata.get(file.filename);
                    return (
                      <li 
                        key={file.filename} 
                        className={styles.fileListItem}
                        onClick={() => handleFileClick(file.filename)}
                        title={`Click to preview ${file.filename}`}
                      >
                        <div className={styles.fileInfo}>
                          <div className={styles.fileHeader}>
                            <span className={styles.fileIcon}>{getFileIcon(file.filename)}</span>
                            <span className={styles.fileName}>{file.filename}</span>
                          </div>
                          <span className={styles.filePath}>{file.path}</span>
                          <span className={styles.fileDetails}>
                            {metadata?.fileType?.toUpperCase() || file.file_type?.toUpperCase() || 'UNKNOWN'} - {formatFileSize(file.size)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={styles.noFiles}>No enhanced files found.</div>
              )}
            </>
          ) : (
            <>
              {files.complete?.length > 0 ? (
                <ul className={styles.fileListItems}>
                  {files.complete.map((file) => {
                    const metadata = fileMetadata.get(file.filename);
                    return (
                      <li 
                        key={file.filename} 
                        className={styles.fileListItem}
                        onClick={() => handleFileClick(file.filename)}
                        title={`Click to preview ${file.filename}`}
                      >
                        <div className={styles.fileInfo}>
                          <div className={styles.fileHeader}>
                            <span className={styles.fileIcon}>{getFileIcon(file.filename)}</span>
                            <span className={styles.fileName}>{file.filename}</span>
                          </div>
                          <span className={styles.filePath}>{file.path}</span>
                          <span className={styles.fileDetails}>
                            {metadata?.fileType?.toUpperCase() || file.file_type?.toUpperCase() || 'UNKNOWN'} - {formatFileSize(file.size)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className={styles.noFiles}>No complete files found.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const ActionButtons = ({ onCheckFiles, onProcessFiles, isProcessReady, isProcessing, captureLoaded, filesChecked, files, bothProcessingComplete = false }) => {
  const canProcess = captureLoaded && filesChecked && !isProcessing && !bothProcessingComplete;
  
  const getProcessButtonTitle = () => {
    if (!captureLoaded) return 'Please load capture dataset first';
    if (!filesChecked) return 'Please click "Check Files" button first to validate files';
    if (bothProcessingComplete) return 'All processing complete - both Enhance and Complete modes are done';
    if (!isProcessReady) return 'No files need processing';
    if (isProcessing) return 'Processing in progress...';
    return 'Ready to process files';
  };
  
  return (
    <div className={styles.actionButtons}>
      <button
        className={`${styles.button} ${styles.checkButton}`}
        onClick={onCheckFiles}
        disabled={isProcessing}
      >
        Check Files
      </button>
      
      <button
        className={`${styles.button} ${
          bothProcessingComplete 
            ? styles.completeButton 
            : canProcess 
              ? styles.readyButton 
              : styles.notReadyButton
        }`}
        onClick={onProcessFiles}
        disabled={!canProcess}
        title={getProcessButtonTitle()}
      >
        {isProcessing ? 'Processing...' : bothProcessingComplete ? 'All Complete' : 'Process Files'}
      </button>
    </div>
  );
};

export const Notification = ({ notification, onClose }) => {
  if (!notification.show) {
    return null;
  }

  const notificationClasses = `${styles.notification} ${
    notification.type === 'error'
      ? styles.errorNotification
      : notification.type === 'success'
      ? styles.successNotification
      : styles.infoNotification
  }`;

  return (
    <div className={notificationClasses}>
      <span>{notification.message}</span>
      <button className={styles.closeButton} onClick={onClose}>
        ×
      </button>
    </div>
  );
};

export const ProcessSummary = ({ files, enhanceFace = false }) => {
  const captureCount = files.capture?.length || 0;
  const enhanceCount = files.enhance?.length || 0;
  const completeCount = files.complete?.length || 0;
  
  // ✅ FIXED: Only consider the relevant folder based on enhanceFace setting
  const totalProcessed = enhanceFace ? enhanceCount : completeCount;
  const remainingCount = captureCount - totalProcessed;
  
  // ✅ SAFETY: Check if both processing modes are complete
  const bothProcessingComplete = captureCount > 0 && 
                                enhanceCount >= captureCount && 
                                completeCount >= captureCount;
  
  return (
    <div className={styles.processSummary}>
      <h3>Processing Summary</h3>
      {bothProcessingComplete && (
        <div className={styles.completionNotice}>
          ✅ All processing complete! Both Enhance and Complete modes are done.
        </div>
      )}
      <div className={styles.summaryStats}>
        <div className={styles.statItem}>
          <span>Total Files:</span>
          <span>{captureCount}</span>
        </div>
        <div className={styles.statItem}>
          <span>Enhanced:</span>
          <span>{enhanceCount}</span>
        </div>
        <div className={styles.statItem}>
          <span>Complete:</span>
          <span>{completeCount}</span>
        </div>
        <div className={styles.statItem}>
          <span>Remaining:</span>
          <span>{remainingCount > 0 ? remainingCount : 0}</span>
        </div>
      </div>
    </div>
  );
};

export const EnhanceFaceToggle = ({ isEnabled = false, onToggle }) => {
  return (
    <div className={styles.enhanceFaceToggle}>
      <label className={styles.toggleLabel}>
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={onToggle}
          className={styles.toggleInput}
        />
        <span className={`${styles.toggleSlider} ${isEnabled ? styles.toggleActive : ''}`}>
          <span className={styles.toggleKnob}></span>
        </span>
        <span className={styles.toggleText}>Enhance Face</span>
      </label>
    </div>
  );
};

export const ProcessingProgress = ({ isProcessing, progressData, onClearProgress }) => {
  // Return null if not processing or no progress data
  if (!isProcessing || !progressData) return null;

  const {
    currentSet = 0,
    totalSets = 0,
    progress = 0,
    currentFile = '',
    status = 'unknown',
    message = ''
  } = progressData || {};


  // Ensure progress is a valid number between 0 and 100
  const validProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className={styles.processingProgress}>
      <div className={styles.progressHeader}>
        <h3>Processing Progress</h3>
        <div className={styles.progressHeaderRight}>
          <span className={`${styles.statusBadge} ${styles[status]}`}>
            {status && typeof status === 'string' ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
          </span>
          {onClearProgress && (status === 'completed' || status === 'error') && (
            <button 
              className={styles.clearButton}
              onClick={onClearProgress}
              title="Clear progress display"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar}
          style={{ width: `${validProgress}%` }}
        />
      </div>
      
      <div className={styles.progressDetails}>
        <div className={styles.progressText}>
          <span>Progress: {validProgress}%</span>
          <span>Set {currentSet} of {totalSets}</span>
        </div>
        
        <div className={styles.currentFile}>
          {currentFile && (
            <div className={styles.fileInfo}>
              <span className={styles.label}>Current File:</span>
              <span className={styles.value}>{currentFile}</span>
            </div>
          )}
          
          {message && message !== currentFile && (
            <div className={styles.messageInfo}>
              <span className={styles.label}>Status:</span>
              <span className={styles.value}>{message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Add default export component
export default function SectionPreviewPage() {
  return null; // This is a utility file, so we don't need to render anything
}
