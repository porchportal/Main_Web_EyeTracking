// pages/process_set/index.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from './sectionPreview.module.css';
import { useEffect, useState } from 'react';
import { useNotification } from './NotificationMessage';

// Import API functions (only backend connection and processing)
import {
  checkBackendConnection,
  checkProcessingStatus,
  processFiles,
  getCurrentUserId
} from './processApi';

// Import dataset reader utilities (now includes all file operations)
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
} from './readDataset';

// Import UI components
import {
  FilePreviewPanel,
  FileList,
  ActionButtons,
  Notification,
  ProcessSummary,
  ProcessingProgress,
  EnhanceFaceToggle
} from './sectionPreview';

export default function ProcessSet() {
  const router = useRouter();
  const { userId: passedUserId } = router.query;
  const [isProcessReady, setIsProcessReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [files, setFiles] = useState({ capture: [], enhance: [] });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('captures');
  const [previewImageData, setPreviewImageData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [enhanceFace, setEnhanceFace] = useState(false);
  const [lastNotificationMessage, setLastNotificationMessage] = useState('');
  const [captureLoaded, setCaptureLoaded] = useState(false);
  const [filesChecked, setFilesChecked] = useState(false);
  const [lastProcessingStatus, setLastProcessingStatus] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const [showNotification, NotificationComponent] = useNotification();

  // Get user ID - prioritize passed user ID, fallback to getCurrentUserId
  const getUserId = async () => {
    if (passedUserId) {
      console.log('Using passed user ID:', passedUserId);
      setCurrentUserId(passedUserId);
      return passedUserId;
    }
    
    console.log('No passed user ID, getting from backend');
    const userId = await getCurrentUserId();
    setCurrentUserId(userId);
    return userId;
  };

  // Handle enhance face toggle
  const handleEnhanceFaceToggle = () => {
    const newValue = !enhanceFace;
    console.log(`EnhanceFace toggle: ${enhanceFace} -> ${newValue}`);
    setEnhanceFace(newValue);
  };

  // Helper function to show notification only if message is different
  const showNotificationIfNew = (message, type = 'info', duration = 5000) => {
    // Create a unique key for this type of notification
    const notificationKey = `${type}-${message}`;
    
    if (notificationKey !== lastNotificationMessage) {
      setLastNotificationMessage(notificationKey);
      showNotification(message, type, duration);
    }
  };

  // Set current user ID when passed user ID is available
  useEffect(() => {
    if (passedUserId) {
      console.log('Setting current user ID from passed user ID:', passedUserId);
      setCurrentUserId(passedUserId);
    }
  }, [passedUserId]);

  // Initialize component on mount
  useEffect(() => {
    setMounted(true);
    initializeComponent();
    
    // Set up interval to check processing status - reduced from 10s to 30s
    const statusInterval = setInterval(() => checkProcessingNeeded(false), 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(statusInterval);
  }, []);

  // Initialize component by checking backend connection and files
  const initializeComponent = async () => {
    await checkConnection();
    if (backendConnected) {
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      console.log('initializeComponent: Using user ID:', userId);
      
      // Get files list from all three folders
      const captureResult = await getFilesList('captures', userId);
      const enhanceResult = await getFilesList('enhance', userId);
      const completeResult = await getFilesList('complete', userId);
      
      if (captureResult.success || enhanceResult.success || completeResult.success) {
        const organizedFiles = {
          capture: captureResult.success ? captureResult.files.map(filename => ({
            filename,
            path: `/captures/${userId}/${filename}`,
            file_type: filename.split('.').pop(),
            size: 0
          })) : [],
          enhance: enhanceResult.success ? enhanceResult.files.map(filename => ({
            filename,
            path: `/enhance/${userId}/${filename}`,
            file_type: filename.split('.').pop(),
            size: 0
          })) : [],
          complete: completeResult.success ? completeResult.files.map(filename => ({
            filename,
            path: `/complete/${userId}/${filename}`,
            file_type: filename.split('.').pop(),
            size: 0
          })) : []
        };
        
        setFiles(organizedFiles);
        
        // Set capture loaded state based on whether we have capture files
        setCaptureLoaded(captureResult.success && captureResult.files.length > 0);
        
        // Check if no dataset was found for this user
        if (captureResult.no_dataset) {
          showNotificationIfNew('Didn\'t collect any dataset for this user', 'info');
        } else if (captureResult.success && captureResult.files.length === 0) {
          // If no files found in captures folder, show the message
          showNotificationIfNew('Didn\'t collect any dataset for this user', 'info');
        }
        
        // Preload first few files for better performance from each folder
        const captureFilenames = organizedFiles.capture.slice(0, 5).map(f => f.filename);
        const enhanceFilenames = organizedFiles.enhance.slice(0, 5).map(f => f.filename);
        
        if (captureFilenames.length > 0) {
          console.log('Preloading capture files for better performance...');
          preloadFilesFromFolder(captureFilenames, 'captures', userId).then(results => {
            const successCount = results.filter(r => r.success).length;
            console.log(`Preloaded ${successCount}/${results.length} capture files`);
          }).catch(error => {
            console.warn('Error preloading capture files:', error);
          });
        }
        
        if (enhanceFilenames.length > 0) {
          console.log('Preloading enhance files for better performance...');
          preloadFilesFromFolder(enhanceFilenames, 'enhance', userId).then(results => {
            const successCount = results.filter(r => r.success).length;
            console.log(`Preloaded ${successCount}/${results.length} enhance files`);
          }).catch(error => {
            console.warn('Error preloading enhance files:', error);
          });
        }
      }
      
      await checkProcessingNeeded(true); // Show notification on initial load
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
  const checkProcessingNeeded = async (showNotificationOnChange = false) => {
    try {
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
      // First check file completeness
      const completenessResult = await checkFilesCompleteness(userId);
      if (!completenessResult.success) {
        if (showNotificationOnChange) {
          showNotification('Error checking file completeness: ' + completenessResult.error, 'error');
        }
        return;
      }

      // Then check if processing is needed
      const result = await checkFilesNeedProcessing(userId);
      if (result.success) {
        // Create current processing status object for comparison
        const currentProcessingStatus = {
          needsProcessing: result.needsProcessing,
          filesToProcess: result.filesToProcess,
          captureCount: result.captureCount,
          enhanceCount: result.enhanceCount
        };
        
        // Check if the processing status has actually changed
        const statusChanged = !lastProcessingStatus || 
          lastProcessingStatus.needsProcessing !== currentProcessingStatus.needsProcessing ||
          lastProcessingStatus.filesToProcess !== currentProcessingStatus.filesToProcess;
        
        // Update state
        const previousProcessReady = isProcessReady;
        setIsProcessReady(result.needsProcessing);
        setProcessingStatus({
          captureCount: result.captureCount,
          enhanceCount: result.enhanceCount,
          filesToProcess: result.filesToProcess
        });
        
        // Only show notification if status actually changed or explicitly requested
        if (showNotificationOnChange || statusChanged) {
          if (result.needsProcessing) {
            showNotificationIfNew(`${result.filesToProcess} sets need processing`, 'info');
          } else {
            showNotificationIfNew('All sets are processed', 'success');
          }
        }
        
        // Update the last processing status
        setLastProcessingStatus(currentProcessingStatus);
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
      if (showNotificationOnChange) {
        showNotification('Error checking processing status: ' + error.message, 'error');
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
    
    // Get user ID (prioritize passed user ID)
    const userId = await getUserId();
    console.log('handleCheckFiles: Using user ID:', userId);
    
    // Get files list from all three folders
    const captureResult = await getFilesList('captures', userId);
    const enhanceResult = await getFilesList('enhance', userId);
    const completeResult = await getFilesList('complete', userId);
    
    if (captureResult.success || enhanceResult.success || completeResult.success) {
      const organizedFiles = {
        capture: captureResult.success ? captureResult.files.map(filename => ({
          filename,
          path: `/captures/${userId}/${filename}`,
          file_type: filename.split('.').pop(),
          size: 0
        })) : [],
        enhance: enhanceResult.success ? enhanceResult.files.map(filename => ({
          filename,
          path: `/enhance/${userId}/${filename}`,
          file_type: filename.split('.').pop(),
          size: 0
        })) : [],
        complete: completeResult.success ? completeResult.files.map(filename => ({
          filename,
          path: `/complete/${userId}/${filename}`,
          file_type: filename.split('.').pop(),
          size: 0
        })) : []
      };
      
      setFiles(organizedFiles);
      
      // Set capture loaded state based on whether we have capture files
      setCaptureLoaded(captureResult.success && captureResult.files.length > 0);
      
      console.log('Files loaded:', organizedFiles);
      console.log('Capture result:', captureResult);
      
      // Check if folders were created (empty folders) or no dataset found
      if (captureResult.folder_created) {
        if (captureResult.no_dataset) {
          showNotificationIfNew('Didn\'t collect any dataset for this user', 'info');
        } else {
          showNotificationIfNew('Created empty captures folder - no files found', 'info');
        }
      } else if (captureResult.success && captureResult.files.length === 0) {
        // If no files found in captures folder, show the message
        showNotificationIfNew('Didn\'t collect any dataset for this user', 'info');
      }
      
      if (enhanceResult.folder_created) {
        if (enhanceResult.no_dataset) {
          showNotificationIfNew('Didn\'t collect any dataset for this user', 'info');
        } else {
          showNotificationIfNew('Created empty enhance folder - no files found', 'info');
        }
      }
      
      // Check file completeness
      const completenessResult = await checkFilesCompleteness(userId);
      if (completenessResult.success) {
        if (completenessResult.isComplete) {
          showNotificationIfNew('All file sets are complete', 'success');
        } else {
          showNotificationIfNew(`Warning: ${completenessResult.missingFiles} files are missing from sets`, 'info');
        }
      }
      
      // Check if processing is needed
      const processingResult = await checkFilesNeedProcessing(userId);
      if (processingResult.success) {
        // Update isProcessReady state based on needsProcessing
        setIsProcessReady(processingResult.needsProcessing);
        setFilesChecked(true); // Mark files as checked
        
        // Update processing status for comparison
        setLastProcessingStatus({
          needsProcessing: processingResult.needsProcessing,
          filesToProcess: processingResult.filesToProcess,
          captureCount: processingResult.captureCount,
          enhanceCount: processingResult.enhanceCount
        });
        
        if (processingResult.needsProcessing) {
          showNotificationIfNew(`${processingResult.filesToProcess} sets need processing`, 'info');
        } else {
          showNotificationIfNew('All sets are processed', 'success');
        }
      }
    } else {
      showNotification('Error loading files: ' + (captureResult.error || enhanceResult.error || 'Unknown error'), 'error');
    }
    
    setLoading(false);
  };

  // Handle file preview using the new dataset reader with folder support
  const handleFileSelect = async (filename, folder = 'captures') => {
    console.log('File selected:', filename, 'from folder:', folder);
    setSelectedFile(filename);
    setSelectedFolder(folder);
    setPreviewImageData(null);
    
    try {
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
      // Use the dataset reader to load the file from specific folder
      const result = await readFileFromFolder(filename, folder, userId, true);
      console.log('Dataset reader result:', result);
      
      if (result.success) {
        console.log('Setting preview data:', { data: result.data, type: result.type });
        setPreviewImageData({
          data: result.data,
          type: result.type
        });
      } else {
        console.error('Dataset reader error:', result.error);
        showNotification('Error loading preview: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error in handleFileSelect:', error);
      showNotification('Error loading preview: ' + error.message, 'error');
    }
  };

  // Process files function - now uses the centralized API function
  const processFilesLocal = async (setNumbers, userId) => {
    try {
      console.log(`processFilesLocal called with enhanceFace=${enhanceFace} (type: ${typeof enhanceFace})`);
      return await processFiles(setNumbers, userId, enhanceFace);
    } catch (error) {
      console.error('Error processing files:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to process files'
      };
    }
  };

  // Handle process files button click
  const handleProcessFiles = async () => {
    if (!captureLoaded) {
      showNotification('Please load capture dataset first', 'info');
      return;
    }
    
    if (!filesChecked) {
      showNotification('Please click "Check Files" button first to validate files', 'info');
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
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
      // Get the processing status
      const result = await checkFilesNeedProcessing(userId);
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

      // Use the local processFiles function
      const processResult = await processFilesLocal(result.setsNeedingProcessing, userId);
      
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
            <span>Current User ID:</span>
            <span 
              className={currentUserId ? styles.statusConnected : styles.statusDisconnected}
              title={currentUserId || 'User ID not available'}
            >
              {currentUserId ? currentUserId.substring(0, 8) + '...' : 'Not Available'}
            </span>
          </div>
          
          <div className={styles.statusIndicator}>
            <span>Backend Connection:</span>
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
              enhanceFace={enhanceFace}
              onEnhanceFaceToggle={handleEnhanceFaceToggle}
            />
            
            <ProcessSummary files={files} />
          </div>
          
          <div className={styles.rightPanel}>
            <FilePreviewPanel 
              selectedFile={selectedFile}
              previewImage={previewImageData?.data}
              previewType={previewImageData?.type}
              folder={selectedFolder}
            />
          </div>
        </div>
        
        <ActionButtons
          onCheckFiles={handleCheckFiles}
          onProcessFiles={handleProcessFiles}
          isProcessReady={isProcessReady}
          isProcessing={isProcessing}
          captureLoaded={captureLoaded}
          filesChecked={filesChecked}
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