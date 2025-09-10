# SSL Certificate Setup for Development and Production

This guide covers SSL certificate generation and management for the eye tracking web application.

## Development Environment (Self-Signed Certificates)

### 1. Generate Self-Signed Certificate

Create the SSL directory and generate certificates:

```bash
# Create SSL directory
mkdir -p /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl

# Generate private key
openssl genrsa -out /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/key.pem 2048

# Generate certificate with SAN (Subject Alternative Name)
openssl req -new -x509 -key /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/key.pem \
    -out /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/cert.pem \
    -days 365 \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com" \
    -addext "subjectAltName=DNS:your-domain.com,DNS:www.your-domain.com,DNS:localhost,IP:127.0.0.1,IP:192.168.1.100"
```

### 2. Set Proper Permissions

```bash
# Set secure permissions
chmod 600 /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/key.pem
chmod 644 /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/cert.pem

# Ensure nginx can read the files
sudo chown root:root /Users/porchportal2/Desktop/🔥everything/Main_web_eyetracking/Main-website/backend/config/ssl/*
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

# Generate certificate
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
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Test with curl
curl -I https://your-domain.com

# Test HTTP redirect
curl -I http://your-domain.com
```

### 3. Check Certificate Details

```bash
# View certificate information
openssl x509 -in /path/to/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in /path/to/cert.pem -noout -dates
```

### 4. Test Rate Limiting

```bash
# Test general rate limiting
for i in {1..15}; do curl -I https://your-domain.com; done

# Test API rate limiting
for i in {1..10}; do curl -I https://your-domain.com/api/health; done

# Test login rate limiting
for i in {1..5}; do curl -I https://your-domain.com/auth/login; done
```

## Security Considerations

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

### Debug Commands

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check certificate chain
openssl s_client -connect your-domain.com:443 -showcerts

# Test specific cipher
openssl s_client -connect your-domain.com:443 -cipher ECDHE-RSA-AES128-GCM-SHA256
```

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

# Production setup
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test configuration
sudo nginx -t && sudo systemctl reload nginx
```
