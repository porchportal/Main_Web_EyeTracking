# Consent Initialization System

This document describes the new consent initialization system that creates MongoDB documents when users accept the cookie banner.

## Overview

When a user clicks "Accept" on the cookie consent banner, the system now automatically creates a comprehensive user data structure in MongoDB with default profile and settings.

## Backend Implementation

### New Route: `/consent-init/initialize-user`

**File:** `routes/consent_initialization.py`

**Endpoint:** `POST /consent-init/initialize-user`

**Purpose:** Creates a complete user data structure in MongoDB when consent is accepted.

**Request Body:**
```json
{
  "user_id": "string",
  "email": "test@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User data initialized successfully",
  "data": {
    "user_id": "string",
    "consent_accepted": true,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### MongoDB Document Structure

The system creates a single document structure in the `eye_tracking.data_centralization` collection:

```json
{
  "_id": {
    "$oid": "6898c45e118ba0e30186e5b0"
  },
  "user_id": "29d83ee6-b3da-4034-be3a-9634ff1944ac",
  "created_at": {
    "$date": "2025-08-10T16:10:06.861Z"
  },
  "key": "user_data_{user_id}",
  "value": {
    "user_id": "string",
    "consent_accepted": true,
    "consent_timestamp": "2024-01-01T00:00:00.000Z",
    "profile": {
      "username": "",
      "email": "test@example.com",
      "sex": "",
      "age": "",
      "night_mode": false
    },
    "settings": {
      "times_set_random": 1,
      "delay_set_random": 3,
      "run_every_of_random": 1,
      "set_timeRandomImage": 1,
      "times_set_calibrate": 1,
      "every_set": 0,
      "zoom_percentage": 150,
      "position_zoom": [0, 0],
      "currentlyPage": "home",
      "state_isProcessOn": false,
      "freeState": 0,
      "buttons_order": "",
      "order_click": "",
      "image_background_paths": ["/backgrounds/one.jpg"],
      "public_data_access": false,
      "enable_background_change": false
    }
  },
  "data_type": "user_consent",
  "updated_at": {
    "$date": "2025-08-10T16:10:06.861Z"
  }
}
```

### Single Document Approach

The system now uses a single document approach where all user data (profile, settings, and consent information) is stored in one document under the key `user_data_{user_id}`. This provides better data consistency and easier management.

## Frontend Implementation

### Modified Components

1. **ConsentBanner.js** - Now calls the initialization endpoint when consent is accepted
2. **ConsentContext.js** - Optionally checks initialization status

### New API Routes

1. **`/api/consent-init/initialize-user`** - Proxies to backend initialization endpoint
2. **`/api/consent-init/check-user/[userId]`** - Checks if user data is initialized
3. **`/api/consent-init/update-user-profile/[userId]`** - Updates user profile within the single document structure

## Usage Flow

1. User visits the website
2. Cookie consent banner appears
3. User clicks "Accept"
4. Frontend calls `/api/consent-init/initialize-user`
5. Backend creates MongoDB document with default profile and settings
6. User is redirected to consent setup page
7. User can now customize their profile and settings

## Error Handling

- If MongoDB connection fails, the system logs an error but doesn't block the consent flow
- If initialization fails, the user can still proceed with the application
- All errors are logged for debugging purposes

## Configuration

The system uses the following default values:
- Email: `test@example.com`
- Zoom percentage: `150`
- Background image: `["/backgrounds/one.jpg"]`
- All other settings have sensible defaults as defined in the `UserSettings` model

## Testing

To test the system:

1. Start the backend server
2. Start the frontend application
3. Visit the website and accept the cookie banner
4. Check MongoDB for the created document
5. Verify that profile and settings are accessible via the data center routes
