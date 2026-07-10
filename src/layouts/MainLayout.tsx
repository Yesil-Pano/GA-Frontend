// ga-frontend/src/layouts/MainLayout.tsx
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import MapView from '../components/MapView';
import type { MapMarker } from '../components/MapView';
import api from '../services/api';
import { formatTurkeyDateTime } from '../utils/dateTime';
import logoImg from '../assets/logo.png';

const Logo = ({ isExpanded }: { isExpanded: boolean }) => (
  <div className="flex items-center h-20 border-b border-brand-navy-light px-5 overflow-hidden whitespace-nowrap">
    <img src={logoImg} alt="Görev Adamı Logo" className="w-10 h-10 min-w-10 object-contain transition-transform duration-300" />
    <div className={`flex flex-col ml-3 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
      <h1 className="text-xl font-bold tracking-wider text-white leading-tight">GÖREV ADAMI</h1>
      <p className='text-[8px] text-brand-orange uppercase tracking-wider font-semibold'>Yeşil Pano Ayak İzi</p>
    </div>
  </div>
);

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [focusedMarkerPosition, setFocusedMarkerPosition] = useState<[number, number] | null>(null);
  const [mapFilter, setMapFilter] = useState('Tümü');
  const [liveMarkers, setLiveMarkers] = useState<MapMarker[]>([]);

  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false);
  const [activePartner, setActivePartner] = useState({
    name: 'Trugo Şarj İstasyonları', letter: 'T'
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notifications = [
    { id: 1, text: "🔔 Trugo sisteminden yeni bir otomatik periyodik iş açıldı!", time: "Şimdi" },
    { id: 2, text: "👷 Utku Obuz ekibi Yeşil Pano Projesi konumuna ulaştı.", time: "10 dk önce" },
    { id: 3, text: "📍 Ankara merkez istasyon altyapı statüsü güncellendi.", time: "1 saat önce" }
  ];

  interface BackendWorkOrderResponse {
    id: string; title: string; customerName: string; priority: string; status: string;
    type: string; description: string; plannedDate: string; position: [number, number];
  }

  interface BackendTeamResponse {
    id: string; name: string; project: string; plate: string; position: [number, number];
    hasLiveLocation?: boolean; locationUpdatedAt?: string | null;
  }

  interface BackendStationResponse {
    id: string; name: string; statusType: string; city: string; position: [number, number];
  }

  interface BackendSurveyResponse {
    id: string;
    status: string;
    description: string;
    latitude: number;
    longitude: number;
  }

  const fetchMapData = useCallback(async () => {
    try {
      if (location.pathname.startsWith('/work-orders')) {
        const response = await api.get('/workorders');
        const mapped = response.data.map((w: BackendWorkOrderResponse) => ({
          id: w.id, title: w.customerName || w.title, subtitle: w.description, position: w.position, priority: w.priority, type: 'Saha' as const
        }));
        setLiveMarkers(mapped);
      } 
      else if (location.pathname.startsWith('/teams')) {
        const response = await api.get('/teams');
        const mapped = response.data.map((t: BackendTeamResponse) => ({
          id: t.id,
          title: t.name,
          subtitle: t.hasLiveLocation
            ? `Canlı konum${t.locationUpdatedAt ? ` · ${formatTurkeyDateTime(t.locationUpdatedAt)}` : ''} | Plaka: ${t.plate}`
            : `Plaka: ${t.plate} | Proje: ${t.project}`,
          position: t.position,
          priority: t.hasLiveLocation ? 'Acil' : 'Orta',
          type: 'Saha' as const
        }));
        setLiveMarkers(mapped);
      } 
      else if (location.pathname.startsWith('/map')) {
        const response = await api.get('/stations');
        const mapped = response.data.map((s: BackendStationResponse) => ({
          id: s.id, title: s.name, subtitle: `${s.city} - ${s.statusType}`, position: s.position, priority: 'Orta', type: 'Nokta' as const
        }));
        setLiveMarkers(mapped);
      }
      else if (location.pathname.startsWith('/surveys')) {
        const response = await api.get('/surveys');
        const mapped = response.data.map((su: BackendSurveyResponse) => ({
          id: su.id,
          title: `Anket: ${su.status}`,
          subtitle: su.description || 'Açıklama girilmemiş.',
          position: [su.latitude || 39.92, su.longitude || 32.85],
          priority: 'Orta',
          type: 'Nokta' as const
        }));
        setLiveMarkers(mapped);
      }
      else {
        setLiveMarkers([]);
      }
    } catch (error) {
      console.error("Harita verileri senkronize edilemedi:", error);
      setLiveMarkers([]);
    }
  }, [location.pathname]);

  // 🚀 LINTER FIX: Doğrudan çağırmak yerine güvenli bir asenkron zırha aldık
  useEffect(() => {
    let isMounted = true;

    const triggerMapFetch = async () => {
      if (isMounted) {
        await fetchMapData();
      }
    };

    triggerMapFetch();

    return () => {
      isMounted = false;
    };
  }, [fetchMapData]);

  const navItems = [
    { path: '/', label: 'Genel Bakış', icon: '📊' },
    { path: '/work-orders', label: 'İş Emri', icon: '💼' },
    { path: '/teams', label: 'Ekipler', icon: '👥' },
    { path: '/map', label: 'Noktalar', icon: '📍' }, 
    { path: '/surveys', label: 'Anketler', icon: '📝' },
    { path: '/timesheet', label: 'Zaman Çizelgesi', icon: '📅' },
    { path: '/planning', label: 'Planlama', icon: '🗓️' },
    { path: '/reports', label: 'Raporlama', icon: '📄' },
    { path: '/settings', label: 'Ayarlar', icon: '⚙️' },
  ];

  const token = localStorage.getItem('token');
  let isSuperAdmin = false;

  if (token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      
      isSuperAdmin = payload.email === 'admin@theobuz.com';
    } catch (e) {
      console.error("Super Admin yetki mührü çözülemedi:", e);
    }
  }

  const authorizedNavItems = [...navItems];
  if (isSuperAdmin) {
    authorizedNavItems.push({ path: '/admin-panel', label: 'Sistem Yönetimi', icon: '🛠️' });
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    navigate('/login', { replace: true });
  };

  const isWorkOrdersPage = location.pathname.startsWith('/work-orders');
  const isTeamsPage = location.pathname.startsWith('/teams'); 
  const isMapPage = location.pathname.startsWith('/map');
  const isSurveysPage = location.pathname.startsWith('/surveys');
  
  const showMapBackground = isWorkOrdersPage || isTeamsPage || isMapPage || isSurveysPage;
  const showSlatPanel = isWorkOrdersPage || isTeamsPage || isMapPage || isSurveysPage;

  const filteredMarkers = liveMarkers.filter(m => mapFilter === 'Tümü' || m.priority === mapFilter);
  const outletContextValue = { setFocusedMarkerPosition, mapFilter, setMapFilter, refreshMapData: fetchMapData };

  return (
    <div className="flex h-screen w-full bg-slate-50 relative overflow-hidden">
      <div className="w-20 h-full shrink-0 z-10 bg-brand-navy"></div>

      <aside 
        onMouseEnter={() => setIsMenuOpen(true)}
        onMouseLeave={() => {
          setIsMenuOpen(false);
          setIsPartnerDropdownOpen(false);
        }}
        className={`absolute top-0 left-0 h-full bg-brand-navy text-white flex flex-col shadow-2xl z-50 transition-all duration-300 ease-in-out overflow-hidden ${isMenuOpen ? 'w-64' : 'w-20'}`}
      >
        <Logo isExpanded={isMenuOpen} />
        
        <div className="mt-4 px-3 shrink-0 relative">
          <button 
            onClick={() => isMenuOpen && setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
            className={`w-full flex items-center bg-[#1A233A] text-white rounded-lg py-2.5 border border-slate-600 hover:bg-slate-700 transition-all duration-300 shadow-inner ${isMenuOpen ? 'px-3 justify-between' : 'justify-center'}`}
          >
            <div className="flex items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap">
              <div className="w-5 h-5 min-w-5 bg-brand-orange rounded-full flex items-center justify-center text-brand-navy font-bold text-[10px] shrink-0">
                {activePartner.letter}
              </div>
              <span className={`text-sm font-medium transition-all duration-300 tracking-wide truncate ${isMenuOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
                {activePartner.name}
              </span>
            </div>
            <span className={`text-xs text-slate-400 transition-opacity duration-200 ${isMenuOpen ? 'opacity-100' : 'opacity-0 w-0 h-0 overflow-hidden pointer-events-none'}`}>
              {isPartnerDropdownOpen ? '▲' : '▼'}
            </span>
          </button>

          {isPartnerDropdownOpen && isMenuOpen && (
            <div className="absolute left-3 right-3 mt-1 bg-[#1A233A] border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-50 text-xs">
              {[
                { name: 'Trugo Şarj İstasyonları', letter: 'T' },
                { name: 'Unilever Algida', letter: 'A' },
                { name: 'Astor Enerji', letter: 'E' },
                { name: 'Yeşil Pano Projesi', letter: 'Y' }
              ].map((partner, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActivePartner(partner);
                    setIsPartnerDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-brand-orange hover:text-brand-navy transition-colors flex items-center gap-2 ${activePartner.name === partner.name ? 'text-brand-orange font-bold' : 'text-slate-300'}`}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold">{partner.letter}</span>
                  <span className="truncate">{partner.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <nav className="flex-1 p-3 space-y-2 mt-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {authorizedNavItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `flex items-center px-3 py-3 rounded-lg transition-all font-medium ${isActive ? 'bg-brand-orange text-brand-navy shadow-md' : 'text-slate-300 hover:bg-brand-navy-light hover:text-white'}`}>
              <span className="text-xl min-w-8 flex justify-center">{item.icon}</span>
              <span className={`ml-3 whitespace-nowrap transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative z-10 h-screen overflow-hidden">
        <header className="h-20 shrink-0 bg-white/90 backdrop-blur-sm border-b border-slate-200 flex items-center px-8 shadow-sm justify-end z-10 gap-4">
          <div className="relative">
            <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl relative transition shadow-sm text-lg">
              🔔 <span className="absolute -top-1 -right-1 bg-brand-orange text-brand-navy text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-white animate-bounce">{notifications.length}</span>
            </button>
            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 text-xs animate-fadeIn">
                <div className="p-3 bg-slate-50 font-bold border-b border-slate-200 text-brand-navy flex justify-between"><span>Anlık İş Takip Akışı</span><span className="text-brand-orange">● Canlı</span></div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <p className="text-slate-700 font-medium leading-relaxed">{n.text}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block text-right font-semibold">{n.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className="text-sm font-bold px-5 py-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition shadow-sm">Çıkış Yap</button>
        </header>
        
        <div className="flex-1 relative overflow-hidden bg-slate-50">
          {showMapBackground ? (
            <>
              <div className="absolute inset-0 z-0">
                <MapView markers={filteredMarkers} center={[37.420, 31.848]} focusedMarkerPosition={focusedMarkerPosition} />
              </div>
              {showSlatPanel && (
                <div className={`absolute top-0 bottom-0 w-100 bg-white border-r border-slate-200 shadow-2xl z-20 overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${isMenuOpen ? 'left-44' : 'left-0'}`}>
                  <div className="flex-1 overflow-y-auto">
                    <Outlet context={outletContextValue} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 z-20 overflow-y-auto p-6 bg-slate-50">
              <Outlet context={outletContextValue} /> 
            </div>
          )}
        </div>
      </main>
    </div>
  );
}