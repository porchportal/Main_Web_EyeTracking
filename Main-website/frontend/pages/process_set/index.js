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
  const [isCheckingFiles, setIsCheckingFiles] = useState(false);
  const [filesLoadingState, setFilesLoadingState] = useState({ 
    capture: false, 
    enhance: false, 
    complete: false 
  });
  const [autoRefreshTriggered, setAutoRefreshTriggered] = useState(false);
  
  const [showNotification, NotificationComponent] = useNotification();

  // Get user ID - prioritize passed user ID, fallback to getCurrentUserId
  const getUserId = async () => {
    if (passedUserId) {
      setCurrentUserId(passedUserId);
      return passedUserId;
    }
    
    const userId = await getCurrentUserId();
    setCurrentUserId(userId);
    return userId;
  };

  // Handle enhance face toggle
  const handleEnhanceFaceToggle = async () => {
    const newValue = !enhanceFace;
    
    // ✅ FIXED: Update state first, then refresh processing status
    setEnhanceFace(newValue);
    
    // ✅ FIXED: Refresh processing status when toggle changes
    // This ensures the UI updates to reflect the new processing mode
    try {
      // Call checkProcessingNeeded with the new value directly
      await checkProcessingNeededWithEnhanceFace(newValue, true);
    } catch (error) {
      console.error('Error refreshing processing status after toggle:', error);
    }
  };

  // Handle clear progress
  const handleClearProgress = () => {
    setIsProcessing(false);
    setProgressData(null);
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
      
      // ✅ OPTIMIZED: Use existing file data if available, otherwise make API call
      let captureCount, enhanceCount, completeCount;
      
      if (files.capture && files.enhance && files.complete) {
        // Use existing file data for faster response
        captureCount = files.capture.length;
        enhanceCount = files.enhance.length;
        completeCount = files.complete.length;
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
      // Use shorter interval for more responsive progress updates
      progressInterval = setInterval(async () => {
        try {
          const userId = await getUserId();
          const result = await checkProcessingStatus(userId);
          if (result.success && result.isProcessing === false) {
            setIsProcessing(false);
            setProgressData(null);
            return;
          }
          checkProcessingProgress();
        } catch (error) {
          console.error('Error in progress polling:', error);
        }
      }, 2000); // Check every 2 seconds when processing for more responsive updates
    }
    
    // Clean up interval when isProcessing changes or component unmounts
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [isProcessing, currentUserId]); // ✅ FIXED: Removed progressData dependency to avoid recreating interval

  // Initialize component by checking backend connection and files
  const initializeComponent = async () => {
    await checkConnection();
    if (backendConnected) {
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
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
          // Use setTimeout to defer preloading and reduce initial load
          setTimeout(() => {
            preloadFilesFromFolder(captureFilenames, 'captures', userId).then(results => {
              const successCount = results.filter(r => r.success).length;
            }).catch(error => {
              console.warn('Error preloading capture files:', error);
            });
          }, 1000); // Defer by 1 second
        }
        
        if (enhanceFilenames.length > 0 && organizedFiles.enhance.length <= 50) {
          // Use setTimeout to defer preloading and reduce initial load
          setTimeout(() => {
            preloadFilesFromFolder(enhanceFilenames, 'enhance', userId).then(results => {
              const successCount = results.filter(r => r.success).length;
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
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
      // Check processing status
      const result = await checkProcessingStatus(userId);
      
      if (result.success) {
        // ✅ FIXED: Check if backend says processing is not running
        if (result.isProcessing === false) {
          console.log('🛑 Backend reports processing is not running, stopping frontend processing state');
          setIsProcessing(false);
          setProgressData(null);
          return;
        }
        
        // Additional check: if no progress file found and no active progress, stop processing
        if (!result.progressFileFound && !result.hasActiveProgress) {
          console.log('🛑 No progress file found and no active progress, stopping frontend processing state');
          setIsProcessing(false);
          setProgressData(null);
          return;
        }
        
        // Clear progress data if we have progress but it's not active processing
        if (result.progress && result.progress.status !== 'processing' && result.progress.status !== 'starting') {
          console.log('🛑 Progress file exists but status is not active processing, clearing progress data');
          setProgressData(null);
          return;
        }
        
        // Check if all files are already processed (no need for processing)
        if (result.captureCount > 0 && result.captureCount <= result.totalProcessedCount) {
          console.log('🛑 All files are already processed, stopping frontend processing state');
          setIsProcessing(false);
          setProgressData(null);
          return;
        }
        
        if (result.progress && (result.progress.status === 'processing' || result.progress.status === 'starting')) {
          // Only update progress data if we're actually processing
          const progressData = {
            currentSet: result.progress.currentSet || 0,
            totalSets: result.progress.totalSets || 0,
            processedSets: result.progress.processedSets || [],
            currentFile: result.progress.currentFile || '',
            progress: result.progress.progress || 0,
            status: result.progress.status || 'unknown',
            message: result.progress.message || '',
            userId: userId
          };
          
          // Only set progress data if we have meaningful progress (not 0% with no activity)
          if (progressData.progress > 0 || progressData.status === 'processing' || progressData.status === 'starting') {
            // Force a re-render by updating a timestamp
            setProgressData({
              ...progressData,
              timestamp: Date.now()
            });
          }
          
          // If processing is completed, update state and clear progress after delay
          if (result.progress.status === 'completed') {
            showNotification('Processing completed successfully', 'success');
            
            // Only trigger auto-refresh once per processing session
            if (!autoRefreshTriggered) {
              setAutoRefreshTriggered(true);
              
              // Set a timeout to clear progress after 3 seconds, then auto-refresh
              setTimeout(async () => {
                console.log('🔄 Auto-refreshing files after processing completion...');
                setIsProcessing(false);
                setProgressData(null);
                
                // Show notification and refresh files
                showNotification('Refreshing files list...', 'info');
                await handleCheckFiles();
                
                // Reset the auto-refresh flag after completion
                setTimeout(() => {
                  setAutoRefreshTriggered(false);
                }, 2000);
              }, 3000); // 3 seconds delay
            }
          } else if (result.progress.status === 'error') {
            showNotification('Processing failed: ' + result.progress.message, 'error');
            
            // Set a timeout to clear progress after 3 seconds for errors
            setTimeout(() => {
              setIsProcessing(false);
              setProgressData(null);
            }, 3000); // 3 seconds delay for errors
          }
        }
      } else {
        // If we can't get progress data and we think we're processing, stop
        if (isProcessing) {
          setIsProcessing(false);
          setProgressData(null);
        }
      }
    } catch (error) {
      console.error('❌ Error checking processing progress:', error);
      // If there's an error checking progress and we think we're processing, stop
      if (isProcessing) {
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
    console.log('🔄 handleCheckFiles called - starting file check...');
    
    if (!backendConnected) {
      await checkConnection();
      if (!backendConnected) return;
    }
    
    // ✅ SMOOTH LOADING: Set loading states for smooth UI transitions
    setIsCheckingFiles(true);
    setFilesLoadingState({ capture: true, enhance: true, complete: true });
    setLoading(true);
    // ✅ IMMEDIATE UI FEEDBACK: Disable button immediately
    setIsProcessReady(false);
    setFilesChecked(false);
    
    // Get user ID (prioritize passed user ID)
    const userId = await getUserId();
    
    try {
      // ✅ OPTIMIZED: Get files list from all three folders in parallel with individual loading states
      const [captureResult, enhanceResult, completeResult] = await Promise.all([
        getFilesList('captures', userId).then(result => {
          setFilesLoadingState(prev => ({ ...prev, capture: false }));
          return result;
        }),
        getFilesList('enhance', userId).then(result => {
          setFilesLoadingState(prev => ({ ...prev, enhance: false }));
          return result;
        }),
        getFilesList('complete', userId).then(result => {
          setFilesLoadingState(prev => ({ ...prev, complete: false }));
          return result;
        })
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
    } catch (error) {
      console.error('Error in handleCheckFiles:', error);
      showNotification('Error checking files: ' + error.message, 'error');
    } finally {
      // ✅ SMOOTH LOADING: Clean up all loading states
      setLoading(false);
      setIsCheckingFiles(false);
      setFilesLoadingState({ capture: false, enhance: false, complete: false });
      console.log('✅ handleCheckFiles completed - files refreshed');
    }
  };

  // Handle file preview using the new dataset reader with folder support
  const handleFileSelect = async (filename, folder = 'captures') => {
    setSelectedFile(filename);
    setSelectedFolder(folder);
    setPreviewImageData(null);
    
    try {
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
      // Use the dataset reader to load the file from specific folder
      const result = await readFileFromFolder(filename, folder, userId, true);
      
      if (result.success) {
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
    
    // ✅ SAFETY: Check if both processing modes are complete before doing anything
    if (processingStatus?.bothProcessingComplete) {
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
      // Let's check the current processing status to see why it's not ready
      const userId = await getUserId();
      const result = await checkFilesNeedProcessing(userId, enhanceFace);
      
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
    
    // Clear any previous progress data when starting new processing
    setProgressData(null);
    // Reset auto-refresh flag for new processing session
    setAutoRefreshTriggered(false);
    
    try {
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();
      
      // Get the processing status first
      const result = await checkFilesNeedProcessing(userId, enhanceFace);
      if (!result.success) {
        throw new Error('Failed to get processing status');
      }
      
      // Set initial progress data immediately
      setProgressData({
        currentSet: 0,
        totalSets: result.setsNeedingProcessing.length,
        processedSets: [],
        currentFile: 'Starting...',
        progress: 0,
        status: 'starting',
        message: 'Initializing processing...',
        userId: userId,
        timestamp: Date.now()
      });

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
            key={progressData?.timestamp || 'default'}
            isProcessing={isProcessing} 
            progressData={progressData}
            onClearProgress={handleClearProgress}
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
              isCheckingFiles={isCheckingFiles}
              filesLoadingState={filesLoadingState}
            />
            
            <ProcessSummary files={files} enhanceFace={enhanceFace} isCheckingFiles={isCheckingFiles} />
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
          isCheckingFiles={isCheckingFiles}
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