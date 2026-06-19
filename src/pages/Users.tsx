// ga-frontend/src/pages/Users.tsx

import { useState } from 'react';

const INITIAL_USERS = [
  { id: 'USR-001', name: 'Ahmet Yılmaz', role: 'Saha Ekibi', email: 'ahmet@gasys.com', status: 'Aktif' },
  { id: 'USR-002', name: 'Mehmet Demir', role: 'Saha Ekibi', email: 'mehmet@gasys.com', status: 'Pasif' },
  { id: 'USR-003', name: 'Ayşe Kaya', role: 'Sistem Yöneticisi', email: 'ayse@gasys.com', status: 'Aktif' },
];

export default function Users() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Saha Ekibi' });

  const handleSave = () => {
    if (!formData.name.trim() || !formData.email.trim()) return;

    const newUser = {
      id: `USR-00${users.length + 1}`,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: 'Aktif',
    };

    setUsers([newUser, ...users]);
    setIsModalOpen(false);
    setFormData({ name: '', email: '', role: 'Saha Ekibi' });
  };

  return (
    <div className="p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Kullanıcı Yönetimi</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          + Yeni Kullanıcı
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-700">İsim / E-posta</th>
              <th className="p-4 font-semibold text-slate-700">Rol</th>
              <th className="p-4 font-semibold text-slate-700">Durum</th>
              <th className="p-4 font-semibold text-slate-700 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4">
                  <div className="font-medium text-slate-800">{user.name}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                    user.role === 'Sistem Yöneticisi' ? 'bg-purple-100 text-purple-700' : 
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Düzenle</button>
                  <button className="text-rose-600 hover:text-rose-800 text-sm font-medium">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Yeni Kullanıcı Ekle</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                  placeholder="Örn: Ali Veli" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-posta Adresi</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                  placeholder="Örn: ali@sirket.com" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kullanıcı Rolü</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Saha Ekibi">Saha Ekibi</option>
                  <option value="Operatör">Operatör</option>
                  <option value="Sistem Yöneticisi">Sistem Yöneticisi</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                İptal
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}