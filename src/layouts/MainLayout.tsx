// ga-frontend/src/layouts/MainLayout.tsx
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MapView from '../components/MapView';
import type { MapMarker } from '../components/MapView';
import api from '../services/api';

const Logo = ({ isExpanded }: { isExpanded: boolean }) => (
  <div className="flex items-center h-20 border-b border-brand-navy-light px-5 overflow-hidden whitespace-nowrap">
    <div className="w-10 h-10 min-w-10 rounded-full flex items-center justify-center font-bold text-brand-orange text-2xl border-2 border-brand-orange transition-transform duration-300">
      G
    </div>
    <div className={`flex flex-col ml-3 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
      <h1 className="text-xl font-bold tracking-wider text-white leading-tight">GÖREV ADAMI</h1>
      <p className='text-[8px] text-brand-orange uppercase'>Saha Yönetim Platformu</p>
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

  // SIKI TİPLEME: Linter uyarıları için net arabirim kontratları
  interface BackendWorkOrderResponse {
    id: string; title: string; customerName: string; priority: string; status: string;
    type: string; description: string; plannedDate: string; position: [number, number];
  }

  interface BackendTeamResponse {
    id: string; name: string; project: string; plate: string; position: [number, number];
  }

  interface BackendStationResponse {
    id: string; name: string; statusType: string; city: string; position: [number, number];
  }

  // 🚀 HARİTA SAYAÇ FİXİ: Rotaya göre tetiklenen dinamik harita veri motoru
  useEffect(() => {
    const fetchMapData = async () => {
      try {
        if (location.pathname.startsWith('/work-orders')) {
          const response = await api.get('/workorders');
          const mapped = response.data.map((w: BackendWorkOrderResponse) => ({
            id: w.id,
            title: w.customerName || w.title,
            subtitle: w.description,
            position: w.position,
            priority: w.priority,
            type: 'Saha' as const
          }));
          setLiveMarkers(mapped);
        } 
        else if (location.pathname.startsWith('/teams')) {
          // 💡 Ekipler sayfasına girildiğinde sadece ekipler çekilir, sayaç 2'ye düşer!
          const response = await api.get('/teams');
          const mapped = response.data.map((t: BackendTeamResponse) => ({
            id: t.id,
            title: t.name,
            subtitle: `Plaka: ${t.plate} | Proje: ${t.project}`,
            position: t.position,
            priority: 'Orta',
            type: 'Saha' as const
          }));
          setLiveMarkers(mapped);
        } 
        else if (location.pathname.startsWith('/map')) {
          const response = await api.get('/stations');
          const mapped = response.data.map((s: BackendStationResponse) => ({
            id: s.id,
            title: s.name,
            subtitle: `${s.city} - ${s.statusType}`,
            position: s.position,
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
        setLiveMarkers([]); // Hata anında temizle, çakışmayı önle
      }
    };

    fetchMapData();
  }, [location.pathname]); // Rotadaki her milimetrik değişimde haritayı baştan aşağı yeniler

  const navItems = [
    { path: '/', label: 'Genel Bakış', icon: '📊' },
    { path: '/work-orders', label: 'İş Emri', icon: '💼' },
    { path: '/teams', label: 'Ekipler', icon: '👥' },
    { path: '/map', label: 'Noktalar', icon: '📍' }, 
    { path: '/surveys', label: 'Anketler', icon: '📝' },
    { path: '/timesheet', label: 'Zaman Çizelgesi', icon: '📅' },
    { path: '/planning', label: 'Planlama', icon: '🗓️' },
    { path: '/reports', label: 'Raporlama', icon: '📄' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    navigate('/login', { replace: true });
  };

  const isWorkOrdersPage = location.pathname.startsWith('/work-orders');
  const isTeamsPage = location.pathname.startsWith('/teams'); 
  const isMapPage = location.pathname.startsWith('/map');
  const showMapBackground = isWorkOrdersPage || isTeamsPage || isMapPage;
  const showSlatPanel = isWorkOrdersPage || isTeamsPage || isMapPage;

  const filteredMarkers = liveMarkers.filter(m => mapFilter === 'Tümü' || m.priority === mapFilter);
  const outletContextValue = { setFocusedMarkerPosition, mapFilter, setMapFilter };

  return (
    <div className="flex h-screen w-full bg-slate-50 relative overflow-hidden">
      <div className="w-20 h-full shrink-0 z-10 bg-brand-navy"></div>

      <aside 
        onMouseEnter={() => setIsMenuOpen(true)}
        onMouseLeave={() => setIsMenuOpen(false)}
        className={`absolute top-0 left-0 h-full bg-brand-navy text-white flex flex-col shadow-2xl z-50 transition-all duration-300 ease-in-out overflow-hidden ${isMenuOpen ? 'w-64' : 'w-20'}`}
      >
        <Logo isExpanded={isMenuOpen} />
        <div className="mt-4 px-3 shrink-0">
          <button className={`w-full flex items-center bg-[#1A233A] text-white rounded-lg py-2.5 border border-slate-600 hover:bg-slate-700 transition-all duration-300 shadow-inner ${isMenuOpen ? 'px-3 justify-between' : 'justify-center'}`}>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap">
              <div className="w-5 h-5 min-w-5 bg-white rounded-full flex items-center justify-center text-brand-navy font-bold text-[10px] shrink-0">T</div>
              <span className={`text-sm font-medium transition-all duration-300 tracking-wide ${isMenuOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>Trugo Şarj İstasyonları</span>
            </div>
            <span className={`text-xs transition-opacity duration-200 ${isMenuOpen ? 'opacity-100' : 'opacity-0 w-0 h-0 overflow-hidden pointer-events-none'}`}>›</span>
          </button>
        </div>
        
        <nav className="flex-1 p-3 space-y-2 mt-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `flex items-center px-3 py-3 rounded-lg transition-all font-medium ${isActive ? 'bg-brand-orange text-brand-navy shadow-md' : 'text-slate-300 hover:bg-brand-navy-light hover:text-white'}`}>
              <span className="text-xl min-w-8 flex justify-center">{item.icon}</span>
              <span className={`ml-3 whitespace-nowrap transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative z-10 h-screen overflow-hidden">
        <header className="h-20 shrink-0 bg-white/90 backdrop-blur-sm border-b border-slate-200 flex items-center px-8 shadow-sm justify-end z-10">
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