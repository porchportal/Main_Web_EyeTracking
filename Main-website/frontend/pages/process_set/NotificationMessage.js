import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/Notification.module.css';

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
  const [isVisible, setIsVisible] = useState(show);
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  const closeNotification = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsFadingOut(false);
      onClose();
    }, 400);
  }, [onClose]);
  
  // Handle the show prop changes
  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsFadingOut(false);
      
      // Set up auto-hide timer
      const timer = setTimeout(() => {
        closeNotification();
      }, duration);
      
      // Clean up timer if component unmounts or show changes
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, duration, closeNotification]);
  
  if (!isVisible) return null;
  
  let notificationClass = styles.notification;
  
  // Add fade-out animation class if needed
  if (isFadingOut) {
    notificationClass += ` ${styles.notificationFadeOut}`;
  }
  
  // Add type-specific class
  switch (type) {
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
      <span className={styles.notificationMessage}>{message}</span>
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
    setNotificationProps({
      show: true,
      message,
      type,
      duration
    });
  }, []);
  
  const hideNotification = useCallback(() => {
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