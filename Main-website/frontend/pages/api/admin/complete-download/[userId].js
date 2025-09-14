// pages/api/admin/complete-download/[userId].js
import { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend_auth_service:8108';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID is required' 
    });
  }

  try {
    // First check if user has complete data
    const checkResponse = await fetch(`${BACKEND_URL}/api/admin/download/check-complete-data/${userId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const checkData = await checkResponse.json();

    if (!checkData.has_data) {
      return res.status(404).json({
        success: false,
        message: checkData.message || "No complete data available for this user",
        hasData: false
      });
    }

    // If user has complete data, proceed with download
    const downloadResponse = await fetch(`${BACKEND_URL}/api/admin/download/download-complete-data/${userId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!downloadResponse.ok) {
      const errorData = await downloadResponse.json().catch(() => ({}));
      return res.status(downloadResponse.status).json({
        success: false,
        message: errorData.message || 'Failed to download complete data',
        hasData: true
      });
    }

    // Get the zip file content
    const zipBuffer = await downloadResponse.arrayBuffer();
    const zipData = Buffer.from(zipBuffer);

    // Get filename from response headers
    const contentDisposition = downloadResponse.headers.get('content-disposition');
    let filename = `user_${userId}_complete_data.zip`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipData.length);

    // Send the zip file
    res.send(zipData);

  } catch (error) {
    console.error('Error in complete-download API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process complete data download request'
    });
  }
}
