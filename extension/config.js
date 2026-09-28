// FocusFlow Extension Configuration
// Switch between development and production API URLs

const CONFIG = {
  // Live deployed API URL on Render
  BASE_URL: "https://focusflow-78ni.onrender.com",

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
