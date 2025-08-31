// pages/api/consent-init/check-user/[userId].js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL;
    
    // Make request to backend
    const response = await fetch(`${backendUrl}/consent/check-user/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
                 'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
      }
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
      const userData = data.data.user_data;
      const consentData = data.data.consent_data;
      
      if (userData) {
        // User is initialized with DataCenter format
        const profile = userData.profile || {};
        const settings = userData.settings || {};
        
        return res.status(200).json({
          success: true,
          data: {
            user_id: userId,
            is_initialized: data.data.is_initialized,
            has_user_data: data.data.has_user_data,
            has_consent_data: data.data.has_consent_data,
            user_data: {
              profile: {
                username: profile.username || "",
                email: "test@example.com", // Default email
                sex: profile.sex || "",
                age: profile.age || "",
                night_mode: profile.night_mode || false
              },
              settings: {
                times_set_random: settings.times_set_random || 1,
                delay_set_random: settings.delay_set_random || 3,
                run_every_of_random: settings.run_every_of_random || 1,
                set_timeRandomImage: settings.set_timeRandomImage || 1,
                times_set_calibrate: settings.times_set_calibrate || 1,
                every_set: settings.every_set || 0,
                zoom_percentage: settings.zoom_percentage || 150,
                position_zoom: settings.position_zoom || [0, 0],
                currentlyPage: settings.currentlyPage || "home",
                state_isProcessOn: settings.state_isProcessOn || false,
                freeState: settings.freeState || 0,
                buttons_order: settings.buttons_order || "",
                order_click: settings.order_click || "",
                image_background_paths: settings.image_background_paths || ["/backgrounds/one.jpg"],
                public_data_access: settings.public_data_access || false,
                enable_background_change: settings.enable_background_change || false
              }
            },
            consent_data: consentData
          }
        });
      } else {
        // User not initialized
        return res.status(200).json({
          success: true,
          data: {
            user_id: userId,
            is_initialized: false,
            has_user_data: false,
            has_consent_data: data.data.has_consent_data,
            user_data: null,
            consent_data: consentData
          }
        });
      }
    }
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error checking user initialization:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
