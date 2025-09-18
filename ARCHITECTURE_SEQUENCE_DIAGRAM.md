# Eye Tracking System - Architecture Sequence Diagram

This document provides a comprehensive time sequence diagram showing the overall service interactions and API flow in the Eye Tracking Web Application.

## System Architecture Overview

The system follows a microservices architecture with the following components:
- **Frontend (Next.js)**: Port 3010 - User interface and API gateway
- **Nginx Reverse Proxy**: Ports 80, 443, 8443 - Load balancing and SSL termination
- **Auth Service (FastAPI)**: Port 8108 - User authentication and data management
- **Image Service (FastAPI)**: Port 8010 - AI image processing and analysis
- **Video Service**: Port 8011 - Currently under development
- **MongoDB**: Database for user data and session management

## Time Sequence Diagram

```mermaid
sequenceDiagram
    participant User as User Browser
    participant Frontend as Next.js Frontend<br/>(Port 3010)
    participant Nginx as Nginx Proxy<br/>(Ports 80/443/8443)
    participant AuthService as Auth Service<br/>(Port 8108)
    participant ImageService as Image Service<br/>(Port 8010)
    participant MongoDB as MongoDB Database
    participant FileSystem as File System<br/>(resource_security/)

    Note over User, FileSystem: 1. User Authentication & Initialization

    User->>Frontend: Access application
    Frontend->>Nginx: HTTPS request (port 443)
    Nginx->>Frontend: Serve static files
    Frontend->>User: Display consent page

    User->>Frontend: Accept consent
    Frontend->>AuthService: POST /api/consent/accept
    AuthService->>MongoDB: Store consent data
    AuthService->>FileSystem: Create user directory
    AuthService-->>Frontend: User ID & session data
    Frontend->>User: Redirect to data collection

    Note over User, FileSystem: 2. Data Collection Session

    User->>Frontend: Start data collection
    Frontend->>AuthService: GET /api/user-preferences/{userId}
    AuthService->>MongoDB: Fetch user preferences
    AuthService-->>Frontend: User preferences & canvas config
    Frontend->>User: Display collection interface

    loop Real-time Eye Tracking
        User->>Frontend: Capture webcam frame
        Frontend->>ImageService: POST /process-frame
        ImageService->>ImageService: AI face detection & analysis
        ImageService-->>Frontend: Eye tracking metrics
        Frontend->>User: Display real-time results
        
        User->>Frontend: Save capture data
        Frontend->>AuthService: POST /api/user-captures/save/{userId}
        AuthService->>FileSystem: Save screen/webcam/parameter files
        AuthService-->>Frontend: Capture confirmation
    end

    Note over User, FileSystem: 3. Image Processing & Enhancement

    User->>Frontend: Request image processing
    Frontend->>AuthService: POST /api/process-set/process
    AuthService->>ImageService: POST /process-images
    ImageService->>FileSystem: Read capture files
    ImageService->>ImageService: AI face enhancement (Real-ESRGAN)
    ImageService->>FileSystem: Save enhanced images
    ImageService-->>AuthService: Processing results
    AuthService->>MongoDB: Update processing status
    AuthService-->>Frontend: Processing complete
    Frontend->>User: Display enhanced results

    Note over User, FileSystem: 4. Admin Operations

    User->>Frontend: Access admin panel
    Frontend->>AuthService: POST /api/admin/auth
    AuthService->>MongoDB: Verify admin credentials
    AuthService-->>Frontend: Admin session token

    User->>Frontend: View datasets
    Frontend->>AuthService: GET /api/admin/dataset-viewer
    AuthService->>FileSystem: Scan user directories
    AuthService->>MongoDB: Fetch user metadata
    AuthService-->>Frontend: Dataset summary
    Frontend->>User: Display admin dashboard

    User->>Frontend: Download data
    Frontend->>AuthService: GET /api/admin/complete-download/{userId}
    AuthService->>FileSystem: Create ZIP archive
    AuthService-->>Frontend: Download link
    Frontend->>User: Trigger download

    Note over User, FileSystem: 5. Health Monitoring

    Frontend->>AuthService: GET /health
    AuthService-->>Frontend: Service status
    Frontend->>ImageService: GET /health
    ImageService-->>Frontend: Service status
    Frontend->>User: Connection indicator

    Note over User, FileSystem: 6. Error Handling & Fallbacks

    alt Backend Service Unavailable
        Frontend->>ImageService: POST /process-frame
        ImageService-->>Frontend: Service unavailable
        Frontend->>Frontend: Generate mock response
        Frontend->>User: Display mock data
    else Network Timeout
        Frontend->>AuthService: API request
        AuthService-->>Frontend: Timeout error
        Frontend->>User: Show error message
    end
```

## Key Service Interactions

### 1. Authentication Flow
- User consent management through Auth Service
- JWT-based session management
- User preference storage in MongoDB

### 2. Data Collection Flow
- Real-time webcam frame processing via Image Service
- Concurrent file saving through Auth Service
- User-specific directory structure in `resource_security/public/captures/`

### 3. Image Processing Flow
- Batch processing through Image Service
- AI face enhancement using Real-ESRGAN
- Enhanced images stored in `resource_security/public/enhance/`

### 4. Admin Operations Flow
- Secure admin authentication
- Dataset viewing and management
- Bulk data download and export

### 5. Error Handling
- Graceful degradation when services are unavailable
- Mock responses for development/testing
- Comprehensive error logging and monitoring

## API Endpoints Summary

### Frontend API Routes (`/pages/api/`)
- `save-capture.js` - Save user capture data
- `process-image.js` - Process single images
- `process-frame.js` - Real-time frame processing
- `check-backend-connection.js` - Health monitoring
- `admin/*` - Administrative operations
- `user-captures/*` - User-specific data management

### Auth Service Endpoints (`/api/`)
- `/health` - Service health check
- `/api/consent/*` - Consent management
- `/api/user-preferences/*` - User settings
- `/api/user-captures/*` - Capture data management
- `/api/admin/*` - Administrative functions
- `/api/process-set/*` - Batch processing coordination

### Image Service Endpoints (`/`)
- `/health` - Service health check
- `/process-image` - Single image processing
- `/process-images` - Batch image processing
- `/process-frame` - Real-time frame analysis
- `/process-single-image` - Enhanced single image processing

## Data Flow Architecture

```mermaid
flowchart TD
    A[User Input] --> B[Frontend<br/>Next.js Port 3010]
    B --> C[Nginx Reverse Proxy<br/>Ports 80/443/8443]
    
    C --> D[Auth Service<br/>Port 8108]
    C --> E[Image Service<br/>Port 8010]
    C --> F[Video Service<br/>Port 8011<br/>Under Development]
    
    D --> G[MongoDB Database]
    D --> H[File System<br/>resource_security/]
    E --> H
    F --> H
    
    H --> I[Enhanced Data Storage]
    I --> J[Complete Dataset Storage]
    
    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#fff3e0
    style D fill:#e8f5e8
    style E fill:#e8f5e8
    style F fill:#ffebee
    style G fill:#f1f8e9
    style H fill:#fce4ec
    style I fill:#e0f2f1
    style J fill:#e0f2f1
```

### Data Flow Description

**All data must pass through Nginx** before reaching any backend service:

1. **User Input** → **Frontend** (Next.js) - User interactions and data capture
2. **Frontend** → **Nginx** - All API requests routed through reverse proxy
3. **Nginx** → **Backend Services** - Load balancing and SSL termination
   - **Auth Service** - User authentication, data management, consent handling
   - **Image Service** - AI image processing and analysis
   - **Video Service** - Currently under development
4. **Backend Services** → **MongoDB** - User data and session storage
5. **Backend Services** → **File System** - Capture data and enhanced images storage
6. **File System** → **Enhanced Data** - AI-processed images and datasets
7. **Enhanced Data** → **Complete Storage** - Final processed datasets

## Security Considerations

- HTTPS enforcement through Nginx
- API key authentication for service-to-service communication
- User data isolation in separate directories
- CORS configuration for cross-origin requests
- SSL certificate management for production deployment

---

*This diagram represents the current system architecture as of the latest version. The video service (Port 8011) is currently under development and not included in the active flow.*
