import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const consentData = req.body;
    const publicDir = path.join(process.cwd(), 'public');
    const consentDir = path.join(publicDir, 'consent');
    
    // Ensure the consent directory exists
    if (!fs.existsSync(consentDir)) {
      fs.mkdirSync(consentDir, { recursive: true });
    }
    
    // Save the consent data
    const filePath = path.join(consentDir, `consent_${consentData.userId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(consentData, null, 2));
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving consent data:', error);
    return res.status(500).json({ error: 'Failed to save consent data' });
  }
} 