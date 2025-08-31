export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get the backend URL and API key from environment variables
          const backendUrl = process.env.BACKEND_URL;
      const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    // Fetch user images from the backend
    const response = await fetch(`${backendUrl}/api/canvas-admin/user-images/${userId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user images: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch user images');
    }

    // Return the user images data
    res.status(200).json({
      success: true,
      user_id: userId,
      images: data.images || [],
      image_count: data.image_count || 0
    });

  } catch (error) {
    console.error('Error fetching canvas images:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch canvas images'
    });
  }
}
