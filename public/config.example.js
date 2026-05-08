// Copy this file to public/config.js to override the API URL at deploy time
// without rebuilding. localStorage["conquest.apiUrl"] still takes precedence,
// and the in-app settings UI on the login screen writes to localStorage.
window.__CONQUEST_CONFIG__ = {
  apiUrl: "http://localhost:8000",
  devLogin: true,
  googleClientId: "", // set if you want Google Sign-In on this build
};
