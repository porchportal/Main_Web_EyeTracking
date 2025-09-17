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
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-server-ip" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.100"

# Set proper permissions
chmod 600 backend/config/ssl/key.pem
chmod 644 backend/config/ssl/cert.pem
```

#### 2. Production Environment (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot

# Generate certificate (Note: Let's Encrypt requires a domain name, not IP)
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
- **Resource constraints**: CPU and memory limits for optimal performance
- **Resource reservations**: Guaranteed minimum resources per service
- **Optimized allocation**: 4 CPU cores, 16GB memory total distribution

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

## 🍪 Privacy & Cookie Policy

### Cookie Management System

The application implements a comprehensive cookie management system with user consent tracking and privacy compliance.

#### Cookie Types Implemented

| Cookie Type | Purpose | Storage Duration | Essential |
|-------------|---------|------------------|-----------|
| **Essential Cookies** | Basic website functionality, navigation, secure areas | Session-based | ✅ Yes |
| **Analytics Cookies** | Anonymous visitor interaction tracking, website improvement | 30 days | ❌ No |
| **Preference Cookies** | User choices, personalized features, settings | 90 days | ❌ No |
| **Marketing Cookies** | Cross-website tracking, relevant advertising | 180 days | ❌ No |

#### Cookie Storage Structure

```javascript
// Essential cookies (always active)
{
  "sessionId": "uuid-session-id",
  "userId": "user-unique-id", 
  "consentStatus": "granted|denied|pending",
  "cameraSettings": "selected-cameras-array"
}

// Analytics cookies (with consent)
{
  "analyticsId": "anonymous-tracking-id",
  "pageViews": "count",
  "sessionDuration": "milliseconds",
  "buttonClicks": "tracked-actions"
}

// Preference cookies (with consent)
{
  "theme": "light|dark",
  "language": "en|es|fr",
  "cameraPreferences": "user-camera-settings",
  "canvasSettings": "background-preferences"
}

// Marketing cookies (with consent)
{
  "marketingId": "advertising-id",
  "campaigns": "tracked-campaigns",
  "conversions": "conversion-events"
}
```

#### Consent Management Implementation

```javascript
// Consent levels and their implications
const CONSENT_LEVELS = {
  ESSENTIAL: {
    required: true,
    description: "Required for basic website functionality",
    cookies: ["sessionId", "userId", "consentStatus"]
  },
  ANALYTICS: {
    required: false,
    description: "Anonymous usage analytics and website improvement",
    cookies: ["analyticsId", "pageViews", "sessionDuration"]
  },
  PREFERENCES: {
    required: false,
    description: "Personalized features and user settings",
    cookies: ["theme", "language", "cameraPreferences"]
  },
  MARKETING: {
    required: false,
    description: "Relevant advertising and cross-site tracking",
    cookies: ["marketingId", "campaigns", "conversions"]
  }
};
```

#### Privacy Policy Features

##### 1. **Cookie Information Display**
- Clear explanation of each cookie type with emojis for visual appeal
- Purpose and duration of each cookie category
- User-friendly descriptions of data collection
- Real-time consent status display with timestamp
- Visual indicators for essential vs. optional cookies

##### 2. **Consent Management**
- Granular consent controls for each cookie type
- Easy-to-use consent interface with toggle switches
- One-click accept/reject all options
- Consent withdrawal functionality
- Real-time consent status updates
- Persistent consent storage in localStorage
- **Banner Persistence**: Banner remains visible when declined, allowing users to change their mind
- **Logo Positioning**: Automatic logo adjustment when banner is visible to prevent overlapping

##### 3. **Data Protection Measures**
- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Use data only for stated purposes
- **Storage Limitation**: Automatic data deletion after specified periods
- **Transparency**: Clear privacy notices and cookie information
- **User Control**: Complete control over cookie preferences

##### 4. **User Rights Implementation**
- **Right to Access**: Users can view their stored data
- **Right to Rectification**: Users can correct inaccurate data
- **Right to Erasure**: Users can request data deletion
- **Right to Portability**: Users can export their data
- **Right to Object**: Users can opt-out of processing
- **Right to Withdraw Consent**: Easy consent withdrawal at any time

#### Cookie Configuration Interface

```javascript
// Cookie preferences configuration
const cookiePreferences = {
  essential: {
    enabled: true,        // Always enabled
    description: "Required for website functionality",
    cannotDisable: true
  },
  analytics: {
    enabled: false,       // User choice
    description: "Anonymous usage analytics",
    canDisable: true,
    impact: "May affect website improvement insights"
  },
  preferences: {
    enabled: false,       // User choice
    description: "Personalized features and settings",
    canDisable: true,
    impact: "May affect personalized experience"
  },
  marketing: {
    enabled: false,       // User choice
    description: "Relevant advertising",
    canDisable: true,
    impact: "May affect ad relevance"
  }
};
```

#### Privacy Compliance Features

##### 1. **GDPR Compliance**
- ✅ Explicit consent before data processing
- ✅ Clear privacy notices
- ✅ Data subject rights implementation
- ✅ Data protection by design
- ✅ Privacy impact assessments

##### 2. **CCPA Compliance**
- ✅ Right to know about data collection
- ✅ Right to delete personal information
- ✅ Right to opt-out of data sale
- ✅ Non-discrimination for privacy choices

##### 3. **Cookie Law Compliance**
- ✅ Clear cookie information
- ✅ Granular consent controls
- ✅ Easy consent withdrawal
- ✅ Regular consent renewal

#### Data Retention Policies

| Data Type | Retention Period | Deletion Method | Legal Basis |
|-----------|------------------|-----------------|-------------|
| **Session Data** | 24 hours | Automatic | Legitimate Interest |
| **User Preferences** | 90 days | Automatic | Consent |
| **Analytics Data** | 30 days | Automatic | Consent |
| **Marketing Data** | 180 days | Automatic | Consent |
| **Eye Tracking Data** | 1 year | Manual | Research Consent |

#### Privacy Contact Information

- **Privacy Officer**: privacy@eyetrackingapp.com
- **Data Protection Officer**: dpo@eyetrackingapp.com
- **General Inquiries**: support@eyetrackingapp.com
- **Data Deletion Requests**: deletion@eyetrackingapp.com

#### Cookie Management API

```javascript
// Cookie management functions
const cookieManager = {
  // Set cookie with consent check
  setCookie: (name, value, category, days) => {
    if (hasConsent(category)) {
      // Set cookie with appropriate settings
    }
  },
  
  // Get cookie value
  getCookie: (name) => {
    // Retrieve cookie value safely
  },
  
  // Delete cookie
  deleteCookie: (name) => {
    // Remove cookie from browser
  },
  
  // Check consent for category
  hasConsent: (category) => {
    // Verify user consent for cookie category
  },
  
  // Update consent preferences
  updateConsent: (preferences) => {
    // Update user consent settings
  }
};
```

#### Current Implementation Details

##### Privacy Policy Page (`/preferences/privacy-policy`)
- **Location**: Moved to preferences folder for better organization
- **Features**:
  - Real-time consent status display with timestamp
  - Interactive cookie management buttons
  - Clear visual hierarchy with emojis and color coding
  - Responsive design for all devices
  - Direct integration with consent management system

##### Cookie Management Buttons
- **← Back**: Returns to previous page
- **⚙️ Configure Cookie Preferences**: Links to detailed consent setup
- **✅ Accept All Cookies**: Accepts all cookie categories
- **❌ Reject Non-Essential**: Rejects optional cookies, keeps essential

##### Visual Design Elements
- **Color Coding**: Green for accepted, red for rejected, blue for informational
- **Emoji Icons**: Visual indicators for different cookie types
- **Status Display**: Real-time consent status with last updated timestamp
- **Warning Messages**: Clear warnings about essential cookie requirements

#### Privacy Policy Updates

- **Version Control**: Track policy changes with version numbers
- **Change Notifications**: Notify users of significant changes
- **Consent Renewal**: Re-request consent for new data uses
- **Audit Trail**: Maintain records of consent changes
- **Last Updated**: Dynamic date display on privacy policy page

#### Browser Compatibility

| Browser | Cookie Support | Local Storage | Session Storage | IndexedDB |
|---------|----------------|---------------|-----------------|-----------|
| **Chrome** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Firefox** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Safari** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Edge** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Mobile Safari** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |

#### Privacy Impact Assessment

##### High-Risk Processing Activities
1. **Eye Tracking Data Collection**
   - Risk Level: High
   - Mitigation: Explicit consent, data anonymization
   - Legal Basis: Research consent

2. **Camera Access and Processing**
   - Risk Level: High
   - Mitigation: User control, secure processing
   - Legal Basis: Legitimate interest + consent

3. **Cross-Site Tracking**
   - Risk Level: Medium
   - Mitigation: Granular consent, opt-out options
   - Legal Basis: Consent

#### Cookie Data Management

##### Safety Features
- **Double Confirmation**: User must confirm destruction
- **Visual Warnings**: Clear indication when destroyer command is detected
- **Graceful Fallback**: System handles errors during clearing
- **Consent Banner Reset**: Ensures banner reappears after clearing

#### Data Breach Response

1. **Detection**: Automated monitoring and alerting
2. **Assessment**: Risk evaluation within 24 hours
3. **Notification**: Authorities within 72 hours
4. **Communication**: Users within 72 hours
5. **Documentation**: Complete incident records
6. **Remediation**: Security improvements and testing

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
- **Resource-constrained deployment**: Optimized for 4-core, 16GB systems
- **Resource monitoring**: Built-in resource limits and reservations
- **Performance optimization**: CPU and memory allocation per service

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

# Check resource usage
docker stats

# Monitor specific service resources
docker stats backend_image_service backend_auth_service frontend_main mongodb backend_nginx
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
- **RAM**: 16GB (optimized resource allocation)
- **Storage**: Minimum 20GB free space (for models and data)
- **CPU**: 4-core processor (resource-constrained configuration)
- **GPU**: Optional but recommended for faster AI processing

### Resource Allocation (Docker Compose)
- **Total CPU Limit**: 4 cores maximum
- **Total Memory Limit**: 16GB maximum
- **Service Distribution**:
  - nginx: 0.5 CPU cores, 512MB RAM
  - image_service: 2.0 CPU cores, 4GB RAM
  - auth_service: 1.5 CPU cores, 3GB RAM
  - frontend: 1.0 CPU cores, 2GB RAM
  - mongodb: 1.0 CPU cores, 2GB RAM

### Network Requirements
- **Ports**: 80, 443, 8443, 3010, 8010, 8011, 8108
- **Firewall**: Configure to allow HTTPS traffic
- **SSL**: Valid SSL certificates for production deployment

## 🔧 Environment Configuration

### Frontend Environment (.env.frontend)

```bash
# Frontend Environment Configuration
# API Configuration
NEXT_PUBLIC_API_URL=https://(ip)

NEXT_PUBLIC_API_KEY=(api-key)

# WebSocket URL for real-time features
NEXT_PUBLIC_WS_URL=wss://(ip)/ws

# Development settings
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
WATCHPACK_POLLING=true

# Camera access port
NEXT_PUBLIC_CAMERA_PORT=8443

# SSL settings
NEXT_PUBLIC_SSL_ENABLED=true

# Backend service URLs
AUTH_SERVICE_URL=http://backend_auth_service:8108
IMAGE_SERVICE_URL=http://backend_auth_service:8010

BACKEND_API_KEY=(api-key)
INTERNAL_API_URL=https://nginx

# Cross-Origin Configuration for Docker Development
# Comma-separated list of allowed development origins
ALLOWED_DEV_ORIGINS=(ip),172.18.0.0/16,192.168.0.0/16,localhost,127.0.0.1
```

### Backend Environment (.env.backend)

```bash
API_KEY=(api-key)

# MongoDB settings
MONGODB_URL=mongodb://mongodb:27017 

MONGODB_DB_NAME=eye_tracking

# Admin settings
ADMIN_USERNAME=(admin-username)
ADMIN_PASSWORD=(admin-password)

# CORS settings
ALLOWED_ORIGINS=http://localhost:3010

# Logging settings
LOG_LEVEL=INFO
AUTH_SERVICE_URL=http://backend_auth_service:8108
IMAGE_SERVICE_URL=http://backend_image_service:8010
```

### Environment Variables Explained

#### Frontend Variables
- **NEXT_PUBLIC_API_URL**: Main API endpoint URL (replace `(ip)` with your server IP)
- **NEXT_PUBLIC_API_KEY**: API authentication key (replace `(api-key)` with your key)
- **NEXT_PUBLIC_WS_URL**: WebSocket URL for real-time features (replace `(ip)` with your server IP)
- **NEXT_PUBLIC_CAMERA_PORT**: Port for camera access (8443)
- **NEXT_PUBLIC_SSL_ENABLED**: Enable/disable SSL features
- **ALLOWED_DEV_ORIGINS**: CORS allowed origins for development (replace `(ip)` with your server IP)

#### Backend Variables
- **API_KEY**: Internal API authentication key (replace `(api-key)` with your key)
- **MONGODB_URL**: MongoDB connection string
- **MONGODB_DB_NAME**: Database name
- **ADMIN_USERNAME/PASSWORD**: Admin credentials (replace `(admin-username)` and `(admin-password)` with your credentials)
- **ALLOWED_ORIGINS**: CORS allowed origins
- **LOG_LEVEL**: Logging verbosity level
