// app/api/tracking/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // For now, just return mock data for testing
    // Later we'll connect this to the Python backend
    return NextResponse.json({
      success: true,
      metrics: {
        pitch: 0,
        yaw: 0,
        roll: 0,
        face_min_position: [100, 100],
        face_max_position: [200, 200],
        face_size_width: 100,
        face_size_height: 100,
        face_center_position: [150, 150],
        gaze_direction: "Looking center",
        posture: "Forward",
        distance: 60,
        // ... other tracking parameters
      }
    });
  } catch (error) {
    console.error('Error in tracking API route:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An error occurred during tracking' 
      },
      { status: 500 }
    );
  }
}