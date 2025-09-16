# SSL Certificate Setup for Development and Production

This comprehensive guide covers SSL certificate generation, HTTPS camera access setup, and security configuration for the eye tracking web application.

> **📋 For complete technical requirements and system specifications, see [Requirements.md](../../../Requirements.md)**  
> **🏠 For main application documentation, see [README.md](../../../README.md)**  
> **🔧 For system architecture and port configurations, see [Requirements.md](../../../Requirements.md#-system-architecture)**

## Overview

The application supports two HTTPS ports with different security configurations:
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

## Development Environment (Self-Signed Certificates)

### 1. Generate Self-Signed Certificate

Create the SSL directory and generate certificates:

```bash
# Create SSL directory
mkdir -p backend/config/ssl

# Generate private key
openssl genrsa -out backend/config/ssl/key.pem 2048

# Generate certificate with SAN (Subject Alternative Name)
openssl req -new -x509 -key backend/config/ssl/key.pem \
    -out backend/config/ssl/cert.pem \
    -days 365 \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-server-ip" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.100"
```

### 2. Set Proper Permissions

```bash
# Set secure permissions
chmod 600 backend/config/ssl/key.pem
chmod 644 backend/config/ssl/cert.pem

# Ensure nginx can read the files
sudo chown root:root backend/config/ssl/*
```

### 3. Update Docker Compose

Add SSL volume mount to your `docker-compose.yml`:

```yaml
nginx:
  image: nginx:alpine
  container_name: backend_nginx
  ports:
    - "80:80"
    - "443:443"
    - "8443:8443"
  volumes:
    - ./backend/config/nginx.conf:/etc/nginx/nginx.conf
    - ./backend/config/ssl:/etc/nginx/ssl:ro
  depends_on:
    - auth_service
    - image_service
    - frontend
```

## Production Environment (Let's Encrypt)

### Option 1: Webroot Method (Recommended)

#### 1. Install Certbot

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# macOS
brew install certbot

# CentOS/RHEL
sudo yum install certbot
```

#### 2. Generate Certificate

```bash
# Stop nginx temporarily
sudo systemctl stop nginx

# Generate certificate (Note: Let's Encrypt requires a domain name, not IP)
sudo certbot certonly --webroot \
    -w /var/www/html \
    -d your-domain.com \
    -d www.your-domain.com

# Or for multiple domains
sudo certbot certonly --webroot \
    -w /var/www/html \
    -d your-domain.com \
    -d www.your-domain.com \
    -d api.your-domain.com
```

#### 3. Update Nginx Configuration

Update the SSL certificate paths in `nginx.conf`:

```nginx
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

#### 4. Set Up Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for automatic renewal
sudo crontab -e

# Add this line (runs twice daily)
0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx
```

### Option 2: Nginx Plugin Method

#### 1. Install Nginx Plugin

```bash
# Ubuntu/Debian
sudo apt install python3-certbot-nginx

# CentOS/RHEL
sudo yum install python3-certbot-nginx
```

#### 2. Generate and Install Certificate

```bash
# Generate and automatically configure nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# For non-interactive mode
sudo certbot --nginx -d your-domain.com -d www.your-domain.com --non-interactive --agree-tos --email your-email@domain.com
```

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
mkdir -p backend/config/ssl

# Generate self-signed certificate with SAN
openssl req -x509 -newkey rsa:2048 -keyout backend/config/ssl/key.pem \
    -out backend/config/ssl/cert.pem \
    -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-server-ip" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.100"

# Set proper permissions
chmod 600 backend/config/ssl/key.pem
chmod 644 backend/config/ssl/cert.pem
```

### 2. Update Server Configuration

Replace `your-server-ip` in `nginx.conf` with your actual server IP:
```bash
# Replace in nginx.conf
sed -i 's/your-server-ip/your-actual-server-ip/g' backend/config/nginx.conf
```

### 3. Start the Application

```bash
# Start with Docker Compose
cd Main-website
docker-compose up -d

# Check if all services are running
docker-compose ps
```

### 4. Access the Application

- **Main Application**: `https://your-server-ip` (port 443)
- **Camera Access**: `https://your-server-ip:8443` (port 8443)
- **HTTP Redirect**: `http://your-server-ip` → `https://your-server-ip`

## Verification and Testing

### 1. Test Nginx Configuration

```bash
# Test nginx configuration
sudo nginx -t

# If using Docker
docker exec backend_nginx nginx -t
```

### 2. Test SSL Certificate

```bash
# Test SSL connection
openssl s_client -connect your-server-ip:443 -servername your-server-ip

# Test with curl
curl -I https://your-server-ip

# Test HTTP redirect
curl -I http://your-server-ip
```

### 3. Check Certificate Details

```bash
# View certificate information
openssl x509 -in backend/config/ssl/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in backend/config/ssl/cert.pem -noout -dates
```



## Security Considerations

> **📋 For detailed security requirements and specifications, see [Requirements.md](../../../Requirements.md#-security-requirements)**

### 1. Certificate Security

- Keep private keys secure (600 permissions)
- Use strong key sizes (2048+ bits)
- Regularly renew certificates
- Monitor certificate expiration

### 2. Nginx Security

- Keep nginx updated
- Use strong SSL ciphers
- Enable security headers
- Implement rate limiting
- Regular security audits

### 3. Development vs Production

- **Development**: Use self-signed certificates with SAN
- **Production**: Use Let's Encrypt or commercial certificates
- **Staging**: Use Let's Encrypt with staging environment

## Troubleshooting

### Common Issues

1. **Certificate not found**: Check file paths and permissions
2. **SSL handshake failed**: Verify certificate and key match
3. **Rate limiting too strict**: Adjust limits in nginx.conf
4. **CORS errors**: Check CORS headers configuration
5. **Camera not working on port 443**: Expected behavior - camera is restricted on main port
6. **WebSocket connection failed**: Check if backend services are running
7. **Permission denied for camera**: Ensure you're using HTTPS and try port 8443
8. **SSL certificate errors**: For development, accept self-signed certificates

### Debug Commands

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check certificate chain
openssl s_client -connect your-server-ip:443 -showcerts

# Test specific cipher
openssl s_client -connect your-server-ip:443 -cipher ECDHE-RSA-AES128-GCM-SHA256

# Check nginx configuration
docker exec backend_nginx nginx -t

# Check SSL certificates
openssl x509 -in backend/config/ssl/cert.pem -text -noout

# Check service logs
docker logs backend_nginx
docker logs backend_auth_service
docker logs frontend_main

# Test SSL connection
openssl s_client -connect your-server-ip:443 -servername your-server-ip
openssl s_client -connect your-server-ip:8443 -servername your-server-ip

# Run without log
docker-compose up --build > /dev/null
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

## File Structure

```
backend/config/
├── nginx.conf
├── ssl/
│   ├── cert.pem          # Self-signed or Let's Encrypt certificate
│   └── key.pem           # Private key
└── SSL_SETUP_README.md   # This file
```

## Quick Start Commands

```bash
# Development setup
mkdir -p backend/config/ssl
openssl req -x509 -newkey rsa:2048 -keyout backend/config/ssl/key.pem -out backend/config/ssl/cert.pem -days 365 -nodes -subj "/CN=localhost"

# Production setup (requires domain name)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test configuration
sudo nginx -t && sudo systemctl reload nginx
```

---

**📚 Related Documentation:**
- [Main Application Documentation](../../../README.md)
- [Technical Requirements](../../../Requirements.md) - Complete technical specifications and system requirements
- [Environment Setup](../ENVIRONMENT_SETUP.md)