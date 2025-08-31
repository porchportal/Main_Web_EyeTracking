// pages/api/consent-init/update-user-profile/[userId].js
export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;
    const { username, sex, age, night_mode } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL;
    
    // Make request to backend
    const response = await fetch(`${backendUrl}/consent/update-user-profile/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
                 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
      },
      body: JSON.stringify({
        username: username || "",
        sex: sex || "",
        age: age || "",
        night_mode: night_mode || false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return res.status(response.status).json({ 
        error: 'Backend request failed',
        details: errorText
      });
    }

    const data = await response.json();
    
    // Transform the response to match the expected frontend format
    if (data.success && data.data) {
      const profile = data.data.profile;
      return res.status(200).json({
        success: true,
        data: {
          user_id: userId,
          profile: {
            username: profile.username || "",
            email: "test@example.com", // Default email
            sex: profile.sex || "",
            age: profile.age || "",
            night_mode: profile.night_mode || false
          },
          message: data.message || "Profile updated successfully"
        }
      });
    }
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
