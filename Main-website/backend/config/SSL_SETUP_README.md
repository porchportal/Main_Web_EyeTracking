# SSL Certificate Setup for Development and Production

This comprehensive guide covers SSL certificate generation, HTTPS camera access setup, and security configuration for the eye tracking web application.

> **📋 For complete technical requirements and system specifications, see [Requirements.md](../../../Requirements.md)**  
> **🏠 For main application documentation, see [README.md](../../../README.md)**  
> **🔧 For system architecture and port configurations, see [Requirements.md](../../../Requirements.md#-system-architecture)**

## Overview

The application supports three external ports with different purposes:
- **Port 9080**: HTTP port (redirects to HTTPS)
- **Port 9443**: Main HTTPS application with restricted camera permissions
- **Port 9444**: Camera HTTPS access with full camera and microphone permissions

## 🎯 Dynamic Configuration Benefits

**No IP Configuration Required!** The nginx configuration is now fully dynamic:
- ✅ Works with **any server IP address**
- ✅ Works with **any hostname**
- ✅ Uses `server_name _;` to accept all requests
- ✅ Uses `$host` variable for dynamic redirects
- ✅ No hardcoded IPs in configuration files

## Security Configuration

### HTTP Port (9080)
- **Purpose**: HTTP to HTTPS redirect
- **Redirect**: `https://$host:9443` (dynamic based on request)
- **Health Check**: Available at `/health` without redirect

### Main Application (Port 9443)
- **CSP**: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ...`
- **Permissions-Policy**: `camera=(), microphone=()`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`

### Camera Access (Port 9444)
- **CSP**: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ...`
- **Permissions-Policy**: `camera=*, microphone=*`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`

## Development Environment (Self-Signed Certificates)

### 1. Generate Self-Signed Certificate

**Note**: With the dynamic nginx configuration, you only need a basic certificate. No need to specify your server IP!

Create the SSL directory and generate certificates:

```bash
# Create SSL directory
mkdir -p backend/config/ssl

# Simple method - One command to generate both key and certificate
cd backend/config/ssl
openssl req -x509 -newkey rsa:2048 \
    -keyout key.pem \
    -out cert.pem \
    -days 365 -nodes \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Or if you want to include your server IP (optional)
openssl req -x509 -newkey rsa:2048 \
    -keyout key.pem \
    -out cert.pem \
    -days 365 -nodes \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.100"
```

**Why this works for any IP**: The nginx `server_name _;` directive accepts all hostnames/IPs, so the certificate's CN or SAN doesn't need to match perfectly. Browsers will show a warning (expected for self-signed certificates), but the connection will work.

### 2. Set Proper Permissions

```bash
# Set secure permissions (run from project root)
chmod 600 backend/config/ssl/key.pem
chmod 644 backend/config/ssl/cert.pem
```

**Note**: No need for `sudo chown` - with the new non-root user configuration, Docker will handle permissions automatically.

### 3. Docker Compose Configuration

The SSL volume is already configured in `docker-compose.yml`:

```yaml
nginx_website:
  image: nginx:alpine
  container_name: backend_nginx
  ports:
    - "9080:9080"    # HTTP (redirects to HTTPS)
    - "9443:9443"    # HTTPS Main
    - "9444:9444"    # HTTPS Camera
  volumes:
    - ./backend/config/nginx.conf:/etc/nginx/nginx.conf
    - ./backend/config/ssl:/etc/nginx/ssl:ro
  networks:
    - ipuserver_internal_eye
    - nginx_proxy  # For external nginx integration
```

**Security Features**:
- Runs as root (required for port binding) but drops privileges for worker processes
- SSL files mounted read-only (`:ro`)
- Multi-network support for external nginx proxy integration

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
- **HTTPS on port 9443**: Uses `wss://hostname:9443/ws/video`
- **HTTPS on port 9444**: Uses `wss://hostname:9444/ws/video`
- **HTTP/Development**: Falls back to `NEXT_PUBLIC_WS_URL`

### Automatic Redirect
When accessing the main application via HTTPS (port 9443) and trying to use the camera:
1. Shows a security notice
2. Provides a button to redirect to port 9444
3. Automatically redirects to `https://hostname:9444`

## Setup Instructions

### 1. Generate SSL Certificates

**Simplified**: No server IP configuration needed!

```bash
# Create SSL directory
mkdir -p backend/config/ssl

# Generate self-signed certificate
cd backend/config/ssl
openssl req -x509 -newkey rsa:2048 \
    -keyout key.pem \
    -out cert.pem \
    -days 365 -nodes \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Set proper permissions
cd ../../../
chmod 600 backend/config/ssl/key.pem
chmod 644 backend/config/ssl/cert.pem
```

### 2. Setup External Network (Optional)

Only needed if you have an external nginx proxy:

```bash
# Create external network for nginx proxy integration
docker network create nginx_proxy
```

Skip this step if not using external nginx.

### 3. Start the Application

```bash
# Start with Docker Compose (using helper script)
cd Main-website
./docker-run.sh up --build -d

# Or manually
export UID=$(id -u)
export GID=$(id -g)
docker-compose up --build -d

# Check if all services are running
docker-compose ps
```

### 4. Access the Application

**Works with ANY IP or hostname!**

- **Main Application**: `https://YOUR_IP:9443` or `https://localhost:9443`
- **Camera Access**: `https://YOUR_IP:9444` or `https://localhost:9444`
- **HTTP Redirect**: `http://YOUR_IP:9080` → `https://YOUR_IP:9443`

Examples:
- `https://192.168.1.100:9443`
- `https://10.0.0.50:9443`
- `https://localhost:9443`

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
# Test SSL connection on main port
openssl s_client -connect localhost:9443 -servername localhost

# Test SSL connection on camera port
openssl s_client -connect localhost:9444 -servername localhost

# Test with curl (main application)
curl -I -k https://localhost:9443

# Test with curl (camera)
curl -I -k https://localhost:9444

# Test HTTP redirect
curl -I http://localhost:9080
```

**Note**: `-k` flag skips certificate verification (needed for self-signed certificates)

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
5. **Camera not working on port 9443**: Expected behavior - camera is restricted on main port
6. **WebSocket connection failed**: Check if backend services are running
7. **Permission denied for camera**: Ensure you're using HTTPS and try port 9444
8. **SSL certificate errors**: For development, accept self-signed certificates
9. **Files owned by root**: Use `./docker-run.sh` to start containers with correct user permissions

### Debug Commands

```bash
# Check nginx error logs (Docker)
docker logs backend_nginx

# Check certificate chain
openssl s_client -connect localhost:9443 -showcerts

# Test specific cipher
openssl s_client -connect localhost:9443 -cipher ECDHE-RSA-AES128-GCM-SHA256

# Check nginx configuration
docker exec backend_nginx nginx -t

# Check SSL certificates
openssl x509 -in backend/config/ssl/cert.pem -text -noout

# Check service logs
docker logs backend_nginx
docker logs backend_auth_service
docker logs backend_image_service
docker logs frontend_main

# Test SSL connections
openssl s_client -connect localhost:9443 -servername localhost
openssl s_client -connect localhost:9444 -servername localhost

# Check container user permissions
docker exec backend_auth_service id

# Run without log output
./docker-run.sh up --build > /dev/null
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
# 1. Development SSL Setup (from project root)
mkdir -p Main-website/backend/config/ssl
cd Main-website/backend/config/ssl
openssl req -x509 -newkey rsa:2048 \
    -keyout key.pem \
    -out cert.pem \
    -days 365 -nodes \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
cd ../../..

# 2. Set permissions
chmod 600 backend/config/ssl/key.pem
chmod 644 backend/config/ssl/cert.pem

# 3. Create external network (optional - only if using external nginx)
docker network create nginx_proxy

# 4. Start application
./docker-run.sh up --build -d

# 5. Test
curl -I -k https://localhost:9443
curl -I -k https://localhost:9444

# Production setup (requires domain name)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test Docker nginx configuration
docker exec backend_nginx nginx -t
```

---

**📚 Related Documentation:**
- [Main Application Documentation](../../../README.md)
- [Technical Requirements](../../../Requirements.md) - Complete technical specifications and system requirements
- [Environment Setup](../ENVIRONMENT_SETUP.md)