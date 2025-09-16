# Eye Tracking Web Application

A comprehensive web-based eye tracking system built with Next.js frontend and Python backend services, featuring real-time face detection, head pose estimation, and image enhancement capabilities.

## 🏗️ Architecture Overview

The application follows a microservices architecture with the following components:

### Frontend (Next.js)
- **Port**: 3010
- **Technology**: Next.js 13+ with React
- **Features**: Real-time eye tracking interface, data collection, admin dashboard
- **Key Pages**:
  - `/` - Home page with consent management
  - `/collected-dataset` - Basic data collection interface
  - `/collected-dataset-customized` - Advanced data collection with canvas
  - `/testing-image` - AI model testing interface
  - `/admin_ui/` - Administrative dashboard

### Backend Services

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

#### 3. Nginx Reverse Proxy (Ports 80, 443, 8443)
- **Purpose**: Load balancing, SSL termination, security headers
- **Features**:
  - HTTPS redirection
  - Rate limiting
  - CORS handling
  - Security headers (CSP, HSTS, etc.)
  - Camera access control via port separation

## 📁 Storage System (`resource_security/`)

The application uses a centralized storage system located at `backend/auth_service/resource_security/`:

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

## 🤖 AI Model Structure (`Main_AI/`)

The AI system is organized in the `backend/Main_AI/` directory:

### Model Weights and Sizes

| Model | File | Size | Purpose |
|-------|------|------|---------|
| **Face Detection** | `detection_Resnet50_Final.pth` | 104MB | Face detection and bounding box |
| **Face Parsing** | `parsing_parsenet.pth` | 81MB | Facial landmark detection |
| **Real-ESRGAN v3** | `realesr-general-x4v3.pth` | 4.7MB | Image super-resolution |
| **Real-ESRGAN WDN** | `realesr-general-wdn-x4v3.pth` | 4.7MB | Image super-resolution (WDN variant) |
| **Real-ESRGAN x4+** | `RealESRGAN_x4plus.pth` | 64MB | High-quality image enhancement |
| **Real-ESRNet x4+** | `RealESRNet_x4plus.pth` | 64MB | Image restoration |

### Directory Structure

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

## 🔐 SSL Configuration (`config/`)

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

### Security Configuration

#### Content Security Policy (CSP)
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';" always;
```

#### Port Configuration
- **Port 80**: HTTP (redirects to HTTPS)
- **Port 443**: Main application (restricted camera access)
- **Port 8443**: Camera access (full camera permissions)

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- OpenSSL (for SSL certificates)
- Node.js 18+ (for development)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd Main_web_eyetracking
```

### 2. Generate SSL Certificates
```bash
# Development
mkdir -p Main-website/backend/config/ssl
openssl req -x509 -newkey rsa:2048 -keyout Main-website/backend/config/ssl/key.pem -out Main-website/backend/config/ssl/cert.pem -days 365 -nodes -subj "/CN=localhost"
```

### 3. Configure Environment
```bash
# Copy environment files
cp Main-website/backend/.env.backend.example Main-website/backend/.env.backend
cp Main-website/frontend/.env.frontend.example Main-website/frontend/.env.frontend

# Edit configuration files
nano Main-website/backend/.env.backend
nano Main-website/frontend/.env.frontend
```

### 4. Start Services
```bash
# Start all services
cd Main-website
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Access Application
- **Main Application**: `https://localhost` (port 443)
- **Camera Access**: `https://localhost:8443` (port 8443)
- **HTTP Redirect**: `http://localhost` → `https://localhost`

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

## 📊 Data Management

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

## 🛡️ Security Features

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

## 📈 Performance Optimization

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
```

## 📚 Documentation

- **Environment Setup**: [Main-website/ENVIRONMENT_SETUP.md](Main-website/ENVIRONMENT_SETUP.md)
- **SSL Setup**: [Main-website/backend/config/SSL_SETUP_README.md](Main-website/backend/config/SSL_SETUP_README.md)
- **Camera Setup**: [Main-website/backend/config/HTTPS_CAMERA_SETUP.md](Main-website/backend/config/HTTPS_CAMERA_SETUP.md)
- **Consent System**: [Main-website/backend/auth_service/CONSENT_INITIALIZATION_README.md](Main-website/backend/auth_service/CONSENT_INITIALIZATION_README.md)
- **Admin Download**: [Main-website/backend/auth_service/routes/ADMIN_DOWNLOAD_README.md](Main-website/backend/auth_service/routes/ADMIN_DOWNLOAD_README.md)
- **Process Set**: [Main-website/frontend/pages/process_set/README.md](Main-website/frontend/pages/process_set/README.md)
- **Dataset Processing**: [Main-website/frontend/pages/api/for-process-folder/readDataset/README.md](Main-website/frontend/pages/api/for-process-folder/readDataset/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the documentation files
- Contact the development team

---

**Note**: This application handles sensitive biometric data. Ensure compliance with local privacy laws and regulations when deploying in production environments.
