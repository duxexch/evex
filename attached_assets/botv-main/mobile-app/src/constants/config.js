// API configuration
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api/v1' 
  : 'https://api.langsense.com/api/v1';  // ⚠️ CHANGE THIS TO YOUR PRODUCTION DOMAIN

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  ME: '/auth/me',
  
  // User
  PROFILE: '/users/profile',
  
  // Financial
  DEPOSIT: '/financial/deposit',
  WITHDRAW: '/financial/withdraw',
  COMPLAINT: '/financial/complaint',
  TRANSACTIONS: '/financial/transactions',
  
  // Settings
  LANGUAGES: '/settings/languages',
  COUNTRIES: '/settings/countries',
  
  // Admin
  ADMIN_STATS: '/admin/stats',
  ADMIN_USERS: '/admin/users',
  ADMIN_BROADCAST: '/admin/broadcast',
  ADMIN_REQUESTS: '/admin/requests',
};

// App configuration
export const APP_CONFIG = {
  DEFAULT_LANGUAGE: 'ar',
  DEFAULT_COUNTRY: 'SA',
  SUPPORTED_LANGUAGES: ['ar', 'en'],
};
