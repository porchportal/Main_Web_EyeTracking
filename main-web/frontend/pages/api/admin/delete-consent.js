import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Check if the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  const apiKey = req.headers['x-api-key'];
  console.log('Received API Key:', apiKey);
  console.log('Expected API Key:', process.env.NEXT_PUBLIC_API_KEY);
  
  if (!apiKey || apiKey !== process.env.NEXT_PUBLIC_API_KEY) {
    console.log('API Key mismatch or missing');
    return res.status(401).json({ 
      error: 'Unauthorized',
      receivedKey: apiKey,
      expectedKey: process.env.NEXT_PUBLIC_API_KEY
    });
  }

  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const adminDir = path.join(process.cwd(), 'public', 'admin');
  const consentFile = path.join(adminDir, 'consent_data.json');

  try {
    // Check if the consent file exists
    if (!fs.existsSync(consentFile)) {
      return res.status(404).json({ error: 'Consent data file not found' });
    }

    // Read existing data
    const fileContent = fs.readFileSync(consentFile, 'utf8');
    let existingData = JSON.parse(fileContent);

    // Filter out the user to be deleted
    const updatedData = existingData.filter(data => data.userId !== userId);

    // If no data was removed, the user wasn't found
    if (existingData.length === updatedData.length) {
      return res.status(404).json({ error: 'User not found in consent data' });
    }

    // Save the updated data
    fs.writeFileSync(consentFile, JSON.stringify(updatedData, null, 2));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting consent data:', error);
    return res.status(500).json({ error: 'Failed to delete consent data' });
  }
} 