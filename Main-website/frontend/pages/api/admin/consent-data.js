import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const adminDir = path.join(process.cwd(), 'public', 'admin');
  const consentFile = path.join(adminDir, 'consent_data.json');

  // Ensure the admin directory exists
  if (!fs.existsSync(adminDir)) {
    fs.mkdirSync(adminDir, { recursive: true });
  }

  if (req.method === 'GET') {
    try {
      // Read existing data if it exists
      let existingData = [];
      if (fs.existsSync(consentFile)) {
        const fileContent = fs.readFileSync(consentFile, 'utf8');
        existingData = JSON.parse(fileContent);
      }
      
      return res.status(200).json(existingData);
    } catch (error) {
      console.error('Error reading consent data:', error);
      return res.status(500).json({ error: 'Failed to read consent data' });
    }
  } else if (req.method === 'POST') {
    try {
      const consentData = req.body;
      
      // Read existing data if it exists
      let existingData = [];
      if (fs.existsSync(consentFile)) {
        const fileContent = fs.readFileSync(consentFile, 'utf8');
        existingData = JSON.parse(fileContent);
      }
      
      // Check if user already exists in the data
      const existingIndex = existingData.findIndex(data => data.userId === consentData.userId);
      
      if (existingIndex !== -1) {
        // Update existing entry
        existingData[existingIndex] = {
          ...consentData,
          receivedAt: new Date().toISOString()
        };
      } else {
        // Add new entry
        existingData.push({
          ...consentData,
          receivedAt: new Date().toISOString()
        });
      }
      
      // Save updated data
      fs.writeFileSync(consentFile, JSON.stringify(existingData, null, 2));
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving consent data:', error);
      return res.status(500).json({ error: 'Failed to save consent data' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 