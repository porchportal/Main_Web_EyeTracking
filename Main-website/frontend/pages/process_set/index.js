// pages/process_set/index.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import styles from './main.module.css';
import componentStyles from './sectionPreview.module.css';
import { useEffect, useState, useRef } from 'react';
import { useNotification } from '../../utils/NotificationContext';

// Import API functions (only backend connection and processing)
import {
  checkBackendConnection,
  checkProcessingStatus,
  processFiles,
  getCurrentUserId
} from './processApi';

// Import dataset reader utilities (now includes all file operations)
import {
  readFileFromFolder,
  getFilesList,
  checkFilesNeedProcessing
} from './readDataset';

// Import UI components
import {
  FilePreviewPanel,
  FileList,
  ActionButtons,
  ProcessSummary,
  ProcessingProgress
} from './sectionPreview';

export default function ProcessSet() {
  const { showNotification: showNotificationContext } = useNotification();
  const router = useRouter();
  const { userId: passedUserId } = router.query;
  const [isProcessReady, setIsProcessReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [files, setFiles] = useState({ capture: [], enhance: [], complete: [] });
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('captures');
  const [previewImageData, setPreviewImageData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [enhanceFace, setEnhanceFace] = useState(false);
  const lastNotificationMessageRef = useRef('');
  const lastProcessingStatusRef = useRef(null);
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

  // Use notification from context
  const showNotification = (message, type = 'info') => {
    if (showNotificationContext) {
      showNotificationContext(message, type);
    } else {
      console.log(`[Notification - ${type}]`, message);
    }
  };

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

  // Helper function to count only image files (exclude JSON, CSV, etc.)
  const countImageFiles = (filesList) => {
    if (!filesList || !Array.isArray(filesList)) return 0;

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return filesList.filter(file => {
      const filename = file.filename || file;
      const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      return imageExtensions.includes(extension);
    }).length;
  };

  // Helper function to check if the current processing mode is complete
  const checkCurrentModeComplete = (captureCount, enhanceCount, completeCount, currentEnhanceFace) => {
    if (captureCount === 0) return false;

    // Check based on current mode setting
    const currentProcessedCount = currentEnhanceFace ? enhanceCount : completeCount;
    return currentProcessedCount >= captureCount;
  };

  // Helper function to check if both processing modes are complete (for informational purposes)
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
        // Use existing file data for faster response - count only image files
        captureCount = countImageFiles(files.capture);
        enhanceCount = countImageFiles(files.enhance);
        completeCount = countImageFiles(files.complete);
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

      // Check if current mode is complete
      const currentModeComplete = checkCurrentModeComplete(
        captureCount,
        enhanceCount,
        completeCount,
        enhanceFaceValue
      );

      // Check if both processing modes are complete (for informational messages)
      const bothProcessingComplete = checkBothProcessingComplete(
        captureCount,
        enhanceCount,
        completeCount
      );

      // Create current processing status object for comparison
      const currentProcessingStatus = {
        needsProcessing: needsProcessing,
        filesToProcess: filesToProcess,
        captureCount: captureCount,
        enhanceCount: enhanceCount,
        completeCount: completeCount,
        totalProcessedCount: totalProcessedCount,
        currentModeComplete: currentModeComplete,
        bothProcessingComplete: bothProcessingComplete
      };

      // Check if the processing status has actually changed (use ref for synchronous comparison)
      const statusChanged = !lastProcessingStatusRef.current ||
        lastProcessingStatusRef.current.needsProcessing !== currentProcessingStatus.needsProcessing ||
        lastProcessingStatusRef.current.filesToProcess !== currentProcessingStatus.filesToProcess ||
        lastProcessingStatusRef.current.currentModeComplete !== currentProcessingStatus.currentModeComplete;

      if (statusChanged) {
        console.log('📊 Status changed:', {
          from: lastProcessingStatusRef.current,
          to: currentProcessingStatus
        });
      }

      // Only update state if values actually changed to prevent unnecessary re-renders
      if (statusChanged || showNotificationOnChange) {
        setIsProcessReady(needsProcessing);
        setProcessingStatus({
          captureCount: captureCount,
          enhanceCount: enhanceCount,
          completeCount: completeCount,
          totalProcessedCount: totalProcessedCount,
          filesToProcess: filesToProcess,
          bothProcessingComplete: currentModeComplete, // Use current mode for button state
          allModesComplete: bothProcessingComplete
        });
      }

      // Only show notification if status actually changed or explicitly requested
      if (showNotificationOnChange || statusChanged) {
        if (bothProcessingComplete) {
          showNotificationIfNew('All processing complete - both Enhance and Complete modes are done', 'success');
        } else if (currentModeComplete) {
          showNotificationIfNew(`Current mode (${enhanceFaceValue ? 'Enhance' : 'Complete'}) processing is complete`, 'success');
        } else if (needsProcessing) {
          showNotificationIfNew(`${filesToProcess} sets need processing in ${enhanceFaceValue ? 'Enhance' : 'Complete'} mode`, 'info');
        } else {
          showNotificationIfNew('All sets are processed', 'success');
        }

        // Update the last processing status only when status changed (both state and ref)
        setLastProcessingStatus(currentProcessingStatus);
        lastProcessingStatusRef.current = currentProcessingStatus;
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
      if (showNotificationOnChange) {
        showNotification('Error checking processing status: ' + error.message, 'error');
      }
    }
  };

  // Helper function to show notification only if message is different
  const showNotificationIfNew = (message, type = 'info') => {
    // Create a unique key for this type of notification
    const notificationKey = `${type}-${message}`;

    // Use ref for synchronous update to prevent duplicate notifications
    if (notificationKey !== lastNotificationMessageRef.current) {
      console.log('✅ Notification:', message);
      lastNotificationMessageRef.current = notificationKey;
      showNotification(message, type);
    } else {
      console.log('⏭️ Skipping duplicate notification');
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

  // ✅ REMOVED: 30-second status check interval
  // Status is now only checked manually via "Check Files" button
  // This prevents duplicate notifications and unnecessary API calls

  // Progress bar update interval (only runs during active processing)
  useEffect(() => {
    let progressInterval = null;
    let hasShownCompletion = false; // Track if we've already shown completion notification

    if (isProcessing) {
      // Set up interval to check processing progress when processing is active
      progressInterval = setInterval(async () => {
        try {
          const userId = await getUserId();
          const result = await checkProcessingStatus(userId);

          // Handle case where processing is not running anymore
          if (result.success && result.isProcessing === false && result.progress === null) {
            console.log('Processing no longer active, cleaning up...');
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            setIsProcessing(false);
            setProgressData(null);
            await handleCheckFiles();
            return;
          }

          // Check if we have progress data and update accordingly
          if (result.progress && typeof result.progress === 'object') {
            // Handle completion status FIRST before updating progress data
            if (result.progress.status === 'completed' && !hasShownCompletion) {
              console.log('Processing completed!');
              hasShownCompletion = true; // Mark as shown

              // Stop polling immediately
              if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
              }

              // Show final completion state briefly
              setProgressData({
                currentSet: result.progress.currentSet || 0,
                totalSets: result.progress.totalSets || 0,
                processedSets: result.progress.processedSets || [],
                currentFile: result.progress.currentFile || '',
                progress: 100,
                status: 'completed',
                message: '✓ Processing completed successfully!',
                userId: userId,
                timestamp: Date.now()
              });

              showNotification('Processing completed successfully!', 'success');

              // Clear state after 1 second and refresh files
              setTimeout(async () => {
                setIsProcessing(false);
                setProgressData(null);
                await handleCheckFiles();
              }, 1000);

              return;
            }
            // Handle error status (only show notification once)
            else if (result.progress.status === 'error' && !hasShownCompletion) {
              console.error('Processing error:', result.progress.message);
              hasShownCompletion = true; // Mark as shown

              // Stop polling immediately
              if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
              }

              showNotification('Processing failed: ' + result.progress.message, 'error');

              // Clear state after 2 seconds
              setTimeout(() => {
                setIsProcessing(false);
                setProgressData(null);
              }, 2000);

              return;
            }

            // Only update progress data if NOT completed/error
            if (result.progress.status !== 'completed' && result.progress.status !== 'error') {
              const newProgressData = {
                currentSet: result.progress.currentSet || 0,
                totalSets: result.progress.totalSets || 0,
                processedSets: result.progress.processedSets || [],
                currentFile: result.progress.currentFile || '',
                progress: result.progress.progress || 0,
                status: result.progress.status || 'unknown',
                message: result.progress.message || 'Processing...',
                userId: userId,
                timestamp: Date.now()
              };
              setProgressData(newProgressData);
            }
          } else if (result.success && result.isProcessing === false) {
            // If processing is not running and no progress data, stop polling
            console.log('No progress data and processing stopped');
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            setIsProcessing(false);
            setProgressData(null);
            await handleCheckFiles();
          }
        } catch (error) {
          console.error('Error in progress polling:', error);
          // Don't stop polling on error, just log it
        }
      }, 1500); // Check every 1.5 seconds for more responsive updates
    }

    // Clean up interval when isProcessing changes or component unmounts
    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [isProcessing, currentUserId]);

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

  // ✅ REMOVED: Old checkProcessingProgress function
  // Progress checking is now handled directly in the useEffect polling interval above
  // This provides better control over completion/error handling and prevents duplicate notifications

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
      
      // ✅ OPTIMIZED: Calculate processing status directly from IMAGE file counts only
      const captureCount = countImageFiles(organizedFiles.capture);
      const enhanceCount = countImageFiles(organizedFiles.enhance);
      const completeCount = countImageFiles(organizedFiles.complete);
      
      // Calculate processing status based on enhanceFace setting
      const totalProcessedCount = enhanceFace ? enhanceCount : completeCount;
      const needsProcessing = captureCount > totalProcessedCount;
      const filesToProcess = Math.max(0, captureCount - totalProcessedCount);

      // Check if current mode is complete (for button state)
      const currentModeComplete = checkCurrentModeComplete(
        captureCount,
        enhanceCount,
        completeCount,
        enhanceFace
      );

      // Check if both processing modes are complete (for informational messages)
      const bothProcessingComplete = checkBothProcessingComplete(
        captureCount,
        enhanceCount,
        completeCount
      );

      // Update isProcessReady state based on needsProcessing for current mode
      setIsProcessReady(needsProcessing);
      setFilesChecked(true); // Mark files as checked

      // Update processing status for ActionButtons component
      setProcessingStatus({
        captureCount: captureCount,
        enhanceCount: enhanceCount,
        completeCount: completeCount,
        totalProcessedCount: totalProcessedCount,
        filesToProcess: filesToProcess,
        bothProcessingComplete: currentModeComplete, // Use current mode check for button disable
        allModesComplete: bothProcessingComplete // Track if all modes are complete
      });

      // Update processing status for comparison (both state and ref for synchronous access)
      const newProcessingStatus = {
        needsProcessing: needsProcessing,
        filesToProcess: filesToProcess,
        captureCount: captureCount,
        enhanceCount: enhanceCount,
        completeCount: completeCount,
        totalProcessedCount: totalProcessedCount,
        currentModeComplete: currentModeComplete,
        bothProcessingComplete: bothProcessingComplete
      };
      setLastProcessingStatus(newProcessingStatus);
      lastProcessingStatusRef.current = newProcessingStatus;

      // Show appropriate notification
      if (bothProcessingComplete) {
        showNotificationIfNew('All processing complete - both Enhance and Complete modes are done', 'success');
      } else if (currentModeComplete) {
        showNotificationIfNew(`Current mode (${enhanceFace ? 'Enhance' : 'Complete'}) processing is complete`, 'success');
      } else if (needsProcessing) {
        showNotificationIfNew(`${filesToProcess} sets need processing in ${enhanceFace ? 'Enhance' : 'Complete'} mode`, 'info');
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
    if (processingStatus?.allModesComplete) {
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
        // Check if current mode is complete (safety check)
        const currentComplete = checkCurrentModeComplete(
          result.captureCount,
          result.enhanceCount,
          result.completeCount,
          enhanceFace
        );

        // Update the state if we found files that need processing
        setIsProcessReady(!currentComplete);
        setProcessingStatus({
          captureCount: result.captureCount,
          enhanceCount: result.enhanceCount,
          completeCount: result.completeCount,
          totalProcessedCount: result.totalProcessedCount,
          filesToProcess: result.filesToProcess,
          bothProcessingComplete: currentComplete
        });

        if (currentComplete) {
          showNotification(`Current mode (${enhanceFace ? 'Enhance' : 'Complete'}) processing is already complete`, 'success');
          return;
        }

        showNotification(`${result.filesToProcess} sets need processing in ${enhanceFace ? 'Enhance' : 'Complete'} mode`, 'info');
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

    try {
      // Get user ID (prioritize passed user ID)
      const userId = await getUserId();

      // Get the processing status first
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

      // ✅ SAFETY: Double-check that we actually need processing for current mode
      const currentModeComplete = checkCurrentModeComplete(
        result.captureCount,
        result.enhanceCount,
        result.completeCount,
        enhanceFace
      );

      if (currentModeComplete) {
        showNotification(`Current mode (${enhanceFace ? 'Enhance' : 'Complete'}) processing is already complete`, 'success');
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
        userId: userId,
        timestamp: Date.now()
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
            <span className={
              processingStatus?.allModesComplete
                ? styles.statusComplete
                : isProcessReady && captureLoaded && filesChecked
                  ? styles.statusReady
                  : styles.statusNotReady
            }>
              {processingStatus?.allModesComplete
                ? 'Complete'
                : isProcessReady && captureLoaded && filesChecked
                  ? 'Ready'
                  : 'Not Ready'}
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
        
        {/* Processing Progress */}
        {isProcessing && progressData && (
          <div className={styles.processingProgress}>
            <h3>Processing Progress</h3>
            <div className={styles.progressInfo}>
              <span className={styles.progressMessage}>{progressData.message}</span>
              <span className={styles.progressPercent}>{progressData.progress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${progressData.progress}%`,
                  transition: 'width 0.3s ease-in-out'
                }}
              ></div>
            </div>
            <div className={styles.progressDetails}>
              <span className={styles.progressSets}>
                Sets: {progressData.processedSets?.length || 0} / {progressData.totalSets}
              </span>
              {progressData.currentFile && (
                <span className={styles.progressFile}>
                  Current: {progressData.currentFile}
                </span>
              )}
            </div>
          </div>
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
              isProcessing={isProcessing}
              styles={componentStyles}
            />

            <ProcessSummary files={files} enhanceFace={enhanceFace} isCheckingFiles={isCheckingFiles} styles={componentStyles} />
          </div>

          <div className={styles.rightPanel}>
            <FilePreviewPanel
              selectedFile={selectedFile}
              previewImage={previewImageData?.data}
              previewType={previewImageData?.type}
              folder={selectedFolder}
              styles={componentStyles}
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
          bothProcessingComplete={processingStatus?.allModesComplete || false}
          isCheckingFiles={isCheckingFiles}
          currentMode={enhanceFace ? 'Enhance' : 'Complete'}
          styles={componentStyles}
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