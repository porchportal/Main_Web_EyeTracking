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
          enhanceCount: result.enhanceCount
        });
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
      // Get the last file number from enhance folder
      const enhanceFiles = files.enhance || [];
      const lastEnhanceNumber = enhanceFiles.length > 0 
        ? Math.max(...enhanceFiles.map(file => {
            const match = file.filename.match(/_(\d+)\./);
            return match ? parseInt(match[1]) : 0;
          }))
        : 0;
      
      // Get all capture files that need processing
      const captureFiles = files.capture || [];
      const filesToProcess = captureFiles
        .filter(file => {
          const match = file.filename.match(/_(\d+)\./);
          if (!match) return false;
          const fileNumber = parseInt(match[1]);
          return fileNumber > lastEnhanceNumber;
        })
        .sort((a, b) => {
          const numA = parseInt(a.filename.match(/_(\d+)\./)[1]);
          const numB = parseInt(b.filename.match(/_(\d+)\./)[1]);
          return numA - numB;
        });
      
      if (filesToProcess.length === 0) {
        showNotification('No files need processing', 'info');
        setIsProcessing(false);
        return;
      }

      // Initialize progress data
      setProgressData({
        currentSet: 0,
        totalSets: filesToProcess.length,
        processedSets: [],
        currentFile: '',
        progress: 0
      });

      // Process all files in parallel
      const processPromises = filesToProcess.map(async (file, index) => {
        const match = file.filename.match(/_(\d+)\./);
        if (!match) return;
        
        const setNumber = parseInt(match[1]);
        const currentFile = `Processing file ${setNumber} (${index + 1}/${filesToProcess.length})`;
        
        // Update progress for current file
        setProgressData(prev => ({
          ...prev,
          currentSet: setNumber,
          currentFile,
          progress: Math.round((index / filesToProcess.length) * 100)
        }));
        
        showNotification(currentFile, 'info');
        
        try {
          const result = await processFiles([setNumber]);
          if (!result.success) {
            throw new Error(`Failed to process set ${setNumber}: ${result.error || 'Unknown error'}`);
          }
          
          // Add to processed sets
          setProgressData(prev => ({
            ...prev,
            processedSets: [...prev.processedSets, setNumber],
            progress: Math.round(((index + 1) / filesToProcess.length) * 100)
          }));
          
          return { success: true, setNumber };
        } catch (error) {
          console.error(`Error processing set ${setNumber}:`, error);
          return { success: false, setNumber, error };
        }
      });

      // Wait for all processing to complete
      const results = await Promise.all(processPromises);
      
      // Check for any errors
      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        throw new Error(`Failed to process ${errors.length} files. First error: ${errors[0].error}`);
      }
      
      showNotification('Processing completed', 'success');
      
      // Refresh file list and check if more processing is needed
      await handleCheckFiles();
    } catch (error) {
      console.error('Error processing files:', error);
      showNotification(`Error: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setProgressData(null);
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
            {/* {console.log('Rendering FilePreviewPanel with:', {
              selectedFile,
              previewImage: previewImageData?.data,
              previewType: previewImageData?.type
            })} */}
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