// ga-frontend/src/pages/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import logoImg from '../assets/logo.png';

interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email: email,
        password: password
      });

      // 🚀 YENİ NESİL KORUMA: JWT Token kaydediliyor
      localStorage.setItem('token', response.data.token);
      
      // 🚀 GERİYE DÖNÜK UYUMLULUK FIX: Eski sayfaların login'e fırlatmasını engellemek için set ediyoruz!
      localStorage.setItem('isAuthenticated', 'true');
      
      localStorage.setItem('user', JSON.stringify({
        username: response.data.username,
        fullName: response.data.fullName
      }));

      navigate('/');
    } catch (err) {
      const axiosError = err as AxiosErrorResponse;
      setError(axiosError.response?.data?.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        
        <div className="flex flex-col items-center mb-8">
          <img src={logoImg} alt="Görev Adamı" className="w-24 h-24 object-contain mb-4" />
          <h1 className="text-2xl font-extrabold text-brand-navy">Sisteme Giriş Yap</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Lütfen e-posta ve şifrenizi giriniz.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-semibold text-center animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">E-posta Adresi</label>
            <input
              type="email"
              required
              autoComplete="username" 
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none transition-all text-sm"
              placeholder="admin@theobuz.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Şifre</label>
            <input
              type="password"
              required
              autoComplete="current-password" 
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none transition-all text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md shadow-blue-200 mt-4 flex justify-center items-center"
          >
            {isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}