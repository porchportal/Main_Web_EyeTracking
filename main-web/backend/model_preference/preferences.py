# backend/models/preferences.py
from typing import Dict, Optional, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class UserPreferences(BaseModel):
    """User preferences model for storing cookie consent and other preferences"""
    user_id: str = Field(..., description="Unique identifier for the user")
    consent_status: Optional[bool] = Field(None, description="Cookie consent status")
    consent_updated_at: Optional[datetime] = Field(None, description="When consent was last updated")
    preferences: Dict[str, Any] = Field(default_factory=dict, description="User-specific preferences")
    theme: Optional[str] = Field(None, description="User's preferred UI theme")
    language: Optional[str] = Field(None, description="User's preferred language")
    notification_settings: Optional[Dict[str, bool]] = Field(None, description="Notification preferences")
    image_processing_settings: Optional[Dict[str, Any]] = Field(None, description="Image processing preferences")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="When the user profile was created")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="When user preferences were last updated")
    last_active: Optional[datetime] = Field(None, description="When the user was last active")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_a1b2c3d4e5",
                "consent_status": True,
                "consent_updated_at": "2025-04-20T10:15:30Z",
                "preferences": {
                    "show_head_pose": True,
                    "show_bounding_box": False,
                    "show_mask": False,
                    "show_parameters": True
                },
                "theme": "dark",
                "language": "en",
                "notification_settings": {
                    "email_notifications": True,
                    "push_notifications": False
                },
                "image_processing_settings": {
                    "quality": "high",
                    "auto_enhance": True
                },
                "created_at": "2025-04-15T08:30:00Z",
                "updated_at": "2025-04-20T10:15:30Z",
                "last_active": "2025-04-20T11:20:15Z"
            }
        }


class UserPreferencesUpdate(BaseModel):
    """Model for updating user preferences"""
    consent_status: Optional[bool] = None
    preferences: Optional[Dict[str, Any]] = None
    theme: Optional[str] = None
    language: Optional[str] = None
    notification_settings: Optional[Dict[str, bool]] = None
    image_processing_settings: Optional[Dict[str, Any]] = None


class ConsentUpdate(BaseModel):
    """Model specifically for updating consent status"""
    consent_status: bool
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)