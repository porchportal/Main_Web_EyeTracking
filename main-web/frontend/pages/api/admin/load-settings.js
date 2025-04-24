import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;
    const settingsPath = path.join(process.cwd(), 'public', 'admin', 'capture_settings.json');

    let settings = {
      times: 1,
      delay: 3
    };

    if (fs.existsSync(settingsPath)) {
      const fileContent = fs.readFileSync(settingsPath, 'utf8');
      const allSettings = JSON.parse(fileContent);
      if (allSettings[userId]) {
        settings = allSettings[userId];
      }
    }

    return res.status(200).json(settings);
  } catch (error) {
    console.error('Error loading settings:', error);
    return res.status(500).json({ error: 'Failed to load settings' });
  }
} 