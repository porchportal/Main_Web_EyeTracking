import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import ImageUploader from './ImageUploader';
import ShowPreview from './showPreview';
import styles from './TestingImage.module.css';

export default function TestingModel() {
  const router = useRouter();
  const [enhanceFace, setEnhanceFace] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleProcessImage = async () => {
    if (!selectedFile) {
      alert('Please select an image first');
      return;
    }

    console.log('handleProcessImage - enhanceFace:', enhanceFace);
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('show_head_pose', 'true');
      formData.append('show_bounding_box', 'true');
      formData.append('show_mask', 'false');
      formData.append('show_parameters', 'true');
      formData.append('enhance_face', enhanceFace.toString());

      const response = await fetch('/api/testAI_image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setAnalysisResult(result);
      setShowPreview(true);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Face Analysis App</title>
        <meta name="description" content="Face analysis with head pose detection" />
        <link rel="icon" href="/favicon.ico" />

      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Face Analysis
        </h1>
        
        <p className={styles.description}>
          Upload an image to analyze face landmarks and head pose detection
        </p>

        <div className={styles.uploaderContainer}>
          <ImageUploader 
            enhanceFace={enhanceFace} 
            onEnhanceFaceChange={setEnhanceFace}
            onFileSelect={setSelectedFile}
            onResult={(result) => {
              setAnalysisResult(result);
              setShowPreview(true);
            }}
          />
        </div>
      </main>
      
      <div className={styles.buttonContainer}>
        <button 
          className={`${styles.processButton} ${isProcessing ? styles.processing : ''}`}
          onClick={handleProcessImage}
          disabled={!selectedFile || isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Process Image'}
        </button>
        
        <button 
          className={styles.backButton}
          onClick={() => router.push('/')}
        >
          ← Back to Home
        </button>
        
        <div className={styles.enhanceToggle}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={enhanceFace}
              onChange={(e) => setEnhanceFace(e.target.checked)}
              className={styles.toggleInput}
            />
            <span className={styles.toggleSlider}></span>
            <span className={styles.toggleText}>Enhance Face</span>
          </label>
        </div>
      </div>

      <footer className={styles.footer}>
        <a 
          href="https://yourwebsite.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.footerLink}
        >
        </a>
      </footer>

      {/* Show Preview Modal */}
      {showPreview && analysisResult && (
        <ShowPreview
          result={analysisResult}
          enhanceFace={enhanceFace}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
