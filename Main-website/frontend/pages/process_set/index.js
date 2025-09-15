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
  const handleEnhanceFaceToggle = async () => {
    const newValue = !enhanceFace;
    console.log(`🔄 EnhanceFace toggle: ${enhanceFace} -> ${newValue}`);
    
    // ✅ FIXED: Update state first, then refresh processing status
    setEnhanceFace(newValue);
    
    // ✅ FIXED: Refresh processing status when toggle changes
    // This ensures the UI updates to reflect the new processing mode
    try {
      console.log('🔄 Refreshing processing status after enhance face toggle...');
      // Call checkProcessingNeeded with the new value directly
      await checkProcessingNeededWithEnhanceFace(newValue, true);
    } catch (error) {
      console.error('Error refreshing processing status after toggle:', error);
    }
  };

  // Helper function to check if both processing modes are complete
  const checkBothProcessingComplete = (captureCount, enhanceCount, completeCount) => {
    return captureCount > 0 && 
           enhanceCount >= captureCount && 
           completeCount >= captureCount;
  };

  // Helper function to check processing needed with specific enhanceFace value
  const checkProcessingNeededWithEnhanceFace = async (enhanceFaceValue, showNotificationOnChange = false) => {
    try {
      console.log(`🔍 checkProcessingNeededWithEnhanceFace called with enhanceFace=${enhanceFaceValue} (type: ${typeof enhanceFaceValue})`);
      
      // ✅ OPTIMIZED: Use existing file data if available, otherwise make API call
      let captureCount, enhanceCount, completeCount;
      
      if (files.capture && files.enhance && files.complete) {
        // Use existing file data for faster response
        captureCount = files.capture.length;
        enhanceCount = files.enhance.length;
        completeCount = files.complete.length;
        console.log(`🔍 Using existing file data: capture=${captureCount}, enhance=${enhanceCount}, complete=${completeCount}`);
      } else {
        // Fallback to API call if file data not available
        const userId = await getUserId();
        const result = await checkFilesNeedProcessing(userId, enhanceFaceValue);
        if (!result.success) {
          if (showNotificationOnChange) {
            showNotification('Error checking processing status: ' + result.error, 'error');
          }
          return;
        }
        captureCount = result.captureCount;
        enhanceCount = result.enhanceCount;
        completeCount = result.completeCount;
      }
      
      // Calculate processing status based on enhanceFace setting
      const totalProcessedCount = enhanceFaceValue ? enhanceCount : completeCount;
      const needsProcessing = captureCount > totalProcessedCount;
      const filesToProcess = Math.max(0, captureCount - totalProcessedCount);
      
      // ✅ SAFETY: Check if both processing modes are complete
      const bothProcessingComplete = checkBothProcessingComplete(
        captureCount, 
        enhanceCount, 
        completeCount
      );
      
      // Create current processing status object for comparison
      const currentProcessingStatus = {
        needsProcessing: needsProcessing && !bothProcessingComplete,
        filesToProcess: filesToProcess,
        captureCount: captureCount,
        enhanceCount: enhanceCount,
        completeCount: completeCount,
        totalProcessedCount: totalProcessedCount,
        bothProcessingComplete: bothProcessingComplete
      };
      
      // Check if the processing status has actually changed
      const statusChanged = !lastProcessingStatus || 
        lastProcessingStatus.needsProcessing !== currentProcessingStatus.needsProcessing ||
        lastProcessingStatus.filesToProcess !== currentProcessingStatus.filesToProcess ||
        lastProcessingStatus.bothProcessingComplete !== currentProcessingStatus.bothProcessingComplete;
      
      // Update state
      setIsProcessReady(needsProcessing && !bothProcessingComplete);
      setProcessingStatus({
        captureCount: captureCount,
        enhanceCount: enhanceCount,
        completeCount: completeCount,
        totalProcessedCount: totalProcessedCount,
        filesToProcess: filesToProcess,
        bothProcessingComplete: bothProcessingComplete
      });
      
      // Only show notification if status actually changed or explicitly requested
      if (showNotificationOnChange || statusChanged) {
        if (bothProcessingComplete) {
          showNotificationIfNew('All processing complete - both Enhance and Complete modes are done', 'success');
        } else if (needsProcessing) {
          showNotificationIfNew(`${filesToProcess} sets need processing`, 'info');
        } else {
          showNotificationIfNew('All sets are processed', 'success');
        }
      }
      
      // Update the last processing status
      setLastProcessingStatus(currentProcessingStatus);
    } catch (error) {
      console.error('Error checking processing status:', error);
      if (showNotificationOnChange) {
        showNotification('Error checking processing status: ' + error.message, 'error');
      }
    }
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
  }, []); // ✅ FIXED: Remove isProcessing dependency

  // Set up interval to check processing status with current enhanceFace value
  useEffect(() => {
    // Set up interval to check processing status - reduced from 10s to 30s
    const statusInterval = setInterval(() => {
      checkProcessingNeededWithEnhanceFace(enhanceFace, false);
    }, 30000);
    
    // Clean up intervals when enhanceFace changes or component unmounts
    return () => {
      clearInterval(statusInterval);
    };
  }, [enhanceFace]); // ✅ FIXED: Recreate interval when enhanceFace changes

  // Separate effect for processing progress interval
  useEffect(() => {
    let progressInterval = null;
    
    if (isProcessing) {
      // Set up interval to check processing progress when processing is active
      progressInterval = setInterval(() => {
        checkProcessingProgress();
      }, 2000); // Check every 2 seconds when processing
    }
    
    // Clean up interval when isProcessing changes or component unmounts
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [isProcessing]); // ✅ FIXED: Only recreate when isProcessing changes

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
        
        // Set capture loaded state based on whether we have capture files
        setCaptureLoaded(captureResult.success && captureResult.files.length > 0);
        
        // Check if no dataset was found for this user
        if (captureResult.no_dataset) {
          showNotificationIfNew('Didn\'t collect any dataset for this user', 'info');
        } else if (captureResult.success && captureResult.files.length === 0) {
          // If no files found in captures folder, show the message
          showNotificationIfNew('Didn\'t collect any dataset for this user', 'info');
        }
        
        // Preload only first 2 files for better performance (reduced from 5 to 2)
        const captureFilenames = organizedFiles.capture.slice(0, 2).map(f => f.filename);
        const enhanceFilenames = organizedFiles.enhance.slice(0, 2).map(f => f.filename);
        
        // Only preload if we have a reasonable number of files (not too many)
        if (captureFilenames.length > 0 && organizedFiles.capture.length <= 50) {
          console.log('Preloading capture files for better performance...');
          // Use setTimeout to defer preloading and reduce initial load
          setTimeout(() => {
            preloadFilesFromFolder(captureFilenames, 'captures', userId).then(results => {
              const successCount = results.filter(r => r.success).length;
              console.log(`Preloaded ${successCount}/${results.length} capture files`);
            }).catch(error => {
              console.warn('Error preloading capture files:', error);
            });
          }, 1000); // Defer by 1 second
        }
        
        if (enhanceFilenames.length > 0 && organizedFiles.enhance.length <= 50) {
          console.log('Preloading enhance files for better performance...');
          // Use setTimeout to defer preloading and reduce initial load
          setTimeout(() => {
            preloadFilesFromFolder(enhanceFilenames, 'enhance', userId).then(results => {
              const successCount = results.filter(r => r.success).length;
              console.log(`Preloaded ${successCount}/${results.length} enhance files`);
            }).catch(error => {
              console.warn('Error preloading enhance files:', error);
            });
          }, 1500); // Defer by 1.5 seconds
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

  // Check processing progress
  const checkProcessingProgress = async () => {
    try {
      console.log('Checking processing progress...');
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
      // Check processing status
      const result = await checkProcessingStatus(userId);
      console.log('Processing status result:', result);
      
      if (result.success) {
        if (result.progress) {
          console.log('Setting progress data:', result.progress);
          console.log('Progress percentage:', result.progress.progress);
          console.log('Current set:', result.progress.currentSet);
          console.log('Total sets:', result.progress.totalSets);
          setProgressData(result.progress);
          
          // If processing is completed, update state
          if (result.progress.status === 'completed') {
            setIsProcessing(false);
            showNotification('Processing completed successfully', 'success');
            // Refresh files list
            await handleCheckFiles();
          } else if (result.progress.status === 'error') {
            setIsProcessing(false);
            showNotification('Processing failed: ' + result.progress.message, 'error');
          }
        } else if (result.isProcessing === false) {
          // If not processing and no progress data, stop processing
          console.log('No processing in progress, stopping...');
          setIsProcessing(false);
          setProgressData(null);
        }
      } else {
        console.log('No progress data received:', result);
        // If we can't get progress data and we think we're processing, stop
        if (isProcessing) {
          console.log('Cannot get progress data, stopping processing...');
          setIsProcessing(false);
          setProgressData(null);
        }
      }
    } catch (error) {
      console.error('Error checking processing progress:', error);
      // If there's an error checking progress and we think we're processing, stop
      if (isProcessing) {
        console.log('Error checking progress, stopping processing...');
        setIsProcessing(false);
        setProgressData(null);
      }
    }
  };

  // Check if processing is needed
  const checkProcessingNeeded = async (showNotificationOnChange = false) => {
    // Use the helper function with current enhanceFace state
    return await checkProcessingNeededWithEnhanceFace(enhanceFace, showNotificationOnChange);
  };

  // Handle check files button click
  const handleCheckFiles = async () => {
    if (!backendConnected) {
      await checkConnection();
      if (!backendConnected) return;
    }
    
    setLoading(true);
    // ✅ IMMEDIATE UI FEEDBACK: Disable button immediately
    setIsProcessReady(false);
    setFilesChecked(false);
    
    // Get user ID (prioritize passed user ID)
    const userId = await getUserId();
    console.log('handleCheckFiles: Using user ID:', userId);
    
    // ✅ OPTIMIZED: Get files list from all three folders in parallel
    const [captureResult, enhanceResult, completeResult] = await Promise.all([
      getFilesList('captures', userId),
      getFilesList('enhance', userId),
      getFilesList('complete', userId)
    ]);
    
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
      
      // ✅ OPTIMIZED: Calculate processing status directly from file counts
      const captureCount = organizedFiles.capture.length;
      const enhanceCount = organizedFiles.enhance.length;
      const completeCount = organizedFiles.complete.length;
      
      // Calculate processing status based on enhanceFace setting
      const totalProcessedCount = enhanceFace ? enhanceCount : completeCount;
      const needsProcessing = captureCount > totalProcessedCount;
      const filesToProcess = Math.max(0, captureCount - totalProcessedCount);
      
      // ✅ SAFETY: Check if both processing modes are complete
      const bothProcessingComplete = checkBothProcessingComplete(
        captureCount, 
        enhanceCount, 
        completeCount
      );
      
      // Update isProcessReady state based on needsProcessing AND safety check
      setIsProcessReady(needsProcessing && !bothProcessingComplete);
      setFilesChecked(true); // Mark files as checked
      
      // Update processing status for comparison
      setLastProcessingStatus({
        needsProcessing: needsProcessing && !bothProcessingComplete,
        filesToProcess: filesToProcess,
        captureCount: captureCount,
        enhanceCount: enhanceCount,
        completeCount: completeCount,
        totalProcessedCount: totalProcessedCount,
        bothProcessingComplete: bothProcessingComplete
      });
      
      // Show appropriate notification
      if (bothProcessingComplete) {
        showNotificationIfNew('All processing complete - both Enhance and Complete modes are done', 'success');
      } else if (needsProcessing) {
        showNotificationIfNew(`${filesToProcess} sets need processing`, 'info');
      } else {
        showNotificationIfNew('All sets are processed', 'success');
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
      console.log(`🔧 processFilesLocal called with:`, {
        enhanceFace: enhanceFace,
        enhanceFaceType: typeof enhanceFace,
        setNumbers: setNumbers,
        userId: userId
      });
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
    console.log(`🚀 handleProcessFiles called with:`, {
      enhanceFace: enhanceFace,
      enhanceFaceType: typeof enhanceFace,
      captureLoaded: captureLoaded,
      filesChecked: filesChecked,
      isProcessReady: isProcessReady,
      isProcessing: isProcessing,
      processingStatus: processingStatus,
      bothProcessingComplete: processingStatus?.bothProcessingComplete
    });
    
    // ✅ SAFETY: Check if both processing modes are complete before doing anything
    if (processingStatus?.bothProcessingComplete) {
      console.log('❌ Both processing modes are complete, preventing processing');
      showNotification('All processing complete - both Enhance and Complete modes are done', 'info');
      return;
    }
    
    if (!captureLoaded) {
      showNotification('Please load capture dataset first', 'info');
      return;
    }
    
    if (!filesChecked) {
      showNotification('Please click "Check Files" button first to validate files', 'info');
      return;
    }
    
    if (!isProcessReady) {
      console.log('❌ Not ready to process - checking why...');
      // Let's check the current processing status to see why it's not ready
      const userId = await getUserId();
      const result = await checkFilesNeedProcessing(userId, enhanceFace);
      console.log('🔍 Current processing status:', result);
      
      if (result.success && result.needsProcessing) {
        // Update the state if we found files that need processing
        setIsProcessReady(true);
        setProcessingStatus({
          captureCount: result.captureCount,
          enhanceCount: result.enhanceCount,
          completeCount: result.completeCount,
          totalProcessedCount: result.totalProcessedCount,
          filesToProcess: result.filesToProcess
        });
        showNotification(`${result.filesToProcess} sets need processing`, 'info');
        // Continue with processing instead of returning
      } else {
        showNotification('No files need processing', 'info');
        return;
      }
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
      const result = await checkFilesNeedProcessing(userId, enhanceFace);
      if (!result.success) {
        throw new Error('Failed to get processing status');
      }

      if (!result.setsNeedingProcessing || result.setsNeedingProcessing.length === 0) {
        showNotification('No files need processing', 'info');
        setIsProcessing(false);
        setProgressData(null);
        return;
      }

      // ✅ SAFETY: Double-check that we actually need processing
      const bothProcessingComplete = checkBothProcessingComplete(
        result.captureCount, 
        result.enhanceCount, 
        result.completeCount
      );
      
      if (bothProcessingComplete) {
        showNotification('All processing complete - both Enhance and Complete modes are done', 'success');
        setIsProcessing(false);
        setProgressData(null);
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
        message: 'Starting processing...',
        userId: userId
      });

      // Start the processing (it will run in the background)
      console.log(`🚀 Starting processing with enhanceFace=${enhanceFace} (type: ${typeof enhanceFace})`);
      const processResult = await processFilesLocal(result.setsNeedingProcessing, userId);
      
      if (!processResult.success) {
        throw new Error(processResult.error || 'Failed to start processing');
      }

      // Show notification that processing has started
      showNotification('Processing started in the background', 'info');
      
      // The progress will be updated via the polling mechanism
      
    } catch (error) {
      console.error('Error during processing:', error);
      showNotification(error.message || 'Error during processing', 'error');
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
            
            <ProcessSummary files={files} enhanceFace={enhanceFace} />
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
          files={files}
          bothProcessingComplete={processingStatus?.bothProcessingComplete || false}
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