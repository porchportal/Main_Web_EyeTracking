import React from 'react';
import styles from '../styles/UserProfile.module.css';

const Settings = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className={`${styles.settingsPanel} ${isOpen ? styles.open : ''}`}
      style={{
        zIndex: 48,
        position: 'fixed',
        top: 0,
        right: isOpen ? '400px' : '-400px',
        width: '400px',
        height: '100vh',
        background: 'white',
        boxShadow: '-2px 0 5px rgba(0, 0, 0, 0.1)',
        transition: 'right 0.3s ease',
        overflowY: 'auto',
        padding: '20px'
      }}
    >
      <div className={styles.settingsHeader}>
        <h2>Settings</h2>
        <button 
          className={styles.closeButton}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className={styles.settingsContent}>
        <div className={styles.settingsSection}>
          <h3>Appearance</h3>
          <div className={styles.formGroup}>
            <label>Theme</label>
            <select>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <h3>Notifications</h3>
          <div className={styles.formGroup}>
            <label>
              <input type="checkbox" />
              Enable notifications
            </label>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <h3>Data Collection</h3>
          <div className={styles.formGroup}>
            <label>
              <input type="checkbox" />
              Allow data collection
            </label>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <h3>Privacy</h3>
          <div className={styles.formGroup}>
            <label>
              <input type="checkbox" />
              Share anonymous usage data
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 