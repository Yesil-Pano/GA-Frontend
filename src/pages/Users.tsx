// ga-frontend/src/pages/Users.tsx

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import ModalOverlay from '../components/ModalOverlay';

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  tenantId: string;
  isActive: boolean;
  roles: string[];
}

interface RoleRow {
  id: string;
  name: string;
  description: string;
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get<UserRow[]>('/users'),
        api.get<RoleRow[]>('/users/roles'),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setAccessDenied(false);
    } catch {
      setAccessDenied(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setSelectedRoles([...user.roles]);
  };

  const toggleRole = (roleName: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName],
    );
  };

  const handleSaveRoles = async () => {
    if (!editUser) return;
    setIsSaving(true);
    try {
      await api.put(`/users/${editUser.id}/roles`, { roleNames: selectedRoles });
      await loadUsers();
      setEditUser(null);
    } catch (error) {
      console.error(error);
      alert('Roller güncellenemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-slate-500 font-medium">Kullanıcılar yükleniyor...</div>
    );
  }

  if (accessDenied) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Kullanıcı Yönetimi</h1>
        <p className="text-slate-500">Bu sayfaya yalnızca Super Admin erişebilir.</p>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Kullanıcı Yönetimi</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-700">İsim / E-posta</th>
              <th className="p-4 font-semibold text-slate-700">Roller</th>
              <th className="p-4 font-semibold text-slate-700">Durum</th>
              <th className="p-4 font-semibold text-slate-700 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4">
                  <div className="font-medium text-slate-800">{user.fullName}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <span key={role} className="px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700">
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {user.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(user)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Rolleri Düzenle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editUser && (
        <ModalOverlay>
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Rol Atama</h2>
            <p className="text-sm text-slate-500 mb-4">{editUser.fullName} ({editUser.email})</p>
            <div className="space-y-2 mb-6">
              {roles.map((role) => (
                <label key={role.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.name)}
                    onChange={() => toggleRole(role.name)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold text-slate-800">{role.name}</span>
                    <span className="block text-xs text-slate-500">{role.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveRoles}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60"
              >
                {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
