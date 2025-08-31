# Canvas Image Management System

This directory contains the canvas image management system for the eye tracking application.

## Overview

The canvas system provides a centralized way to manage user-specific background images for the eye tracking interface. Images are stored in user-specific directories and tracked through a configuration file.

## Directory Structure

```
canvas/
├── config.json          # Main configuration file tracking all users and images
├── {user_id}/           # User-specific directories
│   ├── {timestamp}-{filename}.jpg
│   ├── {timestamp}-{filename}.png
│   └── ...
└── README.md           # This file
```

## Configuration File (config.json)

The configuration file tracks:
- **users**: Object containing user-specific image information
- **images**: Global registry of all images
- **last_updated**: Timestamp of last configuration update

### User Object Structure
```json
{
  "user_id": {
    "created_at": "2024-01-01T00:00:00.000Z",
    "image_count": 5,
    "images": [
      {
        "filename": "original_name.jpg",
        "path": "/canvas/user_id/timestamp-original_name.jpg",
        "size": 1024000,
        "uploaded_at": "2024-01-01T00:00:00.000Z",
        "image_key": "image_path_1"
      }
    ]
  }
}
```

## API Endpoints

### Backend Routes (`/api/canvas-admin/`)

1. **POST /upload-images**
   - Upload multiple images for a user
   - Requires: `user_id`, `files` (multipart form data)
   - Returns: Upload status and image paths

2. **GET /user-images/{user_id}**
   - Get all images for a specific user
   - Returns: User's image list and metadata

3. **GET /config**
   - Get complete canvas configuration
   - Returns: Full configuration object

4. **DELETE /user-images/{user_id}**
   - Delete all images for a user
   - Removes user directory and updates config

5. **DELETE /image/{user_id}/{image_key}**
   - Delete a specific image
   - Removes file and updates config

6. **GET /canvas/{user_id}/{filename}**
   - Serve canvas images (static file serving)
   - Returns: Image file

### Frontend API (`/api/admin/canvas-upload`)

- Handles file upload from frontend to backend canvas service
- Integrates with existing settings management system
- Updates user settings with new image paths

## Image Path Format

Images are stored with paths in the format:
```
/canvas/{user_id}/{timestamp}-{original_filename}
```

Example:
```
/canvas/user123/1704067200000-background.jpg
```

## Integration with Settings

The canvas system integrates with the existing user settings system:

- Images are stored in `image_pdf_canva` object in user settings
- Paths follow the format: `image_path_1`, `image_path_2`, etc.
- Primary image is stored in `image_path` field
- Image name is stored in `updateImage` field

## Security

- All API endpoints require API key authentication
- File size limit: 50MB per image
- Supported formats: JPG, JPEG, PNG
- User-specific directories prevent cross-user access

## Usage

1. **Upload Images**: Use the admin interface to select and upload images
2. **View Images**: Images are displayed in the admin dashboard with canvas badges
3. **Manage Images**: Delete individual images or all user images through API
4. **Access Images**: Images are served statically via `/canvas/` path

## File Management

- Images are automatically organized by user ID
- Unique filenames prevent conflicts
- Configuration file tracks all metadata
- Automatic cleanup when users are deleted
