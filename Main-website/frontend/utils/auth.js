// utils/auth.js - Authentication utilities for admin API routes
import { parse } from 'cookie';

export async function verifyAdminToken(req) {
  try {
    // Parse cookies from the request
    const cookies = parse(req.headers.cookie || '');
    const adminSession = cookies.admin_session;

    if (!adminSession) {
      return { authenticated: false, message: 'No session found' };
    }

    // Verify session with backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${backendUrl}/api/admin/verify-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: adminSession }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { authenticated: false, message: 'Invalid session' };
    }

    return { authenticated: true, message: 'Authenticated' };
  } catch (error) {
    console.error('Error verifying admin token:', error);
    if (error.name === 'AbortError') {
      return { authenticated: false, message: 'Request timeout' };
    }
    return { authenticated: false, message: 'Internal server error' };
  }
}
