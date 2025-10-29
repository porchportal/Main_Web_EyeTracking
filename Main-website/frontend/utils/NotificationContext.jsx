import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const notificationIdCounter = useRef(0);

  const showNotification = useCallback((message, type = 'success') => {
    const id = ++notificationIdCounter.current;
    const newNotification = {
      id,
      show: true,
      message,
      type,
      timestamp: Date.now(),
      removing: false
    };

    setNotifications(prev => {
      // Limit to 5 notifications at a time to prevent overflow
      const updatedNotifications = [...prev, newNotification];
      if (updatedNotifications.length > 5) {
        return updatedNotifications.slice(-5);
      }
      return updatedNotifications;
    });

    // Start removal after 3 seconds
    setTimeout(() => {
      setNotifications(prev => prev.map(notification =>
        notification.id === id
          ? { ...notification, removing: true }
          : notification
      ));

      // Remove from DOM after animation completes
      setTimeout(() => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
      }, 300);
    }, 3000);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, notifications }}>
      {children}
    </NotificationContext.Provider>
  );
};
