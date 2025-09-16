import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from './style/AdminLogin.module.css';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Suppress-Errors': 'true'
        },
        body: JSON.stringify({ username, password }),
      });

      // Check if response is ok before trying to parse JSON
      if (response.ok) {
        try {
          const data = await response.json();
          // Successful login - server sets httpOnly cookie automatically
          // Use replace instead of push for faster navigation
          router.replace('/admin_ui/admin');
        } catch (parseError) {
          console.error('Error parsing successful response:', parseError);
          setError('Login successful but response parsing failed. Please try again.');
        }
      } else {
        // Handle error response
        try {
          const errorData = await response.json();
          setError(errorData.message || `Login failed (${response.status})`);
        } catch (parseError) {
          // If we can't parse the error response, show a generic message
          setError(`Login failed with status ${response.status}. Please check your credentials.`);
        }
        
        // Increment attempts and handle max attempts
        setAttempts(prev => {
          const newAttempts = prev + 1;
          if (newAttempts >= 3) {
            // After 3 failed attempts, redirect to home
            setTimeout(() => {
              router.push('/');
            }, 2000);
          }
          return newAttempts;
        });
      }
    } catch (err) {
      // Only log network errors, not authentication errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        console.error('Network error during login:', err);
        setError('Network error. Please check your connection and try again.');
      } else {
        console.error('Unexpected login error:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1>Admin Login</h1>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="admin-username">Username</label>
            <input
              type="text"
              id="admin-username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="admin-password">Password</label>
            <input
              type="password"
              id="admin-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.buttonContainer}>
            <button 
              type="button" 
              className={styles.backButton}
              onClick={() => router.push('/')}
              disabled={isLoading}
            >
              Back
            </button>
            <button 
              type="submit" 
              className={styles.loginButton}
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 