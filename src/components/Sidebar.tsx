// ga-frontend/src/components/Sidebar.tsx

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  MapPin, 
  Users, 
  Settings, 
  LogOut,
  MessageCircle,
} from 'lucide-react';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const menuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'İş Emirleri', path: '/work-orders', icon: <Briefcase size={20} /> },
    { name: 'Harita / Konumlar', path: '/map', icon: <MapPin size={20} /> },
    { name: 'Kullanıcılar', path: '/users', icon: <Users size={20} /> },
    { name: 'Ayarlar', path: '/settings', icon: <Settings size={20} /> },
    { name: 'Takımlar', path: '/teams', icon: <Briefcase size={20} /> },
    { name: 'Anketler', path: '/surveys', icon: <Briefcase size={20} /> },
    { name: 'Sohbet', path: '/chat', icon: <MessageCircle size={20} /> },
    { name: 'Zaman Çizelgesi', path: '/timesheet', icon: <Briefcase size={20} /> },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="flex flex-col w-64 h-full bg-slate-900 text-white transition-all duration-300">
      {/* Logo Alanı */}
      <div className="flex items-center justify-center h-16 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-blue-400 tracking-wider">GA<span className="text-white">SYS</span></h1>
      </div>

      {/* Menü Linkleri */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Çıkış Yap Butonu */}
      <div className="p-4 border-t border-slate-700">
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-3 text-slate-300 hover:text-red-400 transition-colors w-full px-4 py-2"
        >
          <LogOut size={20} />
          <span className="font-medium">Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;