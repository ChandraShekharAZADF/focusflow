// FocusFlow Extension Configuration
// Switch between development and production API URLs

const CONFIG = {
  // Change this to your deployed API URL for production
  // e.g., "https://focusflow-api.onrender.com"
  BASE_URL: "http://localhost:3001",

  // API endpoints
  get API_URL() {
    return `${this.BASE_URL}/api`;
  },
  get LOGIN_URL() {
    return `${this.API_URL}/auth/login`;
  },
  get EVENTS_URL() {
    return `${this.API_URL}/events`;
  },
  get REMINDERS_URL() {
    return `${this.API_URL}/reminders`;
  },
};
