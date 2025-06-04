// pages/process_set/index.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from '../../styles/ProcessSet.module.css';
import { useEffect, useState } from 'react';
import { useNotification } from './NotificationMessage';

// Import API functions
import {
  checkBackendConnection,
  getFilesList,
  checkFilesCompleteness,
  previewFile,
  processFiles,
  compareFileCounts,
  checkProcessingStatus,
  checkFilesNeedProcessing
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
  
  const [showNotification, NotificationComponent] = useNotification();

  // Initialize component on mount
  useEffect(() => {
    setMounted(true);
    initializeComponent();
    
    // Set up interval to check processing status - reduced from 10s to 30s
    const statusInterval = setInterval(checkProcessingNeeded, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(statusInterval);
  }, []);

  // Initialize component by checking backend connection and files
  const initializeComponent = async () => {
    await checkConnection();
    if (backendConnected) {
      await handleCheckFiles();
      await checkProcessingNeeded();
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

  // Check if processing is needed
  const checkProcessingNeeded = async () => {
    try {
      // First check file completeness
      const completenessResult = await checkFilesCompleteness();
      if (!completenessResult.success) {
        showNotification('Error checking file completeness: ' + completenessResult.error, 'error');
        return;
      }

      // Then check if processing is needed
      const result = await checkFilesNeedProcessing();
      if (result.success) {
        setIsProcessReady(result.needsProcessing);
        setProcessingStatus({
          captureCount: result.captureCount,
          enhanceCount: result.enhanceCount,
          filesToProcess: result.filesToProcess
        });
        
        // Show appropriate notification
        if (result.needsProcessing) {
          showNotification(`${result.filesToProcess} sets need processing`, 'info');
        } else {
          showNotification('All sets are processed', 'success');
        }
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
      showNotification('Error checking processing status: ' + error.message, 'error');
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
      
      // Check if processing is needed
      const processingResult = await checkFilesNeedProcessing();
      if (processingResult.success) {
        // Update isProcessReady state based on needsProcessing
        setIsProcessReady(processingResult.needsProcessing);
        
        if (processingResult.needsProcessing) {
          showNotification(`${processingResult.filesToProcess - 1} sets need processing`, 'info');
        } else {
          showNotification('All sets are processed', 'success');
        }
      }
    } else {
      showNotification('Error loading files: ' + (filesResult.error || 'Unknown error'), 'error');
    }
    
    setLoading(false);
  };

  // Handle file preview
  const handleFileSelect = async (filename) => {
    // console.log('File selected:', filename);
    setSelectedFile(filename);
    setPreviewImageData(null);
    
    const result = await previewFile(filename);
    // console.log('Preview API result:', result);
    
    if (result.success) {
      // console.log('Setting preview data:', { data: result.data, type: result.type });
      setPreviewImageData({
        data: result.data,
        type: result.type
      });
    } else {
      console.error('Preview API error:', result.error);
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
    
    setIsProcessing(true);
    showNotification('Processing started...', 'info');
    
    try {
      // Get the processing status
      const result = await checkFilesNeedProcessing();
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

      // Send processing request to backend
      const response = await fetch('/api/process-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          set_numbers: result.setsNeedingProcessing
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start processing');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      // Update progress with results
      const processedSets = data.results
        .filter(r => r.status === 'success')
        .map(r => r.setNumber);

      setProgressData(prev => ({
        ...prev,
        processedSets,
        progress: Math.round((processedSets.length / prev.totalSets) * 100),
        status: 'completed',
        message: `Processed ${data.processedCount} of ${data.totalSets} sets`
      }));

      // Show notifications for any errors
      data.results
        .filter(r => r.status === 'error')
        .forEach(r => {
          showNotification(r.message, 'error');
        });

      // Show completion notification
      showNotification('Processing completed successfully', 'success');
      
      // Refresh the files list
      await handleCheckFiles();
      
    } catch (error) {
      console.error('Error during processing:', error);
      showNotification(error.message || 'Error during processing', 'error');
    } finally {
      setIsProcessing(false);
      setProgressData(null);
    }
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
        
        {NotificationComponent}
        
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
              previewImage={previewImageData?.data}
              previewType={previewImageData?.type}
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
    </div>
  );
}