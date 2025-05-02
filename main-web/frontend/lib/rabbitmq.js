// We'll use fetch to communicate with the backend API
import { processingStatus, updateProcessingStatus, getProcessingStatus } from '../workers/process_worker';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

class ProcessingService {
  constructor() {
    this.processingStatus = {};
  }

  async publishProcessingRequest(user_id, set_numbers) {
    try {
      console.log('Starting processing request for user:', user_id);
      
      // Check if user is already being processed
      const currentStatus = getProcessingStatus(user_id);
      console.log('Current status for user:', user_id, currentStatus);
      
      if (currentStatus.status === 'processing') {
        throw new Error('User is already being processed');
      }

      // Initialize status
      updateProcessingStatus(user_id, 'queued', 'Request queued for processing');
      console.log('Updated status to queued for user:', user_id);

      // Send request to backend
      const response = await fetch(`${BACKEND_URL}/api/queue-processing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || ''
        },
        body: JSON.stringify({ user_id, set_numbers })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend API error:', errorData);
        throw new Error(errorData.error || 'Failed to start processing');
      }

      // Return success response
      return {
        success: true,
        message: 'Processing request queued successfully',
        status: 'queued'
      };
    } catch (error) {
      console.error('Error starting processing:', error);
      // Update status to error
      updateProcessingStatus(user_id, 'error', `Error: ${error.message}`, 0);
      return {
        success: false,
        error: error.message,
        status: 'error'
      };
    }
  }

  async getProcessingStatus(user_id) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/processing-status?user_id=${user_id}`, {
        headers: {
          'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get processing status');
      }

      const status = await response.json();
      console.log('Received processing status:', status);
      return status;
    } catch (error) {
      console.error('Error getting processing status:', error);
      return {
        status: 'error',
        message: error.message,
        progress: 0,
        user_id: user_id
      };
    }
  }
}

// Create a single instance of the service
const processingService = new ProcessingService();

export default processingService; 