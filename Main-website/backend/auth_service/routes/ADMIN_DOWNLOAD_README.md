# Admin Download Functionality

This module provides functionality for downloading user capture data as zip files.

## Features

- Check if a user has collected any data
- Create zip files containing all user capture data
- Download user data with proper error handling
- Clean up old zip files

## API Endpoints

### Check User Data
- **GET** `/api/admin/download/check-user-data/{user_id}`
- Checks if user has any capture data
- Returns: `{"has_data": boolean, "message": string, "user_id": string}`

### Download User Data
- **GET** `/api/admin/download/download-user-data/{user_id}`
- Downloads user's capture data as a zip file
- Returns: Zip file or error message

### Cleanup Zip Files
- **DELETE** `/api/admin/download/cleanup-zip/{user_id}`
- Removes old zip files for a user
- Returns: Cleanup status

## Frontend Integration

The frontend admin panel includes a "Download Dataset" button that:
1. Checks if the selected user has data
2. Shows appropriate notification messages
3. Downloads the data as a zip file if available
4. Shows error message if no data is found

## File Structure

- User data is stored in: `resource_security/public/captures/{user_id}/`
- Zip files are created in: `resource_security/public/admin/zip-download/`
- Zip files are named: `{user_id}_captures_{timestamp}.zip`

## Environment Variables

The frontend requires:
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL
- `NEXT_PUBLIC_API_KEY`: API key for authentication

## Error Handling

- If user folder doesn't exist: "That User Didn't collect any Data"
- If zip creation fails: Internal server error
- If download fails: Appropriate error message

## Security

- All endpoints require API key authentication
- File paths are validated to prevent directory traversal
- Zip files are created with proper permissions
