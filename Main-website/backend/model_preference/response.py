# backend/models/response.py
from typing import Optional, Generic, TypeVar, Dict, Any, List
from pydantic import BaseModel, Field

T = TypeVar('T')


class ResponseBase(BaseModel):
    """Base model for API responses"""
    success: bool = Field(..., description="Whether the request was successful")
    message: Optional[str] = Field(None, description="Response message")


class DataResponse(BaseModel, Generic[T]):
    """Generic data response with success status, message, and data payload"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None


class ErrorResponse(ResponseBase):
    """Error response with details"""
    success: bool = False
    error_code: Optional[str] = Field(None, description="Error code for client to handle")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")


class HealthResponse(ResponseBase):
    """Health check response"""
    success: bool = True
    status: str = "ok"
    version: Optional[str] = Field(None, description="API version")
    database_connected: bool = Field(False, description="Whether the database is connected")
    components: Optional[Dict[str, str]] = Field(None, description="Status of individual components")