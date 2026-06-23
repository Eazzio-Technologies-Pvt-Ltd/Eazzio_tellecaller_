// API Base URL configuration
// In development, Vite proxy handles /api/* -> localhost:5000
// In production, we use the Render backend URL as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://eazzio-tellecaller.onrender.com');

export default API_BASE_URL;
