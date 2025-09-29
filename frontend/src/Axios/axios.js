// Axios/axios.js
import axios from "axios";
import useAuthStore from "../context/AuthContext"; // adjust path if needed

// API for the main backend
const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL,
  withCredentials: true,
});

// Add interceptor to inject token automatically
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token; // get token directly from zustand
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);



export default api; // Default export
