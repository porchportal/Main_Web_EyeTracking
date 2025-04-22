// components/ConnectionStatusIndicator.js
import { useState, useEffect } from 'react';
import { useBackendConnection } from '../utils/stateManager';
import styles from '../styles/ConnectionIndicator.module.css';

export default function ConnectionStatusIndicator() {
  const { isConnected } = useBackendConnection();

  // Only show when disconnected
  if (isConnected) return null;

  return (
    <div className={styles.connectionIndicator}>
      <span className={styles.statusText}>Backend Disconnected</span>
    </div>
  );
}