# Technical Requirements & Configuration

This document contains detailed technical requirements, configuration specifications, and system architecture details for the Eye Tracking Web Application.

## 🏗️ System Architecture

### Service Ports Configuration

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| **Frontend** | 3010 | HTTP | Next.js development server |
| **Auth Service** | 8108 | HTTP | User authentication & data management |
| **Image Service** | 8010 | HTTP | Image processing & AI inference |
| **Video Service** | 8011 | HTTP | Real-time video processing (unavailable) |
| **Nginx HTTP** | 80 | HTTP | HTTP to HTTPS redirect |
| **Nginx HTTPS** | 443 | HTTPS | Main application (restricted camera) |
| **Nginx Camera** | 8443 | HTTPS | Camera access (full permissions) |

### Microservices Architecture

#### 1. Auth Service (Port 8108)
- **Purpose**: User authentication, data management, consent handling
- **Database**: MongoDB
- **Key Features**:
  - User registration and authentication
  - Consent data management
  - User preferences storage
  - Data centralization
  - Canvas configuration management

#### 2. Image Service (Port 8010)
- **Purpose**: Image processing and AI model inference
- **Key Features**:
  - Face detection and landmark extraction
  - Head pose estimation
  - Image enhancement using Real-ESRGAN
  - Batch processing capabilities

#### 3. Video Service (Port 8011) 🚧
- **Purpose**: Real-time video processing and analysis
- **Key Features**:
  - Real-time video stream processing
  - Video-based eye tracking analysis
  - Continuous frame processing
  - Video enhancement capabilities
- **Status**: 🚧 Currently unavailable (under development)

#### 4. Nginx Reverse Proxy (Ports 80, 443, 8443)
- **Purpose**: Load balancing, SSL termination, security headers
- **Features**:
  - HTTPS redirection
  - Rate limiting
  - CORS handling
  - Security headers (CSP, HSTS, etc.)
  - Camera access control via port separation

## 🤖 AI Model Requirements

### Model Weights and Sizes

| Model | File | Size | Purpose |
|-------|------|------|---------|
| **Face Detection** | `detection_Resnet50_Final.pth` | 104MB | Face detection and bounding box |
| **Face Parsing** | `parsing_parsenet.pth` | 81MB | Facial landmark detection |
| **Real-ESRGAN v3** | `realesr-general-x4v3.pth` | 4.7MB | Image super-resolution |
| **Real-ESRGAN WDN** | `realesr-general-wdn-x4v3.pth` | 4.7MB | Image super-resolution (WDN variant) |
| **Real-ESRGAN x4+** | `RealESRGAN_x4plus.pth` | 64MB | High-quality image enhancement |
| **Real-ESRNet x4+** | `RealESRNet_x4plus.pth` | 64MB | Image restoration |

### AI Model Directory Structure

```
Main_AI/
├── Main_model/                     # Core AI models
│   ├── face_landmarker.task       # MediaPipe face landmark model
│   ├── facetrack_outCV.py         # Face tracking implementation
│   ├── headpose_outCV.py          # Head pose estimation
│   ├── showframeVisualization.py  # Visualization utilities
│   ├── UpResolution.py            # Image enhancement wrapper
│   ├── video_interface.py         # Video processing interface
│   ├── weights/                   # Model weights
│   │   ├── detection_Resnet50_Final.pth
│   │   └── parsing_parsenet.pth
│   └── Real-ESRGAN/               # Real-ESRGAN implementation
│       ├── weights/               # ESRGAN model weights
│       ├── realesrgan/            # Core implementation
│       ├── inference_realesrgan.py
│       └── requirements.txt
└── weights/                       # Shared model weights
    ├── realesr-general-wdn-x4v3.pth
    └── realesr-general-x4v3.pth
```

### AI Pipeline

1. **Face Detection**: ResNet50-based face detection
2. **Landmark Extraction**: MediaPipe facial landmarks
3. **Head Pose Estimation**: 6DOF head pose calculation
4. **Image Enhancement**: Real-ESRGAN super-resolution
5. **Data Export**: CSV parameter export for analysis

## 🔐 SSL Configuration

> **Reference**: This section uses [OpenSSL](https://github.com/openssl/openssl) - a robust, commercial-grade, full-featured Open Source Toolkit for the TLS (formerly SSL), DTLS and QUIC protocols.

### SSL Setup Process

#### 1. Development Environment (Self-Signed)

```bash
# Create SSL directory
mkdir -p backend/config/ssl

# Generate self-signed certificate with SAN
openssl req -x509 -newkey rsa:2048 \
    -keyout backend/config/ssl/key.pem \
    -out backend/config/ssl/cert.pem \
    -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.100"

# Set proper permissions
chmod 600 backend/config/ssl/key.pem
chmod 644 backend/config/ssl/cert.pem
```

#### 2. Production Environment (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --webroot \
    -w /var/www/html \
    -d your-domain.com \
    -d www.your-domain.com

# Update nginx.conf with new paths
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

### SSL Certificate Generation Explained

The OpenSSL command creates a self-signed SSL certificate with the following elements:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `req -x509` | Generate a self-signed certificate (X.509 format) | Creates a certificate without a Certificate Authority |
| `-newkey rsa:2048` | Generate a new RSA private key with 2048-bit encryption | Provides strong security for the private key |
| `-keyout` | Specify the output file for the private key | `key.pem` - contains the private key (keep secure) |
| `-out` | Specify the output file for the certificate | `cert.pem` - contains the public certificate |
| `-days 365` | Certificate validity period | Valid for 1 year (365 days) |
| `-nodes` | No DES encryption for the private key | Private key is not password-protected |
| `-subj "/CN=YOUR_SERVER_IP"` | Subject field with Common Name | Sets the primary domain/IP for the certificate |
| `-addext "subjectAltName=..."` | Subject Alternative Names (SAN) | Allows multiple domains/IPs in one certificate |

**Subject Alternative Names (SAN) Breakdown:**
- `DNS:localhost` - Allows access via `https://localhost`
- `IP:127.0.0.1` - Allows access via `https://127.0.0.1` (localhost IP)
- `IP:YOUR_SERVER_IP` - Allows access via `https://YOUR_SERVER_IP` (your server's IP)

**Security Notes:**
- The private key (`key.pem`) should be kept secure and never shared
- The certificate (`cert.pem`) can be distributed to clients
- For production, consider using Let's Encrypt or a commercial CA
- Self-signed certificates will show security warnings in browsers (expected for development)

### Security Configuration

#### Content Security Policy (CSP)
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';" always;
```

#### Port Configuration
- **Port 80**: HTTP (redirects to HTTPS)
- **Port 443**: Main application (restricted camera access)
- **Port 8443**: Camera access (full camera permissions)

## 📁 Storage System Requirements

### Directory Structure

```
resource_security/
├── canvas/                          # Canvas background images
│   ├── config.json                 # Canvas configuration
│   └── *.jpg, *.png               # Background images
├── consent_data.json               # User consent records
├── data_centralization/            # Centralized user data
│   ├── data_centralization_data.json
│   └── [user-id].json             # Individual user data
├── public/                         # Public file storage
│   ├── captures/                   # User capture sessions
│   │   └── [session-id]/          # Individual session data
│   │       ├── screen_*.jpg       # Screen captures
│   │       ├── webcam_*.jpg       # Webcam captures
│   │       ├── parameter_*.csv    # Eye tracking parameters
│   │       └── metadata.json      # Session metadata
│   ├── enhance/                    # Enhanced images
│   └── complete/                   # Processed complete datasets
└── user_preferences/               # User-specific settings
    ├── user_preferences_data.json
    └── [user-id].json             # Individual user preferences
```

### Data Flow

1. **User Registration**: Creates user ID and initial preferences
2. **Data Collection**: Stores captures in `public/captures/[session-id]/`
3. **Processing**: Images moved to `enhance/` for AI processing
4. **Completion**: Final datasets stored in `complete/`
5. **Centralization**: Data aggregated in `data_centralization/`

## 🔧 Configuration Files

### Docker Compose (`Main-website/docker-compose.yml`)
- Service definitions and networking
- Volume mounts for persistent data
- Health checks and dependencies
- Port mappings and environment variables

### Nginx Configuration (`Main-website/backend/config/nginx.conf`)
- Reverse proxy setup
- SSL termination
- Rate limiting rules
- Security headers
- API routing

### MongoDB Configuration (`Main-website/backend/config/mongod.conf`)
- Database settings
- Security configurations
- Performance tuning

## 📊 Data Management Requirements

### User Data Flow
1. **Registration**: User creates account with consent
2. **Session Creation**: Unique session ID generated
3. **Data Capture**: Screen/webcam captures stored
4. **AI Processing**: Images enhanced and analyzed
5. **Export**: Data available for download

### Data Formats
- **Images**: JPG format for captures
- **Parameters**: CSV format for eye tracking data
- **Metadata**: JSON format for session information
- **Configurations**: JSON format for settings

## 🛡️ Security Requirements

### Authentication
- JWT-based authentication
- Session management
- User consent tracking
- API key validation

### Data Protection
- HTTPS encryption
- Secure file storage
- User data isolation
- Regular backups

### Privacy Compliance
- GDPR-compliant consent management
- Data anonymization options
- User data deletion
- Audit logging

## 🔍 Monitoring and Logging

### Health Checks
- Service availability monitoring
- Database connectivity checks
- AI model loading verification
- SSL certificate validation

### Logging
- Application logs via Docker
- Nginx access/error logs
- MongoDB operation logs
- AI processing logs

## 📈 Performance Requirements

### Caching
- Static asset caching
- Database query optimization
- Image processing caching
- CDN integration ready

### Scaling
- Horizontal scaling support
- Load balancing configuration
- Database replication ready
- Microservices architecture

## 🐛 Troubleshooting

### Common Issues
1. **SSL Certificate Errors**: Check certificate validity and permissions
2. **Camera Access Denied**: Ensure HTTPS and correct port (8443)
3. **Database Connection**: Verify MongoDB service and credentials
4. **AI Model Loading**: Check model file paths and permissions

### Debug Commands
```bash
# Check service status
cd Main-website
docker-compose ps

# View logs
docker-compose logs [service-name]

# Test SSL
openssl s_client -connect localhost:443

# Check nginx config
docker exec backend_nginx nginx -t

# Run without log
docker-compose up --build > /dev/null
```

## 📚 Key Dependencies

### AI/ML Libraries
- **[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN)**: Image super-resolution and enhancement
- **[MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide)**: Facial landmark detection and head pose estimation

### Core Technologies
- **Next.js**: React framework for the frontend application
- **FastAPI**: Python web framework for backend services
- **MongoDB**: NoSQL database for user data and session management
- **Docker**: Containerization for microservices architecture
- **Nginx**: Reverse proxy and load balancer
- **[OpenSSL 3.5.2](https://github.com/openssl/openssl)**: TLS/SSL and crypto library for secure communications

## 🚀 Prerequisites

### System Requirements
- Docker Compose v2.39.2-desktop.1
- OpenSSL 3.5.2 (for SSL certificates)
- Node.js v23.11.0 (for development)
- Next.js 15.5.3 (frontend framework)
- Python 3.8+ (for backend services)
- MongoDB v8.0.8 (for database)

### Hardware Requirements
- **RAM**: Minimum 8GB (16GB recommended for AI processing)
- **Storage**: Minimum 20GB free space (for models and data)
- **CPU**: Multi-core processor (AI processing is CPU intensive)
- **GPU**: Optional but recommended for faster AI processing

### Network Requirements
- **Ports**: 80, 443, 8443, 3010, 8010, 8011, 8108
- **Firewall**: Configure to allow HTTPS traffic
- **SSL**: Valid SSL certificates for production deployment
