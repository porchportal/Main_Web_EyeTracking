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
    return (
      <div className={styles.previewPanel}>
        <div className={styles.noPreview}>
          <p>Select a file to preview</p>
        </div>
      </div>
    );
  }

  if (!previewImage) {
    return (
      <div className={styles.previewPanel}>
        <div className={styles.noPreview}>
          <p>Loading preview...</p>
        </div>
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
      <div className={styles.previewContent}>
        {previewType === 'image' ? (
          <img 
            src={previewImage} 
            alt={selectedFile} 
            className={styles.previewImage}
          />
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
  // Return null if not processing or no progress data
  if (!isProcessing || !progressData) return null;

  const {
    currentSet,
    totalSets,
    progress,
    currentFile,
    status,
    message
  } = progressData;

  return (
    <div className={styles.processingProgress}>
      <div className={styles.progressHeader}>
        <h3>Processing Progress</h3>
        <span className={`${styles.statusBadge} ${styles[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
      
      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className={styles.progressDetails}>
        <div className={styles.progressText}>
          <span>Progress: {progress}%</span>
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
export default function ProcessSetUIPage() {
  return null; // This is a utility file, so we don't need to render anything
}