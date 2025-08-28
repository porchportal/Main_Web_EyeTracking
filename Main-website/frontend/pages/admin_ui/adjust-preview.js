// adjust-preview.js
// Data Preview component for adjusting dataset

import React, { useState, useEffect } from 'react';
import styles from './adjust-preview.module.css';

const DataPreview = ({ userId, onClose }) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('summary'); // 'summary', 'detailed', 'statistics'
  const [selectedDataType, setSelectedDataType] = useState('all');
  const [isClosing, setIsClosing] = useState(false);

  // Sample data structure - replace with actual API calls
  const dataTypes = [
    { value: 'all', label: 'All Data' },
    { value: 'captures', label: 'Eye Tracking Captures' },
    { value: 'profiles', label: 'User Profiles' },
    { value: 'consent', label: 'Consent Data' },
    { value: 'settings', label: 'User Settings' }
  ];

  const viewModes = [
    { value: 'summary', label: 'Summary', icon: '📊' },
    { value: 'detailed', label: 'Detailed', icon: '📋' },
    { value: 'statistics', label: 'Statistics', icon: '📈' }
  ];

  useEffect(() => {
    if (userId) {
      loadPreviewData();
    }
  }, [userId, selectedDataType]);

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

  const handleRefresh = () => {
    loadPreviewData();
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match CSS transition duration
  };

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

  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading preview data...</p>
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

    switch (viewMode) {
      case 'summary':
        return renderSummaryView();
      case 'detailed':
        return renderDetailedView();
      case 'statistics':
        return renderStatisticsView();
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
        
        <div className={styles.controlGroup}>
          <label>View Mode:</label>
          <div className={styles.viewModeButtons}>
            {viewModes.map(mode => (
              <button
                key={mode.value}
                className={`${styles.viewModeButton} ${viewMode === mode.value ? styles.viewModeButtonActive : ''}`}
                onClick={() => setViewMode(mode.value)}
              >
                <span className={styles.viewModeIcon}>{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        
        <button 
          className={styles.refreshButton}
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
      
      <div className={styles.previewContent}>
        {renderContent()}
      </div>
    </div>
  );
};

export default DataPreview;
