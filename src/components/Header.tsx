// ga-frontend/src/components/Header.tsx

import React, { useState } from 'react';
import { Bell, User, Building2, ChevronDown } from 'lucide-react';

const Header: React.FC = () => {
  // İleride bu veriler backend'den gelecek
  const [selectedTenant] = useState<string>('Trugo');

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      
      {/* Sol Taraf: Firma (Tenant) Seçici */}
      <div className="flex items-center">
        <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-200 transition-colors">
          <Building2 size={18} className="text-gray-500 mr-2" />
          <span className="text-sm font-semibold text-gray-700 mr-2">{selectedTenant}</span>
          <ChevronDown size={16} className="text-gray-500" />
        </div>
      </div>

      {/* Sağ Taraf: Bildirimler ve Kullanıcı */}
      <div className="flex items-center space-x-4">
        <button className="text-gray-500 hover:text-blue-600 transition-colors relative">
          <Bell size={20} />
          {/* Bildirim Noktası */}
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>

        <div className="h-8 w-px bg-gray-300"></div>

        <div className="flex items-center space-x-2 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <User size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 leading-tight">Yönetici</span>
            <span className="text-xs text-gray-500 leading-tight">Sistem Admin</span>
          </div>
        </div>
      </div>

    </header>
  );
};

export default Header;