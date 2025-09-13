# ReadDataset API - Folder-Based File Reading

This directory contains the API endpoints and utilities for reading files from different folders in the backend storage system.

## Structure

```
readDataset/
├── [userId].js          # Dynamic user-specific file preview API
└── README.md           # This documentation
```

## API Endpoint

### `[userId].js` - Dynamic File Preview API

**Endpoint:** `/api/for-process-folder/readDataset/[userId]`

**Method:** GET

**Parameters:**
- `userId` (path parameter): The user ID
- `filename` (query parameter): The filename to preview
- `folder` (query parameter, optional): The folder to read from (default: 'captures')

**Supported Folders:**
- `captures` → Maps to `eye_tracking_captures` (user-specific)
- `enhance` → Maps to `enhance` (global)
- `complete` → Maps to `complete` (global)

**Example Requests:**
```
GET /api/for-process-folder/readDataset/user123?filename=screen_001.jpg&folder=captures
GET /api/for-process-folder/readDataset/user123?filename=webcam_enhance_001.jpg&folder=enhance
GET /api/for-process-folder/readDataset/user123?filename=parameter_001.csv&folder=captures
```

**Response Format:**
```json
{
  "success": true,
  "data": "base64_encoded_data_or_text_content",
  "type": "image|text|csv",
  "userId": "user123",
  "filename": "screen_001.jpg",
  "folder": "eye_tracking_captures",
  "size": 12345,
  "mtime": "2024-01-01T00:00:00.000Z"
}
```

## Folder Mapping

| Frontend Folder | Backend Folder | Location | Description |
|----------------|----------------|----------|-------------|
| `captures` | `eye_tracking_captures` | `/captures/{userId}/eye_tracking_captures/` | User-specific capture files |
| `enhance` | `enhance` | `/captures/enhance/` | Global enhanced files |
| `complete` | `complete` | `/captures/complete/` | Global completed files |

## File Type Support

### Images
- Extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`
- Returns: Base64 encoded data
- Special handling for screen vs webcam images

### Text Files
- Extensions: `.csv`, `.txt`, `.json`, `.log`
- Returns: UTF-8 text content

## Error Handling

The API provides comprehensive error handling:

- **400 Bad Request**: Missing required parameters
- **404 Not Found**: File or folder not found
- **500 Internal Server Error**: Server-side errors

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error message",
  "filename": "filename.jpg",
  "folder": "captures",
  "path": "/full/path/to/file"
}
```

## Integration with Frontend

This API is designed to work seamlessly with the `readDataset.js` utility in the process_set folder:

```javascript
import { readFileFromFolder } from './readDataset';

// Read a file from specific folder
const result = await readFileFromFolder('screen_001.jpg', 'captures', 'user123');
```

## Backend Integration

The API integrates with the backend `preview.py` endpoint:

```python
@router.get("/preview-api")
async def get_preview(filename: str, userId: str = "default", folder: str = "captures"):
    # Handles folder-based file reading
```

## Performance Features

- **Caching**: Files are cached after first load
- **Concurrent Loading**: Multiple files can be loaded simultaneously
- **Error Recovery**: Failed loads can be retried
- **File Metadata**: Returns file size and modification time

## Security

- API key authentication required
- User-specific folder access control
- Path traversal protection
- File type validation

## Usage Examples

### Frontend Integration
```javascript
// Read capture file
const captureFile = await readFileFromFolder('screen_001.jpg', 'captures', 'user123');

// Read enhanced file
const enhancedFile = await readFileFromFolder('webcam_enhance_001.jpg', 'enhance', 'user123');

// Read complete file
const completeFile = await readFileFromFolder('parameter_complete_001.csv', 'complete', 'user123');
```

### Direct API Usage
```javascript
// Using fetch directly
const response = await fetch('/api/for-process-folder/readDataset/user123?filename=screen_001.jpg&folder=captures');
const data = await response.json();
```

## Migration from Old System

The new folder-based system replaces the old filename-based detection:

**Old System:**
- Files were detected by filename patterns (`_enhance_` in filename)
- Limited to two folders (captures and enhance)

**New System:**
- Explicit folder parameter
- Support for three folders (captures, enhance, complete)
- Better error handling and metadata
- Improved caching and performance
