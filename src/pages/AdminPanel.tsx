// ga-frontend/src/pages/AdminPanel.tsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface TenantLookup {
  id: string;
  name: string;
}

// 🚀 LINTER GÜVENLİK FIX: Hata yakalama (catch) bloklarındaki 'any' yasağını delmek için güvenli kontrat
interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function AdminPanel() {
  const [tenants, setTenants] = useState<TenantLookup[]>([]);
  const [activeTab, setActiveTab] = useState<'tenant' | 'project' | 'team'>('tenant');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State'leri
  const [tenantForm, setTenantForm] = useState({ name: '', taxNumber: '' });
  const [projectForm, setProjectForm] = useState({ name: '', tenantId: '' });
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', fullName: '', phoneNumber: '', tenantId: '' });

  // 🚀 REVIZYON 1: Senkron zincirleme render uyarısını ve hafıza sızıntılarını (race condition) engelleyen zırhlı useEffect
  useEffect(() => {
    let isMounted = true;

    const loadTenantsData = async () => {
      try {
        const res = await api.get('/superadmin/tenants');
        if (isMounted) {
          setTenants(res.data);
        }
      } catch (err) {
        console.error("Firmalar yüklenemedi", err);
      }
    };

    loadTenantsData();

    // Temizleme fonksiyonu: Sayfa kapanırsa veya yeniden tetiklenirse asenkron state güncellemelerini güvenle keser
    return () => {
      isMounted = false;
    };
  }, []);

  // Yeniden yükleme gerektiğinde çağrılacak asenkron tetikleyici
  const reloadTenantsList = async () => {
    try {
      const res = await api.get('/superadmin/tenants');
      setTenants(res.data);
    } catch (err) {
      console.error("Firmalar yenilenemedi", err);
    }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/superadmin/tenants', tenantForm);
      showMsg('success', 'Firma başarıyla oluşturuldu!');
      setTenantForm({ name: '', taxNumber: '' });
      await reloadTenantsList();
    } catch (err) {
      // 🚀 REVIZYON 2: 'any' yerine TypeScript uyumlu tip ataması gerçekleştirildi
      const error = err as AxiosErrorResponse;
      showMsg('error', error.response?.data?.message || 'Firma eklenirken bir hata oluştu.');
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/superadmin/projects', projectForm);
      showMsg('success', 'Proje ilgili firmaya başarıyla eklendi!');
      setProjectForm({ name: '', tenantId: '' });
    } catch (err) {
      // 🚀 REVIZYON 2: 'any' yerine TypeScript uyumlu tip ataması gerçekleştirildi
      const error = err as AxiosErrorResponse;
      showMsg('error', error.response?.data?.message || 'Proje eklenirken bir hata oluştu.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/superadmin/users', userForm);
      showMsg('success', 'Kullanıcı/Ekip ilgili firmaya başarıyla eklendi!');
      setUserForm({ username: '', email: '', password: '', fullName: '', phoneNumber: '', tenantId: '' });
    } catch (err) {
      // 🚀 REVIZYON 2: 'any' yerine TypeScript uyumlu tip ataması gerçekleştirildi
      const error = err as AxiosErrorResponse;
      showMsg('error', error.response?.data?.message || 'Kullanıcı eklenirken bir hata oluştu.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
      <div className="border-b border-slate-200 pb-4 mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Sistem Yönetim Paneli (Super Admin)</h1>
        <p className="text-sm text-slate-500 mt-1">Yeni kiracı firmalar, kurumsal projeler ve ekipler bu ekrandan global olarak yönetilir.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 font-semibold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {message.text}
        </div>
      )}

      {/* Sekme Butonları */}
      <div className="flex space-x-2 bg-slate-100 p-1.5 rounded-xl mb-8">
        <button onClick={() => setActiveTab('tenant')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'tenant' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>🏢 Firma Ekle</button>
        <button onClick={() => setActiveTab('project')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'project' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>📁 Firmaya Proje Tanımla</button>
        <button onClick={() => setActiveTab('team')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>👥 Firmaya Ekip/User Ekle</button>
      </div>

      {/* TAB 1: FIRMA EKLEME */}
      {activeTab === 'tenant' && (
        <form onSubmit={handleCreateTenant} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Firma / Şkapak Şirket Adı</label>
              <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm focus:ring-2 focus:ring-blue-500" placeholder="Örn: Trugo Şarj A.Ş." value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Vergi Numarası</label>
              <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm focus:ring-2 focus:ring-blue-500" placeholder="10 haneli vergi no" value={tenantForm.taxNumber} onChange={e => setTenantForm({ ...tenantForm, taxNumber: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-colors text-sm">Firmayı Kaydet</button>
        </form>
      )}

      {/* TAB 2: PROJE EKLEME */}
      {activeTab === 'project' && (
        <form onSubmit={handleCreateProject} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">İlgili Firma (Kiracı)</label>
              <select required className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500" value={projectForm.tenantId} onChange={e => setProjectForm({ ...projectForm, tenantId: e.target.value })}>
                <option value="">Firma Seçiniz...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Proje Adı</label>
              <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm focus:ring-2 focus:ring-blue-500" placeholder="Örn: İstanbul Akıllı İstasyon Kurulumu" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-colors text-sm">Projeyi Tanımla</button>
        </form>
      )}

      {/* TAB 3: USER EKLEME */}
      {activeTab === 'team' && (
        <form onSubmit={handleCreateUser} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Hedef Firma (Kiracı)</label>
            <select required className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white outline-none text-sm focus:ring-2 focus:ring-blue-500" value={userForm.tenantId} onChange={e => setUserForm({ ...userForm, tenantId: e.target.value })}>
              <option value="">Firma Seçiniz...</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Kullanıcı Adı (Username)</label>
              <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm" placeholder="utkuobuz" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">E-Posta Adresi</label>
              <input type="email" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm" placeholder="utku@yesilpano.com" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Adı Soyadı</label>
              <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm" placeholder="Utku Obuz" value={userForm.fullName} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Telefon Numarası</label>
              <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm" placeholder="0555..." value={userForm.phoneNumber} onChange={e => setUserForm({ ...userForm, phoneNumber: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Giriş Şifresi</label>
              <input type="password" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm" placeholder="••••••••" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-colors text-sm">Kullanıcıyı Firmaya Bağla</button>
        </form>
      )}
    </div>
  );
}