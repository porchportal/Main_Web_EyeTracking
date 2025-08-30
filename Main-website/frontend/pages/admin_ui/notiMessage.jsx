import { useState, useEffect } from 'react';
import styles from './Admin.module.css';

const NotiMessage = () => {
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showNotification = (message, type = 'success') => {
    setNotification({ 
      show: true, 
      message, 
      type 
    });
    
    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Expose showNotification function globally so it can be used from admin.js
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.showNotification = showNotification;
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete window.showNotification;
      }
    };
  }, []);

  return (
    <>
      {notification.show && (
        <div 
          className={`${styles.notification} ${
            notification.type === 'error' 
              ? styles.notificationError 
              : styles.notificationSuccess
          }`}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            pointerEvents: 'auto'
          }}
        >
          <div className={styles.notificationContent}>
            <span className={styles.notificationIcon}>
              {notification.type === 'success' ? '✓' : '⚠'}
            </span>
            <span className={styles.notificationMessage}>
              {notification.message}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default NotiMessage;
