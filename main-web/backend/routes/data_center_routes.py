from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.data_center_service import data_center_service
import json
from typing import List, Dict, Any
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/api/data-center/values")
async def get_values():
    """Get all current values"""
    return data_center_service.get_all_values()

@router.post("/api/data-center/update")
async def update_value(data: Dict[str, Any]):
    """Update a value"""
    key = data.get('key')
    value = data.get('value')
    data_type = data.get('data_type')
    
    if not all([key, value, data_type]):
        return {"error": "Missing required fields"}
    
    data_center_service.update_value(key, value, data_type)
    return {"success": True}

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    active_connections[client_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                # Parse incoming message
                message = json.loads(data)
                
                # Handle different message types
                if message.get('type') == 'request':
                    # Handle settings request
                    key = message.get('key')
                    if key:
                        # Get settings from data center
                        settings = data_center_service.get_value(key)
                        if settings:
                            # Ensure settings are JSON serializable
                            if isinstance(settings, dict):
                                response = {
                                    'key': key,
                                    'value': json.dumps(settings, cls=DateTimeEncoder),
                                    'data_type': 'json'
                                }
                            else:
                                response = {
                                    'key': key,
                                    'value': str(settings),
                                    'data_type': 'string'
                                }
                            await websocket.send_json(response)
                
                elif message.get('key') and message.get('value'):
                    # Handle settings update
                    key = message['key']
                    value = message['value']
                    data_type = message.get('data_type', 'string')
                    
                    # Update data center
                    if data_type == 'json':
                        try:
                            value = json.loads(value)
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON value for key {key}")
                            continue
                    
                    data_center_service.update_value(key, value, data_type)
                    
                    # Broadcast update to all connected clients
                    for connection in active_connections.values():
                        try:
                            await connection.send_json({
                                'key': key,
                                'value': json.dumps(value, cls=DateTimeEncoder) if data_type == 'json' else str(value),
                                'data_type': data_type
                            })
                        except Exception as e:
                            logger.error(f"Error broadcasting to client: {e}")
            
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing WebSocket message: {e}")
                continue
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                continue
    
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
    finally:
        if client_id in active_connections:
            del active_connections[client_id] 