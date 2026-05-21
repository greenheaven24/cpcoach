import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
});

if (typeof window !== 'undefined') {
  const token = localStorage.getItem('cpcoach_token');
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}
