// adminAdjust-dataset.js
// Admin Adjust Dataset component for adjusting dataset

import React, { useState, useEffect, useRef } from 'react';
import styles from './style/adminAdjust-dataset.module.css';

const AdminAdjustDataset = ({ userId, onClose }) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // 'summary', 'detailed', 'statistics', 'dataset'
  const [selectedDataType, setSelectedDataType] = useState('all');
  const [isClosing, setIsClosing] = useState(false);
  const [dataTypeVisible, setDataTypeVisible] = useState(false);
  
  // New state for dataset view
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [csvEditMode, setCsvEditMode] = useState(false);
  const [csvEditData, setCsvEditData] = useState([]);
  
  // CSV data cache to prevent unnecessary reloads
  const csvDataCache = useRef(new Map());
  
  // Prevent unnecessary re-renders by memoizing stable references
  const stableUserId = useRef(userId);
  const stableSelectedFile = useRef(selectedFile);
  
  // Update stable references only when they actually change
  useEffect(() => {
    stableUserId.current = userId;
  }, [userId]);
  
  useEffect(() => {
    stableSelectedFile.current = selectedFile;
  }, [selectedFile]);
  
  // Filters and sorting
  const [datasetQuery, setDatasetQuery] = useState('');
  const [datasetFilterField, setDatasetFilterField] = useState('name'); // name | id | type | fileCount | timestamp
  const [datasetSortBy, setDatasetSortBy] = useState('id'); // id | name | timestamp | fileCount
  const [datasetSortOrder, setDatasetSortOrder] = useState('desc'); // asc | desc
  const [datasetNumberFilter, setDatasetNumberFilter] = useState({ mode: 'none', value: '' }); // {mode: 'gt'|'lt'|'eq'|'none', value: number}
  const [requireParameterFile, setRequireParameterFile] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Debounced refresh to prevent rapid successive refreshes
  const refreshTimeoutRef = useRef(null);
  
  // Sample data structure - replace with actual API calls
  const dataTypes = [
    { value: 'all', label: 'All Data' },
    { value: 'screen', label: 'Screen' },
    { value: 'captureWebcam', label: 'CaptureWebcam' },
    { value: 'captureWebcam1', label: 'CaptureWebcam1' },
    { value: 'parameters', label: 'Parameters' }
  ];

  const viewModes = [
    { value: 'summary', label: 'Summary', icon: '📊' },
    { value: 'dataset', label: 'Dataset', icon: '📁' }
  ];

  useEffect(() => {
    if (userId) {
      loadPreviewData();
    }
    
    // Clear CSV cache when userId changes
    return () => {
      csvDataCache.current.clear();
      // Clear any pending refresh timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [userId, selectedDataType]);

  useEffect(() => {
    if (viewMode === 'dataset' && userId) {
      // Clear any previous errors and load datasets when switching to dataset view
      setError(null);
      loadDatasets();
    }
  }, [viewMode, userId]); // Only trigger when switching view modes or userId changes

  const loadPreviewData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call - replace with actual endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Sample data - replace with actual API response
      const sampleData = {
        summary: {
          totalCaptures: 1250,
          totalUsers: 15,
          totalConsent: 20,
          totalSettings: 15,
          lastUpdated: new Date().toLocaleString()
        },
        detailed: {
          captures: [
            { id: 1, userId: userId, timestamp: '2024-01-15 10:30:00', type: 'calibration', status: 'completed' },
            { id: 2, userId: userId, timestamp: '2024-01-15 10:35:00', type: 'random', status: 'completed' },
            { id: 3, userId: userId, timestamp: '2024-01-15 10:40:00', type: 'calibration', status: 'completed' }
          ],
          profiles: [
            { userId: userId, username: 'User1', age: 25, sex: 'M', createdAt: '2024-01-10' },
            { userId: 'user2', username: 'User2', age: 30, sex: 'F', createdAt: '2024-01-12' }
          ],
          consent: [
            { userId: userId, status: 'accepted', timestamp: '2024-01-10 09:00:00' },
            { userId: 'user2', status: 'accepted', timestamp: '2024-01-12 14:30:00' }
          ]
        },
        statistics: {
          dailyCaptures: [45, 52, 38, 61, 48, 55, 42],
          userActivity: [12, 15, 8, 18, 14, 16, 11],
          captureTypes: { calibration: 60, random: 40 },
          completionRate: 94.5
        }
      };
      
      setPreviewData(sampleData);
    } catch (err) {
      setError('Failed to load preview data');
      console.error('Error loading preview data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDatasets = async () => {
    setDatasetLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/dataset_viewerEdit?user_id=${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'no_data') {
        setDatasets([]);
        setSelectedDataset(null);
        setError(data.message || 'Not Collect Yet');
      } else if (data.status === 'success') {
        setDatasets(data.datasets || []);
        if (data.datasets && data.datasets.length > 0) {
          setSelectedDataset(data.datasets[0]);
        } else {
          setSelectedDataset(null);
        }
      } else {
        throw new Error(data.message || 'Failed to load datasets');
      }
      
      // Clear CSV cache when datasets are refreshed to ensure fresh data
      csvDataCache.current.clear();
    } catch (err) {
      setError('Failed to load datasets');
      console.error('Error loading datasets:', err);
    } finally {
      setDatasetLoading(false);
    }
  };

  const handleRefresh = () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    // Debounce the refresh to prevent rapid successive calls
    refreshTimeoutRef.current = setTimeout(() => {
      if (viewMode === 'dataset') {
        setIsRefreshing(true);
        setLastRefreshTime(new Date());
        // Only clear cache and reload if explicitly requested
        csvDataCache.current.clear();
        loadDatasets().finally(() => {
          setIsRefreshing(false);
        });
      } else {
        setIsRefreshing(true);
        loadPreviewData().finally(() => {
          setIsRefreshing(false);
        });
      }
    }, 300); // 300ms debounce delay
  };

  const handleClose = () => {
    setIsClosing(true);
    
    // Clear any pending timeouts and cache
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    csvDataCache.current.clear();
    
    setTimeout(() => {
      onClose();
    }, 300); // Match CSS transition duration
  };

  const handleDatasetSelect = (dataset) => {
    setSelectedDataset(dataset);
  };

  // Compute filtered and sorted datasets
  const getFilteredSortedDatasets = () => {
    let list = Array.isArray(datasets) ? [...datasets] : [];

    // Text filter by selected field
    if (datasetQuery && datasetFilterField) {
      const queryLower = datasetQuery.toLowerCase();
      list = list.filter((d) => {
        switch (datasetFilterField) {
          case 'name':
            return (d.name || '').toLowerCase().includes(queryLower);
          case 'type':
            return (d.type || '').toLowerCase().includes(queryLower);
          case 'id':
            return String(d.id || '').toLowerCase().includes(queryLower);
          case 'fileCount':
            return String((d.files || []).length).includes(datasetQuery);
          case 'timestamp':
            return (d.timestamp || '').toLowerCase().includes(queryLower);
          default:
            return true;
        }
      });
    }

    // Number-based filter (>, <, =)
    if (datasetNumberFilter && datasetNumberFilter.mode !== 'none' && datasetNumberFilter.value !== '') {
      const num = Number(datasetNumberFilter.value);
      list = list.filter((d) => {
        // Apply on capture id by default; if fileCount selected, compare file count
        const compareTarget = datasetFilterField === 'fileCount' ? (d.files ? d.files.length : 0) : Number(d.id || 0);
        if (Number.isNaN(num)) return true;
        if (datasetNumberFilter.mode === 'gt') return compareTarget > num;
        if (datasetNumberFilter.mode === 'lt') return compareTarget < num;
        if (datasetNumberFilter.mode === 'eq') return compareTarget === num;
        return true;
      });
    }

    // Require parameter CSV present
    if (requireParameterFile) {
      list = list.filter((d) => Array.isArray(d.files) && d.files.some((f) => (f.name || '').toLowerCase().startsWith('parameter_') || (f.name || '').toLowerCase().includes('parameter_')));
    }

    // Sorting
    list.sort((a, b) => {
      const dir = datasetSortOrder === 'asc' ? 1 : -1;
      const getKey = (d) => {
        switch (datasetSortBy) {
          case 'name':
            return (d.name || '').toLowerCase();
          case 'timestamp':
            return new Date(d.timestamp || 0).getTime();
          case 'fileCount':
            return (d.files ? d.files.length : 0);
          case 'id':
          default:
            return Number(d.id || 0);
        }
      };
      const ka = getKey(a);
      const kb = getKey(b);
      if (ka < kb) return -1 * dir;
      if (ka > kb) return 1 * dir;
      return 0;
    });

    return list;
  };

  // Keep selection in sync with filtered list
  useEffect(() => {
    const list = getFilteredSortedDatasets();
    if (!list.some((d) => d?.id === selectedDataset?.id)) {
      setSelectedDataset(list.length > 0 ? list[0] : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetQuery, datasetFilterField, datasetNumberFilter, datasetSortBy, datasetSortOrder, requireParameterFile, datasets]);

  const handleFilePreview = (file) => {
    // Set the selected file for preview
    setSelectedFile(file);
    
    // Clear CSV edit mode when switching files
    setCsvEditMode(false);
  };

  const handleFileDownload = (file) => {
    // Download file
    const downloadUrl = `/api/admin/dataset_viewerEdit?user_id=${userId}&filename=${encodeURIComponent(file.name)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileEdit = (file) => {
    if (file.type === 'csv') {
      // For CSV files, open the CSV editor
      setSelectedFile(file);
      setCsvEditMode(true);
    } else {
      // For other file types, show info message
      window.showNotification(`Editing not available for ${file.type.toUpperCase()} files`, 'info');
    }
  };

  const handleFileDelete = async (file) => {
    const confirmDelete = confirm(`Are you sure you want to delete ${file.name}?`);
    if (!confirmDelete) return;

    try {
      setDatasetLoading(true);
      
      const response = await fetch(`/api/admin/dataset_viewerEdit?user_id=${userId}&filename=${encodeURIComponent(file.name)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Failed to delete ${file.name}: ${errorData.detail || 'Unknown error'}`);
      }
      
              // Show success message
        window.showNotification(`Successfully deleted ${file.name}`, 'success');
        
        // Clear file selection if this was the selected file
        if (selectedFile?.name === file.name) {
          setSelectedFile(null);
        }
        
        // Clear the cache for this file
        const cacheKey = `${userId}_${file.name}`;
        csvDataCache.current.delete(cacheKey);
        
        // Refresh the dataset to reflect changes
        await loadDatasets();
      
    } catch (error) {
      console.error('Error deleting file:', error);
      window.showNotification(`Error deleting file: ${error.message}`, 'error');
    } finally {
      setDatasetLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(file.name)) {
        newSet.delete(file.name);
      } else {
        newSet.add(file.name);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) {
      window.showNotification('No files selected for deletion', 'warning');
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete ${selectedFiles.size} selected file(s)?`);
    if (!confirmDelete) return;

    try {
      // Show loading state
      setDatasetLoading(true);
      
      // Delete each selected file
      const deletePromises = Array.from(selectedFiles).map(async (fileName) => {
        const response = await fetch(`/api/admin/dataset_viewerEdit?user_id=${userId}&filename=${encodeURIComponent(fileName)}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(`Failed to delete ${fileName}: ${errorData.detail || 'Unknown error'}`);
        }
        
        return fileName;
      });

      // Wait for all deletions to complete
      const deletedFiles = await Promise.all(deletePromises);
      
      // Show success message
      window.showNotification(`Successfully deleted ${deletedFiles.length} file(s)`, 'success');
      
      // Clear selection and exit selection mode
      setSelectedFiles(new Set());
      setIsSelectionMode(false);
      
      // Clear cache for all deleted files
      deletedFiles.forEach(fileName => {
        const cacheKey = `${userId}_${fileName}`;
        csvDataCache.current.delete(cacheKey);
      });
      
      // Check if the current dataset is now empty
      if (selectedDataset && selectedDataset.files) {
        const remainingFiles = selectedDataset.files.filter(file => !deletedFiles.includes(file.name));
        if (remainingFiles.length === 0) {
          // Dataset is now empty, clear selection
          setSelectedDataset(null);
          setSelectedFile(null);
        }
      }
      
      // Refresh the dataset to reflect changes
      await loadDatasets();
      
    } catch (error) {
      console.error('Error during bulk delete:', error);
      window.showNotification(`Error during deletion: ${error.message}`, 'error');
    } finally {
      setDatasetLoading(false);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedFiles(new Set());
    }
  };

  const handleSelectAll = () => {
    if (selectedDataset && selectedDataset.files) {
      const allFileNames = selectedDataset.files.map(file => file.name);
      setSelectedFiles(new Set(allFileNames));
    }
  };



  // CSV Preview Component
  const CSVPreview = React.memo(({ userId, filename }) => {
    const [csvData, setCsvData] = useState(null);
    const [csvLoading, setCsvLoading] = useState(false);
    const [csvError, setCsvError] = useState(null);
    
    // Create a cache key for this specific file
    const cacheKey = `${userId}_${filename}`;
    
    // Check if we already have this data cached
    const cachedData = csvDataCache.current.get(cacheKey);
    
    // Use ref to track if component is mounted
    const isMounted = useRef(true);

    useEffect(() => {
      // If we have cached data, use it immediately
      if (cachedData) {
        setCsvData(cachedData);
        return;
      }

      // Prevent loading if already loading
      if (csvLoading) return;

      const loadCSVData = async () => {
        setCsvLoading(true);
        setCsvError(null);
        
        try {
          const response = await fetch(`/api/admin/dataset_viewerEdit?user_id=${userId}&filename=${encodeURIComponent(filename)}`);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const csvText = await response.text();
          
          // Parse CSV data (simple parsing for display)
          const lines = csvText.split('\n').filter(line => line.trim());
          const rows = lines.map(line => {
            const [key, value] = line.split(',').map(cell => cell.trim());
            return { key, value };
          });
          
          // Cache the parsed data
          csvDataCache.current.set(cacheKey, rows);
          
          // Only update state if component is still mounted
          if (isMounted.current) {
            setCsvData(rows);
          }
        } catch (err) {
          if (isMounted.current) {
            setCsvError('Failed to load CSV data');
            console.error('Error loading CSV:', err);
          }
        } finally {
          if (isMounted.current) {
            setCsvLoading(false);
          }
        }
      };

      if (userId && filename) {
        loadCSVData();
      }
      
      // Cleanup function
      return () => {
        isMounted.current = false;
      };
    }, [userId, filename, csvLoading]); // Added csvLoading to prevent multiple simultaneous requests
    
    // Memoize the component to prevent unnecessary re-renders
    const memoizedComponent = React.useMemo(() => {
      if (csvLoading) {
        return (
          <div className={styles.csvLoading}>
            <div className={styles.spinner}></div>
            <p>Loading CSV data...</p>
          </div>
        );
      }

      if (csvError) {
        return (
          <div className={styles.csvError}>
            <p>❌ {csvError}</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        );
      }

      if (!csvData) {
        return <p>No CSV data available</p>;
      }

      return (
        <div className={styles.csvSimpleContainer}>
          <div className={styles.csvSimpleBox}>
            {csvData.map((row, index) => (
              <div key={index} className={styles.csvSimpleLine}>
                {row.key},{row.value}
              </div>
            ))}
          </div>
        </div>
      );
    }, [csvData, csvLoading, csvError]);

    return memoizedComponent;
  });

  // CSV Editor Component
  const CSVEditor = React.memo(({ userId, filename, onSave, onCancel }) => {
    const [editData, setEditData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Create a cache key for this specific file
    const cacheKey = `${userId}_${filename}`;
    
    // Check if we already have this data cached
    const cachedData = csvDataCache.current.get(cacheKey);
    
    // Use ref to track if component is mounted
    const isMounted = useRef(true);

    useEffect(() => {
      // If we have cached data, use it immediately
      if (cachedData) {
        setEditData(cachedData);
        return;
      }

      const loadCSVData = async () => {
        setLoading(true);
        setError(null);
        
        try {
          const response = await fetch(`/api/admin/dataset_viewerEdit?user_id=${userId}&filename=${encodeURIComponent(filename)}`);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const csvText = await response.text();
          
          // Parse CSV data for editing
          const lines = csvText.split('\n').filter(line => line.trim());
          const rows = lines.map(line => {
            const [key, value] = line.split(',').map(cell => cell.trim());
            return { key, value };
          });
          
          // Cache the parsed data
          csvDataCache.current.set(cacheKey, rows);
          
          // Only update state if component is still mounted
          if (isMounted.current) {
            setEditData(rows);
          }
        } catch (err) {
          if (isMounted.current) {
            setError('Failed to load CSV data');
            console.error('Error loading CSV:', err);
          }
        } finally {
          if (isMounted.current) {
            setLoading(false);
          }
        }
      };

      if (userId && filename) {
        loadCSVData();
      }
      
      // Cleanup function
      return () => {
        isMounted.current = false;
      };
    }, [userId, filename]); // Only depend on userId and filename

    const handleRowChange = (index, field, value) => {
      const newData = [...editData];
      newData[index] = { ...newData[index], [field]: value };
      setEditData(newData);
    };

    const addRow = () => {
      setEditData([...editData, { key: '', value: '' }]);
    };

    const removeRow = (index) => {
      const newData = editData.filter((_, i) => i !== index);
      setEditData(newData);
    };

    const handleSave = async () => {
      try {
        setLoading(true);
        
        // Convert back to CSV format
        const csvContent = editData
          .filter(row => row.key.trim() && row.value.trim())
          .map(row => `${row.key},${row.value}`)
          .join('\n');
        
        // Save to backend
        const response = await fetch(`/api/admin/dataset_viewerEdit?user_id=${userId}&filename=${encodeURIComponent(filename)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/csv',
          },
          body: csvContent
        });
        
        if (!response.ok) {
          throw new Error('Failed to save CSV file');
        }
        
        window.showNotification('CSV file saved successfully', 'success');
        
        // Clear the cache for this file so it will reload fresh data
        const cacheKey = `${userId}_${filename}`;
        csvDataCache.current.delete(cacheKey);
        
        onSave();
      } catch (error) {
        console.error('Error saving CSV:', error);
        window.showNotification(`Error saving CSV: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    if (loading) {
      return (
        <div className={styles.csvLoading}>
          <div className={styles.spinner}></div>
          <p>Loading CSV data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.csvError}>
          <p>❌ {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }

    return (
      <div className={styles.csvEditorContainer}>
        <div className={styles.csvEditorHeader}>
          <h5>Edit CSV: {filename}</h5>
          <div className={styles.csvEditorControls}>
            <button 
              className={styles.csvEditorButton}
              onClick={addRow}
              title="Add new row"
            >
              ➕ Add Row
            </button>
            <button 
              className={styles.csvEditorButton}
              onClick={handleSave}
              disabled={loading}
              title="Save changes"
            >
              💾 Save
            </button>
            <button 
              className={styles.csvEditorButton}
              onClick={onCancel}
              title="Cancel editing"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
        
        <div className={styles.csvEditorContent}>
          <div className={styles.csvEditorTable}>
            <div className={styles.csvEditorRow}>
              <div className={styles.csvEditorCell}>Key</div>
              <div className={styles.csvEditorCell}>Value</div>
              <div className={styles.csvEditorCell}>Actions</div>
            </div>
            {editData.map((row, index) => (
              <div key={index} className={styles.csvEditorRow}>
                <input
                  className={styles.csvEditorInput}
                  type="text"
                  value={row.key}
                  onChange={(e) => handleRowChange(index, 'key', e.target.value)}
                  placeholder="Enter key"
                />
                <input
                  className={styles.csvEditorInput}
                  type="text"
                  value={row.value}
                  onChange={(e) => handleRowChange(index, 'value', e.target.value)}
                  placeholder="Enter value"
                />
                <button
                  className={styles.csvEditorRemoveButton}
                  onClick={() => removeRow(index)}
                  title="Remove this row"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  });

  const renderSummaryView = () => {
    if (!previewData?.summary) return null;
    
    const { summary } = previewData;
    
    return (
      <div className={styles.previewSummary}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>📸</div>
            <div className={styles.summaryContent}>
              <h4>Total Captures</h4>
              <p>{summary.totalCaptures.toLocaleString()}</p>
            </div>
          </div>
          
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>👥</div>
            <div className={styles.summaryContent}>
              <h4>Active Users</h4>
              <p>{summary.totalUsers}</p>
            </div>
          </div>
          
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>✅</div>
            <div className={styles.summaryContent}>
              <h4>Consent Records</h4>
              <p>{summary.totalConsent}</p>
            </div>
          </div>
          
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>⚙️</div>
            <div className={styles.summaryContent}>
              <h4>User Settings</h4>
              <p>{summary.totalSettings}</p>
            </div>
          </div>
        </div>
        
        <div className={styles.lastUpdated}>
          <p>Last updated: {summary.lastUpdated}</p>
        </div>
      </div>
    );
  };

  const renderDetailedView = () => {
    if (!previewData?.detailed) return null;
    
    const { detailed } = previewData;
    
    return (
      <div className={styles.previewDetailed}>
        <div className={styles.detailedTable}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>User ID</th>
                <th>Type</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {detailed.captures.map((capture) => (
                <tr key={capture.id}>
                  <td>{capture.id}</td>
                  <td>{capture.userId}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles.statusBadgeCompleted}`}>
                      {capture.type}
                    </span>
                  </td>
                  <td>{capture.timestamp}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles.statusBadgeCompleted}`}>
                      {capture.status}
                    </span>
                  </td>
                  <td>
                    <button className={styles.actionButton}>View</button>
                    <button className={styles.actionButton}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStatisticsView = () => {
    if (!previewData?.statistics) return null;
    
    const { statistics } = previewData;
    
    return (
      <div className={styles.previewStatistics}>
        <div className={styles.statisticsGrid}>
          <div className={styles.statCard}>
            <h4>Daily Capture Activity</h4>
            <div className={styles.statChart}>
              <div className={styles.chartPlaceholder}>
                📊 Chart: {statistics.dailyCaptures.join(', ')} captures over 7 days
              </div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <h4>Capture Type Distribution</h4>
            <div className={styles.statList}>
              <li>Calibration: {statistics.captureTypes.calibration}%</li>
              <li>Random: {statistics.captureTypes.random}%</li>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <h4>Completion Rate</h4>
            <div className={styles.statValue}>
              <span className={styles.statNumber}>{statistics.completionRate}%</span>
              <span className={styles.statLabel}>Success Rate</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDatasetView = () => {
    if (datasetLoading) {
      return (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading datasets...</p>
        </div>
      );
    }

    if (error && error === 'Not Collect Yet') {
      return (
        <div className={styles.noDataState}>
          <div className={styles.noDataIcon}>📁</div>
          <h3>No Datasets Available</h3>
          <p>{error}</p>
          <p>This user hasn't collected any eye tracking data yet.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorState}>
          <p>{error}</p>
          <button onClick={handleRefresh}>Retry</button>
        </div>
      );
    }

    if (datasets.length === 0) {
      return (
        <div className={styles.noDataState}>
          <div className={styles.noDataIcon}>📁</div>
          <h3>No Datasets Found</h3>
          <p>No datasets are available for this user.</p>
        </div>
      );
    }

    const filteredDatasets = getFilteredSortedDatasets();

    return (
      <div className={styles.datasetView}>
        <div className={styles.datasetSidebar}>
          <div className={styles.datasetList}>
            <h3>Datasets ({filteredDatasets.length})</h3>
            <div className={styles.datasetControlsBar}>
              <div className={styles.datasetSearchGroup}>
                <input
                  className={styles.datasetSearchInput}
                  type="text"
                  placeholder={`Search by ${datasetFilterField}...`}
                  value={datasetQuery}
                  onChange={(e) => setDatasetQuery(e.target.value)}
                />
                <select
                  className={styles.datasetSearchSelect}
                  value={datasetFilterField}
                  onChange={(e) => setDatasetFilterField(e.target.value)}
                >
                  <option value="name">Capture Session</option>
                  <option value="id">Capture Number</option>
                  <option value="type">Type</option>
                  <option value="fileCount">File Count</option>
                  <option value="timestamp">Timestamp</option>
                </select>
              </div>



              <div className={styles.datasetSortGroup}>
                <select
                  className={styles.datasetSortSelect}
                  value={datasetSortBy}
                  onChange={(e) => setDatasetSortBy(e.target.value)}
                >
                  <option value="name">Sort by Name</option>
                  <option value="timestamp">Sort by Time</option>
                  <option value="fileCount">Sort by Files</option>
                </select>
                <button
                  className={styles.datasetSortOrderButton}
                  onClick={() => setDatasetSortOrder(datasetSortOrder === 'asc' ? 'desc' : 'asc')}
                  title="Toggle sort order"
                >
                  {datasetSortOrder === 'asc' ? 'Low → High' : 'High → Low'}
                </button>

                <div className={styles.datasetNumberFilter}>
                  <select
                    className={styles.datasetNumMode}
                    value={datasetNumberFilter.mode}
                    onChange={(e) => setDatasetNumberFilter({ ...datasetNumberFilter, mode: e.target.value })}
                  >
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="eq">=</option>
                  </select>
                  <input
                    className={styles.datasetNumInput}
                    type="number"
                    placeholder={datasetFilterField === 'fileCount' ? 'files' : 'number'}
                    value={datasetNumberFilter.value}
                    onChange={(e) => setDatasetNumberFilter({ ...datasetNumberFilter, value: e.target.value })}
                  />
                </div>

                <div className={styles.datasetFlags}>
                  <label className={styles.checkboxInline}>
                    <input
                      type="checkbox"
                      checked={requireParameterFile}
                      onChange={(e) => setRequireParameterFile(e.target.checked)}
                    />
                    Only sessions with parameter.csv
                  </label>
                </div>
              </div>
            </div>

            {filteredDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className={`${styles.datasetItem} ${selectedDataset?.id === dataset.id ? styles.datasetItemActive : ''}`}
                onClick={() => handleDatasetSelect(dataset)}
              >
                <div className={styles.datasetHeader}>
                  <span className={styles.datasetName}>{dataset.name}</span>
                  <span className={`${styles.datasetStatus} ${styles.datasetStatusCompleted}`}>
                    {dataset.status}
                  </span>
                </div>
                <div className={styles.datasetInfo}>
                  <span className={styles.datasetType}>{dataset.type}</span>
                  <span className={styles.datasetTime}>{dataset.timestamp}</span>
                </div>
                <div className={styles.datasetFiles}>
                  <span className={styles.fileCount}>{dataset.files.length} files</span>
                  <span className={styles.datasetDuration}>{dataset.duration}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className={styles.datasetPreview}>
          {selectedDataset ? (
            <div className={styles.previewContainer}>
              <div className={styles.previewHeader}>
                <h3>{selectedDataset.name}</h3>
                <div className={styles.previewMeta}>
                  <span>Type: {selectedDataset.type}</span>
                  <span>Duration: {selectedDataset.duration}</span>
                  <span>Status: {selectedDataset.status}</span>
                </div>
              </div>
              
              <div className={styles.fileList}>
                <div className={styles.fileListHeader}>
                  <h4>Files ({selectedDataset.files.length})</h4>
                  <div className={styles.fileListControls}>
                    <button 
                      className={`${styles.selectionModeButton} ${isSelectionMode ? styles.selectionModeActive : ''}`}
                      onClick={toggleSelectionMode}
                    >
                      {isSelectionMode ? '✕ Cancel Selection' : '☑️ Select Files'}
                    </button>
                    {isSelectionMode && (
                                              <>
                          {selectedFiles.size < selectedDataset.files.length && (
                            <button 
                              className={styles.selectAllButton}
                              onClick={handleSelectAll}
                            >
                              ☑️ Select All
                            </button>
                          )}
                          {selectedFiles.size > 0 && (
                            <button 
                              className={styles.bulkDeleteButton}
                              onClick={handleBulkDelete}
                            >
                              🗑️ Delete Selected ({selectedFiles.size})
                            </button>
                          )}
                        </>
                    )}
                  </div>
                </div>
                <div className={styles.fileGrid}>
                  {selectedDataset.files.map((file, index) => (
                    <div key={index} className={`${styles.fileItem} ${selectedFiles.has(file.name) ? styles.fileItemSelected : ''}`}>
                      {isSelectionMode && (
                        <div className={styles.fileCheckbox}>
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file.name)}
                            onChange={() => handleFileSelect(file)}
                          />
                        </div>
                      )}
                      <div className={styles.fileIcon}>
                        {file.type === 'jpg' || file.type === 'png' ? '🖼️' : file.type === 'csv' ? '📊' : '📄'}
                      </div>
                      <div className={styles.fileInfo}>
                        <div className={styles.fileName}>{file.name}</div>
                        <div className={styles.fileMeta}>
                          <span className={styles.fileType}>{file.type.toUpperCase()}</span>
                          <span className={styles.fileSize}>{file.size}</span>
                        </div>
                      </div>
                      <div className={styles.fileActions}>
                        <button 
                          className={`${styles.previewButton} ${selectedFile?.name === file.name ? styles.active : ''}`}
                          onClick={() => handleFilePreview(file)}
                        >
                          Preview
                        </button>

                        <button 
                          className={styles.editingButton}
                          onClick={() => handleFileEdit(file)}
                        >
                          Editing
                        </button>
                        <button 
                          className={styles.deleteButton}
                          onClick={() => handleFileDelete(file)}
                          title="Delete this file"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
                            <div className={styles.previewContent}>
                <h4>Preview</h4>
                {selectedFile ? (
                  <div className={styles.filePreviewContainer}>
                    <div className={styles.filePreviewHeader}>
                      <h5>{selectedFile.name}</h5>
                      <div className={styles.filePreviewMeta}>
                        <span>Type: {selectedFile.type.toUpperCase()}</span>
                        <span>Size: {selectedFile.size}</span>
                      </div>
                    </div>
                    
                                         {selectedFile.type === 'jpg' || selectedFile.type === 'png' ? (
                       <div className={styles.imagePreview}>
                         <img 
                           src={`/api/admin/dataset_viewerEdit?user_id=${userId}&filename=${encodeURIComponent(selectedFile.name)}`}
                           alt={selectedFile.name}
                           onError={(e) => {
                             e.target.style.display = 'none';
                             e.target.nextSibling.style.display = 'block';
                           }}
                         />
                         <div className={styles.imagePreviewFallback}>
                           📸 Image preview not available
                           <p>Error: Could not load image from server</p>
                           <p>This might be due to backend configuration</p>
                           <p>Try using the Download button instead</p>
                         </div>
                       </div>
                                           ) : selectedFile.type === 'csv' ? (
                      <div className={styles.csvPreview}>
                        {csvEditMode ? (
                          <div className={styles.csvPreviewContent}>
                            <CSVEditor 
                              userId={userId} 
                              filename={selectedFile.name}
                              onSave={() => {
                                setCsvEditMode(false);
                                loadDatasets(); // Refresh to show updated data
                              }}
                              onCancel={() => setCsvEditMode(false)}
                            />
                          </div>
                        ) : (
                          <div className={styles.csvPreviewContent}>
                            <CSVPreview userId={userId} filename={selectedFile.name} />
                            <div className={styles.csvPreviewActions}>
                              <button 
                                className={styles.csvEditButton}
                                onClick={() => setCsvEditMode(true)}
                              >
                                ✏️ Edit CSV
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                     ) : (
                      <div className={styles.filePreviewFallback}>
                        <h6>File Preview</h6>
                        <p>📄 Preview not available for {selectedFile.type.toUpperCase()} files</p>
                        <p>Click Download to get the file</p>
                      </div>
                    )}
                  </div>
                                 ) : (
                   <div className={styles.previewPlaceholder}>
                     <div className={styles.previewWelcome}>
                       <div className={styles.previewWelcomeIcon}>📁</div>
                       <h5>Dataset Preview</h5>
                       <p>Select a file from the dataset to preview its contents</p>
                       <div className={styles.previewInstructions}>
                         <p>• Click <strong>Preview</strong> on any file to view its contents</p>
                         <p>• Click <strong>Editing</strong> on CSV files to modify their content</p>
                         <p>• Supported formats: Images (JPG/PNG), CSV data files</p>
                       </div>
                     </div>
                   </div>
                 )}
              </div>
            </div>
          ) : (
            <div className={styles.noSelection}>
              <p>Select a dataset from the left panel to view details</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading && viewMode !== 'dataset') {
      return (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading preview data...</p>
        </div>
      );
    }

    if (error && viewMode !== 'dataset') {
      return (
        <div className={styles.errorState}>
          <p>{error}</p>
          <button onClick={handleRefresh}>Retry</button>
        </div>
      );
    }

    switch (viewMode) {
      case 'summary':
        return renderSummaryView();
      case 'detailed':
        return renderDetailedView();
      case 'statistics':
        return renderStatisticsView();
      case 'dataset':
        return renderDatasetView();
      default:
        return renderSummaryView();
    }
  };

  return (
    <div className={`${styles.dataPreviewSection} ${isClosing ? styles.closing : ''}`}>
      <div className={styles.previewHeader}>
        <h2>Data Preview</h2>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
      </div>
      
      <div className={styles.previewControls}>
        <div className={styles.controlGroup}>
          <label>View Mode:</label>
          <div className={styles.viewModeButtons}>
            {viewModes.map(mode => (
              <button
                key={mode.value}
                className={`${styles.viewModeButton} ${viewMode === mode.value ? styles.viewModeButtonActive : ''}`}
                onClick={() => {
                  setViewMode(mode.value);
                  // Show/hide data type control based on view mode
                  if (mode.value === 'dataset') {
                    setDataTypeVisible(true);
                  } else {
                    setDataTypeVisible(false);
                  }
                }}
              >
                <span className={styles.viewModeIcon}>{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        
        <div 
          className={`${styles.controlGroup} ${styles.dataTypeControl} ${
            dataTypeVisible ? styles.dataTypeVisible : styles.dataTypeHidden
          }`}
        >
          <label>Data Type:</label>
          <select 
            className={styles.previewSelect}
            value={selectedDataType}
            onChange={(e) => setSelectedDataType(e.target.value)}
          >
            {dataTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className={`${styles.refreshButton} ${styles.refreshButtonAnimated} ${
            dataTypeVisible ? styles.refreshButtonRight : styles.refreshButtonLeft
          }`}
          onClick={handleRefresh}
          disabled={loading || datasetLoading || isRefreshing}
        >
          {loading || datasetLoading || isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
      
      <div className={styles.previewContent}>
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminAdjustDataset;
