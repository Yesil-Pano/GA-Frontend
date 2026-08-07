// ga-frontend/src/pages/AdminPanel.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatTurkeyDateTime } from '../utils/dateTime';
import PageLoading from '../components/PageLoading';

interface TenantLookup {
  id: string;
  name: string;
  taxNumber?: string | null;
  isActive?: boolean;
  isDemo?: boolean;
  demoExpiresAt?: string | null;
  isDemoExpired?: boolean;
  createdAt?: string;
}

interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
      Message?: string;
    };
  };
}

const DEMO_DURATIONS = [
  { value: 'OneWeek', label: 'Bir Hafta' },
  { value: 'FifteenDays', label: '15 Gün' },
  { value: 'OneMonth', label: 'Bir Ay' },
] as const;

export default function AdminPanel() {
  const [tenants, setTenants] = useState<TenantLookup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tenant' | 'project'>('tenant');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [tenantForm, setTenantForm] = useState({
    name: '',
    taxNumber: '',
    isDemo: false,
    demoDuration: 'OneWeek' as string,
  });
  const [projectForm, setProjectForm] = useState({ name: '', tenantId: '' });
  const [extendDurationByTenant, setExtendDurationByTenant] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const loadTenantsData = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/superadmin/tenants');
        if (isMounted) setTenants(res.data);
      } catch (err) {
        console.error('Firmalar yüklenemedi', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadTenantsData();
    return () => { isMounted = false; };
  }, []);

  const reloadTenantsList = async () => {
    try {
      const res = await api.get('/superadmin/tenants');
      setTenants(res.data);
    } catch (err) {
      console.error('Firmalar yenilenemedi', err);
    }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const errMsg = (err: unknown) => {
    const error = err as AxiosErrorResponse;
    return error.response?.data?.message || error.response?.data?.Message || 'İşlem başarısız.';
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: tenantForm.name,
        taxNumber: tenantForm.taxNumber,
        isDemo: tenantForm.isDemo,
        demoDuration: tenantForm.isDemo ? tenantForm.demoDuration : null,
      };
      const { data } = await api.post('/superadmin/tenants', payload);
      showMsg('success', data.message || 'Firma başarıyla oluşturuldu!');
      setTenantForm({ name: '', taxNumber: '', isDemo: false, demoDuration: 'OneWeek' });
      await reloadTenantsList();
    } catch (err) {
      showMsg('error', errMsg(err));
    }
  };

  const handleClearDemo = async (tenantId: string) => {
    if (!window.confirm('DEMO süresi kaldırılsın mı? Firma kalıcı erişime geçer.')) return;
    try {
      const { data } = await api.post(`/superadmin/tenants/${tenantId}/clear-demo`);
      showMsg('success', data.message || 'DEMO kaldırıldı.');
      await reloadTenantsList();
    } catch (err) {
      showMsg('error', errMsg(err));
    }
  };

  const handleExtendDemo = async (tenantId: string) => {
    const demoDuration = extendDurationByTenant[tenantId] || 'OneWeek';
    try {
      const { data } = await api.post(`/superadmin/tenants/${tenantId}/extend-demo`, { demoDuration });
      showMsg('success', data.message || 'DEMO uzatıldı.');
      await reloadTenantsList();
    } catch (err) {
      showMsg('error', errMsg(err));
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/superadmin/projects', projectForm);
      showMsg('success', 'Proje ilgili firmaya başarıyla eklendi!');
      setProjectForm({ name: '', tenantId: '' });
    } catch (err) {
      showMsg('error', errMsg(err));
    }
  };

  if (isLoading) {
    return <PageLoading className="absolute inset-0 z-20 min-h-0 h-full" />;
  }

  return (    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
      <div className="border-b border-slate-200 pb-4 mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Sistem Yönetim Paneli (Super Admin)</h1>
        <p className="text-sm text-slate-500 mt-1">Yeni kiracı firmalar ve kurumsal projeler bu ekrandan yönetilir. Kullanıcı/rol işlemleri Kullanıcı Yönetimi sayfasındadır.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 font-semibold text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-blue-900">Kullanıcı ve rol yönetimi taşındı</p>
          <p className="text-xs text-blue-800/80 mt-1">Firma ataması, rol seçimi ve saha/ofis kullanıcıları artık Kullanıcı Yönetimi ekranından yapılır.</p>
        </div>
        <Link
          to="/users"
          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm text-center transition-colors"
        >
          Kullanıcı Yönetimine Git
        </Link>
      </div>

      <div className="flex space-x-2 bg-slate-100 p-1.5 rounded-xl mb-8">
        <button type="button" onClick={() => setActiveTab('tenant')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'tenant' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>🏢 Firma Ekle</button>
        <button type="button" onClick={() => setActiveTab('project')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'project' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>📁 Firmaya Proje Tanımla</button>
      </div>

      {activeTab === 'tenant' && (
        <div className="space-y-8">
          <form onSubmit={handleCreateTenant} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Firma / Şahıs Şirket Adı</label>
                <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm focus:ring-2 focus:ring-blue-500" placeholder="Örn: Trugo Şarj A.Ş." value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Vergi Numarası</label>
                <input type="text" required className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none text-sm focus:ring-2 focus:ring-blue-500" placeholder="10 haneli vergi no" value={tenantForm.taxNumber} onChange={e => setTenantForm({ ...tenantForm, taxNumber: e.target.value })} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="ga-checkbox ga-checkbox-accent-blue"
                  checked={tenantForm.isDemo}
                  onChange={(e) => setTenantForm({ ...tenantForm, isDemo: e.target.checked })}
                />
                <span className="text-sm font-bold text-slate-800">DEMO firma</span>
              </label>
              <p className="text-[11px] text-slate-500 font-medium pl-7">
                İşaretlenirse süre sonunda web ve mobil erişim otomatik kapanır. Süre, kayıt anından başlar.
              </p>
              {tenantForm.isDemo && (
                <div className="pl-7 flex flex-wrap gap-2">
                  {DEMO_DURATIONS.map((d) => (
                    <label
                      key={d.value}
                      className={`cursor-pointer text-xs font-bold px-3 py-2 rounded-lg border transition ${
                        tenantForm.demoDuration === d.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="demoDuration"
                        className="sr-only"
                        checked={tenantForm.demoDuration === d.value}
                        onChange={() => setTenantForm({ ...tenantForm, demoDuration: d.value })}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-colors text-sm">Firmayı Kaydet</button>
          </form>

          <div>
            <h3 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wide">Kayıtlı Firmalar</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {tenants.map((t) => (
                <div key={t.id} className="border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-white">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">{t.name}</p>
                      {t.isDemo ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.isDemoExpired ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                          {t.isDemoExpired ? 'DEMO SÜRESİ DOLDU' : 'DEMO'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">KALICI</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t.isDemo && t.demoExpiresAt ? `Bitiş: ${formatTurkeyDateTime(t.demoExpiresAt)}` : 'Demo yok'}
                    </p>
                  </div>
                  {t.isDemo && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"
                        value={extendDurationByTenant[t.id] || 'OneWeek'}
                        onChange={(e) => setExtendDurationByTenant((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      >
                        {DEMO_DURATIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleExtendDemo(t.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600">
                        Uzat
                      </button>
                      <button type="button" onClick={() => handleClearDemo(t.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                        DEMO Kaldır
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {tenants.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">Henüz firma yok.</p>
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
