// frontend/pages/admin_ui/consentDataTable.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from './style/consentDataTable.module.css';

export default function ConsentDataTable({
  consentData,
  onDataUpdate,
  onOverrideAccess,
  safeShowNotification
}) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showAllConsentData, setShowAllConsentData] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const handleDeleteClick = (userId) => {
    setDeleteTarget(userId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;

      // Close the confirmation dialog first
      setShowDeleteConfirm(false);

      // Start the deletion animation
      setDeletingUserId(deleteTarget);

      // Delete from local consent file using the existing endpoint
      const consentResponse = await fetch('/api/admin/delete-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ userId: deleteTarget })
      });

      if (!consentResponse.ok) {
        if (consentResponse.status === 401) {
          // Silent redirect without error notification
          router.replace('/admin_ui/admin-login');
          return;
        } else {
          const errorData = await consentResponse.json().catch(() => ({}));
          console.error('Consent deletion error:', {
            status: consentResponse.status,
            statusText: consentResponse.statusText,
            errorData
          });
          setDeletingUserId(null); // Reset animation state on error
          throw new Error('Failed to delete consent data');
        }
      }

      // Wait for animation to complete before removing from state
      setTimeout(() => {
        // Notify parent component to update the data
        if (onDataUpdate) {
          onDataUpdate(deleteTarget);
        }

        setDeletingUserId(null);
        setDeleteTarget(null);
        safeShowNotification('User consent data deleted successfully from consent_data.json!');
      }, 500); // Match the animation duration

    } catch (error) {
      console.error('Error deleting consent data:', error);
      safeShowNotification('Failed to delete consent data. Please try again.', 'error');
      setDeletingUserId(null);
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  return (
    <>
      {/* Consent Data Section */}
      <div className={styles.settingsSection}>
        <h2>Consent Data</h2>
        <div className={styles.consentTable}>
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Consent Status</th>
                <th>Timestamp</th>
                <th>Received At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {consentData
                .slice(0, showAllConsentData ? consentData.length : 5)
                .map((data, index) => (
                <tr
                  key={index}
                  className={`
                    ${isAnimating ? (showAllConsentData ? styles.expanding : styles.collapsing) : ''}
                    ${deletingUserId === data.userId ? styles.rowDeleting : ''}
                  `}
                  style={{
                    animationDelay: `${index * 0.05}s`
                  }}
                >
                  <td>{data.userId}</td>
                  <td>{data.status ? 'Accepted' : 'Declined'}</td>
                  <td>{new Date(data.timestamp).toLocaleString()}</td>
                  <td>{new Date(data.receivedAt).toLocaleString()}</td>
                  <td>
                    <div className={styles.actionButtons}>
                      {!data.status && (
                        <button
                          className={styles.overrideButton}
                          onClick={() => onOverrideAccess && onOverrideAccess(data.userId)}
                        >
                          Grant Access
                        </button>
                      )}
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDeleteClick(data.userId)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {consentData.length > 5 && (
            <div className={styles.showMoreContainer}>
              <button
                className={styles.showMoreButton}
                onClick={() => {
                  if (!isAnimating) {
                    setIsAnimating(true);
                    setShowAllConsentData(!showAllConsentData);

                    // Reset animation state after animation completes
                    setTimeout(() => {
                      setIsAnimating(false);
                    }, 500);
                  }
                }}
                disabled={isAnimating}
              >
                {showAllConsentData ? 'Show Less' : 'Show More'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className={styles.confirmationDialog}>
          <div className={styles.confirmationContent}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete consent data for this user?</p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              This will remove the user from consent_data.json
            </p>
            <div className={styles.confirmationButtons}>
              <button
                className={styles.confirmButton}
                onClick={handleDeleteConfirm}
              >
                OK
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
