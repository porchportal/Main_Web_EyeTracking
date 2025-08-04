import { useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/AdminLogin.module.css';

// Use the frontend environment variables - ensure it points to auth service
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8108';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      console.log('Attempting login with:', { username, password });
      console.log('Using API_BASE_URL:', API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/api/admin/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('Login response:', { status: response.status, data });

      if (response.ok) {
        // Successful login - server sets httpOnly cookie automatically
        router.push('/admin');
      } else {
        // Failed login
        setAttempts(prev => prev + 1);
        setError(data.message || 'Invalid credentials');
        
        if (attempts >= 2) {
          // After 3 failed attempts, redirect to home
          setTimeout(() => {
            router.push('/');
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1>Admin Login</h1>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.loginButton}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
} 