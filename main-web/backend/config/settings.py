# backend/config/settings.py
import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    """Application settings loaded from environment variables with defaults"""
    
    # App settings
    APP_NAME: str = "Face Tracking API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False)
    
    # API settings
    API_KEY: str = Field(default="A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV")
    CORS_ORIGINS: list = Field(default=["http://localhost:3000"])
    
    # MongoDB settings
    MONGODB_URI: str = Field(default="mongodb://localhost:27017")
    MONGODB_DB: str = Field(default="face_tracking_app")
    
    # File storage settings
    UPLOAD_DIR: str = Field(default="./uploads")
    MAX_UPLOAD_SIZE: int = Field(default=52428800)  # 50MB
    
    # Logging settings
    LOG_LEVEL: str = Field(default="INFO")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Create settings instance to import
settings = Settings()

def get_settings() -> Settings:
    """Get the settings instance"""
    return settings