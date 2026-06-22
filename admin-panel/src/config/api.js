// API Base URL configuration
// In development, Vite proxy handles /api/* -> localhost:5000
// In production, we need the full Render backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export default API_BASE_URL;
