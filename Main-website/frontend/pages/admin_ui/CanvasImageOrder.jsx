import React, { useState, useEffect } from 'react';
import styles from './style/CanvasImageOrder.module.css';

const CanvasImageOrder = ({ 
  isOpen, 
  onClose, 
  userId, 
  currentImages = {}, 
  onOrderSave 
}) => {
  const [imageOrder, setImageOrder] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Debug logging
  console.log('CanvasImageOrder props:', { isOpen, userId, currentImages });

  // Initialize image order when component opens or images change
  useEffect(() => {
    if (isOpen && currentImages) {
      // Convert currentImages object to array and sort by key (image_1, image_2, etc.)
      const imageArray = Object.entries(currentImages)
        .filter(([key, path]) => {
          // Filter out non-image entries
          return path && 
                 typeof path === 'string' && 
                 (path.startsWith('/canvas/') || 
                  path.startsWith('http') || 
                  path.includes('.jpg') || 
                  path.includes('.jpeg') || 
                  path.includes('.png') || 
                  path.includes('.gif') ||
                  path.includes('.webp'));
        })
        .sort(([a], [b]) => {
          // Sort by image_1, image_2, etc.
          const aNum = parseInt(a.replace('image_', ''));
          const bNum = parseInt(b.replace('image_', ''));
          return aNum - bNum;
        })
        .map(([key, path], index) => {
          // Check if there's a times value stored separately
          const timesKey = `${key}_times`;
          const times = currentImages[timesKey] || 1;
          
          return {
            id: key,
            path: path,
            originalIndex: index,
            displayName: key.replace('image_', 'Image '),
            times: times
          };
        });

      setImageOrder(imageArray);
    }
  }, [isOpen, currentImages]);

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    setDragOverIndex(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    // Only clear dragOverIndex if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle drop
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...imageOrder];
    const draggedItem = newOrder[draggedIndex];
    
    // Remove dragged item
    newOrder.splice(draggedIndex, 1);
    
    // Insert at new position (handle dropping at the end)
    const insertIndex = dropIndex >= newOrder.length ? newOrder.length : dropIndex;
    newOrder.splice(insertIndex, 0, draggedItem);
    
    setImageOrder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle save order
  const handleSaveOrder = async () => {
    if (imageOrder.length === 0) {
      alert('No images to reorder');
      return;
    }

    setIsSaving(true);
    
    try {
      // Create image_background_paths array in the specific format: "[times]-path"
      const imageBackgroundPaths = imageOrder.map((item) => {
        const times = item.times || 1;
        const path = item.path.startsWith('/canvas/') ? item.path.replace('/canvas/', '/') : item.path;
        return `[${times}]-${path}`;
      });

      // Also create the traditional order object for backward compatibility
      const newOrderObject = {};
      imageOrder.forEach((item, index) => {
        newOrderObject[`image_${index + 1}`] = {
          path: item.path,
          times: item.times || 1
        };
      });

      // Call the parent's save function with both formats
      if (onOrderSave) {
        await onOrderSave(newOrderObject, imageBackgroundPaths);
      }

      // Show success message
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification('Image order saved successfully!', 'success');
      } else {
        alert('Image order saved successfully!');
      }

      // Close the modal
      onClose();
    } catch (error) {
      console.error('Error saving image order:', error);
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification('Failed to save image order', 'error');
      } else {
        alert('Failed to save image order');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Canvas Image Priority Order</h2>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.instructions}>
            <p>Drag and drop images to reorder their priority. Images at the top have higher priority.</p>
            <p>Set the "Times" value to control how many times each image appears in the rotation (1-10).</p>
            <p><strong>User ID:</strong> {userId}</p>
            <p><strong>Total Images:</strong> {imageOrder.length}</p>
          </div>

          {imageOrder.length === 0 ? (
            <div className={styles.noImages}>
              <p>No canvas images found for this user.</p>
              <p>Please add canvas images first before reordering.</p>
            </div>
          ) : (
            <div 
              className={`${styles.imageList} ${draggedIndex !== null ? styles.dragActive : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                // If dragging over the end of the list, set dragOverIndex to the length
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const height = rect.height;
                
                // If dragging over the bottom 20% of the list, consider it as dropping at the end
                if (y > height * 0.8) {
                  setDragOverIndex(imageOrder.length);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDragOverIndex(null);
                }
              }}
            >
              {imageOrder.map((image, index) => {
                // Convert backend path to frontend accessible URL
                let imageUrl;
                if (image.path.startsWith('/canvas/')) {
                  const protocol = window.location.protocol;
                  const hostname = window.location.hostname;
                  const currentPort = window.location.port;
                  
                  if (currentPort && currentPort !== '80') {
                    imageUrl = `${protocol}//${hostname}:80${image.path}`;
                  } else {
                    imageUrl = image.path;
                  }
                } else {
                  imageUrl = image.path;
                }

                return (
                  <React.Fragment key={image.id}>
                    {/* Drop indicator line */}
                    {draggedIndex !== null && 
                     draggedIndex !== index && 
                     dragOverIndex === index && (
                      <div className={styles.dropIndicator}></div>
                    )}
                    
                    <div
                      className={`${styles.imageItem} ${
                        draggedIndex === index ? styles.dragging : ''
                      } ${
                        dragOverIndex === index && draggedIndex !== index ? styles.dragOver : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                    <div className={styles.dragHandle}>
                      <span className={styles.dragIcon}>⋮⋮</span>
                    </div>
                    
                    <div className={styles.imagePreview}>
                      <img 
                        src={imageUrl} 
                        alt={image.displayName}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className={styles.imageError}>
                        <span>Image not found</span>
                      </div>
                    </div>
                    
                    <div className={styles.imageInfo}>
                      <div className={styles.imageName}>{image.displayName}</div>
                      <div className={styles.imagePath}>
                        {image.path.startsWith('/canvas/') ? 
                          image.path.replace('/canvas/', '/') : 
                          image.path
                        }
                      </div>
                      <div className={styles.priorityBadge}>
                        Priority: {index + 1}
                      </div>
                      <div className={styles.timesInputContainer}>
                        <label className={styles.timesLabel}>Times:</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={image.times || 1}
                          onChange={(e) => {
                            const newTimes = Math.max(1, Math.min(1000, parseInt(e.target.value) || 1));
                            const newOrder = [...imageOrder];
                            newOrder[index] = { ...newOrder[index], times: newTimes };
                            setImageOrder(newOrder);
                          }}
                          className={styles.timesInput}
                        />
                      </div>
                    </div>
                    
                    <div className={styles.orderControls}>
                      <button
                        className={styles.moveButton}
                        onClick={() => {
                          if (index > 0) {
                            const newOrder = [...imageOrder];
                            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                            setImageOrder(newOrder);
                          }
                        }}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className={styles.moveButton}
                        onClick={() => {
                          if (index < imageOrder.length - 1) {
                            const newOrder = [...imageOrder];
                            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                            setImageOrder(newOrder);
                          }
                        }}
                        disabled={index === imageOrder.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>
                    </div>
                  </React.Fragment>
                );
              })}
              
              {/* Drop indicator at the end */}
              {draggedIndex !== null && 
               dragOverIndex === imageOrder.length && (
                <div className={styles.dropIndicator}></div>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            className={styles.cancelButton}
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSaveOrder}
            disabled={isSaving || imageOrder.length === 0}
          >
            {isSaving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CanvasImageOrder;
