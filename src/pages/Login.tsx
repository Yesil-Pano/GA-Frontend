// ga-frontend/src/pages/Login.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import logoImg from '../assets/logo.png';
import { saveAuthProfileFromLogin, saveAuthProfileFromMeResponse } from '../utils/authSession';
import {
  getRememberMePreference,
  saveSessionTokens,
} from '../utils/sessionTokens';

interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
      Message?: string;
    };
  };
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
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
        password: password,
      });

      saveSessionTokens(
        response.data.token,
        response.data.refreshToken ?? null,
        rememberMe,
      );

      saveAuthProfileFromLogin({
        userId: response.data.userId,
        username: response.data.username,
        fullName: response.data.fullName,
        roles: response.data.roles ?? [],
      });

      try {
        const meRes = await api.get('/users/me');
        saveAuthProfileFromMeResponse(meRes.data);
      } catch {
        /* JWT + login yanıtı yeterli; profil sonraki istekte güncellenir */
      }

      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify({
        username: response.data.username,
        fullName: response.data.fullName,
      }));

      navigate('/');
    } catch (err) {
      const axiosError = err as AxiosErrorResponse;
      setError(
        axiosError.response?.data?.message
          || axiosError.response?.data?.Message
          || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.',
      );
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
          <p className="text-sm text-slate-500 mt-2 font-medium">E-posta veya kullanıcı adı ve şifrenizi giriniz.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-semibold text-center animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">E-posta veya Kullanıcı Adı</label>
            <input
              type="text"
              required
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none transition-all text-sm"
              placeholder="ornek@sirket.com veya kullaniciadi"
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="ga-checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span className="text-sm font-medium text-slate-600">Beni Hatırla</span>
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md shadow-blue-200 mt-2 flex justify-center items-center"
          >
            {isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
