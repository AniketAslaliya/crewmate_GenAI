// Axios/axios.js
import axios from "axios";
import useAuthStore from "../context/AuthContext"; // adjust path if needed

// API for the main backend
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000',
  withCredentials: true,
});

// Add interceptor to inject token automatically
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token; // get token directly from zustand
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No token found in auth store for request:', config.url);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized request:', error.config?.url);
      // Optionally redirect to login or refresh token
      // useAuthStore.getState().logout();
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);



export default api; // Default export
