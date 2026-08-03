// ga-frontend/src/pages/Users.tsx

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import ModalOverlay from '../components/ModalOverlay';

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  tenantId: string;
  tenantName: string;
  isActive: boolean;
  roles: string[];
}

interface RoleRow {
  id: string;
  name: string;
  description: string;
}

interface TenantRow {
  id: string;
  name: string;
}

interface UserFormState {
  username: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  password: string;
  tenantId: string;
  isActive: boolean;
  roleNames: string[];
}

const EMPTY_FORM: UserFormState = {
  username: '',
  email: '',
  fullName: '',
  phoneNumber: '',
  password: '',
  tenantId: '',
  isActive: true,
  roleNames: [],
};

const SUPER_ADMIN_ROLE = 'SuperAdmin';

interface AxiosErrorResponse {
  response?: { data?: { message?: string } };
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [lockedSuperAdmin, setLockedSuperAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, tenantsRes] = await Promise.all([
        api.get<UserRow[]>('/users'),
        api.get<RoleRow[]>('/users/roles'),
        api.get<TenantRow[]>('/users/tenants'),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setTenants(tenantsRes.data);
      setAccessDenied(false);
    } catch {
      setAccessDenied(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openCreate = () => {
    setModalMode('create');
    setEditingUserId(null);
    setLockedSuperAdmin(false);
    setForm({ ...EMPTY_FORM, roleNames: [] });
  };

  const openEdit = (user: UserRow) => {
    const hasSuperAdmin = user.roles.some((r) => r === SUPER_ADMIN_ROLE);
    setModalMode('edit');
    setEditingUserId(user.id);
    setLockedSuperAdmin(hasSuperAdmin);
    setForm({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      password: '',
      tenantId: user.tenantId === '00000000-0000-0000-0000-000000000000' ? '' : user.tenantId,
      isActive: user.isActive,
      roleNames: user.roles.filter((r) => r !== SUPER_ADMIN_ROLE),
    });
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUserId(null);
    setForm(EMPTY_FORM);
    setLockedSuperAdmin(false);
  };

  const toggleRole = (roleName: string) => {
    setForm((prev) => ({
      ...prev,
      roleNames: prev.roleNames.includes(roleName)
        ? prev.roleNames.filter((r) => r !== roleName)
        : [...prev.roleNames, roleName],
    }));
  };

  const errMsg = (err: unknown) => {
    const error = err as AxiosErrorResponse;
    return error.response?.data?.message || 'İşlem başarısız.';
  };

  const handleSave = async () => {
    if (form.roleNames.length === 0 && !lockedSuperAdmin) {
      alert('En az bir rol seçilmelidir.');
      return;
    }
    if (!lockedSuperAdmin && !form.tenantId) {
      alert('Firma seçimi zorunludur.');
      return;
    }
    if (modalMode === 'create' && !form.password.trim()) {
      alert('Yeni kullanıcı için şifre zorunludur.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        tenantId: lockedSuperAdmin ? '00000000-0000-0000-0000-000000000000' : form.tenantId,
        isActive: form.isActive,
        roleNames: form.roleNames,
        ...(form.password.trim() ? { password: form.password } : {}),
      };

      if (modalMode === 'create') {
        await api.post('/users', payload);
      } else if (editingUserId) {
        await api.put(`/users/${editingUserId}`, payload);
      }

      await loadUsers();
      closeModal();
    } catch (err) {
      alert(errMsg(err));
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
        <button
          type="button"
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-colors text-sm"
        >
          + Yeni Kullanıcı
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-700">İsim / E-posta</th>
              <th className="p-4 font-semibold text-slate-700">Firma</th>
              <th className="p-4 font-semibold text-slate-700">Roller</th>
              <th className="p-4 font-semibold text-slate-700">Durum</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                onClick={() => openEdit(user)}
                className="border-b border-slate-100 hover:bg-slate-50 transition cursor-pointer"
              >
                <td className="p-4">
                  <div className="font-medium text-slate-800">{user.fullName}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5">@{user.username}</div>
                </td>
                <td className="p-4 text-sm text-slate-700">{user.tenantName}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className={`px-2 py-1 rounded-md text-xs font-medium ${
                          role === SUPER_ADMIN_ROLE
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
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
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400 text-sm">
                  Henüz kullanıcı yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalMode && (
        <ModalOverlay>
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              {modalMode === 'create' ? 'Yeni Kullanıcı' : 'Kullanıcıyı Düzenle'}
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Firma ve rol atamaları kiracı kurallarına göre kaydedilir.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Ad Soyad</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Kullanıcı Adı</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">E-posta</label>
                  <input
                    type="email"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Telefon</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Şifre {modalMode === 'edit' && <span className="font-normal normal-case text-slate-400">(boş = değişmez)</span>}
                </label>
                <input
                  type="password"
                  required={modalMode === 'create'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={modalMode === 'edit' ? 'Değiştirmek için yeni şifre girin' : ''}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Firma</label>
                {lockedSuperAdmin ? (
                  <div className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 text-slate-600">
                    Sistem (Super Admin) — firma ataması yok
                  </div>
                ) : (
                  <select
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={form.tenantId}
                    onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                  >
                    <option value="">Firma seçiniz...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Roller</label>
                {lockedSuperAdmin && (
                  <label className="flex items-start gap-2 mb-2 opacity-70 cursor-not-allowed">
                    <input type="checkbox" checked disabled className="ga-checkbox mt-0.5" />
                    <span>
                      <span className="font-semibold text-purple-800">{SUPER_ADMIN_ROLE}</span>
                      <span className="block text-xs text-slate-500">Mevcut süper admin hesabı — rol kaldırılamaz</span>
                    </span>
                  </label>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.roleNames.includes(role.name)}
                        onChange={() => toggleRole(role.name)}
                        className="ga-checkbox mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-slate-800">{role.name}</span>
                        <span className="block text-xs text-slate-500">{role.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  className="ga-checkbox ga-checkbox-accent-blue"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span className="text-sm font-semibold text-slate-800">Hesap aktif</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSave}
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
