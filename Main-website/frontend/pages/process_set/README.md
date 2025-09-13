# Process Set Dataset Reader

This folder contains the process set functionality with an integrated dataset reader for handling image previews from the backend with folder-based organization.

## Files

### `readDataset.js`
A comprehensive utility class for reading and managing dataset files from the backend with folder support.

**Features:**
- **Folder-based reading** (captures, enhance, complete)
- File type detection (image, text, unknown)
- Caching system for improved performance
- Preloading capabilities for multiple files
- Error handling and retry logic
- Base64 data processing for images
- Metadata management
- API integration with retry logic

**Key Methods:**
- `readFile(filename, userId, useCache, folder)` - Read a single file from specific folder
- `readFileFromFolder(filename, folder, userId, useCache)` - Convenience method for folder-based reading
- `preloadFiles(filenames, userId, folder)` - Preload multiple files from specific folder
- `preloadFilesFromFolder(filenames, folder, userId)` - Convenience method for folder-based preloading
- `readImageFromBackend(filename, userId, folder)` - Read image with folder support
- `getImagePreviewUrl(filename, userId, folder)` - Get preview URL for images
- `isImageFile(filename)` - Check if file is an image
- `isTextFile(filename)` - Check if file is text/CSV
- `getFileType(filename)` - Get file type for preview
- `clearCache(filename)` - Clear cache for specific file or all files
- `getCacheStats()` - Get cache statistics

### `sectionPreview.js`
UI components for the process set page with enhanced file handling.

**Updated Components:**
- `FilePreviewPanel` - Enhanced with better image handling and error states
- `FileList` - Added file icons and metadata display
- All components now use the dataset reader utilities

### `index.js`
Main process set page with integrated dataset reader functionality.

**New Features:**
- Uses `readDataset.js` for file loading
- Preloads first 5 files from each folder for better performance
- Enhanced error handling and user feedback
- Better file type detection and display

## Folder Structure

The system now supports three main folders:

| Frontend Folder | Backend Folder | Location | Description |
|----------------|----------------|----------|-------------|
| `captures` | `eye_tracking_captures` | `/captures/{userId}/eye_tracking_captures/` | User-specific capture files |
| `enhance` | `enhance` | `/captures/enhance/` | Global enhanced files |
| `complete` | `complete` | `/captures/complete/` | Global completed files |

## Usage

The dataset reader is automatically integrated into the process set page with folder support. When users click on files in the file list, the system will:

1. Determine the correct folder based on file metadata
2. Check if the file is cached (with folder-specific cache keys)
3. If not cached, load it from the backend using the new folder-based API
4. Process the data based on file type (images get proper base64 formatting)
5. Display the preview with appropriate scaling and metadata
6. Cache the result for future access with folder information

## File Type Support

- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`
- **Text/CSV**: `.csv`, `.txt`, `.json`, `.log`
- **Unknown**: Other file types (will show as unsupported)

## Performance Features

- **Caching**: Files are cached after first load
- **Preloading**: First 5 files from each folder are preloaded on page load
- **Concurrent Loading**: Multiple files can be loaded simultaneously
- **Error Recovery**: Failed loads can be retried

## Debugging

Use the `debugDatasetReader()` function to get cache statistics and debug information:

```javascript
import { debugDatasetReader } from './readDataset';
debugDatasetReader();
```

## API Integration

The dataset reader now integrates with a new folder-based API structure:

### Frontend API (`/api/for-process-folder/readDataset/[userId]`)
- **Endpoint**: `/api/for-process-folder/readDataset/[userId]`
- **Parameters**: `filename`, `folder` (captures/enhance/complete)
- **Features**: Folder-based file reading, comprehensive error handling

### Backend API (`/api/preview-api`)
- **Endpoint**: `/api/preview-api`
- **Parameters**: `filename`, `userId`, `folder`
- **Features**: Enhanced folder mapping, better error messages

### Migration from Old System

**Old System:**
- Files detected by filename patterns (`_enhance_` in filename)
- Limited to two folders (captures and enhance)
- Basic error handling

**New System:**
- Explicit folder parameter
- Support for three folders (captures, enhance, complete)
- Enhanced error handling and metadata
- Improved caching with folder-specific keys
- Better performance and user experience

## Integration

The dataset reader integrates seamlessly with the existing `processApi.js` functions while adding new folder-based capabilities. It maintains backward compatibility while providing enhanced functionality for folder-based file management.
