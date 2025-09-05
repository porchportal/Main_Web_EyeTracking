import { useState, useRef, useEffect } from 'react';
import styles from './style/adminCanvasImage.module.css';

export default function AdminCanvaConfig({ onImageSave, onClose, userId, existingImages = {} }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [existingPreviews, setExistingPreviews] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const fileInputRef = useRef(null);

  // Function to get base image name without numeric suffixes
  const getBaseImageName = (filename) => {
    if (!filename) return '';
    const nameWithoutExt = filename.split('.').slice(0, -1).join('.');
    // Remove numeric suffixes like _1, _2, _3, etc.
    return nameWithoutExt.replace(/_\d+$/, '');
  };

  // Function to check if a file is a duplicate of existing images
  const isDuplicateBaseImage = (filename) => {
    const baseName = getBaseImageName(filename);
    return existingPreviews.some(preview => {
      const existingBaseName = getBaseImageName(preview.name);
      return existingBaseName === baseName;
    });
  };

  // Fetch existing canvas images from backend when component mounts
  useEffect(() => {
    const fetchExistingImages = async () => {
      if (!userId) {
        setLoadingExisting(false);
        return;
      }

      try {
        setLoadingExisting(true);
        
        // Fetch images from the backend canvas service
        const response = await fetch(`/api/admin/view-canvas-image?userId=${userId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch canvas images: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.images) {
          // Convert backend paths to preview format
          const previews = data.images
            .filter(path => {
              // Filter out non-image entries (like user IDs)
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
                          .map((path, index) => {
                // Convert backend path to frontend accessible URL
                // Use the correct URL structure for canvas images
                let imageUrl;
                if (path.startsWith('/canvas/')) {
                  // For canvas images, construct the correct URL using backend API
                  const filename = path.replace('/canvas/', '');
                  // Use the backend API endpoint to serve canvas images
                  imageUrl = `/api/admin/canvas-image/${filename}`;
                } else if (path.startsWith('http')) {
                  imageUrl = path;
                } else {
                  // Fallback for other paths
                  imageUrl = path;
                }
              
              const filename = path.split('/').pop() || `image_${index + 1}`;
              const baseName = getBaseImageName(filename);
              
              return {
                url: imageUrl,
                name: filename,
                baseName: baseName,
                isExisting: true,
                key: `existing_${index}`,
                originalPath: path
              };
            });
          
          setExistingPreviews(previews);
        } else {
          setExistingPreviews([]);
        }
      } catch (error) {
        console.error('Error fetching existing canvas images:', error);
        setExistingPreviews([]);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExistingImages();
  }, [userId]);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const isValidType = file.type === 'image/jpeg' || 
                         file.type === 'image/png' || 
                         file.type === 'image/jpg';
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit
      const isDuplicate = isDuplicateBaseImage(file.name);
      
      if (!isValidType) {
        console.warn(`Skipped file ${file.name}: Invalid file type`);
      }
      if (!isValidSize) {
        console.warn(`Skipped file ${file.name}: File too large (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      }
      if (isDuplicate) {
        console.warn(`Skipped file ${file.name}: Base image already exists`);
      }
      
      return isValidType && isValidSize && !isDuplicate;
    });

    const skippedCount = files.length - validFiles.length;
    if (skippedCount > 0) {
      let skipReason = '';
      if (files.some(f => !['image/jpeg', 'image/png', 'image/jpg'].includes(f.type))) {
        skipReason += 'Invalid file type. ';
      }
      if (files.some(f => f.size > 50 * 1024 * 1024)) {
        skipReason += 'File too large. ';
      }
      if (files.some(f => isDuplicateBaseImage(f.name))) {
        skipReason += 'Base image duplicates detected. ';
      }
      
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(`${skippedCount} file(s) were skipped. ${skipReason}Only JPG, JPEG, and PNG files under 50MB without duplicate base names are allowed.`, 'error');
      } else {
        alert(`${skippedCount} file(s) were skipped. ${skipReason}Only JPG, JPEG, and PNG files under 50MB without duplicate base names are allowed.`);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      
      // Create preview URLs for new files
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrls(prev => [...prev, { url: e.target.result, name: file.name }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const isValidType = file.type === 'image/jpeg' || 
                         file.type === 'image/png' || 
                         file.type === 'image/jpg';
      const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit
      const isDuplicate = isDuplicateBaseImage(file.name);
      
      if (!isValidType) {
        console.warn(`Skipped file ${file.name}: Invalid file type`);
      }
      if (!isValidSize) {
        console.warn(`Skipped file ${file.name}: File too large (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      }
      if (isDuplicate) {
        console.warn(`Skipped file ${file.name}: Base image already exists`);
      }
      
      return isValidType && isValidSize && !isDuplicate;
    });

    const skippedCount = files.length - validFiles.length;
    if (skippedCount > 0) {
      let skipReason = '';
      if (files.some(f => !['image/jpeg', 'image/png', 'image/jpg'].includes(f.type))) {
        skipReason += 'Invalid file type. ';
      }
      if (files.some(f => f.size > 50 * 1024 * 1024)) {
        skipReason += 'File too large. ';
      }
      if (files.some(f => isDuplicateBaseImage(f.name))) {
        skipReason += 'Base image duplicates detected. ';
      }
      
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(`${skippedCount} file(s) were skipped. ${skipReason}Only JPG, JPEG, and PNG files under 50MB without duplicate base names are allowed.`, 'error');
      } else {
        alert(`${skippedCount} file(s) were skipped. ${skipReason}Only JPG, JPEG, and PNG files under 50MB without duplicate base names are allowed.`);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      
      // Create preview URLs for new files
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrls(prev => [...prev, { url: e.target.result, name: file.name }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
  };

  const handleSave = async () => {
    if (selectedFiles.length === 0) {
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification('Please select at least one image', 'error');
      } else {
        alert('Please select at least one image');
      }
      return;
    }

    if (!userId) {
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification('Please select a user first', 'error');
      } else {
        alert('Please select a user first');
      }
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append(`image_${index}`, file);
      });
      formData.append('userId', userId);
      formData.append('fileCount', selectedFiles.length);

      console.log('Uploading files for user:', userId);
      console.log('File count:', selectedFiles.length);

      const response = await fetch('/api/admin/canvas-upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || `HTTP ${response.status}: Failed to upload images`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to upload images');
      }

      console.log('Upload successful, image paths:', data.imagePaths);
      console.log('Uploaded images data:', data.uploaded_images);
      console.log('Backend data:', data.backendData);
      console.log('Formatted data:', data.data);
      
      // Call the callback with the image paths
      if (onImageSave) {
        onImageSave(data.data);
      }
      
      // Show success message and close modal
      const uploadedCount = data.uploaded_images?.length || data.backendData?.uploaded_images?.length || 0;
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(`Images uploaded successfully to canvas service! ${uploadedCount} images processed.`, 'success');
      } else {
        alert(`Images uploaded successfully to canvas service! ${uploadedCount} images processed.`);
      }
      onClose();
    } catch (error) {
      console.error('Error uploading images:', error);
      console.error('Error stack:', error.stack);
      if (typeof window !== 'undefined' && window.showNotification) {
        window.showNotification(`Failed to upload images: ${error.message}`, 'error');
      } else {
        alert(`Failed to upload images: ${error.message}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.canvaConfigModal}>
      <div className={styles.canvaConfigContent}>
        <h2>
          {loadingExisting ? 'Loading Canvas Images...' : 
           existingPreviews.length > 0 ? 'Add More Images' : 'Image Upload Configuration'}
          {!loadingExisting && existingPreviews.length > 0 && (
            <span className={styles.existingCount}>
              ({existingPreviews.length} existing)
            </span>
          )}
        </h2>
        
        <div 
          className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={handleFileSelect}
            multiple
            style={{ display: 'none' }}
          />
          <div className={styles.dropZoneText}>
            <p>Drag and drop images here or click to select</p>
            <p className={styles.supportedFormats}>Supported formats: JPG, JPEG, PNG</p>
          </div>
        </div>

        {/* Show images in a separate box below */}
        {(previewUrls.length > 0 || existingPreviews.length > 0 || loadingExisting) && (
          <div className={styles.imagesContainer}>
            <h3 className={styles.imagesContainerTitle}>
              {loadingExisting ? 'Loading Existing Images...' :
               existingPreviews.length > 0 ? 'All Images' : 'Selected Images'}
              {!loadingExisting && existingPreviews.length > 0 && (
                <span className={styles.imageCount}>
                  ({existingPreviews.length + previewUrls.length} total)
                </span>
              )}
            </h3>
            <div className={styles.imagesPreviewGrid}>
              {/* Show loading state for existing images */}
              {loadingExisting && (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner}></div>
                  <p>Loading existing canvas images...</p>
                </div>
              )}
              
              {/* Show existing images first */}
              {!loadingExisting && existingPreviews.map((preview, index) => {
                // Check if this is a base image or variation
                const isBaseImage = !preview.name.match(/_\d+\./);
                const baseName = preview.baseName;
                
                return (
                  <div key={`existing-${preview.key}`} className={`${styles.previewItem} ${styles.existingImage}`}>
                    <img 
                      src={preview.url} 
                      alt={`Existing ${preview.name}`} 
                      className={styles.imagePreview}
                      onError={(e) => {
                        console.error(`Failed to load image: ${preview.url}`);
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <p className={styles.imageError} style={{ display: 'none', color: '#dc3545', fontSize: '0.8rem' }}>
                      Failed to load image
                    </p>
                    <div className={styles.existingBadge}>Existing</div>
                    {isBaseImage ? (
                      <div className={styles.baseImageBadge} style={{ 
                        background: '#28a745', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '0.7rem', 
                        marginTop: '4px' 
                      }}>
                        Base Image
                      </div>
                    ) : (
                      <div className={styles.variationBadge} style={{ 
                        background: '#ffc107', 
                        color: 'black', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '0.7rem', 
                        marginTop: '4px' 
                      }}>
                        Variation
                      </div>
                    )}
                    <span className={styles.fileName}>{preview.name}</span>
                  </div>
                );
              })}
              
              {/* Show new images */}
              {previewUrls.map((preview, index) => (
                <div key={`new-${index}`} className={`${styles.previewItem} ${styles.newImage}`}>
                  <img src={preview.url} alt={`Preview ${index + 1}`} className={styles.imagePreview} />
                  <button 
                    className={styles.removeButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    ×
                  </button>
                  <div className={styles.newBadge}>New</div>
                  <span className={styles.fileName}>{preview.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={styles.canvaConfigActions}>
          <div className={styles.buttonRow}>
            <button 
              onClick={handleSave} 
              className={styles.saveButton}
              disabled={isUploading || selectedFiles.length === 0}
            >
              {isUploading ? 'Uploading...' : 
               !loadingExisting && existingPreviews.length > 0 ? 'Add More Images' : 'Save Images'}
            </button>
            <button 
              onClick={onClose} 
              className={styles.cancelButton}
              disabled={isUploading}
            >
              Cancel
            </button>
          </div>
          {selectedFiles.length > 0 && (
            <div className={styles.clearButtonContainer}>
              <button 
                onClick={clearAllFiles} 
                className={styles.clearButton}
                disabled={isUploading}
              >
                Clear New
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 