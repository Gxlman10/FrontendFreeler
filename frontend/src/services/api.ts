import axios, { AxiosError } from 'axios';
import { STORAGE_KEYS } from '@/utils/constants';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let token: string | null =
  typeof window !== 'undefined'
    ? localStorage.getItem(STORAGE_KEYS.token)
    : null;

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (!config.headers) config.headers = {};
  const headerToken = token ?? localStorage.getItem(STORAGE_KEYS.token);
  if (headerToken) {
    config.headers.Authorization = `Bearer ${headerToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
    }
    return Promise.reject(error);
  },
);

export const setAuthToken = (nextToken: string | null) => {
  token = nextToken;
  if (nextToken) {
    localStorage.setItem(STORAGE_KEYS.token, nextToken);
  } else {
    localStorage.removeItem(STORAGE_KEYS.token);
  }
};
