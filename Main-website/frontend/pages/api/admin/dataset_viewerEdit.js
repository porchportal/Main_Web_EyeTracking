// dataset_viewer&Edit.js - Admin dataset viewing and editing API
import { verifyAdminToken } from '../../../utils/auth';

export default async function handler(req, res) {
  // Verify admin authentication
  const authResult = await verifyAdminToken(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { method, query, body } = req;
  const { user_id, dataset_id, filename } = query;

  try {
    switch (method) {
      case 'GET':
        if (user_id && filename) {
          // Get specific file from dataset
          return await getDatasetFile(req, res, user_id, filename);
        } else if (user_id) {
          // Get datasets for specific user
          return await getUserDatasets(req, res, user_id);
        } else {
          // Get datasets for all users
          return await getAllDatasets(req, res);
        }

      case 'DELETE':
        if (user_id && dataset_id) {
          // Delete specific dataset
          return await deleteDataset(req, res, user_id, dataset_id);
        } else if (user_id) {
          // Delete all datasets for user
          return await deleteUserAllDatasets(req, res, user_id);
        } else {
          return res.status(400).json({ error: 'Missing user_id parameter' });
        }

      default:
        res.setHeader('Allow', ['GET', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Dataset API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserDatasets(req, res, userId) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    console.log('🔍 Frontend API - getUserDatasets called');
    console.log('📁 User ID:', userId);
    console.log('🌐 Backend URL:', backendUrl);
    console.log('🔑 API Key set:', !!apiKey);

    if (!backendUrl) {
      console.error('❌ NEXT_PUBLIC_API_URL not set');
      return res.status(500).json({ error: 'Backend URL not configured' });
    }

    if (!apiKey) {
      console.error('❌ NEXT_PUBLIC_API_KEY not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const backendEndpoint = `${backendUrl}/api/admin/dataset/user/${userId}`;
    console.log('🌐 Calling backend endpoint:', backendEndpoint);

    const response = await fetch(backendEndpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Backend response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('❌ Backend error:', errorData);
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    console.log('✅ Datasets loaded successfully:', data);
    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Error fetching user datasets:', error);
    return res.status(500).json({ error: 'Failed to fetch user datasets', details: error.message });
  }
}

async function getAllDatasets(req, res) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    const response = await fetch(`${backendUrl}/api/admin/dataset/all`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching all datasets:', error);
    return res.status(500).json({ error: 'Failed to fetch all datasets' });
  }
}

async function getDatasetFile(req, res, userId, filename) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    console.log('🔍 Frontend API - getDatasetFile called');
    console.log('📁 User ID:', userId);
    console.log('📁 Filename:', filename);
    console.log('🌐 Backend URL:', backendUrl);
    console.log('🔑 API Key set:', !!apiKey);

    if (!backendUrl) {
      console.error('❌ NEXT_PUBLIC_API_URL not set');
      return res.status(500).json({ error: 'Backend URL not configured' });
    }

    if (!apiKey) {
      console.error('❌ NEXT_PUBLIC_API_KEY not set');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const backendEndpoint = `${backendUrl}/api/admin/dataset/file/${userId}/${filename}`;
    console.log('🌐 Calling backend endpoint:', backendEndpoint);

    const response = await fetch(backendEndpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    console.log('📡 Backend response status:', response.status);
    console.log('📡 Backend response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      console.error('❌ Backend error:', errorData);
      return res.status(response.status).json(errorData);
    }

    // Forward the file response
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    console.log('✅ File loaded successfully, size:', buffer.byteLength, 'bytes');
    console.log('✅ Content type:', contentType);
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('❌ Error fetching dataset file:', error);
    return res.status(500).json({ error: 'Failed to fetch dataset file', details: error.message });
  }
}

async function deleteDataset(req, res, userId, datasetId) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    const response = await fetch(`${backendUrl}/api/admin/dataset/user/${userId}/dataset/${datasetId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting dataset:', error);
    return res.status(500).json({ error: 'Failed to delete dataset' });
  }
}

async function deleteUserAllDatasets(req, res, userId) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY ;

    const response = await fetch(`${backendUrl}/api/admin/dataset/user/${userId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error deleting user all datasets:', error);
    return res.status(500).json({ error: 'Failed to delete user datasets' });
  }
}
