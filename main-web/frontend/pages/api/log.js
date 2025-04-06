export default function handler(req, res) {
    if (req.method === 'POST') {
      console.log('🖨️ Logging point on server:', req.body.point); // This shows in terminal
    }
    res.status(200).end();
  }