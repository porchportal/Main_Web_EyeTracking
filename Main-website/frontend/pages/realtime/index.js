// frontend/pages/realtime/index.js
import { useRouter } from 'next/router';
import styles from '../../styles/ComingSoon.module.css';

export default function RealtimeModelPage() {
  const router = useRouter();

  const handleGoBack = () => {
    router.push('/');
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        <div className={styles.header}>
          <h1>Coming Soon!</h1>
        </div>
        <div className={styles.body}>
          <p>The Realtime Model feature is currently under development.</p>
          <p>Please check back later for updates!</p>
        </div>
        <div className={styles.footer}>
          <button
            className={styles.backButton}
            onClick={handleGoBack}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
