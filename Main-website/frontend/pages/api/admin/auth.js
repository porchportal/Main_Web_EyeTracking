export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Check credentials against backend environment variables
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return res.status(200).json({ message: 'Authentication successful' });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
} 