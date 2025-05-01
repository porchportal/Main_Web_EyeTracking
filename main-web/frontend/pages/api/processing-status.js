import rabbitmqService from '@/lib/rabbitmq';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get the processing status from RabbitMQ service
    const status = await rabbitmqService.getProcessingStatus(userId);
    return res.status(200).json(status);
  } catch (error) {
    console.error('Error in processing-status API:', error);
    return res.status(500).json({ error: error.message });
  }
} 