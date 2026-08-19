// ga-frontend/src/pages/Users.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { getAuthProfile } from '../utils/authSession';
import ModalOverlay from '../components/ModalOverlay';
import PageLoading from '../components/PageLoading';

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
const PAGE_SIZE = 20;

type SortKey = 'fullName' | 'email' | 'username' | 'tenantName' | 'roles' | 'status';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'inactive';

function compareText(a: string, b: string, dir: SortDir): number {
  const result = a.localeCompare(b, 'tr', { sensitivity: 'base' });
  return dir === 'asc' ? result : -result;
}

function sortUsers(list: UserRow[], sortKey: SortKey, sortDir: SortDir): UserRow[] {
  return [...list].sort((a, b) => {
    switch (sortKey) {
      case 'fullName':
        return compareText(a.fullName, b.fullName, sortDir);
      case 'email':
        return compareText(a.email, b.email, sortDir);
      case 'username':
        return compareText(a.username, b.username, sortDir);
      case 'tenantName':
        return compareText(a.tenantName, b.tenantName, sortDir);
      case 'roles':
        return compareText(
          [...a.roles].sort((x, y) => x.localeCompare(y, 'tr')).join(', '),
          [...b.roles].sort((x, y) => x.localeCompare(y, 'tr')).join(', '),
          sortDir,
        );
      case 'status': {
        const av = a.isActive ? 0 : 1;
        const bv = b.isActive ? 0 : 1;
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      default:
        return 0;
    }
  });
}

function filterUsers(
  list: UserRow[],
  search: string,
  tenantFilter: string,
  roleFilter: string,
  statusFilter: StatusFilter,
): UserRow[] {
  const q = search.trim().toLowerCase();
  return list.filter((user) => {
    if (statusFilter === 'active' && !user.isActive) return false;
    if (statusFilter === 'inactive' && user.isActive) return false;
    if (tenantFilter && user.tenantId !== tenantFilter) return false;
    if (roleFilter && !user.roles.some((r) => r === roleFilter)) return false;
    if (!q) return true;
    const haystack = [
      user.fullName,
      user.email,
      user.username,
      user.tenantName,
      user.phoneNumber,
      ...user.roles,
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

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
  const [isDeleting, setIsDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('fullName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const tenantOptions = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.tenantId, u.tenantName));
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [users]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => u.roles.forEach((r) => set.add(r)));
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [users]);

  const filteredUsers = useMemo(
    () => filterUsers(users, search, tenantFilter, roleFilter, statusFilter),
    [users, search, tenantFilter, roleFilter, statusFilter],
  );

  const sortedUsers = useMemo(
    () => sortUsers(filteredUsers, sortKey, sortDir),
    [filteredUsers, sortKey, sortDir],
  );

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));

  const listControlKey = `${search}|${tenantFilter}|${roleFilter}|${statusFilter}|${sortKey}|${sortDir}`;
  const [prevListControlKey, setPrevListControlKey] = useState(listControlKey);

  if (listControlKey !== prevListControlKey) {
    setPrevListControlKey(listControlKey);
    setCurrentPage(1);
  }

  const safePage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, safePage]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  const clearFilters = () => {
    setSearch('');
    setTenantFilter('');
    setRoleFilter('');
    setStatusFilter('all');
  };

  const hasActiveFilters = !!(search.trim() || tenantFilter || roleFilter || statusFilter !== 'all');

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usersRes, rolesRes, tenantsRes] = await Promise.all([
          api.get<UserRow[]>('/users'),
          api.get<RoleRow[]>('/users/roles'),
          api.get<TenantRow[]>('/users/tenants'),
        ]);
        if (cancelled) return;
        setUsers(usersRes.data);
        setRoles(rolesRes.data);
        setTenants(tenantsRes.data);
        setAccessDenied(false);
      } catch {
        if (!cancelled) setAccessDenied(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const currentUserId = getAuthProfile()?.userId ?? '';
  const canDeleteCurrentUser =
    modalMode === 'edit'
    && editingUserId
    && editingUserId !== currentUserId
    && !lockedSuperAdmin;

  const handleDelete = async (userId?: string) => {
    const targetId = userId ?? editingUserId;
    if (!targetId) return;
    const user = users.find((u) => u.id === targetId);
    if (!user) return;
    if (!window.confirm(`"${user.fullName}" kullanıcısını silmek istediğinize emin misiniz?\n\nHesap devre dışı bırakılır; açık iş emirleri Atanmamış'a çekilir.`)) return;

    setIsDeleting(true);
    try {
      await api.delete(`/users/${targetId}`);
      await loadUsers();
      if (editingUserId === targetId) closeModal();
    } catch (err) {
      alert(errMsg(err));
    } finally {
      setIsDeleting(false);
    }
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
    return <PageLoading className="absolute inset-0 z-20 min-h-0 h-full" />;
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Ara</label>
            <input
              type="text"
              placeholder="İsim, e-posta, kullanıcı adı..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Firma</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
            >
              <option value="">Tüm firmalar</option>
              {tenantOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Rol</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Tüm roller</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Durum</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            {sortedUsers.length} kullanıcı
            {hasActiveFilters && ` (toplam ${users.length} içinden)`}
            {sortedUsers.length > 0 && ` · Sayfa ${safePage} / ${totalPages}`}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-700">
                <button type="button" onClick={() => handleSort('fullName')} className="inline-flex items-center gap-1 hover:text-blue-600">
                  İsim / E-posta <span className="text-slate-400 text-xs">{sortIndicator('fullName')}</span>
                </button>
              </th>
              <th className="p-4 font-semibold text-slate-700">
                <button type="button" onClick={() => handleSort('tenantName')} className="inline-flex items-center gap-1 hover:text-blue-600">
                  Firma <span className="text-slate-400 text-xs">{sortIndicator('tenantName')}</span>
                </button>
              </th>
              <th className="p-4 font-semibold text-slate-700">
                <button type="button" onClick={() => handleSort('roles')} className="inline-flex items-center gap-1 hover:text-blue-600">
                  Roller <span className="text-slate-400 text-xs">{sortIndicator('roles')}</span>
                </button>
              </th>
              <th className="p-4 font-semibold text-slate-700">
                <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-blue-600">
                  Durum <span className="text-slate-400 text-xs">{sortIndicator('status')}</span>
                </button>
              </th>
              <th className="p-4 font-semibold text-slate-700 w-28">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition"
              >
                <td className="p-4 cursor-pointer" onClick={() => openEdit(user)}>
                  <div className="font-medium text-slate-800">{user.fullName}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5">@{user.username}</div>
                </td>
                <td className="p-4 text-sm text-slate-700 cursor-pointer" onClick={() => openEdit(user)}>{user.tenantName}</td>
                <td className="p-4 cursor-pointer" onClick={() => openEdit(user)}>
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
                <td className="p-4 cursor-pointer" onClick={() => openEdit(user)}>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {user.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      Düzenle
                    </button>
                    {user.id !== currentUserId && !user.roles.includes(SUPER_ADMIN_ROLE) && (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(user.id);
                        }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 disabled:opacity-50"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sortedUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">
                  {users.length === 0 ? 'Henüz kullanıcı yok.' : 'Filtrelere uygun kullanıcı bulunamadı.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {sortedUsers.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 disabled:opacity-40 hover:bg-slate-100"
            >
              ← Önceki
            </button>
            <div className="flex flex-wrap items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-8 px-2 py-1.5 rounded-lg text-sm font-bold transition ${
                    page === safePage
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-700 disabled:opacity-40 hover:bg-slate-100"
            >
              Sonraki →
            </button>
          </div>
        )}
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

            <div className="flex justify-between items-center gap-2 mt-6">
              <div>
                {canDeleteCurrentUser && (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={isDeleting || isSaving}
                    className="px-4 py-2 rounded-lg bg-rose-50 text-rose-700 font-semibold border border-rose-200 hover:bg-rose-100 disabled:opacity-60"
                  >
                    {isDeleting ? 'Siliniyor...' : 'Kullanıcıyı Sil'}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
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
                disabled={isSaving || isDeleting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60"
              >
                {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
