import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { canManageEdasCompanies } from '../utils/authSession';

type EmptyOption = 'select' | 'dash' | 'none';

interface EdasSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  emptyOption?: EmptyOption;
  className?: string;
}

export default function EdasSelectField({
  value,
  onChange,
  required,
  emptyOption = 'select',
  className = 'w-full border rounded-lg p-2.5 bg-slate-50',
}: EdasSelectFieldProps) {
  const [companies, setCompanies] = useState<string[]>([]);
  const [canManage, setCanManage] = useState(canManageEdasCompanies());
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const loadCompanies = useCallback(async () => {
    const [listRes, capRes] = await Promise.all([
      api.get<{ id: string; name: string }[]>('/edas-companies'),
      api.get<{ canManageEdasCompanies?: boolean }>('/edas-companies/capabilities'),
    ]);
    const names = listRes.data.map((item) => item.name);
    setCompanies(names);
    setCanManage(!!capRes.data?.canManageEdasCompanies || canManageEdasCompanies());
    return names;
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCompanies().catch(() => {
      if (!cancelled) setCompanies([]);
    });
    return () => {
      cancelled = true;
    };
  }, [loadCompanies]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('EDAŞ adı giriniz.');
      return;
    }

    setAdding(true);
    setError('');
    try {
      const res = await api.post<{ id: string; name: string }>('/edas-companies', { name: trimmed });
      const createdName = res.data.name;
      setCompanies((prev) => [...prev, createdName].sort((a, b) => a.localeCompare(b, 'tr')));
      onChange(createdName);
      setNewName('');
      setShowAdd(false);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'EDAŞ eklenemedi.';
      setError(message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <select
        required={required}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {emptyOption === 'select' && <option value="">Seçiniz</option>}
        {emptyOption === 'dash' && <option value="-">-</option>}
        {companies.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      {canManage && (
        <div className="mt-1.5">
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
            >
              + Yeni EDAŞ ekle
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                maxLength={100}
                placeholder="EDAŞ adı"
                className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
              <button
                type="button"
                disabled={adding}
                onClick={() => void handleAdd()}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                {adding ? '...' : 'Ekle'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setNewName('');
                  setError('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                İptal
              </button>
            </div>
          )}
          {error && <p className="text-[11px] text-rose-600 font-semibold mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
