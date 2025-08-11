import { useState, useEffect } from 'react';
import styles from './ui_noti.module.css';

const UINotification = ({ 
  message, 
  type = 'success', 
  isVisible = false, 
  duration = 3000, 
  onClose 
}) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsActive(true);
      
      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsActive(false);
        setTimeout(() => {
          onClose && onClose();
        }, 300); // Wait for fade out animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const handleClose = () => {
    setIsActive(false);
    setTimeout(() => {
      onClose && onClose();
    }, 300);
  };

  if (!isVisible && !isActive) {
    return null;
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return '✓';
    }
  };

  return (
    <div className={`${styles.notificationContainer} ${isActive ? styles.active : ''}`}>
      <div className={`${styles.notification} ${styles[type]}`}>
        <div className={styles.iconContainer}>
          <span className={styles.icon}>{getIcon()}</span>
        </div>
        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
        </div>
        <button 
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default UINotification;
