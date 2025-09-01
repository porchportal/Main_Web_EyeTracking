export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, imagePath } = req.body;

    if (!userId || !imagePath) {
      return res.status(400).json({ 
        error: 'User ID and image path are required' 
      });
    }

    // Get environment variables
    const backendUrl = process.env.BACKEND_URL;
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;

    if (!backendUrl) {
      console.error('BACKEND_URL environment variable is not set');
      return res.status(500).json({ 
        error: 'Backend URL not configured' 
      });
    }

    if (!apiKey) {
      console.error('NEXT_PUBLIC_API_KEY environment variable is not set');
      return res.status(500).json({ 
        error: 'API key not configured' 
      });
    }

    // URL encode the image path to handle special characters
    const encodedImagePath = encodeURIComponent(imagePath);
    
    console.log('Environment check:', {
      BACKEND_URL: backendUrl ? 'Set' : 'Not set',
      API_KEY: apiKey ? 'Set' : 'Not set'
    });
    
    console.log('Deleting canvas image:', {
      userId,
      imagePath,
      encodedImagePath,
      backendUrl: `${backendUrl}/api/canvas-admin/image/${userId}/${encodedImagePath}`
    });

    // Call the backend canvas admin service to delete the image
    const response = await fetch(`${backendUrl}/api/canvas-admin/image/${userId}/${encodedImagePath}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });

    console.log('Backend response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        errorData = { error: 'Failed to parse error response' };
      }

      console.error('Backend delete error:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        backendUrl,
        userId,
        imagePath
      });
      
      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Image not found or already deleted' 
        });
      }
      
      throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorData.detail || errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    
    console.log('Successfully deleted image:', {
      userId,
      imagePath,
      result
    });
    
    return res.status(200).json({
      success: true,
      message: result.message || 'Image deleted successfully',
      deletedImage: result.deleted_image,
      remainingImages: result.remaining_images
    });

  } catch (error) {
    console.error('Error deleting canvas image:', error);
    return res.status(500).json({ 
      error: 'Failed to delete image',
      details: error.message 
    });
  }
}
