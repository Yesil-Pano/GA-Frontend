// ga-frontend/src/layouts/MainLayout.tsx
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import MapView, { DEFAULT_MAP_CENTER } from '../components/MapView';
import type { MapMarker } from '../components/MapView';
import api from '../services/api';
import { formatTurkeyDateTime } from '../utils/dateTime';
import logoImg from '../assets/logo.png';
import trugoLogoImg from '../assets/trugo-logo.png';
import {
  SUPER_ADMIN_PARTNERS,
  getPartnerByKey,
  getPartnerColor,
  getStoredPartnerKey,
  resolvePartnerKey,
  storePartnerKey,
  type PartnerKey,
  type PartnerOption,
} from '../utils/partners';

const Logo = ({ isExpanded }: { isExpanded: boolean }) => (
  <div className="flex items-center h-20 border-b border-brand-navy-light px-5 overflow-hidden whitespace-nowrap">
    <img src={logoImg} alt="Görev Adamı Logo" className="w-10 h-10 min-w-10 object-contain transition-transform duration-300" />
    <div className={`flex flex-col ml-3 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
      <h1 className="text-xl font-bold tracking-wider text-white leading-tight">GÖREV ADAMI</h1>
      <p className="text-[8px] text-brand-orange uppercase tracking-wider font-semibold">Yeşil Pano Ayak İzi</p>
    </div>
  </div>
);

interface AppNotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  workOrderId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [focusedMarkerPosition, setFocusedMarkerPosition] = useState<[number, number] | null>(null);
  const [mapFilter, setMapFilter] = useState('Tümü');
  const [liveMarkers, setLiveMarkers] = useState<MapMarker[]>([]);
  /** /map sayfası sol listesi — harita ile aynı GET /stations yanıtı (çift fetch yok) */
  const [mapStations, setMapStations] = useState<unknown[]>([]);
  const [isMapStationsLoading, setIsMapStationsLoading] = useState(() =>
    location.pathname.startsWith('/map'),
  );

  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false);
  const [activePartner, setActivePartner] = useState<PartnerOption>(() =>
    getPartnerByKey(getStoredPartnerKey()),
  );

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isListPanelHidden, setIsListPanelHidden] = useState(false);
  const [listPanelPath, setListPanelPath] = useState(location.pathname);

  const token = localStorage.getItem('token');
  let isSuperAdmin = false;
  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      isSuperAdmin = payload.email === 'admin@theobuz.com';
    } catch (e) {
      console.error('Super Admin yetki mührü çözülemedi:', e);
    }
  }

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get<{ unread: number; items: AppNotificationItem[] }>('/notifications', {
        params: { take: 10 },
      });
      setNotifications(data.items || []);
      setUnreadCount(data.unread || 0);
    } catch (error) {
      console.error('Bildirimler alınamadı:', error);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);
    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, 60_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [fetchNotifications]);

  const partnerKey = activePartner.key as PartnerKey;

  const fetchMapData = useCallback(async () => {
    try {
      if (location.pathname.startsWith('/work-orders')) {
        const response = await api.get('/workorders', { params: { partnerKey } });
        const mapped = response.data.map((w: {
          id: string; title: string; customerName: string; priority: string; description: string;
          position: [number, number]; tenantId?: string;
        }) => {
          const pk = resolvePartnerKey({ tenantId: w.tenantId, name: w.customerName });
          const partner = pk ? getPartnerByKey(pk) : null;
          return {
            id: w.id,
            title: w.customerName || w.title,
            subtitle: w.description,
            position: w.position,
            priority: w.priority,
            type: 'Saha' as const,
            partnerColor: getPartnerColor(pk),
            partnerName: partner && partner.key !== 'all' ? partner.name : undefined,
          };
        });
        setLiveMarkers(mapped);
      } else if (location.pathname.startsWith('/teams')) {
        const response = await api.get('/teams', { params: { partnerKey } });
        const mapped = response.data.map((t: {
          id: string; name: string; project: string; plate: string; position: [number, number];
          tenantId?: string; hasLiveLocation?: boolean; locationUpdatedAt?: string | null;
        }) => {
          const pk = resolvePartnerKey({ tenantId: t.tenantId, name: t.project });
          const partner = pk ? getPartnerByKey(pk) : null;
          return {
            id: t.id,
            title: t.name,
            subtitle: t.hasLiveLocation
              ? `Canlı konum${t.locationUpdatedAt ? ` · ${formatTurkeyDateTime(t.locationUpdatedAt)}` : ''} | Plaka: ${t.plate}`
              : `Plaka: ${t.plate} | Proje: ${t.project}`,
            position: t.position,
            priority: t.hasLiveLocation ? 'Acil' : 'Orta',
            type: 'Saha' as const,
            partnerColor: getPartnerColor(pk),
            partnerName: partner && partner.key !== 'all' ? partner.name : undefined,
          };
        });
        setLiveMarkers(mapped);
      } else if (location.pathname.startsWith('/map')) {
        setIsMapStationsLoading(true);
        try {
          const response = await api.get('/stations', { params: { partnerKey } });
          const stations = Array.isArray(response.data) ? response.data : [];
          setMapStations(stations);
          const mapped = stations.map((s: {
            id: string; name: string; statusType: string; city: string; position: [number, number];
            ownerCompany?: string | null; tenantId?: string;
          }) => {
            const pk = resolvePartnerKey({
              tenantId: s.tenantId,
              ownerCompany: s.ownerCompany,
              name: s.name,
            });
            const partner = pk ? getPartnerByKey(pk) : null;
            return {
              id: s.id,
              title: s.name,
              subtitle: `${s.city} - ${s.statusType}`,
              position: s.position,
              priority: 'Orta',
              type: 'Nokta' as const,
              partnerColor: getPartnerColor(pk),
              partnerName: partner && partner.key !== 'all' ? partner.name : undefined,
            };
          });
          setLiveMarkers(mapped);
        } finally {
          setIsMapStationsLoading(false);
        }
      } else if (location.pathname.startsWith('/surveys')) {
        setMapStations([]);
        setIsMapStationsLoading(false);
        const response = await api.get('/surveys');
        const mapped = response.data.map((su: {
          id: string; status: string; description: string; latitude: number; longitude: number;
        }) => ({
          id: su.id,
          title: `Anket: ${su.status}`,
          subtitle: su.description || 'Açıklama girilmemiş.',
          position: [su.latitude || 39.92, su.longitude || 32.85] as [number, number],
          priority: 'Orta',
          type: 'Nokta' as const,
        }));
        setLiveMarkers(mapped);
      } else {
        setMapStations([]);
        setIsMapStationsLoading(false);
        setLiveMarkers([]);
      }
    } catch (error) {
      console.error('Harita verileri senkronize edilemedi:', error);
      setLiveMarkers([]);
      setMapStations([]);
      setIsMapStationsLoading(false);
    }
  }, [location.pathname, partnerKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchMapData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchMapData]);

  // Sayfa değişince önceki nokta odağını temizle — harita varsayılan lat/lng + zoom'a döner
  useEffect(() => {
    setFocusedMarkerPosition(null);
  }, [location.pathname]);

  const handlePartnerSelect = (partner: PartnerOption) => {
    setActivePartner(partner);
    storePartnerKey(partner.key);
    setIsPartnerDropdownOpen(false);
  };

  const handleNotificationClick = async (n: AppNotificationItem) => {
    try {
      if (!n.isRead) {
        await api.put(`/notifications/${n.id}/read`);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      /* ignore */
    }
    setIsNotificationOpen(false);
    if (n.workOrderId) {
      navigate(`/work-orders?open=${n.workOrderId}`);
    }
  };

  const navItems = [
    { path: '/', label: 'Genel Bakış', icon: '📊' },
    { path: '/work-orders', label: 'İş Emri', icon: '💼' },
    { path: '/teams', label: 'Ekipler', icon: '👥' },
    { path: '/map', label: 'Noktalar', icon: '📍' },
    { path: '/surveys', label: 'Anketler', icon: '📝' },
    { path: '/timesheet', label: 'Zaman Çizelgesi', icon: '📅' },
    { path: '/planning', label: 'Planlama', icon: '🗓️' },
    { path: '/reports', label: 'Raporlama', icon: '📄' },
    { path: '/chat', label: 'Sohbet', icon: '💬' },
    { path: '/settings', label: 'Ayarlar', icon: '⚙️' },
  ];

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
  const showSlatPanel = showMapBackground;

  if (listPanelPath !== location.pathname) {
    setListPanelPath(location.pathname);
    setIsListPanelHidden(false);
  }

  const filteredMarkers = liveMarkers.filter((m) => mapFilter === 'Tümü' || m.priority === mapFilter);
  const outletContextValue = {
    setFocusedMarkerPosition,
    mapFilter,
    setMapFilter,
    refreshMapData: fetchMapData,
    activePartner,
    partnerKey,
    mapStations,
    isMapStationsLoading,
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 relative overflow-hidden">
      <div className="w-20 h-full shrink-0 z-10 bg-brand-navy" />

      <aside
        onMouseEnter={() => setIsMenuOpen(true)}
        onMouseLeave={() => {
          setIsMenuOpen(false);
          setIsPartnerDropdownOpen(false);
        }}
        className={`absolute top-0 left-0 h-full bg-brand-navy text-white flex flex-col shadow-2xl z-50 transition-all duration-300 ease-in-out overflow-hidden ${isMenuOpen ? 'w-64' : 'w-20'}`}
      >
        <Logo isExpanded={isMenuOpen} />

        {isSuperAdmin && (
          <div className="mt-4 px-3 shrink-0 relative">
            <button
              onClick={() => isMenuOpen && setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
              className={`w-full flex items-center bg-[#1A233A] text-white rounded-lg py-2.5 border border-slate-600 hover:bg-slate-700 transition-all duration-300 shadow-inner ${isMenuOpen ? 'px-3 justify-between' : 'justify-center'}`}
            >
              <div className="flex items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap">
                <div
                  className="w-5 h-5 min-w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border border-white/30"
                  style={{
                    backgroundColor: activePartner.color,
                    color: activePartner.color === '#000000' ? '#FFFFFF' : '#1A233A',
                  }}
                >
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
                {SUPER_ADMIN_PARTNERS.map((partner) => (
                  <button
                    key={partner.key}
                    onClick={() => handlePartnerSelect(partner)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-brand-orange hover:text-brand-navy transition-colors flex items-center gap-2 ${activePartner.key === partner.key ? 'text-brand-orange font-bold' : 'text-slate-300'}`}
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border border-white/20"
                      style={{
                        backgroundColor: partner.color,
                        color: partner.color === '#000000' ? '#FFFFFF' : '#1A233A',
                      }}
                    >
                      {partner.letter}
                    </span>
                    <span className="truncate">{partner.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 p-3 space-y-2 mt-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {authorizedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-3 rounded-lg transition-all font-medium ${isActive ? 'bg-brand-orange text-brand-navy shadow-md' : 'text-slate-300 hover:bg-brand-navy-light hover:text-white'}`
              }
            >
              <span className="text-xl min-w-8 flex justify-center">{item.icon}</span>
              <span className={`ml-3 whitespace-nowrap transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative z-10 h-screen overflow-hidden">
        <header className="h-20 shrink-0 bg-white/90 backdrop-blur-sm border-b border-slate-200 flex items-center px-8 shadow-sm justify-end z-40 gap-4 relative">
          {showMapBackground && (
            <button
              type="button"
              onClick={() => setIsListPanelHidden((prev) => !prev)}
              className="mr-auto text-sm font-bold px-4 py-2.5 rounded-lg transition shadow-sm border border-slate-200 bg-slate-50 text-brand-navy hover:bg-slate-100"
              title={isListPanelHidden ? 'Listeyi göster' : 'Yalnızca haritayı göster'}
            >
              {isListPanelHidden ? '☰ Listeyi Göster' : '🗺 Yalnızca Harita'}
            </button>
          )}
          {partnerKey === 'trugo' && (
            <img
              src={trugoLogoImg}
              alt="Trugo"
              title="Trugo Şarj İstasyonları"
              className="h-12 w-auto max-w-[220px] object-contain select-none"
              draggable={false}
            />
          )}
          <div className="relative">
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl relative transition shadow-sm text-lg"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-orange text-brand-navy text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-white">
                  {unreadCount}
                </span>
              )}
            </button>
            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-100 text-xs animate-fadeIn">
                <div className="p-3 bg-slate-50 font-bold border-b border-slate-200 text-brand-navy flex justify-between items-center">
                  <span>Bildirimler</span>
                  <button
                    type="button"
                    className="text-[10px] text-brand-orange font-bold"
                    onClick={async () => {
                      await api.put('/notifications/read-all');
                      fetchNotifications();
                    }}
                  >
                    Tümünü okundu işaretle
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-slate-400 text-center">Bildirim yok.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${n.isRead ? 'opacity-70' : 'bg-orange-50/40'}`}
                      >
                        <p className="text-slate-800 font-bold">{n.title}</p>
                        <p className="text-slate-600 font-medium leading-relaxed mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block text-right font-semibold">
                          {formatTurkeyDateTime(n.createdAt)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-bold px-5 py-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition shadow-sm"
          >
            Çıkış Yap
          </button>
        </header>

        <div className="flex-1 relative overflow-hidden bg-slate-50 z-0">
          {showMapBackground ? (
            <>
              <div className="absolute inset-0 z-0">
                <MapView
                  markers={filteredMarkers}
                  center={DEFAULT_MAP_CENTER}
                  focusedMarkerPosition={focusedMarkerPosition}
                  viewResetKey={location.pathname}
                />
              </div>
              {showSlatPanel && (
                <div
                  className={`absolute top-0 bottom-0 w-100 bg-white border-r border-slate-200 shadow-2xl z-20 overflow-hidden flex flex-col transition-[left,opacity] duration-300 ease-in-out ${
                    isListPanelHidden
                      ? '-left-100 opacity-0 pointer-events-none'
                      : isMenuOpen
                        ? 'left-44 opacity-100'
                        : 'left-0 opacity-100'
                  }`}
                >
                  <div className="flex-1 overflow-y-auto">
                    <Outlet context={outletContextValue} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 z-0 overflow-y-auto p-6 bg-slate-50">
              <Outlet context={outletContextValue} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
