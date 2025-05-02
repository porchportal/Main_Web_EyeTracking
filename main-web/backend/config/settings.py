# backend/config/settings.py
import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
from pathlib import Path

class Settings(BaseSettings):
    """Application settings loaded from environment variables with defaults"""
    
    # App settings
    APP_NAME: str = "Eye Tracking API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False)
    
    # API settings
    API_KEY: str = Field(default="your-api-key-here")
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000"])
    
    # MongoDB settings
    MONGODB_URL: str = Field(default="mongodb://localhost:27017")
    MONGODB_DB_NAME: str = Field(default="eye_tracking")
    
    # RabbitMQ settings
    RABBITMQ_URL: str = Field(default="amqp://rabbitmq:5672")
    RABBITMQ_HOST: str = Field(default="rabbitmq")  # Docker service name
    RABBITMQ_PORT: int = Field(default=5672)
    RABBITMQ_USERNAME: str = Field(default="guest")
    RABBITMQ_PASSWORD: str = Field(default="guest")
    RABBITMQ_QUEUE: str = Field(default="image_processing_queue")
    RABBITMQ_VHOST: str = Field(default="/")
    
    # Admin settings
    ADMIN_USERNAME: str = Field(default="admin")
    ADMIN_PASSWORD: str = Field(default="1234")
    
    # File storage settings
    UPLOAD_DIR: str = Field(default="./uploads")
    MAX_UPLOAD_SIZE: int = Field(default=52428800)  # 50MB
    
    # Logging settings
    LOG_LEVEL: str = Field(default="WARNING")
    
    class Config:
        env_file = Path(__file__).parent.parent / '.env.backend'
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "allow"  # Allow extra fields in environment variables


# Create settings instance
settings = Settings()

def get_settings() -> Settings:
    """Get the settings instance"""
    return settings