// ga-frontend/src/services/api.ts

import axios from 'axios';

// Backend projenizin çalıştığı adresi buraya yazıyoruz (Genelde localhost:5000 veya benzeri olur)
const api = axios.create({
  baseURL: 'http://localhost:5112/api', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Araya Girici (Interceptor): Her HTTP isteği gitmeden önce çalışır
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Token'ı tarayıcı hafızasından al
    if (token) {
      config.headers.Authorization = `Bearer ${token}`; // Backend'in beklediği formata ekle
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;