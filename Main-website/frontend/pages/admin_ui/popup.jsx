import React, { useState, useEffect } from 'react';
import styles from './style/popup.module.css';

const DownloadPopup = ({ isOpen, onClose, userId }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    // Add a small delay to allow animation to complete
    setTimeout(() => {
      onClose();
    }, 300); // Match the CSS animation duration
  };

  const handleDownload = async (downloadType) => {
    if (!userId || userId === 'default') {
      window.showNotification('Please select a user ID before downloading!', 'error');
      return;
    }

    try {
      let endpoint = '';
      let filename = '';
      
      switch (downloadType) {
        case 'capture':
          endpoint = `/api/admin/zip-download/${userId}`;
          filename = `user_${userId}_captures.zip`;
          break;
        case 'complete':
          endpoint = `/api/admin/complete-download/${userId}`;
          filename = `user_${userId}_complete_data.zip`;
          break;
        case 'enhance':
          endpoint = `/api/admin/enhance-download/${userId}`;
          filename = `user_${userId}_enhanced_data.zip`;
          break;
        default:
          throw new Error('Invalid download type');
      }

      window.showNotification(`Downloading ${downloadType} data...`, 'info');
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/zip')) {
        // It's a ZIP file, trigger download
        window.showNotification('Preparing download...', 'info');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        window.showNotification(`${downloadType} download started successfully!`, 'success');
      } else {
        // It's a JSON error response
        const errorData = await response.json();
        window.showNotification(errorData.message || `No ${downloadType} data available for this user`, 'error');
      }
      
    } catch (error) {
      console.error(`Error downloading ${downloadType} data:`, error);
      window.showNotification(`Failed to download ${downloadType} data. Please try again.`, 'error');
    }
  };

  return (
    <div className={`${styles.downloadPopupSection} ${isClosing ? styles.closing : ''}`}>
      <div className={styles.popupHeader}>
        <h2>Download Dataset</h2>
        <button 
          className={styles.popupCloseButton}
          onClick={handleClose}
        >
          ×
        </button>
      </div>
      
      <div className={styles.popupBody}>
        <p>Choose the type of data you want to download:</p>
        
        <div className={styles.downloadButtonsContainer}>
          <button 
            className={styles.downloadTypeButton}
            onClick={() => {
              handleDownload('capture');
              handleClose();
            }}
          >
            📷 Capture
            <span className={styles.buttonDescription}>
              Download captured images and data
            </span>
          </button>
          
          <button 
            className={styles.downloadTypeButton}
            onClick={() => {
              handleDownload('complete');
              handleClose();
            }}
          >
            📋 Complete
            <span className={styles.buttonDescription}>
              Download complete dataset with metadata
            </span>
          </button>
          
          <button 
            className={styles.downloadTypeButton}
            onClick={() => {
              handleDownload('enhance');
              handleClose();
            }}
          >
            ⚡ Enhance
            <span className={styles.buttonDescription}>
              Download enhanced/processed data
            </span>
          </button>
        </div>
      </div>
      
      <div className={styles.popupFooter}>
        <button 
          className={styles.popupCancelButton}
          onClick={handleClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DownloadPopup;
