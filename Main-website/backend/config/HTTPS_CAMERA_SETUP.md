# HTTPS Camera Access Setup

This guide explains how to set up HTTPS camera access for the eye tracking application with proper security headers and camera permissions.

## Overview

The application now supports two HTTPS ports:
- **Port 443**: Main application with restricted camera permissions
- **Port 8443**: Camera access with full camera and microphone permissions

## Security Configuration

### Main Application (Port 443)
- **CSP**: `default-src 'self'; connect-src 'self';`
- **Permissions-Policy**: `camera=(), microphone=()`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **X-Content-Type-Options**: `nosniff`

### Camera Access (Port 8443)
- **CSP**: `default-src 'self'; connect-src 'self';`
- **Permissions-Policy**: `camera=*, microphone=*`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **X-Content-Type-Options**: `nosniff`

## Camera Component Features

### Automatic HTTPS Detection
The camera component automatically detects:
- Current protocol (HTTP/HTTPS)
- Current port
- Required security context

### Smart WebSocket Connection
- **HTTPS on port 443**: Uses `wss://hostname:443/ws/video`
- **HTTPS on port 8443**: Uses `wss://hostname:8443/ws/video`
- **HTTP/Development**: Falls back to `NEXT_PUBLIC_WS_URL`

### Automatic Redirect
When accessing the main application via HTTPS (port 443) and trying to use the camera:
1. Shows a security notice
2. Provides a button to redirect to port 8443
3. Automatically redirects to `https://hostname:8443`

## Setup Instructions

### 1. Generate SSL Certificates

```bash
# Create SSL directory
mkdir -p /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl

# Generate self-signed certificate with SAN
openssl req -x509 -newkey rsa:2048 -keyout /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/key.pem \
    -out /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/cert.pem \
    -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com" \
    -addext "subjectAltName=DNS:your-domain.com,DNS:www.your-domain.com,DNS:localhost,IP:127.0.0.1,IP:192.168.1.100"

# Set proper permissions
chmod 600 /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/key.pem
chmod 644 /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/cert.pem
```

### 2. Update Domain Configuration

Replace `your-domain.com` in `nginx.conf` with your actual domain:
```bash
# Replace in nginx.conf
sed -i 's/your-domain.com/your-actual-domain.com/g' /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/nginx.conf
```

### 3. Start the Application

```bash
# Start with Docker Compose
cd /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website
docker-compose up -d

# Check if all services are running
docker-compose ps
```

### 4. Access the Application

- **Main Application**: `https://your-domain.com` (port 443)
- **Camera Access**: `https://your-domain.com:8443` (port 8443)
- **HTTP Redirect**: `http://your-domain.com` → `https://your-domain.com`

## Testing Camera Access

### 1. Test Main Application
```bash
# Test HTTPS redirect
curl -I http://your-domain.com
# Should return 301 redirect to HTTPS

# Test main application
curl -I https://your-domain.com
# Should return 200 OK
```

### 2. Test Camera Port
```bash
# Test camera port
curl -I https://your-domain.com:8443
# Should return 200 OK with camera permissions
```

### 3. Test WebSocket Connection
```bash
# Test WebSocket on main port
wscat -c wss://your-domain.com/ws/video

# Test WebSocket on camera port
wscat -c wss://your-domain.com:8443/ws/video
```

## Browser Testing

### Chrome/Edge
1. Navigate to `https://your-domain.com`
2. Try to access camera - should show redirect notice
3. Click "Access Camera Port" button
4. Camera should work on `https://your-domain.com:8443`

### Firefox
1. Navigate to `https://your-domain.com:8443` directly
2. Allow camera permissions when prompted
3. Camera should work immediately

### Safari
1. Navigate to `https://your-domain.com:8443` directly
2. Allow camera permissions when prompted
3. Camera should work (Safari requires HTTPS for camera access)

## Troubleshooting

### Common Issues

1. **Camera not working on port 443**
   - Expected behavior - camera is restricted on main port
   - Use port 8443 for camera access

2. **WebSocket connection failed**
   - Check if backend services are running
   - Verify SSL certificates are valid
   - Check nginx logs: `docker logs backend_nginx`

3. **Permission denied for camera**
   - Ensure you're using HTTPS
   - Check browser permissions
   - Try accessing port 8443 directly

4. **SSL certificate errors**
   - For development, accept self-signed certificates
   - For production, use Let's Encrypt certificates

### Debug Commands

```bash
# Check nginx configuration
docker exec backend_nginx nginx -t

# Check SSL certificates
openssl x509 -in /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/cert.pem -text -noout

# Check service logs
docker logs backend_nginx
docker logs backend_auth_service
docker logs frontend_main

# Test SSL connection
openssl s_client -connect your-domain.com:443 -servername your-domain.com
openssl s_client -connect your-domain.com:8443 -servername your-domain.com
```

## Security Benefits

1. **Strict CSP**: Prevents XSS attacks by restricting resource loading
2. **Permissions Policy**: Controls camera/microphone access per port
3. **HTTPS Only**: Ensures encrypted communication
4. **Port Separation**: Isolates camera access for better security
5. **Automatic Redirects**: Guides users to secure camera access

## Production Considerations

1. **Use Let's Encrypt**: Replace self-signed certificates
2. **Enable HSTS**: Uncomment HSTS header in nginx.conf
3. **Monitor Logs**: Set up log monitoring for security events
4. **Regular Updates**: Keep nginx and certificates updated
5. **Firewall Rules**: Restrict access to necessary ports only
