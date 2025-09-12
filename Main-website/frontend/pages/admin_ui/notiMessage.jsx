import { useState, useEffect } from 'react';
import styles from './style/Admin.module.css';

const NotiMessage = () => {
  const [notifications, setNotifications] = useState([]);
  let notificationId = 0;

  const showNotification = (message, type = 'success') => {
    const id = ++notificationId;
    const newNotification = { 
      id,
      show: true, 
      message, 
      type,
      timestamp: Date.now()
    };
    
    // Add new notification to the stack
    setNotifications(prev => [...prev, newNotification]);
    
    // Auto-hide notification after 3 seconds with smooth exit animation
    setTimeout(() => {
      setNotifications(prev => prev.map(notification => 
        notification.id === id 
          ? { ...notification, removing: true }
          : notification
      ));
      
      // Remove from DOM after exit animation completes
      setTimeout(() => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
      }, 300);
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
      {notifications.map((notification, index) => (
        <div 
          key={notification.id}
          className={`${styles.notification} ${
            notification.type === 'error' 
              ? styles.notificationError 
              : notification.type === 'info'
              ? styles.notificationInfo
              : styles.notificationSuccess
          } ${notification.removing ? styles.removing : ''}`}
          style={{
            position: 'fixed',
            top: `${20 + (index * 80)}px`, // Stack notifications vertically with 80px spacing
            right: '20px',
            zIndex: 9999 + index, // Ensure proper layering
            pointerEvents: 'auto',
            maxWidth: '400px',
            minWidth: '300px'
          }}
        >
          <div className={styles.notificationContent}>
            <span className={styles.notificationIcon}>
              {notification.type === 'success' ? '✓' : 
               notification.type === 'info' ? 'ℹ' : '⚠'}
            </span>
            <span className={styles.notificationMessage}>
              {notification.message}
            </span>
          </div>
        </div>
      ))}
    </>
  );
};

export default NotiMessage;
