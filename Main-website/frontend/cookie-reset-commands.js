// Cookie Reset Command
// Run this in your browser console to reset consent cookies:

// Method 1: Using the resetConsentBanner function
if (typeof window !== 'undefined' && window.resetConsentBanner) {
  window.resetConsentBanner();
  console.log('Cookies reset via resetConsentBanner function');
} else {
  // Method 2: Manual cookie clearing
  document.cookie = 'eye_tracking_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'consent_details=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'user_profile=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'user_preferences=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  console.log('Cookies manually cleared');
  // Reload the page to trigger consent banner
  window.location.reload();
}

// Method 3: Clear all cookies (more aggressive)
// Object.keys(document.cookie.split(';').reduce((cookies, cookie) => {
//   const [name, value] = cookie.trim().split('=');
//   cookies[name] = value;
//   return cookies;
// }, {})).forEach(name => {
//   document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
// });
// console.log('All cookies cleared');
// window.location.reload();

