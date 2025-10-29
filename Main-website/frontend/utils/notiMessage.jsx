import { useNotification } from './NotificationContext';
import styles from './noti.module.css';

const NotiMessage = () => {
  const { notifications } = useNotification();

  return (
    <div className={styles.notificationContainer}>
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          className={`${styles.notification} ${
            notification.type === 'error'
              ? styles.notificationError
              : notification.type === 'info'
              ? styles.notificationInfo
              : styles.notificationSuccess
          } ${notification.removing ? styles.removing : styles.entering}`}
          style={{
            '--notification-index': index
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
    </div>
  );
};

export default NotiMessage;
