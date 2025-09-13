import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../../styles/Notification.module.css';

// Global notification queue to prevent overlapping
let notificationQueue = [];
let currentNotification = null;
let notificationListeners = new Set();

const processNotificationQueue = () => {
  if (currentNotification || notificationQueue.length === 0) return;
  
  const nextNotification = notificationQueue.shift();
  if (nextNotification) {
    currentNotification = nextNotification;
    // Notify all listeners about the new notification
    notificationListeners.forEach(listener => listener(nextNotification));
  }
};

const addToQueue = (notification) => {
  // Check if the same message is already in queue or currently showing
  const isDuplicate = notificationQueue.some(n => n.message === notification.message) || 
                     (currentNotification && currentNotification.message === notification.message);
  
  if (!isDuplicate) {
    notificationQueue.push(notification);
    processNotificationQueue();
  }
};

const removeFromQueue = () => {
  currentNotification = null;
  // Notify all listeners that notification is cleared
  notificationListeners.forEach(listener => listener(null));
  // Process next notification in queue
  setTimeout(processNotificationQueue, 100);
};

/**
 * Notification system component that can be imported and used in any React component
 * @param {Object} props - Component props
 * @param {boolean} props.show - Whether to show the notification
 * @param {string} props.message - The notification message
 * @param {string} props.type - The notification type ('info', 'success', 'error')
 * @param {number} props.duration - Duration in ms before notification auto-hides (default: 5000)
 * @param {Function} props.onClose - Function to call when notification is closed
 */
const NotificationMessage = ({ 
  show = false,
  message = '',
  type = 'info',
  duration = 5000,
  onClose = () => {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [currentType, setCurrentType] = useState('info');
  const timerRef = useRef(null);
  
  const closeNotification = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsFadingOut(false);
      removeFromQueue();
      onClose();
    }, 400);
  }, [onClose]);
  
  // Handle global notification queue
  useEffect(() => {
    const handleGlobalNotification = (notification) => {
      if (notification) {
        setCurrentMessage(notification.message);
        setCurrentType(notification.type);
        setIsVisible(true);
        setIsFadingOut(false);
        
        // Set up auto-hide timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          closeNotification();
        }, notification.duration || 5000);
      } else {
        // Clear current notification
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setIsVisible(false);
        setIsFadingOut(false);
      }
    };
    
    notificationListeners.add(handleGlobalNotification);
    
    return () => {
      notificationListeners.delete(handleGlobalNotification);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [closeNotification]);
  
  // Handle the show prop changes (for backward compatibility)
  useEffect(() => {
    if (show) {
      addToQueue({ message, type, duration });
    }
  }, [show, message, type, duration]);
  
  if (!isVisible) return null;
  
  let notificationClass = styles.notification;
  
  // Add fade-out animation class if needed
  if (isFadingOut) {
    notificationClass += ` ${styles.notificationFadeOut}`;
  }
  
  // Add type-specific class
  switch (currentType) {
    case 'info':
      notificationClass += ` ${styles.notificationInfo}`;
      break;
    case 'success':
      notificationClass += ` ${styles.notificationSuccess}`;
      break;
    case 'error':
      notificationClass += ` ${styles.notificationError}`;
      break;
  }
  
  return (
    <div className={notificationClass}>
      <span className={styles.notificationMessage}>{currentMessage}</span>
      <button className={styles.notificationCloseButton} onClick={closeNotification}>
        ×
      </button>
    </div>
  );
};

export const useNotification = () => {
  const [notificationProps, setNotificationProps] = useState({
    show: false,
    message: '',
    type: 'info',
    duration: 5000
  });
  
  const showNotification = useCallback((message, type = 'info', duration = 5000) => {
    // Add notification to global queue instead of local state
    addToQueue({ message, type, duration });
    
    // Also update local state for backward compatibility
    setNotificationProps({
      show: true,
      message,
      type,
      duration
    });
  }, []);
  
  const hideNotification = useCallback(() => {
    // Clear current notification from queue
    removeFromQueue();
    
    // Also update local state for backward compatibility
    setNotificationProps(prev => ({
      ...prev,
      show: false
    }));
  }, []);
  
  const NotificationComponent = (
    <NotificationMessage
      {...notificationProps}
      onClose={hideNotification}
    />
  );
  
  return [showNotification, NotificationComponent];
};

export default NotificationMessage;