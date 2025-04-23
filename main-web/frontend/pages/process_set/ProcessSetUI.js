// pages/process_set/ProcessSetUI.js - UI components for process_set page
import { useState, useEffect } from 'react';
import styles from '../../styles/ProcessSet.module.css';

// Utility function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FilePreviewPanel = ({ selectedFile, previewImage, previewType }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  // console.log('FilePreviewPanel props:', { 
  //   selectedFile, 
  //   previewImage: previewImage ? 'data present' : 'no data', 
  //   previewType 
  // });
  
  // Function to pre-load the image and get its dimensions
  useEffect(() => {
    // console.log('useEffect triggered:', { 
    //   selectedFile, 
    //   previewImage: previewImage ? 'data present' : 'no data', 
    //   previewType 
    // });
    
    if (!selectedFile || !previewImage || previewType !== 'image') {
      console.log('Skipping image load:', { 
        hasSelectedFile: !!selectedFile, 
        hasPreviewImage: !!previewImage, 
        isImageType: previewType === 'image' 
      });
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      // console.log('Image loaded, dimensions:', { width: img.width, height: img.height });
      // Use different scaling for screen vs webcam images
      const isScreenImage = selectedFile.includes('screen_');
      const scaleFactor = isScreenImage ? 2 : 1.5; // 1/2 = 50% for screen, 1/1.5 ≈ 67% for webcam
      
      const newSize = {
        width: Math.round(img.width / scaleFactor),
        height: Math.round(img.height / scaleFactor)
      };
      // console.log('Setting image size:', newSize);
      setImageSize(newSize);
    };
    
    img.onerror = (error) => {
      console.error('Error loading image:', error);
    };
    
    // console.log('Setting image source');
    img.src = `data:image/jpeg;base64,${previewImage}`;
  }, [selectedFile, previewImage, previewType]);
  
  // Check if file is an image
  const isImageFile = (filename) => {
    return filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png');
  };

  if (!selectedFile) {
    // console.log('No file selected');
    return (
      <div className={styles.previewPanel}>
        <p>Select a file to preview</p>
      </div>
    );
  }

  if (!previewImage) {
    // console.log('No preview data available');
    return (
      <div className={styles.previewPanel}>
        <p>Loading preview...</p>
      </div>
    );
  }

  // console.log('Rendering preview:', { 
  //   previewType, 
  //   imageSize,
  //   hasPreviewImage: !!previewImage
  // });
  
  return (
    <div className={styles.previewPanel}>
      <h3>Preview: {selectedFile}</h3>
      {previewType === 'image' ? (
        <div className={styles.imageContainer}>
          <img
            src={`data:image/jpeg;base64,${previewImage}`}
            alt={selectedFile}
            className={styles.previewImage}
            style={{
              width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
              height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto',
              objectFit: 'initial' // Don't scale the image
            }}
            onError={(e) => console.error('Error displaying image:', e)}
          />
        </div>
      ) : (
        <div className={styles.csvPreview}>
          <pre>{previewImage}</pre>
        </div>
      )}
    </div>
  );
};

export const FileList = ({ files, onFileSelect, isLoading }) => {
  const [selectedFolder, setSelectedFolder] = useState('capture'); // Default to capture folder

  return (
    <div className={styles.fileList}>
      <div className={styles.fileListHeader}>
        <h3>Files</h3>
        <div className={styles.folderSelector}>
          <button 
            className={`${styles.folderButton} ${selectedFolder === 'capture' ? styles.activeFolder : ''}`}
            onClick={() => setSelectedFolder('capture')}
          >
            Capture Files ({files.capture.length})
          </button>
          <button 
            className={`${styles.folderButton} ${selectedFolder === 'enhance' ? styles.activeFolder : ''}`}
            onClick={() => setSelectedFolder('enhance')}
          >
            Enhanced Files ({files.enhance.length})
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className={styles.loading}>Loading files...</div>
      ) : (
        <div className={styles.tabContent}>
          {selectedFolder === 'capture' ? (
            <>
              {files.capture.length > 0 ? (
                <ul className={styles.fileListItems}>
                  {files.capture.map((file) => (
                    <li 
                      key={file.filename} 
                      className={styles.fileListItem}
                      onClick={() => onFileSelect(file.filename)}
                    >
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{file.filename}</span>
                        <span className={styles.filePath}>{file.path}</span>
                        <span className={styles.fileDetails}>
                          {file.file_type.toUpperCase()} - {formatFileSize(file.size)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.noFiles}>No capture files found.</div>
              )}
            </>
          ) : (
            <>
              {files.enhance.length > 0 ? (
                <ul className={styles.fileListItems}>
                  {files.enhance.map((file) => (
                    <li 
                      key={file.filename} 
                      className={styles.fileListItem}
                      onClick={() => onFileSelect(file.filename)}
                    >
                      <div className={styles.fileInfo}>
                        <span className={styles.fileName}>{file.filename}</span>
                        <span className={styles.filePath}>{file.path}</span>
                        <span className={styles.fileDetails}>
                          {file.file_type.toUpperCase()} - {formatFileSize(file.size)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.noFiles}>No enhanced files found.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const ActionButtons = ({ onCheckFiles, onProcessFiles, isProcessReady, isProcessing }) => {
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
        className={`${styles.button} ${isProcessReady ? styles.readyButton : styles.notReadyButton}`}
        onClick={onProcessFiles}
        disabled={!isProcessReady || isProcessing}
      >
        {isProcessing ? 'Processing...' : 'Process Files'}
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

export const ProcessSummary = ({ files }) => {
  const captureCount = files.capture?.length || 0;
  const enhanceCount = files.enhance?.length || 0;
  const remainingCount = captureCount - enhanceCount;
  
  return (
    <div className={styles.processSummary}>
      <h3>Processing Summary</h3>
      <div className={styles.summaryStats}>
        <div className={styles.statItem}>
          <span>Total Files:</span>
          <span>{captureCount}</span>
        </div>
        <div className={styles.statItem}>
          <span>Processed:</span>
          <span>{enhanceCount}</span>
        </div>
        <div className={styles.statItem}>
          <span>Remaining:</span>
          <span>{remainingCount > 0 ? remainingCount : 0}</span>
        </div>
      </div>
    </div>
  );
};

export const ProcessingProgress = ({ isProcessing, progressData }) => {
  if (!isProcessing || !progressData) {
    return null;
  }
  
  const { currentSet, totalSets, processedSets, currentFile, progress } = progressData;
  const percentComplete = progress;
  
  return (
    <div className={styles.progressContainer}>
      <h3>Processing Progress</h3>
      
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${percentComplete}%` }}
        ></div>
      </div>
      
      <div className={styles.progressStats}>
        <div className={styles.progressStat}>
          <span>Current File:</span>
          <span>{currentFile || 'Starting...'}</span>
        </div>
        
        <div className={styles.progressStat}>
          <span>Progress:</span>
          <span>{percentComplete}% ({processedSets.length} of {totalSets} files)</span>
        </div>
        
        <div className={styles.progressStat}>
          <span>Last Processed:</span>
          <span>{processedSets.length > 0 ? processedSets[processedSets.length - 1] : 'None'}</span>
        </div>
      </div>
      
      {processedSets.length > 0 && (
        <div className={styles.processedFiles}>
          <h4>Processed Files:</h4>
          <div className={styles.processedList}>
            {processedSets.map((setNumber, index) => (
              <span key={index} className={styles.processedItem}>
                {setNumber}
                {index < processedSets.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};