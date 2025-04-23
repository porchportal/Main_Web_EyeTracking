import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const settings = req.body;
    const settingsPath = path.join(process.cwd(), 'public', 'admin', 'capture_settings.json');
    const dirPath = path.dirname(settingsPath);

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Save settings to file
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
} 