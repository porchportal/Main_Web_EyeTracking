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
        setProgressData(null);
        return;
      }

      // Initialize progress data
      setProgressData({
        currentSet: 0,
        totalSets: filesToProcess.length,
        processedSets: [],
        currentFile: '',
        progress: 0,
        status: 'processing',
        message: 'Starting processing...'
      });

      // Get set numbers to process
      const set_numbers = filesToProcess.map(file => {
        const match = file.filename.match(/_(\d+)\./);
        return match ? parseInt(match[1]) : 0;
      }).filter(num => num > 0);

      // Generate a unique user ID
      const user_id = `user_${Date.now()}`;

      try {
        // Send processing request to backend
        const response = await fetch('/api/queue-processing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            user_id,
            set_numbers 
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start processing');
        }

        // Start reading the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const data = JSON.parse(line);
              console.log('Received processing update:', data);
              
              // Update progress data with the backend-provided progress
              setProgressData(prev => {
                if (!prev) return prev;
                
                const newProcessedSets = [...prev.processedSets];
                if (data.status === 'processing' && !newProcessedSets.includes(data.currentSet)) {
                  newProcessedSets.push(data.currentSet);
                }
                
                return {
                  ...prev,
                  currentSet: data.currentSet || prev.currentSet,
                  currentFile: data.currentFile || prev.currentFile,
                  processedSets: newProcessedSets,
                  progress: data.progress || Math.round((newProcessedSets.length / prev.totalSets) * 100),
                  status: data.status || prev.status,
                  message: data.message || prev.message
                };
              });

              // Show notifications for important updates
              if (data.status === 'warning') {
                showNotification(data.message, 'warning');
              } else if (data.status === 'error') {
                showNotification(data.message, 'error');
                setIsProcessing(false);
                setProgressData(null);
              } else if (data.status === 'completed') {
                showNotification('Processing completed successfully', 'success');
                setIsProcessing(false);
                setProgressData(null);
                // Refresh the files list after completion
                await handleCheckFiles();
              }
            } catch (error) {
              console.error('Error parsing update:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error during processing:', error);
        showNotification(error.message || 'Error during processing', 'error');
        setIsProcessing(false);
        setProgressData(null);
      }
    } catch (error) {
      console.error('Error in processing loop:', error);
      showNotification(`Error: ${error.message}`, 'error');
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