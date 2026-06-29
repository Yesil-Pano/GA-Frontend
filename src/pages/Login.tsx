import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Logomuzu daha önce buraya eklemiştik
import logoImg from '../assets/logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Backend entegrasyonu
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        
        {/* KURUMSAL LOGO ALANI */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoImg} alt="Görev Adamı" className="w-24 h-24 object-contain mb-4" />
          <h1 className="text-2xl font-extrabold text-brand-navy">Sisteme Giriş Yap</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Lütfen e-posta ve şifrenizi giriniz.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">E-posta Adresi</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none transition-all text-sm"
              placeholder="admin@yesilpano.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Şifre</label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none transition-all text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md shadow-blue-200 mt-4"
          >
            Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
}