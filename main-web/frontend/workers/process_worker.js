// Store processing status for each user
const processingStatus = {};

// Function to update processing status
export function updateProcessingStatus(userId, status, message, progress = 0) {
  processingStatus[userId] = {
    status,
    message,
    progress,
    timestamp: Date.now()
  };
  console.log(`Updated status for ${userId}:`, processingStatus[userId]);
}

// Function to clear processing status
export function clearProcessingStatus(userId) {
  delete processingStatus[userId];
}

// Function to get processing status
export function getProcessingStatus(userId) {
  return processingStatus[userId] || {
    status: 'unknown',
    message: 'No processing status found',
    progress: 0
  };
} 