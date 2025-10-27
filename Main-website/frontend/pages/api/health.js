// Health check endpoint for Docker healthcheck
export default function handler(req, res) {
  res.status(200).json({ status: 'healthy' });
}
