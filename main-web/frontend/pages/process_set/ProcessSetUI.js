// pages/process_set/ProcessSetUI.js - UI components for process_set page
import { useState } from 'react';
import styles from '../../styles/ProcessSet.module.css';

export const FilePreviewPanel = ({ selectedFile, previewImage }) => {
  if (!selectedFile) {
    return (
      <div className={styles.previewPanel}>
        <p>Select a file to preview</p>
      </div>
    );
  }

  if (!previewImage) {
    return (
      <div className={styles.previewPanel}>
        <p>Loading preview...</p>
      </div>
    );
  }

  // Determine if it's an image or CSV data
  const isImage = selectedFile.endsWith('.jpg') || selectedFile.endsWith('.jpeg') || selectedFile.endsWith('.png');

  return (
    <div className={styles.previewPanel}>
      <h3>Preview: {selectedFile}</h3>
      {isImage ? (
        <img
          src={`data:image/jpeg;base64,${previewImage}`}
          alt={selectedFile}
          className={styles.previewImage}
        />
      ) : (
        <div className={styles.csvPreview}>
          <pre>{previewImage}</pre>
        </div>
      )}
    </div>
  );
};

export const FileList = ({ files, onFileSelect, isLoading }) => {
  const [activeTab, setActiveTab] = useState('capture');

  if (isLoading) {
    return <div className={styles.fileList}>Loading files...</div>;
  }

  const captureFiles = files.capture || [];
  const enhanceFiles = files.enhance || [];

  return (
    <div className={styles.fileListContainer}>
      <div className={styles.fileTabs}>
        <button
          className={`${styles.fileTab} ${activeTab === 'capture' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('capture')}
        >
          Capture Files ({captureFiles.length})
        </button>
        <button
          className={`${styles.fileTab} ${activeTab === 'enhance' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('enhance')}
        >
          Enhanced Files ({enhanceFiles.length})
        </button>
      </div>

      <div className={styles.fileList}>
        {activeTab === 'capture' && captureFiles.map((file) => (
          <div
            key={file}
            className={styles.fileItem}
            onClick={() => onFileSelect(file)}
          >
            {file}
          </div>
        ))}

        {activeTab === 'enhance' && enhanceFiles.map((file) => (
          <div
            key={file}
            className={styles.fileItem}
            onClick={() => onFileSelect(file)}
          >
            {file}
          </div>
        ))}

        {activeTab === 'capture' && captureFiles.length === 0 && (
          <p>No capture files found.</p>
        )}

        {activeTab === 'enhance' && enhanceFiles.length === 0 && (
          <p>No enhanced files found.</p>
        )}
      </div>
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
    
    const { currentSet, totalSets, processedSets } = progressData;
    const percentComplete = totalSets > 0 ? 
      Math.min(100, Math.round((processedSets.length / totalSets) * 100)) : 0;
    
    // Calculate elapsed and remaining time logic...
    
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
            <span>Progress:</span>
            <span>{processedSets.length} of {totalSets} ({percentComplete}%)</span>
          </div>
          {/* Additional progress stats... */}
        </div>
      </div>
    );
  };