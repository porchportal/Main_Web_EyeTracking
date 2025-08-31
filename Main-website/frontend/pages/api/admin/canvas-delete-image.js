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

    // Call the backend canvas admin service to delete the image
    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:8000'}/api/canvas-admin/image/${userId}/${imagePath}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'your-api-key-here'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Backend delete error:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Image not found or already deleted' 
        });
      }
      
      throw new Error(`Backend error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    return res.status(200).json({
      success: true,
      message: result.message || 'Image deleted successfully',
      deletedImage: result.deleted_image
    });

  } catch (error) {
    console.error('Error deleting canvas image:', error);
    return res.status(500).json({ 
      error: 'Failed to delete image',
      details: error.message 
    });
  }
}
