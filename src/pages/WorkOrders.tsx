// src/pages/WorkOrders.tsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';

interface WorkOrderData {
  id: string;
  title: string;
  customerName: string;
  priority: string;
  status: string;
  type: string;
  category: string;
  description: string;
  mobileDescription: string;
  address: string;
  startDate: string;
  endDate: string;
  position: [number, number];
  operationUserName: string;
  openedByUserName: string;
  assignedToUserName: string;
  isPeriodic?: boolean;
  recurrenceInterval?: string;
}

interface LookupData {
  personnel: { id: string; fullName: string }[];
  types: string[];
  categories: string[];
}

export default function WorkOrders() {
  const [filter, setFilter] = useState('Tümü');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<WorkOrderData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [lookups, setLookups] = useState<LookupData>({ 
    personnel: [], 
    types: ['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu'], 
    categories: ['Arıza Bildirimi', 'Periyodik Bakım', 'Devreye Alma', 'Altyapı İncelemesi'] 
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderData | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    title: '', customerName: '', description: '', mobileDescription: '', address: '',
    priority: 'Orta', workType: 'Arıza', workCategory: 'Arıza Bildirimi',
    startDate: '2026-06-19T12:00', endDate: '2026-06-20T12:00', lat: 39.92, lng: 32.85,
    operationUserId: '', openedByUserId: '', assignedToUserId: '',
    isPeriodic: false, recurrenceInterval: 'None'
  });

  const { setFocusedMarkerPosition } = useOutletContext<{ setFocusedMarkerPosition: (pos: [number, number] | null) => void }>();

  const filteredOrders = orders
    .filter(order => {
      if (filter === 'Tümü') return true;
      if (filter === 'Atanmamış') return !order.assignedToUserName || order.assignedToUserName === '' || order.assignedToUserName === 'Atanmamış';
      if (filter === 'Tamamlanan') return order.status === 'Tamamlandı';
      if (filter === 'İptal Edilen') return order.status === 'İptal Edildi';
      return order.status === filter;
    })
    .filter(order => searchTerm === '' || order.title.toLowerCase().includes(searchTerm.toLowerCase()) || order.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders([]); 
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id)); 
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedOrders.includes(id)) setSelectedOrders(prev => prev.filter(orderId => orderId !== id));
    else setSelectedOrders(prev => [...prev, id]);
  };

  const fetchOrders = async () => {
    try {
      const response = await api.get('/workorders');
      setOrders(response.data);
    } catch (error) {
      console.error("Veriler çekilemedi:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [ordersRes, lookupsRes] = await Promise.all([
          api.get('/workorders'),
          api.get('/workorders/lookups')
        ]);
        
        if (isMounted) {
          setOrders(ordersRes.data);
          
          const backendData = lookupsRes.data || {};
          const mappedPersonnel = backendData.teams ? backendData.teams.map((t: { id: string; name: string }) => ({ id: t.id, fullName: t.name })) : [];

          setLookups({
            personnel: mappedPersonnel,
            types: ['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu'],
            categories: ['Arıza Bildirimi', 'Periyodik Bakım', 'Devreye Alma', 'Altyapı İncelemesi']
          });

          if (mappedPersonnel.length > 0) {
            setFormData(prev => ({
              ...prev,
              operationUserId: mappedPersonnel[0].id,
              openedByUserId: mappedPersonnel[0].id,
              assignedToUserId: mappedPersonnel[0].id,
            }));
          }
        }
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 🚀 ZIRH: BÜTÜN EKSİK ALANLAR API'YE EKLENDİ
      await api.post('/workorders', {
        title: formData.title, 
        customerName: formData.customerName, 
        description: formData.description,
        mobileDescription: formData.mobileDescription, 
        address: formData.address, 
        priority: formData.priority,
        type: formData.workType, 
        category: formData.workCategory,
        startDate: new Date(formData.startDate).toISOString(), 
        endDate: new Date(formData.endDate).toISOString(),
        latitude: Number(formData.lat), 
        longitude: Number(formData.lng),
        operationUserId: formData.operationUserId || null, 
        openedByUserId: formData.openedByUserId || null, 
        assignedToUserId: formData.assignedToUserId || null,
        isPeriodic: formData.isPeriodic, 
        recurrenceInterval: formData.recurrenceInterval
      });
      setIsFormOpen(false);
      fetchOrders();
    } catch (error) {
      console.error("Kayıt hatası:", error);
      alert("İş emri kaydedilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 bg-slate-50 relative overflow-hidden">
      
      <h1 className="text-2xl font-extrabold text-brand-navy mb-4">İş Emirleri</h1>

      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
        <div className="flex flex-1 gap-4 items-center min-w-75">
          <input type="text" placeholder="İş emri veya nokta ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-orange bg-slate-50 cursor-pointer">
            <option value="Tümü">Tüm İşler</option>
            <option value="Bekliyor">Bekliyor</option>
            <option value="Devam Ediyor">Devam Ediyor</option>
            <option value="Tamamlanan">Tamamlanan</option>
            <option value="İptal Edilen">İptal Edilen</option>
            <option value="Atanmamış">Atanmamış İşler</option>
          </select>
        </div>
        <button onClick={() => setIsFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-5 rounded-lg transition-colors shadow-sm whitespace-nowrap">+ İş Emri Ekle</button>
      </div>

      {selectedOrders.length > 0 && (
        <div className="bg-brand-navy text-white px-5 py-3 rounded-xl mb-4 flex justify-between items-center shadow-md">
          <span className="font-bold text-sm">{selectedOrders.length} iş emri seçildi</span>
          <div className="flex gap-3">
            <button className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">✓ Toplu Onayla</button>
            <button className="bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">🗑 Toplu Sil</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3 px-2">
        <input type="checkbox" className="w-5 h-5 cursor-pointer accent-brand-orange" checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} onChange={handleSelectAll} />
        <span className="text-sm font-bold text-slate-600">Tümünü Seç</span>
      </div>
      
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center pt-20 space-y-3">
            <svg className="animate-spin h-8 w-7 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="text-xs font-bold text-slate-400 tracking-wide animate-pulse">İş Emirleri Yükleniyor...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <p className='text-sm text-slate-500 text-center mt-10'>Aranan kriterde iş emri bulunamadı.</p>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} onClick={() => order.position && setFocusedMarkerPosition([...order.position])} className={`cursor-pointer bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative flex items-center gap-4 transition-all hover:border-brand-orange hover:shadow-md ${order.priority === 'Acil' ? 'border-l-4 border-l-rose-600' : ''}`}>
              <input type="checkbox" className="w-5 h-5 cursor-pointer accent-brand-orange shrink-0" checked={selectedOrders.includes(order.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(order.id); }} />
              <div className="flex-1">
                <h3 className="text-base font-bold text-brand-navy mb-2">Nokta Adı: {order.customerName || order.title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs mb-3">
                  <div className="flex justify-between md:justify-start gap-2"><span className="text-slate-500 font-medium">İş Tipi:</span><span className="text-slate-800 font-bold">{order.type}</span></div>
                  <div className="flex justify-between md:justify-start gap-2"><span className="text-slate-500 font-medium">Öncelik:</span><span className={`font-bold ${order.priority === 'Acil' ? 'text-rose-600' : 'text-slate-700'}`}>{order.priority}</span></div>
                  <div className="flex justify-between md:justify-start gap-2"><span className="text-slate-500 font-medium">Durum:</span><span className="font-bold text-blue-600">{order.status}</span></div>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsDetailModalOpen(true); }} className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition shadow-sm">🔎 Detayları Gör</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`fixed top-20 right-0 bottom-0 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] border-l border-slate-200 transition-transform duration-300 z-40 flex flex-col ${isFormOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '450px' }}>
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2"><span className="text-emerald-600 font-bold">Formu</span><span className="text-slate-400">›</span><span className="font-bold text-brand-navy text-sm truncate max-w-50">{formData.customerName || 'Yeni İş Emri'}</span></div>
          <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-sm pb-10">
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Tipi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.workType} onChange={e => setFormData({...formData, workType: e.target.value})}>{lookups.types.map((t, idx) => <option key={idx} value={t}>{t}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Kategorisi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.workCategory} onChange={e => setFormData({...formData, workCategory: e.target.value})}>{lookups.categories.map((c, idx) => <option key={idx} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">İş Öncelik Tipi</label><select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}><option>Düşük</option><option>Orta</option><option>Acil</option></select></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Başlık / İş Özeti</label><input required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-700 mb-1">Müşteri / Pano Adı</label><input required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-orange outline-none" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} /></div>
          
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Planlanan Başlangıç</label><input type="datetime-local" className="w-full border border-slate-300 rounded-lg p-2.5" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Planlanan Bitiş</label><input type="datetime-local" className="w-full border border-slate-300 rounded-lg p-2.5" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} /></div>
          </div>
          <div className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Enlem (Lat)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Boylam (Lng)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div>
          </div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Sistem Açıklaması</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Saha Mobil Açıklaması</label><textarea className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.mobileDescription} onChange={e => setFormData({...formData, mobileDescription: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-600 mb-1">Tam Açık Adres</label><textarea required className="w-full border border-slate-300 rounded-lg p-2.5" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
          
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
            <label className="flex items-center gap-2 font-bold text-emerald-800 text-xs cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" checked={formData.isPeriodic} onChange={e => setFormData({...formData, isPeriodic: e.target.checked})} />
              <span>Bu Bir Periyodik İş Emridir (Otomatik Tekrarlansın)</span>
            </label>
            {formData.isPeriodic && (
              <div>
                <label className="block text-[11px] font-bold text-emerald-700 mb-1">Tekrarlanma Döngüsü Sıklığı</label>
                <select className="w-full border border-emerald-200 rounded-lg p-2 bg-white text-xs font-semibold text-slate-700" value={formData.recurrenceInterval} onChange={e => setFormData({...formData, recurrenceInterval: e.target.value})}>
                  <option value="Haftalik">Her Hafta Otomatik Açılsın</option>
                  <option value="Aylik">Her Ay Otomatik Açılsın</option>
                  <option value="Yillik">Her Yıl Otomatik Açılsın</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Operasyon Atamaları</h4>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Operasyon Sorumlusu</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.operationUserId} onChange={e => setFormData({...formData, operationUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">İş Açan Yetkili</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.openedByUserId} onChange={e => setFormData({...formData, openedByUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
            <div><label className="block text-[11px] font-bold text-slate-600 mb-1">İş Atanan Sahacı</label><select className="w-full border border-slate-300 rounded-lg p-2 bg-white" value={formData.assignedToUserId} onChange={e => setFormData({...formData, assignedToUserId: e.target.value})}>{lookups.personnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></div>
          </div>
          
          <div className="flex gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 border border-slate-300 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 transition">İptal</button>
            <button type="submit" disabled={isSubmitting} className={`flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-md transition ${isSubmitting ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isSubmitting ? (
                <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Kaydediliyor...</span></>
              ) : (<span>✓ Kaydet</span>)}
            </button>
          </div>
        </form>
      </div>

      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div><h2 className="text-base font-bold text-brand-navy">İş Emri Detay Kartı</h2></div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl p-1 transition-colors">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-x-6 gap-y-4 custom-scrollbar text-xs">
              <div className="col-span-2 bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold text-sm">📌 Nokta Adı: {selectedOrder.customerName}</div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Başlığı / Özeti</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.title} /></div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Öncelik Tipi</label><input disabled className={`w-full bg-slate-50 border border-slate-200 font-bold rounded-lg p-2.5 cursor-not-allowed ${selectedOrder.priority === 'Acil' ? 'text-rose-600' : 'text-slate-700'}`} value={selectedOrder.priority} /></div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Tipi</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.type} /></div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Kategorisi</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.category} /></div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Planlanan Başlangıç</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.startDate || ''} /></div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Planlanan Bitiş</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.endDate || ''} /></div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Enlem - Lat)</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-mono rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.position?.[0] || ''} /></div>
              <div><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Boylam - Lng)</label><input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-600 font-mono rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.position?.[1] || ''} /></div>
              <div className="col-span-2"><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Sistem Açıklaması</label><textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedOrder.description || 'Açıklama girilmemiş.'} /></div>
              <div className="col-span-2"><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Saha Mobil Açıklaması</label><textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedOrder.mobileDescription || 'Mobil açıklama girilmemiş.'} /></div>
              <div className="col-span-2"><label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Tam Açık Adres</label><textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedOrder.address || 'Adres girilmemiş.'} /></div>
              
              <div className="col-span-2 grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Operasyon Sorumlusu</label><div className="font-bold text-slate-700 truncate">{selectedOrder.operationUserName}</div></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">İş Açan Yetkili</label><div className="font-bold text-slate-700 truncate">{selectedOrder.openedByUserName}</div></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Atanan Sahacı</label><div className="font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded px-2 py-0.5 inline-block max-w-full truncate">👷 {selectedOrder.assignedToUserName || 'Sahacı Atanmamış'}</div></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end"><button onClick={() => setIsDetailModalOpen(false)} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 transition shadow">Kapat</button></div>
          </div>
        </div>
      )}

    </div>
  );
}