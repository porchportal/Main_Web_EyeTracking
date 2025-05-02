import rabbitmqService from '@/lib/rabbitmq';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received queue-processing request:', req.body);
    const { user_id, set_numbers } = req.body;

    if (!user_id || !set_numbers || !Array.isArray(set_numbers)) {
      console.error('Invalid request parameters:', { user_id, set_numbers });
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    console.log('Attempting to queue processing request for user:', user_id);
    // Queue the processing request using RabbitMQ
    const result = await rabbitmqService.publishProcessingRequest(user_id, set_numbers);
    console.log('Queue processing result:', result);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Set up SSE headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Send initial queued status
    res.write(`data: ${JSON.stringify({
      status: 'queued',
      message: 'Processing request queued',
      progress: 0
    })}\n\n`);

    // Keep the connection open
    res.flushHeaders();

    // The actual processing will be handled by the backend
    // and progress updates will be sent through the SSE connection
    return res;
  } catch (error) {
    console.error('Error in queue-processing API:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to queue processing request',
      details: error.stack
    });
  }
} 