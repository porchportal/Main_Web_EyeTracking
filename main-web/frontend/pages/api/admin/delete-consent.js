import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Check if the request method is POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('API Key validation failed:', {
      received: apiKey,
      expected: expectedApiKey
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Delete from admin consent file
    const adminDir = path.join(process.cwd(), 'public', 'admin');
    const consentFile = path.join(adminDir, 'consent_data.json');

    if (fs.existsSync(consentFile)) {
      const fileContent = fs.readFileSync(consentFile, 'utf8');
      let existingData = JSON.parse(fileContent);
      
      // Filter out the user to be deleted
      const updatedData = existingData.filter(data => data.userId !== userId);
      
      // Save the updated data
      fs.writeFileSync(consentFile, JSON.stringify(updatedData, null, 2));
    }

    // Delete from individual consent file
    const consentDir = path.join(process.cwd(), 'public', 'consent');
    const userConsentFile = path.join(consentDir, `consent_${userId}.json`);

    if (fs.existsSync(userConsentFile)) {
      fs.unlinkSync(userConsentFile);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting consent data:', error);
    return res.status(500).json({ error: 'Failed to delete consent data' });
  }
} 