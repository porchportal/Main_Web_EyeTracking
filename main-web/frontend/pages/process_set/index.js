// pages/process_set/index.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../../styles/ProcessSet.module.css';
import { useEffect, useState } from 'react';

// Import API functions
import {
  checkBackendConnection,
  getFilesList,
  checkFilesCompleteness,
  previewFile,
  processFiles,
  compareFileCounts,
  checkProcessingStatus
} from './processApi';

// Import UI components
import {
  FilePreviewPanel,
  FileList,
  ActionButtons,
  Notification,
  ProcessSummary,
  ProcessingProgress
} from './ProcessSetUI';

export default function ProcessSet() {
  const router = useRouter();
  const [isProcessReady, setIsProcessReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [files, setFiles] = useState({ capture: [], enhance: [] });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImageData, setPreviewImageData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [progressData, setProgressData] = useState(null);
  
  // Initialize component on mount
  useEffect(() => {
    setMounted(true);
    initializeComponent();
    
    // Set up interval to check processing status
    const statusInterval = setInterval(checkCurrentProcessingStatus, 2000); // Faster updates for smoother progress
    
    // Clean up interval on unmount
    return () => clearInterval(statusInterval);
  }, []);

  // Initialize component by checking backend connection and files
  const initializeComponent = async () => {
    await checkConnection();
    if (backendConnected) {
      await handleCheckFiles();
      await checkCurrentProcessingStatus();
    }
  };

  // Check backend connection
  const checkConnection = async () => {
    setLoading(true);
    const result = await checkBackendConnection();
    
    if (result.success && result.connected) {
      setBackendConnected(true);
    } else {
      showNotification('Cannot connect to backend server', 'error');
      setBackendConnected(false);
    }
    setLoading(false);
  };

  // Check current processing status
  const checkCurrentProcessingStatus = async () => {
    const status = await checkProcessingStatus();
    if (status.success) {
      setProcessingStatus(status);
      setIsProcessing(status.isProcessing);
      
      // Set progress data if available
      if (status.progress) {
        setProgressData(status.progress);
      }
      
      // Update process ready status based on file counts
      if (status.needsProcessing !== isProcessReady) {
        setIsProcessReady(status.needsProcessing);
      }
      
      // If processing was in progress and now it's done, refresh file list
      if (isProcessing && !status.isProcessing) {
        showNotification('Processing completed', 'success');
        handleCheckFiles();
        setProgressData(null); // Clear progress data
      }
    }
  };

  // Handle check files button click
  const handleCheckFiles = async () => {
    if (!backendConnected) {
      await checkConnection();
      if (!backendConnected) return;
    }
    
    setLoading(true);
    
    // Get files list
    const filesResult = await getFilesList();
    if (filesResult.success) {
      setFiles(filesResult.files);
      
      // Check file completeness
      const completenessResult = await checkFilesCompleteness();
      if (completenessResult.success) {
        if (completenessResult.isComplete) {
          showNotification('All file sets are complete', 'success');
        } else {
          showNotification(`Warning: ${completenessResult.missingFiles} files are missing from sets`, 'info');
        }
      }
      
      // Compare file counts between folders
      const compareResult = await compareFileCounts();
      if (compareResult.success) {
        // Update process status based on whether there are files to process
        const needsProcessing = compareResult.captureCount > compareResult.enhanceCount;
        setIsProcessReady(needsProcessing);
        
        if (needsProcessing) {
          showNotification(`${compareResult.captureCount - compareResult.enhanceCount} files need processing`, 'info');
        } else {
          showNotification('All files are processed', 'success');
        }
      }
    } else {
      showNotification('Error loading files: ' + (filesResult.error || 'Unknown error'), 'error');
    }
    
    setLoading(false);
  };

  // Handle file preview
  const handleFileSelect = async (filename) => {
    setSelectedFile(filename);
    setPreviewImageData(null);
    
    const result = await previewFile(filename);
    if (result.success) {
      setPreviewImageData(result.data);
    } else {
      showNotification('Error loading preview: ' + (result.error || 'Unknown error'), 'error');
    }
  };

  // Handle process files button click
  const handleProcessFiles = async () => {
    if (!isProcessReady) {
      showNotification('No files need processing', 'info');
      return;
    }
    
    if (isProcessing) {
      showNotification('Processing is already in progress', 'info');
      return;
    }
    
    // Get set numbers that need processing from compareFileCounts
    const compareResult = await compareFileCounts();
    if (!compareResult.success) {
      showNotification('Error determining files to process', 'error');
      return;
    }
    
    // Extract set numbers that need processing
    const setNumbersToProcess = compareResult.setsNeedingProcessing;
    if (setNumbersToProcess.length === 0) {
      showNotification('No sets need processing', 'info');
      return;
    }
    
    setIsProcessing(true);
    
    // Call API to trigger Python processing
    const result = await processFiles(setNumbersToProcess);
    
    if (result.success) {
      showNotification(`Processing started for ${result.setsToProcess} sets`, 'success');
      
      // Reset progress data
      setProgressData({
        currentSet: 0,
        totalSets: setNumbersToProcess.length,
        processedSets: [],
        startTime: new Date().toISOString()
      });
      
      // Force immediate status check
      await checkCurrentProcessingStatus();
    } else {
      showNotification('Error starting processing: ' + (result.error || 'Unknown error'), 'error');
      setIsProcessing(false);
    }
  };

  // Show notification
  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  // Close notification
  const closeNotification = () => {
    setNotification({ show: false, message: '', type: '' });
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Process Image Folder | Eye Tracking App</title>
        <meta name="description" content="Process image folder for eye tracking" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Process Image Folder
        </h1>
        
        <Notification 
          notification={notification} 
          onClose={closeNotification} 
        />
        
        <div className={styles.statusDisplay}>
          <div className={styles.statusIndicator}>
            <span>Backend Connection:</span>
            <span className={backendConnected ? styles.statusConnected : styles.statusDisconnected}>
              {backendConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className={styles.statusIndicator}>
            <span>Processing Status:</span>
            <span className={isProcessReady ? styles.statusReady : styles.statusNotReady}>
              {isProcessReady ? 'Ready' : 'Not Ready'}
            </span>
          </div>
          
          {isProcessing && (
            <div className={styles.statusIndicator}>
              <span className={styles.processingIndicator}>
                Processing in progress...
              </span>
            </div>
          )}
        </div>
        
        {/* Add the ProcessingProgress component if processing is active */}
        {isProcessing && (
          <ProcessingProgress 
            isProcessing={isProcessing} 
            progressData={progressData}
          />
        )}

        <div className={styles.processingContainer}>
          <div className={styles.leftPanel}>
            <FileList 
              files={files}
              onFileSelect={handleFileSelect}
              isLoading={loading}
            />
            
            <ProcessSummary files={files} />
          </div>
          
          <div className={styles.rightPanel}>
            <FilePreviewPanel 
              selectedFile={selectedFile}
              previewImage={previewImageData}
            />
          </div>
        </div>
        
        <ActionButtons
          onCheckFiles={handleCheckFiles}
          onProcessFiles={handleProcessFiles}
          isProcessReady={isProcessReady}
          isProcessing={isProcessing}
        />
        
        <button 
          className={styles.backButton}
          onClick={() => router.push('/')}
        >
          Back to Home
        </button>
      </main>

      {/* <footer className={styles.footer}>
        <a 
          href="https://yourwebsite.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Your Company
        </a>
      </footer> */}
    </div>
  );
}