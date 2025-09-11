// Cookie Reset Command for Browser Console
// Copy and paste this into your browser's developer console (F12)

// Method 1: Clear specific consent cookies
document.cookie = 'eye_tracking_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
document.cookie = 'consent_details=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
document.cookie = 'user_profile=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
document.cookie = 'user_preferences=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
console.log('✅ Consent cookies cleared successfully');
window.location.reload();

// Method 2: Clear all cookies (more aggressive)
// Uncomment the lines below if you want to clear ALL cookies:
/*
Object.keys(document.cookie.split(';').reduce((cookies, cookie) => {
  const [name, value] = cookie.trim().split('=');
  cookies[name] = value;
  return cookies;
}, {})).forEach(name => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
});
console.log('✅ All cookies cleared');
window.location.reload();
*/

