import React, { useEffect, useState } from 'react';
import UserProfileSidebar from '../components/UserProfileSidebar';
import styles from '../styles/CollectedDataset.module.css';

const CollectedDatasetCustomized = () => {
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handleSettingsMessage = (event) => {
      if (event.data.type === 'SHOW_SETTINGS') {
        setShowSettings(event.data.show);
      }
    };

    window.addEventListener('message', handleSettingsMessage);
    return () => {
      window.removeEventListener('message', handleSettingsMessage);
    };
  }, []);

  return (
    <div className={styles.container}>
      <UserProfileSidebar />
    </div>
  );
};

export default CollectedDatasetCustomized; 