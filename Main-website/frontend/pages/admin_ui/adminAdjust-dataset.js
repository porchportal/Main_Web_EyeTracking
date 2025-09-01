// adminAdjust-dataset.js
// Admin Adjust Dataset component for adjusting dataset

import React, { useState, useEffect } from 'react';
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
  // Filters and sorting
  const [datasetQuery, setDatasetQuery] = useState('');
  const [datasetFilterField, setDatasetFilterField] = useState('name'); // name | id | type | fileCount | timestamp
  const [datasetSortBy, setDatasetSortBy] = useState('id'); // id | name | timestamp | fileCount
  const [datasetSortOrder, setDatasetSortOrder] = useState('desc'); // asc | desc
  const [datasetNumberFilter, setDatasetNumberFilter] = useState({ mode: 'none', value: '' }); // {mode: 'gt'|'lt'|'eq'|'none', value: number}
  const [requireParameterFile, setRequireParameterFile] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

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
  }, [userId, selectedDataType]);

  useEffect(() => {
    if (viewMode === 'dataset' && userId) {
      // Clear any previous errors and load datasets when switching to dataset view
      setError(null);
      loadDatasets();
    }
  }, [viewMode, userId]); // Added viewMode back to trigger when switching views

  // Separate useEffect for refresh button clicks
  useEffect(() => {
    if (viewMode === 'dataset' && userId) {
      loadDatasets();
    }
  }, [viewMode, userId]); // Only reload when switching view modes

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
    } catch (err) {
      setError('Failed to load datasets');
      console.error('Error loading datasets:', err);
    } finally {
      setDatasetLoading(false);
    }
  };

  const handleRefresh = () => {
    if (viewMode === 'dataset') {
      setLastRefreshTime(new Date());
      loadDatasets();
    } else {
      loadPreviewData();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
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
    // Handle file editing - you can implement the editing logic here
    console.log('Editing file:', file.name);
    window.showNotification(`Editing file: ${file.name}`, 'info');
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

  const handleBulkDelete = () => {
    if (selectedFiles.size === 0) {
      window.showNotification('No files selected for deletion', 'warning');
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete ${selectedFiles.size} selected file(s)?`);
    if (confirmDelete) {
      // Implement bulk delete logic here
      console.log('Deleting files:', Array.from(selectedFiles));
      window.showNotification(`Deleted ${selectedFiles.size} file(s)`, 'success');
      setSelectedFiles(new Set());
      setIsSelectionMode(false);
      // Refresh the dataset to reflect changes
      handleRefresh();
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

    useEffect(() => {
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
          
          setCsvData(rows);
        } catch (err) {
          setCsvError('Failed to load CSV data');
          console.error('Error loading CSV:', err);
        } finally {
          setCsvLoading(false);
        }
      };

      if (userId && filename) {
        loadCSVData();
      }
    }, [userId, filename]); // Removed refreshTrigger dependency

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
                        <div className={styles.csvPreviewContent}>
                          <CSVPreview userId={userId} filename={selectedFile.name} />
                        </div>
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
                         <p>• Use <strong>Download</strong> to save files to your device</p>
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
          disabled={loading || datasetLoading}
        >
          {loading || datasetLoading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
      
      <div className={styles.previewContent}>
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminAdjustDataset;
