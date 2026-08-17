// src/pages/WorkOrders.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import { trIncludes } from '../utils/trSearch';
import { getPartnerByKey, resolvePartnerKey } from '../utils/partners';
import { durationMinutes, formatTurkeyDateTime, toTurkeyDateTimeLocal } from '../utils/dateTime';
import { isSuperAdmin, canCloseWorkOrderFromOffice, saveAuthProfileFromMeResponse } from '../utils/authSession';
import { mergeOfficeAndFieldPersonnel } from '../utils/personnelLookups';
import ModalOverlay from '../components/ModalOverlay';
import PageLoading from '../components/PageLoading';
import WorkOrderPhotoPicker from '../components/WorkOrderPhotoPicker';
import { sortWorkOrdersNewestFirst } from '../utils/workOrderSort';
import {
  formatOpeningUploadError,
  isVideoContentType,
  MAX_OPENING_ATTACHMENTS,
  OPENING_ATTACHMENT_CATEGORY,
  revokePendingPreviews,
  uploadOpeningAttachments,
  uploadWorkOrderPhotos,
  type PendingOpeningAttachment,
} from '../utils/openingAttachments';

interface WorkOrderData {
  id: string;
  title: string;
  customerName: string;
  tenantId?: string;
  priority: string;
  status: string;
  type: string;
  category: string;
  description: string;
  mobileDescription: string;
  address: string;
  startDate: string;
  endDate: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  position: [number, number];
  operationUserId?: string | null;
  operationUserName: string;
  openedByUserId?: string | null;
  openedByUserName: string;
  assignedToUserId?: string | null;
  assignedToUserName: string;
  fieldNote?: string | null;
  fieldNoteAddedAt?: string | null;
  isPeriodic?: boolean;
  recurrenceInterval?: string;
  titleEn?: string | null;
  descriptionEn?: string | null;
  mobileDescriptionEn?: string | null;
  fieldNoteEn?: string | null;
  translationProvider?: string | null;
  translatedAt?: string | null;
  createdAt?: string | null;
}

function isTerminalWorkOrderStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'tamamlandı' || s === 'iptal' || s === 'iptal edildi';
}

type WorkOrderStatusFilterKey =
  | 'Atanmamış'
  | 'Bekliyor'
  | 'Devam Ediyor'
  | 'Tamamlanan'
  | 'İptal';

const WORK_ORDER_STATUS_BADGES: {
  key: WorkOrderStatusFilterKey;
  label: string;
  active: string;
  idle: string;
}[] = [
  { key: 'Atanmamış', label: 'Atanmamış', active: 'bg-slate-700 text-white border-slate-700', idle: 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400' },
  { key: 'Bekliyor', label: 'Bekliyor', active: 'bg-amber-500 text-white border-amber-500', idle: 'bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-300' },
  { key: 'Devam Ediyor', label: 'Devam Ediyor', active: 'bg-blue-600 text-white border-blue-600', idle: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300' },
  { key: 'Tamamlanan', label: 'Tamamlanan', active: 'bg-emerald-600 text-white border-emerald-600', idle: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300' },
  { key: 'İptal', label: 'İptal', active: 'bg-rose-600 text-white border-rose-600', idle: 'bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300' },
];

const TERMINAL_WORK_ORDER_STATUSES = new Set(['Tamamlandı', 'İptal', 'İptal Edildi']);

function matchesWorkOrderStatusFilter(order: WorkOrderData, statusKey: WorkOrderStatusFilterKey): boolean {
  if (statusKey === 'Tamamlanan') return order.status === 'Tamamlandı';
  if (statusKey === 'İptal') return order.status === 'İptal Edildi' || order.status === 'İptal';

  if (TERMINAL_WORK_ORDER_STATUSES.has(order.status)) {
    return false;
  }

  if (statusKey === 'Atanmamış') {
    return order.status === 'Atanmamış'
      || !order.assignedToUserId
      || !order.assignedToUserName
      || order.assignedToUserName === ''
      || order.assignedToUserName === 'Atanmamış';
  }
  return order.status === statusKey;
}

interface OrderPhoto {
  id: string;
  fileName: string;
  url: string;
  contentType: string;
  isVideo: boolean;
  category: 'ISG' | 'OPERASYON' | 'DIGER' | 'ACILIS';
}

interface StationLookup {
  id: string;
  name: string;
  address?: string;
  city?: string;
  district?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  ownerCompany?: string | null;
  tenantId?: string;
  latitude: number;
  longitude: number;
}

interface ProjectLookup {
  id: string;
  name: string;
  tenantId: string;
}

interface LookupData {
  personnel: { id: string; fullName: string }[];
  officeUsers: { id: string; fullName: string }[];
  types: string[];
  categories: string[];
  stations: StationLookup[];
  projects: ProjectLookup[];
}

export default function WorkOrders() {
  const isSuperAdminUser = isSuperAdmin();
  const canOfficeClose = canCloseWorkOrderFromOffice();

  const [filter, setFilter] = useState<WorkOrderStatusFilterKey | null>(
    isSuperAdminUser ? 'Atanmamış' : null,
  );
  const [bulkAssignUserId, setBulkAssignUserId] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [canViewIsgPhotos, setCanViewIsgPhotos] = useState(true);
  const [canViewOperationPhotos, setCanViewOperationPhotos] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<WorkOrderData[]>([]);
  
  const [lookups, setLookups] = useState<LookupData>({ 
    personnel: [], 
    officeUsers: [],
    types: ['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu'], 
    categories: ['Arıza Bildirimi', 'Periyodik Bakım', 'Devreye Alma', 'Altyapı İncelemesi'],
    stations: [],
    projects: [],
  });

  const operationAssigneeOptions = useMemo(
    () =>
      isSuperAdminUser
        ? mergeOfficeAndFieldPersonnel(lookups.officeUsers, lookups.personnel)
        : lookups.officeUsers,
    [isSuperAdminUser, lookups.officeUsers, lookups.personnel],
  );
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderData | null>(null);
  const [orderPhotos, setOrderPhotos] = useState<OrderPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const photoUrlsRef = useRef<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [lightbox, setLightbox] = useState<{
    photos: OrderPhoto[];
    index: number;
    title: string;
  } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [isOfficeClosing, setIsOfficeClosing] = useState(false);
  /** TESLA: varsayılan EN; bayraklarla TR/EN */
  const [displayLang, setDisplayLang] = useState<'en' | 'tr'>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [pendingOpeningAttachments, setPendingOpeningAttachments] = useState<PendingOpeningAttachment[]>([]);
  const [pendingIsgAttachments, setPendingIsgAttachments] = useState<PendingOpeningAttachment[]>([]);
  const [pendingOperasyonAttachments, setPendingOperasyonAttachments] = useState<PendingOpeningAttachment[]>([]);
  const [editFormData, setEditFormData] = useState({
    title: '',
    customerName: '',
    priority: 'Orta',
    type: 'Arıza',
    category: 'Arıza Bildirimi',
    startDate: '',
    endDate: '',
    lat: 0,
    lng: 0,
    description: '',
    mobileDescription: '',
    address: '',
    operationUserId: '',
    openedByUserId: '',
    assignedToUserId: '',
    isPeriodic: false,
    recurrenceInterval: 'Haftalik',
    startedAt: '',
    completedAt: '',
    cancelledAt: '',
    fieldNote: '',
  });

  const { setFocusedMarkerPosition, refreshMapData, partnerKey } = useOutletContext<{
    setFocusedMarkerPosition: (pos: [number, number] | null) => void;
    refreshMapData: () => Promise<void>;
    partnerKey?: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchMatchedOrders = useMemo(
    () => orders.filter(
      (order) =>
        searchTerm === ''
        || trIncludes(order.title, searchTerm)
        || trIncludes(order.customerName, searchTerm),
    ),
    [orders, searchTerm],
  );

  const statusCounts = useMemo(() => {
    const counts = {} as Record<WorkOrderStatusFilterKey, number>;
    for (const badge of WORK_ORDER_STATUS_BADGES) {
      counts[badge.key] = searchMatchedOrders.filter((o) => matchesWorkOrderStatusFilter(o, badge.key)).length;
    }
    return counts;
  }, [searchMatchedOrders]);

  const filteredOrders = useMemo(() => {
    const base = !filter
      ? searchMatchedOrders
      : searchMatchedOrders.filter((order) => matchesWorkOrderStatusFilter(order, filter));
    return sortWorkOrdersNewestFirst(base);
  }, [searchMatchedOrders, filter]);

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

  const revokePhotoUrls = () => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photoUrlsRef.current = [];
  };

  const clearPendingAttachments = () => {
    setPendingOpeningAttachments((prev) => {
      revokePendingPreviews(prev);
      return [];
    });
    setPendingIsgAttachments((prev) => {
      revokePendingPreviews(prev);
      return [];
    });
    setPendingOperasyonAttachments((prev) => {
      revokePendingPreviews(prev);
      return [];
    });
  };

  const loadOrderPhotos = useCallback(async (workOrderId: string) => {
    setLoadingPhotos(true);
    revokePhotoUrls();
    setOrderPhotos([]);
    try {
      const { data } = await api.get<Array<{ id: string; fileName: string; contentType?: string; description?: string | null }>>(`/photos/WorkOrder/${workOrderId}`);
      const loaded = await Promise.all(
        data.map(async (photo) => {
          const res = await api.get(`/photos/${photo.id}/image`, { responseType: 'blob' });
          const url = URL.createObjectURL(res.data);
          photoUrlsRef.current.push(url);
          const categoryValue = (photo.description ?? '').trim().toUpperCase();
          const category: OrderPhoto['category'] =
            categoryValue === 'ISG' ? 'ISG'
              : categoryValue === 'OPERASYON' ? 'OPERASYON'
                : categoryValue === OPENING_ATTACHMENT_CATEGORY ? 'ACILIS'
                  : 'DIGER';
          const contentType = String(photo.contentType || res.headers['content-type'] || 'image/jpeg');
          return {
            id: photo.id,
            fileName: photo.fileName,
            url,
            contentType,
            isVideo: isVideoContentType(contentType),
            category,
          };
        }),
      );
      setOrderPhotos(loaded);
    } catch (error) {
      console.error('Fotoğraflar yüklenemedi:', error);
      setOrderPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }, []);

  const isTeslaOrder = useCallback((order: WorkOrderData | null | undefined) => {
    if (!order) return false;
    if (partnerKey === 'tesla') return true;
    return resolvePartnerKey({ tenantId: order.tenantId, name: order.customerName }) === 'tesla';
  }, [partnerKey]);

  const ensureTranslation = useCallback(async (order: WorkOrderData): Promise<WorkOrderData> => {
    if (order.titleEn?.trim()) return order;
    setIsTranslating(true);
    try {
      const { data } = await api.post<{
        titleEn?: string;
        descriptionEn?: string;
        mobileDescriptionEn?: string;
        fieldNoteEn?: string | null;
        translationProvider?: string;
        translatedAt?: string;
      }>(`/workorders/${order.id}/translate`);
      const updated: WorkOrderData = {
        ...order,
        titleEn: data.titleEn ?? null,
        descriptionEn: data.descriptionEn ?? null,
        mobileDescriptionEn: data.mobileDescriptionEn ?? null,
        fieldNoteEn: data.fieldNoteEn ?? null,
        translationProvider: data.translationProvider ?? null,
        translatedAt: data.translatedAt ?? null,
      };
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      return updated;
    } catch (error) {
      console.error('Çeviri başarısız:', error);
      alert('İngilizce çeviri alınamadı. API key’leri kontrol edin veya Türkçe görünüme geçin.');
      return order;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const openDetailModal = useCallback(async (order: WorkOrderData) => {
    const tesla = isTeslaOrder(order);
    setDisplayLang(tesla ? 'en' : 'tr');
    setSelectedOrder(order);
    setAssignUserId(order.assignedToUserId || '');
    setIsEditingDetail(false);
    clearPendingAttachments();
    setEditFormData({
      title: order.title || '',
      customerName: order.customerName || '',
      priority: order.priority || 'Orta',
      type: order.type || 'Arıza',
      category: order.category || 'Arıza Bildirimi',
      startDate: toTurkeyDateTimeLocal(order.startDate),
      endDate: toTurkeyDateTimeLocal(order.endDate),
      lat: order.position?.[0] ?? 0,
      lng: order.position?.[1] ?? 0,
      description: order.description || '',
      mobileDescription: order.mobileDescription || '',
      address: order.address || '',
      operationUserId: order.operationUserId || '',
      openedByUserId: order.openedByUserId || '',
      assignedToUserId: order.assignedToUserId || '',
      isPeriodic: !!order.isPeriodic,
      recurrenceInterval: order.recurrenceInterval && order.recurrenceInterval !== 'None'
        ? order.recurrenceInterval
        : 'Haftalik',
      startedAt: order.startedAt ? toTurkeyDateTimeLocal(order.startedAt) : '',
      completedAt: order.completedAt ? toTurkeyDateTimeLocal(order.completedAt) : '',
      cancelledAt: order.cancelledAt ? toTurkeyDateTimeLocal(order.cancelledAt) : '',
      fieldNote: order.fieldNote?.trim() || '',
    });
    setIsDetailModalOpen(true);
    void loadOrderPhotos(order.id);

    if (tesla && !order.titleEn?.trim()) {
      const translated = await ensureTranslation(order);
      setSelectedOrder(translated);
    }
  }, [loadOrderPhotos, isTeslaOrder, ensureTranslation]);

  const closeDetailModal = () => {
    revokePhotoUrls();
    clearPendingAttachments();
    setOrderPhotos([]);
    setIsDetailModalOpen(false);
    setSelectedOrder(null);
    setAssignUserId('');
    setIsEditingDetail(false);
    setDisplayLang('tr');
  };

  const handleOfficeClose = async (closeStatus: 'Tamamlandı' | 'İptal') => {
    if (!selectedOrder || isOfficeClosing) return;
    setIsOfficeClosing(true);
    try {
      const { data } = await api.post<{
        message?: string;
        status?: string;
        completedAt?: string | null;
        cancelledAt?: string | null;
        fieldNote?: string;
        fieldNoteAddedAt?: string | null;
      }>(`/workorders/${selectedOrder.id}/office-close`, { status: closeStatus });
      const updated: WorkOrderData = {
        ...selectedOrder,
        status: data.status ?? closeStatus,
        completedAt: closeStatus === 'Tamamlandı'
          ? (data.completedAt ?? selectedOrder.completedAt)
          : selectedOrder.completedAt,
        cancelledAt: closeStatus === 'İptal'
          ? (data.cancelledAt ?? selectedOrder.cancelledAt)
          : selectedOrder.cancelledAt,
        fieldNote: data.fieldNote ?? selectedOrder.fieldNote,
        fieldNoteAddedAt: data.fieldNoteAddedAt ?? selectedOrder.fieldNoteAddedAt,
        fieldNoteEn: null,
      };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      await refreshMapData();
    } catch (error: unknown) {
      console.error('Ofisten kapatma başarısız:', error);
      const msg =
        axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'İş emri kapatılamadı.';
      alert(msg);
    } finally {
      setIsOfficeClosing(false);
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedOrder) return;
    if (!editFormData.title.trim()) {
      alert('Başlık zorunludur.');
      return;
    }
    setIsSavingDetail(true);
    try {
      const payload: Record<string, unknown> = {
        title: editFormData.title,
        customerName: editFormData.customerName,
        description: editFormData.description,
        mobileDescription: editFormData.mobileDescription,
        address: editFormData.address,
        priority: editFormData.priority,
        type: editFormData.type,
        category: editFormData.category,
        startDate: new Date(editFormData.startDate).toISOString(),
        endDate: new Date(editFormData.endDate).toISOString(),
        latitude: Number(editFormData.lat),
        longitude: Number(editFormData.lng),
        operationUserId: editFormData.operationUserId || null,
        openedByUserId: editFormData.openedByUserId || null,
        assignedToUserId: editFormData.assignedToUserId || null,
        isPeriodic: editFormData.isPeriodic,
        recurrenceInterval: editFormData.isPeriodic ? editFormData.recurrenceInterval : 'None',
        fieldNote: editFormData.fieldNote,
      };
      if (isSuperAdminUser) {
        if (editFormData.startedAt) payload.startedAt = new Date(editFormData.startedAt).toISOString();
        if (editFormData.completedAt) payload.completedAt = new Date(editFormData.completedAt).toISOString();
        if (editFormData.cancelledAt) payload.cancelledAt = new Date(editFormData.cancelledAt).toISOString();
      }
      const { data } = await api.put(`/workorders/${selectedOrder.id}`, payload);

      const attachmentsToUpload = [
        { items: pendingOpeningAttachments, category: OPENING_ATTACHMENT_CATEGORY },
        { items: pendingIsgAttachments, category: 'ISG' },
        { items: pendingOperasyonAttachments, category: 'OPERASYON' },
      ].filter((batch) => batch.items.length > 0);

      for (const batch of attachmentsToUpload) {
        if (batch.category === OPENING_ATTACHMENT_CATEGORY) {
          await uploadOpeningAttachments(selectedOrder.id, batch.items);
        } else {
          await uploadWorkOrderPhotos(selectedOrder.id, batch.items, batch.category);
        }
      }

      const updated: WorkOrderData = {
        ...selectedOrder,
        title: data.title,
        customerName: data.customerName,
        description: data.description,
        mobileDescription: data.mobileDescription,
        address: data.address,
        priority: data.priority,
        type: data.type,
        category: data.category,
        status: data.status ?? selectedOrder.status,
        startDate: data.startDate,
        endDate: data.endDate,
        position: data.position,
        operationUserId: data.operationUserId,
        operationUserName: data.operationUserName,
        openedByUserId: data.openedByUserId,
        openedByUserName: data.openedByUserName,
        assignedToUserId: data.assignedToUserId,
        assignedToUserName: data.assignedToUserName,
        isPeriodic: data.isPeriodic,
        recurrenceInterval: data.recurrenceInterval,
        startedAt: data.startedAt ?? selectedOrder.startedAt,
        completedAt: data.completedAt ?? selectedOrder.completedAt,
        cancelledAt: data.cancelledAt ?? selectedOrder.cancelledAt,
        titleEn: null,
        descriptionEn: null,
        mobileDescriptionEn: null,
        fieldNoteEn: null,
        fieldNote: data.fieldNote ?? editFormData.fieldNote,
        fieldNoteAddedAt: data.fieldNoteAddedAt ?? selectedOrder.fieldNoteAddedAt,
        translationProvider: null,
        translatedAt: null,
      };

      setSelectedOrder(updated);
      setAssignUserId(updated.assignedToUserId || '');
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      setIsEditingDetail(false);
      clearPendingAttachments();
      if (attachmentsToUpload.length > 0) {
        await loadOrderPhotos(selectedOrder.id);
      }
      await refreshMapData();
      if (updated.position) {
        setFocusedMarkerPosition([...updated.position]);
      }

      if (isTeslaOrder(updated) && displayLang === 'en') {
        const translated = await ensureTranslation(updated);
        setSelectedOrder(translated);
      }
    } catch (error) {
      console.error('Güncelleme başarısız:', error);
      const msg = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : formatOpeningUploadError(error);
      alert(msg);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedOrder) return;
    if (!isSuperAdminUser) {
      alert('İş emri ataması yalnızca Super Admin tarafından yapılabilir.');
      return;
    }
    setIsAssigning(true);
    try {
      const { data } = await api.put<{
        message: string;
        status?: string;
        assignedToUserId: string | null;
        assignedToUserName: string;
        operationUserId?: string | null;
        operationUserName?: string;
        openedByUserId?: string | null;
        openedByUserName?: string;
      }>(`/workorders/${selectedOrder.id}/assign`, {
        assignedToUserId: assignUserId || null,
      });

      const updated: WorkOrderData = {
        ...selectedOrder,
        status: data.status ?? (assignUserId ? 'Bekliyor' : 'Atanmamış'),
        assignedToUserId: data.assignedToUserId,
        assignedToUserName: data.assignedToUserName,
        operationUserId: data.operationUserId ?? selectedOrder.operationUserId,
        operationUserName: data.operationUserName ?? selectedOrder.operationUserName,
        openedByUserId: data.openedByUserId ?? selectedOrder.openedByUserId,
        openedByUserName: data.openedByUserName ?? selectedOrder.openedByUserName,
      };
      setSelectedOrder(updated);
      setEditFormData((prev) => ({
        ...prev,
        assignedToUserId: data.assignedToUserId || '',
        operationUserId: data.operationUserId || prev.operationUserId,
        openedByUserId: data.openedByUserId || prev.openedByUserId,
      }));
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    } catch (error) {
      console.error('Atama başarısız:', error);
      alert('Personel ataması yapılamadı.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedOrders.length === 0) return;
    if (!window.confirm(`${selectedOrders.length} iş emri onaylansın (Tamamlandı) mı?`)) return;
    try {
      await api.post('/workorders/bulk-approve', { ids: selectedOrders });
      setSelectedOrders([]);
      const res = await api.get('/workorders');
      setOrders(res.data);
      await refreshMapData();
      alert('Seçili iş emirleri onaylandı.');
    } catch (error) {
      console.error(error);
      alert('Toplu onay başarısız.');
    }
  };

  const handleBulkAssign = async () => {
    if (!isSuperAdminUser) {
      alert('İş emri ataması yalnızca Super Admin tarafından yapılabilir.');
      return;
    }
    if (selectedOrders.length === 0) return;
    if (!bulkAssignUserId) {
      alert('Lütfen ekipten bir kişi seçin.');
      return;
    }
    const person = lookups.personnel.find((p) => p.id === bulkAssignUserId);
    if (!window.confirm(`${selectedOrders.length} iş emri ${person?.fullName || 'seçilen kişiye'} atansın mı?`)) return;
    setIsBulkAssigning(true);
    const idsSnapshot = [...selectedOrders];
    try {
      const { data } = await api.post<{ message?: string }>('/workorders/bulk-assign', {
        ids: idsSnapshot,
        assignedToUserId: bulkAssignUserId,
      });
      setSelectedOrders([]);
      setBulkAssignUserId('');
      const res = await api.get('/workorders');
      setOrders(res.data);
      await refreshMapData();
      if (selectedOrder && idsSnapshot.includes(selectedOrder.id)) {
        const refreshed = res.data.find((o: WorkOrderData) => o.id === selectedOrder.id);
        if (refreshed) {
          setSelectedOrder(refreshed);
          setAssignUserId(refreshed.assignedToUserId || '');
        }
      }
      alert(data.message || 'Atama tamamlandı.');
    } catch (error: unknown) {
      console.error(error);
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      alert(message || 'Toplu atama başarısız.');
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.length === 0) return;
    if (!window.confirm(`${selectedOrders.length} iş emri silinsin mi?`)) return;
    try {
      await api.post('/workorders/bulk-delete', { ids: selectedOrders });
      setSelectedOrders([]);
      const res = await api.get('/workorders');
      setOrders(res.data);
      await refreshMapData();
      alert('Seçili iş emirleri silindi.');
    } catch (error) {
      console.error(error);
      alert('Toplu silme başarısız.');
    }
  };

  const handlePurgeAll = async () => {
    const typed = window.prompt(
      'TÜM iş emirleri silinecek (yalnızca WorkOrders). Onaylamak için CONFIRM_PURGE_ALL yazın:',
    );
    if (typed !== 'CONFIRM_PURGE_ALL') return;
    setIsPurging(true);
    try {
      const { data } = await api.post<{ count: number; message: string }>('/workorders/purge-all', {
        confirm: 'CONFIRM_PURGE_ALL',
      });
      setSelectedOrders([]);
      setOrders([]);
      await refreshMapData();
      alert(data.message ?? `${data.count} iş emri silindi.`);
    } catch (error) {
      console.error(error);
      alert('Toplu temizlik başarısız.');
    } finally {
      setIsPurging(false);
    }
  };

  const openingPhotos = orderPhotos.filter((p) => p.category === 'ACILIS');
  const remainingOpeningSlots = Math.max(0, MAX_OPENING_ATTACHMENTS - openingPhotos.length);

  const visiblePhotoCategories = (['ISG', 'OPERASYON', 'DIGER'] as const).filter((category) => {
    if (category === 'ISG') return canViewIsgPhotos;
    if (category === 'OPERASYON') return canViewOperationPhotos;
    return canViewIsgPhotos || canViewOperationPhotos;
  });

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Bu fotoğraf silinsin mi?')) return;
    try {
      await api.delete(`/photos/${photoId}`);
      setOrderPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (lightbox && lightbox.photos[lightbox.index]?.id === photoId) {
        const nextPhotos = lightbox.photos.filter((p) => p.id !== photoId);
        if (nextPhotos.length === 0) setLightbox(null);
        else setLightbox({
          photos: nextPhotos,
          index: Math.min(lightbox.index, nextPhotos.length - 1),
          title: lightbox.title,
        });
      }
    } catch (error) {
      console.error(error);
      alert('Fotoğraf silinemedi.');
    }
  };

  const cancelEditDetail = () => {
    if (selectedOrder) {
      setEditFormData({
        title: selectedOrder.title || '',
        customerName: selectedOrder.customerName || '',
        priority: selectedOrder.priority || 'Orta',
        type: selectedOrder.type || 'Arıza',
        category: selectedOrder.category || 'Arıza Bildirimi',
        startDate: toTurkeyDateTimeLocal(selectedOrder.startDate),
        endDate: toTurkeyDateTimeLocal(selectedOrder.endDate),
        lat: selectedOrder.position?.[0] ?? 0,
        lng: selectedOrder.position?.[1] ?? 0,
        description: selectedOrder.description || '',
        mobileDescription: selectedOrder.mobileDescription || '',
        address: selectedOrder.address || '',
        operationUserId: selectedOrder.operationUserId || '',
        openedByUserId: selectedOrder.openedByUserId || '',
        assignedToUserId: selectedOrder.assignedToUserId || '',
        isPeriodic: !!selectedOrder.isPeriodic,
        recurrenceInterval: selectedOrder.recurrenceInterval && selectedOrder.recurrenceInterval !== 'None'
          ? selectedOrder.recurrenceInterval
          : 'Haftalik',
        startedAt: selectedOrder.startedAt ? toTurkeyDateTimeLocal(selectedOrder.startedAt) : '',
        completedAt: selectedOrder.completedAt ? toTurkeyDateTimeLocal(selectedOrder.completedAt) : '',
        cancelledAt: selectedOrder.cancelledAt ? toTurkeyDateTimeLocal(selectedOrder.cancelledAt) : '',
        fieldNote: selectedOrder.fieldNote?.trim() || '',
      });
    }
    clearPendingAttachments();
    setIsEditingDetail(false);
  };

  useEffect(() => () => revokePhotoUrls(), []);

  useEffect(() => {
    api.get('/users/me')
      .then(({ data }) => {
        saveAuthProfileFromMeResponse(data);
        if (typeof data.canViewIsgPhotos === 'boolean') setCanViewIsgPhotos(data.canViewIsgPhotos);
        if (typeof data.canViewOperationPhotos === 'boolean') setCanViewOperationPhotos(data.canViewOperationPhotos);
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightbox(null);
        return;
      }
      if (e.key === 'ArrowRight') {
        setLightbox((prev) =>
          prev
            ? { ...prev, index: (prev.index + 1) % prev.photos.length }
            : prev
        );
      }
      if (e.key === 'ArrowLeft') {
        setLightbox((prev) =>
          prev
            ? {
                ...prev,
                index: (prev.index - 1 + prev.photos.length) % prev.photos.length,
              }
            : prev
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [ordersRes, lookupsRes] = await Promise.all([
          api.get('/workorders'),
          api.get('/workorders/lookups', { params: { partnerKey: partnerKey || undefined } })
        ]);
        
        if (isMounted) {
          setOrders(sortWorkOrdersNewestFirst(ordersRes.data));
          
          const backendData = lookupsRes.data || {};
          const mappedPersonnel = backendData.teams
            ? backendData.teams.map((t: { id: string; name: string }) => ({ id: t.id, fullName: t.name }))
            : [];
          const mappedStations: StationLookup[] = (backendData.stations || []).map(
            (s: {
              id: string;
              name: string;
              address?: string;
              city?: string;
              district?: string | null;
              cityId?: string | null;
              districtId?: string | null;
              ownerCompany?: string | null;
              tenantId?: string;
              latitude: number;
              longitude: number;
            }) => ({
              id: s.id,
              name: s.name,
              address: s.address,
              city: s.city,
              district: s.district,
              cityId: s.cityId,
              districtId: s.districtId,
              ownerCompany: s.ownerCompany,
              tenantId: s.tenantId,
              latitude: s.latitude,
              longitude: s.longitude,
            }),
          );
          const mappedProjects: ProjectLookup[] = (backendData.projects || []).map(
            (p: { id: string; name: string; tenantId: string }) => ({
              id: p.id,
              name: p.name,
              tenantId: p.tenantId,
            }),
          );

          const mappedOffice = (backendData.officeUsers ?? []).map(
            (u: { id: string; name: string }) => ({ id: u.id, fullName: u.name }),
          );

          setLookups({
            personnel: mappedPersonnel,
            officeUsers: mappedOffice,
            types: ['Arıza', 'Bakım', 'Kurulum', 'Keşif', 'Saha Operasyonu'],
            categories: ['Arıza Bildirimi', 'Periyodik Bakım', 'Devreye Alma', 'Altyapı İncelemesi'],
            stations: mappedStations,
            projects: mappedProjects,
          });

        }
      } catch (error) {
        console.error("Veri yükleme hatası:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadInitialData();
    return () => { isMounted = false; };
  }, [partnerKey]);

  // Bildirimden ?open=id ile gelindiğinde detayı aç (setState effect içinde senkron olmasın)
  const pendingOpenId = searchParams.get('open');
  const handledOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingOpenId || orders.length === 0) return;
    if (handledOpenRef.current === pendingOpenId) return;
    const found = orders.find((o) => o.id === pendingOpenId);
    if (!found) return;

    handledOpenRef.current = pendingOpenId;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      openDetailModal(found);
      setSearchParams({}, { replace: true });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [pendingOpenId, orders, openDetailModal, setSearchParams]);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 bg-slate-50 relative overflow-hidden min-w-0">
      
      <h1 className="text-2xl font-extrabold text-brand-navy mb-4 flex items-center justify-between gap-3">
        <span>İş Emirleri</span>
        {isSuperAdminUser && (
          <button
            type="button"
            onClick={handlePurgeAll}
            disabled={isPurging}
            className="text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white px-3 py-2 rounded-lg disabled:opacity-60"
          >
            {isPurging ? 'Siliniyor...' : 'Tüm İş Emirlerini Temizle'}
          </button>
        )}
      </h1>

      <div className="w-full min-w-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 space-y-3 overflow-hidden">
        <input
          type="text"
          placeholder="İş emri veya nokta ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full min-w-0 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
        />
        <div className="flex flex-wrap gap-2 items-center min-w-0">
          {WORK_ORDER_STATUS_BADGES.map((badge) => {
            const isActive = filter === badge.key;
            const count = statusCounts[badge.key] ?? 0;
            return (
              <button
                key={badge.key}
                type="button"
                onClick={() => setFilter((prev) => (prev === badge.key ? null : badge.key))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  isActive ? badge.active : badge.idle
                }`}
              >
                <span>{badge.label}</span>
                <span
                  className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-center ${
                    isActive ? 'bg-white/25 text-white' : 'bg-white/80 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedOrders.length > 0 && (
        <div className="mb-4 space-y-3 rounded-xl bg-brand-navy px-5 py-3 text-white shadow-md min-w-0 overflow-hidden">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <span className="font-bold text-sm">{selectedOrders.length} iş emri seçildi</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleBulkApprove} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">✓ Toplu Onayla</button>
              <button type="button" onClick={handleBulkDelete} className="bg-rose-500 hover:bg-rose-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">🗑 Toplu Sil</button>
            </div>
          </div>
          {isSuperAdminUser && (
            <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-white/10 p-3">
              <select
                className="min-w-0 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-semibold text-slate-800"
                value={bulkAssignUserId}
                onChange={(e) => setBulkAssignUserId(e.target.value)}
              >
                <option value="">Ekip Seçiniz</option>
                {lookups.personnel.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={isBulkAssigning || !bulkAssignUserId}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {isBulkAssigning ? 'Atanıyor...' : 'İşi Ata'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-3 px-2">
        <input type="checkbox" className="ga-checkbox" checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} onChange={handleSelectAll} />
        <span className="text-sm font-bold text-slate-600">Tümünü Seç</span>
      </div>
      
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-4 custom-scrollbar">
        {isLoading ? (
          <PageLoading variant="panel" />
        ) : filteredOrders.length === 0 ? (
          <p className='text-sm text-slate-500 text-center mt-10'>Aranan kriterde iş emri bulunamadı.</p>
        ) : (
          filteredOrders.map((order) => {
            const pk = resolvePartnerKey({ tenantId: order.tenantId, name: order.customerName });
            const partner = pk ? getPartnerByKey(pk) : null;
            return (
            <div key={order.id} onClick={() => order.position && setFocusedMarkerPosition([...order.position])} className={`cursor-pointer bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative flex items-center gap-4 transition-all hover:border-brand-orange hover:shadow-md ${order.priority === 'Acil' ? 'border-l-4 border-l-rose-600' : ''}`}>
              <input type="checkbox" className="ga-checkbox" checked={selectedOrders.includes(order.id)} onChange={(e) => { e.stopPropagation(); handleSelectOne(order.id); }} />
              <div className="flex-1 min-w-0">
                {partnerKey === 'all' && partner && partner.key !== 'all' && (
                  <span
                    className="mb-1.5 inline-block shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold text-white"
                    style={{ backgroundColor: partner.color }}
                  >
                    {partner.name}
                  </span>
                )}
                <h3 className="mb-2 text-base font-bold leading-snug text-brand-navy wrap-break-word">
                  Nokta Adı: {order.customerName || order.title}
                </h3>
                <div className="flex flex-col gap-1.5 text-xs mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">İş Tipi</span>
                    <span className="text-slate-800 font-bold truncate">{order.type || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">Öncelik</span>
                    <span className={`font-bold truncate ${order.priority === 'Acil' ? 'text-rose-600' : 'text-slate-700'}`}>{order.priority || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">Durum</span>
                    <span className="font-bold text-blue-600 truncate">{order.status || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">Açılış Tarihi</span>
                    <span className="text-slate-800 font-medium truncate">
                      {order.createdAt ? formatTurkeyDateTime(order.createdAt) : '—'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-slate-500 font-medium shrink-0 w-18">Genel Açıklama</span>
                    <span className="text-slate-800 font-medium line-clamp-3 wrap-break-word">{order.description?.trim() || '—'}</span>
                  </div>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button onClick={(e) => { e.stopPropagation(); openDetailModal(order); }} className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition shadow-sm">🔎 Detayları Gör</button>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {isDetailModalOpen && selectedOrder && (
        <ModalOverlay className="animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-base font-bold text-brand-navy">
                  İş Emri Detay Kartı {isEditingDetail ? '› Düzenleme Modu' : ''}
                </h2>
                {isTeslaOrder(selectedOrder) && !isEditingDetail && (
                  <div className="flex items-center gap-1.5 shrink-0" title="Dil (TESLA)">
                    <button
                      type="button"
                      onClick={async () => {
                        setDisplayLang('en');
                        if (!selectedOrder.titleEn?.trim()) {
                          const translated = await ensureTranslation(selectedOrder);
                          setSelectedOrder(translated);
                        }
                      }}
                      className={`text-xl leading-none px-1.5 py-0.5 rounded-md border transition ${displayLang === 'en' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      aria-label="English"
                    >
                      🇬🇧
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayLang('tr')}
                      className={`text-xl leading-none px-1.5 py-0.5 rounded-md border transition ${displayLang === 'tr' ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      aria-label="Türkçe"
                    >
                      🇹🇷
                    </button>
                    {isTranslating && (
                      <span className="text-[10px] font-bold text-slate-400 ml-1">Çevriliyor…</span>
                    )}
                  </div>
                )}
              </div>
              <button onClick={closeDetailModal} className="text-slate-400 hover:text-rose-600 font-bold text-2xl p-1 transition-colors">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-x-6 gap-y-4 custom-scrollbar text-xs">
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Nokta Adı</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-bold text-sm outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100 text-blue-800' : 'bg-blue-50 border-blue-100 text-blue-800 cursor-not-allowed'}`}
                  value={isEditingDetail ? editFormData.customerName : selectedOrder.customerName}
                  onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Başlığı / Özeti</label>
                <input
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.title : (
                    (!isEditingDetail && displayLang === 'en' && isTeslaOrder(selectedOrder) && selectedOrder.titleEn?.trim())
                      ? selectedOrder.titleEn
                      : selectedOrder.title
                  )}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Öncelik Tipi</label>
                {isEditingDetail ? (
                  <select
                    className="w-full border border-blue-400 rounded-lg p-2.5 font-bold bg-white outline-none focus:ring-2 focus:ring-blue-100"
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                  >
                    <option>Düşük</option>
                    <option>Orta</option>
                    <option>Acil</option>
                  </select>
                ) : (
                  <input disabled className={`w-full bg-slate-50 border border-slate-200 font-bold rounded-lg p-2.5 cursor-not-allowed ${selectedOrder.priority === 'Acil' ? 'text-rose-600' : 'text-slate-700'}`} value={selectedOrder.priority} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Tipi</label>
                {isEditingDetail ? (
                  <select
                    className="w-full border border-blue-400 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-100"
                    value={editFormData.type}
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                  >
                    {lookups.types.map((t) => <option key={t}>{t}</option>)}
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.type} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">İş Kategorisi</label>
                {isEditingDetail ? (
                  <select
                    className="w-full border border-blue-400 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-100"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  >
                    {lookups.categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                ) : (
                  <input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed" value={selectedOrder.category} />
                )}
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Planlanan Başlangıç</label>
                <input
                  type={isEditingDetail && isSuperAdminUser ? 'datetime-local' : 'text'}
                  disabled={!(isEditingDetail && isSuperAdminUser)}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail && isSuperAdminUser ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail && isSuperAdminUser ? editFormData.startDate : (formatTurkeyDateTime(selectedOrder.startDate) || '—')}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  title={!isSuperAdminUser ? 'Planlanan tarihler yalnızca Süper Admin tarafından değiştirilebilir' : undefined}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Planlanan Bitiş</label>
                <input
                  type={isEditingDetail && isSuperAdminUser ? 'datetime-local' : 'text'}
                  disabled={!(isEditingDetail && isSuperAdminUser)}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail && isSuperAdminUser ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail && isSuperAdminUser ? editFormData.endDate : (formatTurkeyDateTime(selectedOrder.endDate) || '—')}
                  onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  title={!isSuperAdminUser ? 'Planlanan tarihler yalnızca Süper Admin tarafından değiştirilebilir' : undefined}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Gerçek Başlangıç</label>
                <input
                  type={isEditingDetail && isSuperAdminUser ? 'datetime-local' : 'text'}
                  disabled={!(isEditingDetail && isSuperAdminUser)}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail && isSuperAdminUser ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail && isSuperAdminUser ? editFormData.startedAt : (formatTurkeyDateTime(selectedOrder.startedAt) || '—')}
                  onChange={(e) => setEditFormData({ ...editFormData, startedAt: e.target.value })}
                  title={!isSuperAdminUser ? 'Gerçek başlangıç yalnızca Süper Admin tarafından değiştirilebilir' : undefined}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  {selectedOrder.cancelledAt || selectedOrder.status === 'İptal' || selectedOrder.status === 'İptal Edildi'
                    ? 'İptal Tarihi'
                    : 'Bitiş Tarihi'}
                </label>
                <input
                  type={isEditingDetail && isSuperAdminUser ? 'datetime-local' : 'text'}
                  disabled={!(isEditingDetail && isSuperAdminUser)}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none ${isEditingDetail && isSuperAdminUser ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={
                    isEditingDetail && isSuperAdminUser
                      ? (selectedOrder.cancelledAt || selectedOrder.status === 'İptal' || selectedOrder.status === 'İptal Edildi'
                          ? editFormData.cancelledAt
                          : editFormData.completedAt)
                      : (selectedOrder.cancelledAt || selectedOrder.status === 'İptal' || selectedOrder.status === 'İptal Edildi'
                          ? (formatTurkeyDateTime(selectedOrder.cancelledAt) || '—')
                          : (formatTurkeyDateTime(selectedOrder.completedAt) || '—'))
                  }
                  onChange={(e) => {
                    if (selectedOrder.cancelledAt || selectedOrder.status === 'İptal' || selectedOrder.status === 'İptal Edildi') {
                      setEditFormData({ ...editFormData, cancelledAt: e.target.value });
                    } else {
                      setEditFormData({ ...editFormData, completedAt: e.target.value });
                    }
                  }}
                  title={!isSuperAdminUser ? 'Gerçek bitiş yalnızca Süper Admin tarafından değiştirilebilir' : undefined}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Süre (dk)</label>
                <input
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-lg p-2.5 cursor-not-allowed"
                  value={durationMinutes(selectedOrder.startedAt, selectedOrder.completedAt) ?? '—'}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Enlem - Lat)</label>
                <input
                  type="number"
                  step="any"
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-mono outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`}
                  value={isEditingDetail ? editFormData.lat : (selectedOrder.position?.[0] || '')}
                  onChange={(e) => setEditFormData({ ...editFormData, lat: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Koordinat (Boylam - Lng)</label>
                <input
                  type="number"
                  step="any"
                  disabled={!isEditingDetail}
                  className={`w-full border rounded-lg p-2.5 font-mono outline-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`}
                  value={isEditingDetail ? editFormData.lng : (selectedOrder.position?.[1] || '')}
                  onChange={(e) => setEditFormData({ ...editFormData, lng: parseFloat(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Genel Açıklama</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={2}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none resize-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.description : (
                    (displayLang === 'en' && isTeslaOrder(selectedOrder) && selectedOrder.descriptionEn?.trim())
                      ? selectedOrder.descriptionEn
                      : (selectedOrder.description || 'Açıklama girilmemiş.')
                  )}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Mühendis Açıklaması</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={2}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none resize-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.mobileDescription : (
                    (displayLang === 'en' && isTeslaOrder(selectedOrder) && selectedOrder.mobileDescriptionEn?.trim())
                      ? selectedOrder.mobileDescriptionEn
                      : (selectedOrder.mobileDescription || 'Mühendis açıklaması girilmemiş.')
                  )}
                  onChange={(e) => setEditFormData({ ...editFormData, mobileDescription: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Tam Açık Adres</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={2}
                  className={`w-full border rounded-lg p-2.5 font-medium outline-none resize-none ${isEditingDetail ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`}
                  value={isEditingDetail ? editFormData.address : (selectedOrder.address || 'Adres girilmemiş.')}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>

              {isEditingDetail ? (
                <>
                  <div className="col-span-2 space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Operasyon Atamaları</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operasyon Sorumlusu</label>
                        <select className="w-full border border-blue-300 rounded-lg p-2 bg-white" value={editFormData.operationUserId} onChange={(e) => setEditFormData({ ...editFormData, operationUserId: e.target.value })}>
                          <option value="">Seçiniz</option>
                          {operationAssigneeOptions.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">İş Açan Yetkili</label>
                        <select className="w-full border border-blue-300 rounded-lg p-2 bg-white" value={editFormData.openedByUserId} onChange={(e) => setEditFormData({ ...editFormData, openedByUserId: e.target.value })}>
                          <option value="">Seçiniz</option>
                          {operationAssigneeOptions.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </select>
                      </div>
                      {isSuperAdminUser && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">İş Atanan Sahacı</label>
                        <select className="w-full border border-blue-300 rounded-lg p-2 bg-white" value={editFormData.assignedToUserId} onChange={(e) => setEditFormData({ ...editFormData, assignedToUserId: e.target.value })}>
                          <option value="">Atanmamış</option>
                          {lookups.personnel.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </select>
                      </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-3">
                    <label className="flex items-center gap-2 font-bold text-emerald-800 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="ga-checkbox ga-checkbox-accent-emerald"
                        checked={editFormData.isPeriodic}
                        onChange={(e) => setEditFormData({ ...editFormData, isPeriodic: e.target.checked })}
                      />
                      <span>Bu Bir Periyodik İş Emridir (Otomatik Tekrarlansın)</span>
                    </label>
                    {editFormData.isPeriodic && (
                      <select
                        className="w-full border border-emerald-200 rounded-lg p-2 bg-white text-xs font-semibold text-slate-700"
                        value={editFormData.recurrenceInterval}
                        onChange={(e) => setEditFormData({ ...editFormData, recurrenceInterval: e.target.value })}
                      >
                        <option value="Haftalik">Her Hafta Otomatik Açılsın</option>
                        <option value="Aylik">Her Ay Otomatik Açılsın</option>
                        <option value="Yillik">Her Yıl Otomatik Açılsın</option>
                      </select>
                    )}
                  </div>
                </>
              ) : (
                <div className="col-span-2 grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Operasyon Sorumlusu</label><div className="font-bold text-slate-700 truncate">{selectedOrder.operationUserName}</div></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">İş Açan Yetkili</label><div className="font-bold text-slate-700 truncate">{selectedOrder.openedByUserName}</div></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mevcut Atama</label><div className="font-bold text-blue-600 bg-blue-50/50 border border-blue-100 rounded px-2 py-0.5 inline-block max-w-full truncate">👷 {selectedOrder.assignedToUserName || 'Sahacı Atanmamış'}</div></div>
                </div>
              )}

              {!isEditingDetail && isSuperAdminUser && (
                selectedOrder.status === 'Atanmamış' || !selectedOrder.assignedToUserId
              ) && (
                <div className="col-span-2 bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
                  <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider">Sahacı Ata</label>
                  <p className="text-[11px] text-emerald-800/80 font-medium">
                    Atama kaydedildiğinde iş emri Bekliyor durumuna geçer ve saha personeline bildirim gider.
                  </p>
                  <div className="flex gap-2 items-center">
                    <select
                      className="flex-1 border border-emerald-200 rounded-lg p-2.5 bg-white text-sm font-semibold"
                      value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)}
                    >
                      <option value="">Atanmamış</option>
                      {lookups.personnel.map((p) => (
                        <option key={p.id} value={p.id}>{p.fullName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={isAssigning || !assignUserId}
                      className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
                    >
                      {isAssigning ? 'Kaydediliyor...' : 'Atamayı Kaydet'}
                    </button>
                  </div>
                </div>
              )}

              <div className="col-span-2 mt-2">
                <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Saha Notu (Tamamlama / İptal)</label>
                <textarea
                  disabled={!isEditingDetail}
                  rows={3}
                  className={`w-full font-medium rounded-lg p-2.5 resize-none whitespace-pre-wrap outline-none ${
                    isEditingDetail
                      ? 'bg-white border border-blue-400 focus:ring-2 focus:ring-blue-100 text-slate-700'
                      : 'bg-amber-50/50 border border-amber-100 text-slate-700 cursor-not-allowed'
                  }`}
                  value={
                    isEditingDetail
                      ? editFormData.fieldNote
                      : (
                        (displayLang === 'en' && isTeslaOrder(selectedOrder) && selectedOrder.fieldNoteEn?.trim())
                          ? selectedOrder.fieldNoteEn
                          : (selectedOrder.fieldNote?.trim() || '')
                      )
                  }
                  placeholder={isEditingDetail ? 'Saha notu giriniz...' : undefined}
                  onChange={(e) => setEditFormData({ ...editFormData, fieldNote: e.target.value })}
                />
                {!isEditingDetail && !selectedOrder.fieldNote?.trim() && (
                  <p className="text-xs text-slate-400 italic mt-1">Saha notu girilmemiş.</p>
                )}
                {(isEditingDetail ? editFormData.fieldNote && selectedOrder.fieldNoteAddedAt : selectedOrder.fieldNoteAddedAt) && (
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">Eklenme: {selectedOrder.fieldNoteAddedAt}</p>
                )}
              </div>

              <div className="col-span-2 space-y-3">
                <label className="block font-bold text-slate-500 uppercase tracking-wider">
                  Açılış Ekleri ({openingPhotos.length})
                </label>
                {loadingPhotos ? (
                  <p className="text-xs text-slate-400 italic">Yükleniyor...</p>
                ) : openingPhotos.length === 0 ? (
                  !isEditingDetail ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 border border-slate-100 rounded-lg p-3">
                    Açılış eki yok.
                  </p>
                  ) : null
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {openingPhotos.map((photo, photoIndex) => (
                      <button
                        key={photo.id}
                        type="button"
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-brand-orange transition text-left"
                        title={photo.fileName}
                        onClick={() => setLightbox({ photos: openingPhotos, index: photoIndex, title: 'Açılış Ekleri' })}
                      >
                        {photo.isVideo ? (
                          <video src={photo.url} className="w-full h-28 object-cover bg-black" muted />
                        ) : (
                          <img src={photo.url} alt={photo.fileName} className="w-full h-28 object-cover group-hover:opacity-90 transition" />
                        )}
                        <p className="text-[10px] text-slate-500 px-2 py-1 truncate font-semibold">{photo.fileName}</p>
                      </button>
                    ))}
                  </div>
                )}
                {isEditingDetail && remainingOpeningSlots > 0 && (
                  <WorkOrderPhotoPicker
                    title="Yeni Açılış Eki"
                    hint="Görsel (max 10 MB) veya video (max 30 MB)"
                    allowVideo
                    maxCount={remainingOpeningSlots}
                    attachments={pendingOpeningAttachments}
                    onChange={setPendingOpeningAttachments}
                  />
                )}
                {isEditingDetail && remainingOpeningSlots === 0 && openingPhotos.length >= MAX_OPENING_ATTACHMENTS && (
                  <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-100 rounded-lg p-3">
                    En fazla {MAX_OPENING_ATTACHMENTS} açılış eki yüklenebilir.
                  </p>
                )}
              </div>

              <div className="col-span-2 space-y-4">
                {visiblePhotoCategories.map((category) => {
                  const photos = orderPhotos.filter((p) => p.category === category);
                  if (loadingPhotos) return null;
                  if (category === 'DIGER' && photos.length === 0) return null;
                  const title =
                    category === 'ISG' ? 'İSG Fotoğrafları' :
                    category === 'OPERASYON' ? 'Operasyoncu Fotoğrafları' :
                    'Diğer Fotoğraflar';
                  return (
                    <div key={category}>
                      <label className="block font-bold text-slate-500 mb-2 uppercase tracking-wider">
                        {title} ({photos.length})
                      </label>
                      {photos.length === 0 ? (
                        !isEditingDetail ? (
                        <p className="text-xs text-slate-400 italic bg-slate-50 border border-slate-100 rounded-lg p-3">
                          Bu kategoride fotoğraf yok.
                        </p>
                        ) : null
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {photos.map((photo, photoIndex) => (
                            <div
                              key={photo.id}
                              className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 hover:border-brand-orange transition"
                            >
                              <button
                                type="button"
                                className="block w-full text-left"
                                title={photo.fileName}
                                onClick={() => setLightbox({ photos, index: photoIndex, title })}
                              >
                                {photo.isVideo ? (
                                  <video src={photo.url} className="w-full h-28 object-cover bg-black" muted />
                                ) : (
                                  <img src={photo.url} alt={photo.fileName} className="w-full h-28 object-cover group-hover:opacity-90 transition" />
                                )}
                                <p className="text-[10px] text-slate-500 px-2 py-1 truncate font-semibold">{photo.fileName}</p>
                              </button>
                              {!isEditingDetail && (
                              <button
                                type="button"
                                onClick={() => handleDeletePhoto(photo.id)}
                                className="absolute top-1.5 right-1.5 bg-rose-600/90 hover:bg-rose-700 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow"
                              >
                                Sil
                              </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {isEditingDetail && category === 'ISG' && (
                        <WorkOrderPhotoPicker
                          title="Yeni İSG Fotoğrafı"
                          hint="JPEG, PNG veya WebP (max 10 MB)"
                          attachments={pendingIsgAttachments}
                          onChange={setPendingIsgAttachments}
                        />
                      )}
                      {isEditingDetail && category === 'OPERASYON' && (
                        <WorkOrderPhotoPicker
                          title="Yeni Operasyoncu Fotoğrafı"
                          hint="JPEG, PNG veya WebP (max 10 MB)"
                          attachments={pendingOperasyonAttachments}
                          onChange={setPendingOperasyonAttachments}
                        />
                      )}
                    </div>
                  );
                })}
                {loadingPhotos && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold py-4">
                    <svg className="animate-spin h-4 w-4 text-brand-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Fotoğraflar yükleniyor...
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              {isEditingDetail ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEditDetail}
                    className="border border-slate-300 text-slate-600 font-bold px-5 py-2 rounded-xl hover:bg-white transition"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDetail}
                    disabled={isSavingDetail}
                    className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-emerald-700 shadow transition disabled:opacity-60"
                  >
                    {isSavingDetail ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                </>
              ) : (
                <>
                  {canOfficeClose && selectedOrder && !isTerminalWorkOrderStatus(selectedOrder.status) && (
                    <div className="flex flex-wrap gap-2 mr-auto">
                      <button
                        type="button"
                        onClick={() => handleOfficeClose('Tamamlandı')}
                        disabled={isOfficeClosing}
                        className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-emerald-700 shadow transition disabled:opacity-60 text-sm"
                      >
                        {isOfficeClosing ? 'Kapatılıyor…' : 'Tamamlandı Olarak Kapat'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOfficeClose('İptal')}
                        disabled={isOfficeClosing}
                        className="bg-rose-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-rose-700 shadow transition disabled:opacity-60 text-sm"
                      >
                        {isOfficeClosing ? 'Kapatılıyor…' : 'İptal Olarak Kapat'}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditingDetail(true)}
                    className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-blue-700 shadow transition"
                  >
                    ✏️ Düzenle
                  </button>
                  <button onClick={closeDetailModal} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 transition shadow">Kapat</button>
                </>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {lightbox && lightbox.photos.length > 0 && (
        <ModalOverlay className="bg-slate-950/90" onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white mb-3 gap-3">
              <p className="text-sm font-bold truncate">
                {lightbox.title} · {lightbox.index + 1}/{lightbox.photos.length} · {lightbox.photos[lightbox.index].fileName}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {lightbox.photos[lightbox.index].category !== 'ACILIS' && (
                <button
                  type="button"
                  className="bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold"
                  onClick={() => handleDeletePhoto(lightbox.photos[lightbox.index].id)}
                >
                  Sil
                </button>
                )}
                <button type="button" className="text-2xl font-bold px-2" onClick={() => setLightbox(null)}>×</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-white text-3xl font-bold px-3 py-8 hover:bg-white/10 rounded-xl"
                onClick={() =>
                  setLightbox((prev) =>
                    prev
                      ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length }
                      : prev
                  )
                }
              >
                ‹
              </button>
              {lightbox.photos[lightbox.index].isVideo ? (
                <video
                  src={lightbox.photos[lightbox.index].url}
                  controls
                  autoPlay
                  className="max-h-[75vh] w-full object-contain rounded-xl bg-black/40"
                />
              ) : (
              <img
                src={lightbox.photos[lightbox.index].url}
                alt={lightbox.photos[lightbox.index].fileName}
                className="max-h-[75vh] w-full object-contain rounded-xl bg-black/40"
              />
              )}
              <button
                type="button"
                className="text-white text-3xl font-bold px-3 py-8 hover:bg-white/10 rounded-xl"
                onClick={() =>
                  setLightbox((prev) =>
                    prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : prev
                  )
                }
              >
                ›
              </button>
            </div>
            <p className="text-center text-slate-300 text-xs mt-3 font-semibold">
              Gezinmek için ← → ok tuşları · Esc ile kapat
            </p>
          </div>
        </ModalOverlay>
      )}

    </div>
  );
}