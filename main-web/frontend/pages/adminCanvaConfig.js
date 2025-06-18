import { useState, useRef } from 'react';
import styles from '../styles/Consent.module.css';

export default function AdminCanvaConfig({ onImageSave, onClose, userId }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => 
      file.type === 'image/jpeg' || 
      file.type === 'image/png' || 
      file.type === 'image/jpg'
    );

    if (validFiles.length !== files.length) {
      alert('Some files were skipped. Only JPG, JPEG, and PNG files are allowed.');
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
    const validFiles = files.filter(file => 
      file.type === 'image/jpeg' || 
      file.type === 'image/png' || 
      file.type === 'image/jpg'
    );

    if (validFiles.length !== files.length) {
      alert('Some files were skipped. Only JPG, JPEG, and PNG files are allowed.');
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

  const handleSave = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one image');
      return;
    }

    if (!userId) {
      alert('Please select a user first');
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

      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to upload images');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to upload images');
      }

      onImageSave(data.imagePaths);
      onClose();
    } catch (error) {
      console.error('Error uploading images:', error);
      alert(error.message || 'Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.canvaConfigModal}>
      <div className={styles.canvaConfigContent}>
        <h2>Image Upload Configuration</h2>
        
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
          {previewUrls.length > 0 ? (
            <div className={styles.previewGrid}>
              {previewUrls.map((preview, index) => (
                <div key={index} className={styles.previewItem}>
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
                  <span className={styles.fileName}>{preview.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.dropZoneText}>
              <p>Drag and drop images here or click to select</p>
              <p className={styles.supportedFormats}>Supported formats: JPG, JPEG, PNG</p>
            </div>
          )}
        </div>

        <div className={styles.canvaConfigActions}>
          <button 
            onClick={handleSave} 
            className={styles.saveButton}
            disabled={isUploading || selectedFiles.length === 0}
          >
            {isUploading ? 'Uploading...' : 'Save Images'}
          </button>
          <button 
            onClick={onClose} 
            className={styles.cancelButton}
            disabled={isUploading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 