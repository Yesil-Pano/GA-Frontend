// src/pages/Teams.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import { formatTurkeyDateTime } from '../utils/dateTime';
import { trIncludes } from '../utils/trSearch';
import { getPartnerColor, resolvePartnerKey } from '../utils/partners';
import { isSuperAdmin, isTenantAdmin } from '../utils/authSession';
import ModalOverlay from '../components/ModalOverlay';
import PageLoading from '../components/PageLoading';

interface TeamMemberData {
  id: string;
  name: string;
  username: string; 
  email: string;
  tenantId?: string;
  project: string;
  projectIds: string[];
  assignedProjects?: { id: string; name: string }[];
  plate: string;
  phone: string;
  teamLeader: string;
  // 🚀 YENİ ALANLAR ARAYÜZE TANITILDI
  address: string;
  city: string;
  district: string;
  position: [number, number];
  hasLiveLocation?: boolean;
  locationUpdatedAt?: string | null;
  hasAuthorizationDocument?: boolean;
  authorizationDocumentFileName?: string | null;
  authorizationDocumentFileSize?: number | null;
  personnelDocumentCount?: number;
}

interface TeamDocumentItem {
  id: string;
  documentType: 'Authorization' | 'Personnel' | string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

interface AssignedWorkOrder {
  id: string;
  title: string;
  customerName: string;
  priority: string;
  status: string;
  type: string;
  plannedDate: string;
  assignedToUserId: string | null;
  isPeriodic?: boolean;
  parentWorkOrderId?: string | null;
}

interface PeriodicOccurrence {
  id: string;
  periodLabel: string | null;
  startDate: string;
  endDate: string;
  status: string;
  assignedToUserId: string | null;
  assignedToUserName: string;
  isTemplate?: boolean;
  periodIndex?: number;
}

interface ProjectLookup {
  id: string;
  name: string;
  tenantId?: string;
}

interface TenantLookup {
  id: string;
  name: string;
}

interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
      Message?: string;
    };
  };
}

type AssignedJobStatusFilter = 'Tümü' | 'Bekliyor' | 'Devam Ediyor' | 'Tamamlandı' | 'İptal';

const ASSIGNED_JOB_STATUS_ORDER: Record<string, number> = {
  'Devam Ediyor': 0,
  'Bekliyor': 1,
  'Tamamlandı': 2,
  'İptal': 3,
  'İptal Edildi': 3,
};

const ASSIGNED_JOB_STATUS_FILTERS: { key: AssignedJobStatusFilter; label: string; active: string; idle: string }[] = [
  { key: 'Tümü', label: 'Tümü', active: 'bg-brand-navy text-white border-brand-navy', idle: 'bg-white text-slate-600 border-slate-200 hover:border-slate-300' },
  { key: 'Devam Ediyor', label: 'Devam Ediyor', active: 'bg-blue-600 text-white border-blue-600', idle: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-300' },
  { key: 'Bekliyor', label: 'Bekliyor', active: 'bg-amber-500 text-white border-amber-500', idle: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300' },
  { key: 'Tamamlandı', label: 'Tamamlandı', active: 'bg-emerald-600 text-white border-emerald-600', idle: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300' },
  { key: 'İptal', label: 'İptal', active: 'bg-rose-600 text-white border-rose-600', idle: 'bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300' },
];

function assignedJobSortKey(status: string): number {
  return ASSIGNED_JOB_STATUS_ORDER[status] ?? 4;
}

function matchesAssignedJobStatusFilter(status: string, filter: AssignedJobStatusFilter): boolean {
  if (filter === 'Tümü') return true;
  if (filter === 'İptal') return status === 'İptal' || status === 'İptal Edildi';
  return status === filter;
}

function periodRowClass(status: string): string {
  if (status === 'Tamamlandı' || status === 'İptal' || status === 'İptal Edildi')
    return 'border-slate-200 bg-slate-100 opacity-75';
  return 'border-slate-200 bg-slate-50';
}

function jobStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Bekliyor':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Devam Ediyor':
      return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'Tamamlandı':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'İptal':
    case 'İptal Edildi':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    default:
      return 'text-slate-600 bg-white border-slate-200';
  }
}

export default function Teams() {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState<TeamMemberData[]>([]);
  const [allWorkOrders, setAllWorkOrders] = useState<AssignedWorkOrder[]>([]); 
  const [projects, setProjects] = useState<ProjectLookup[]>([]);
  const [createFormProjects, setCreateFormProjects] = useState<ProjectLookup[]>([]);
  const [globalTenants, setGlobalTenants] = useState<TenantLookup[]>([]); 
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamMemberData | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'jobs'>('details');
  const [assignedJobStatusFilter, setAssignedJobStatusFilter] = useState<AssignedJobStatusFilter>('Tümü');
  const [assignedJobSearch, setAssignedJobSearch] = useState('');
  const [isEditingModal, setIsEditingModal] = useState(false); 

  // 🚀 FORM STATE'İNE YENİ ALANLAR EKLENDİ
  const [formData, setFormData] = useState({
    name: '', username: '', email: '', password: '', phone: '', teamLeader: '', plate: '', address: '', city: '', district: '', tenantId: '', lat: 39.92077, lng: 32.85411
  });
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // 🚀 DÜZENLEME STATE'İNE YENİ ALANLAR EKLENDİ
  const [editFormData, setEditFormData] = useState({
    name: '', username: '', email: '', password: '', phone: '', teamLeader: '', plate: '', address: '', city: '', district: '', lat: 39.92077, lng: 32.85411
  });
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);

  const { setFocusedMarkerPosition, refreshMapData, partnerKey } = useOutletContext<{
    setFocusedMarkerPosition: (pos: [number, number] | null) => void;
    refreshMapData: () => Promise<void>;
    partnerKey?: string;
  }>();

  const [refreshingLocations, setRefreshingLocations] = useState(false);
  const [lastLocationRefresh, setLastLocationRefresh] = useState<Date | null>(null);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [authDocInputKey, setAuthDocInputKey] = useState(0);
  const [personnelDocInputKey, setPersonnelDocInputKey] = useState(0);
  const [canManageAuthorizationDocuments, setCanManageAuthorizationDocuments] = useState(
    () => isSuperAdmin() || isTenantAdmin(),
  );
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [docsModalFilter, setDocsModalFilter] = useState<'all' | 'Authorization' | 'Personnel'>('all');
  const [teamDocuments, setTeamDocuments] = useState<TeamDocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const [periodicModalOpen, setPeriodicModalOpen] = useState(false);
  const [periodicJob, setPeriodicJob] = useState<AssignedWorkOrder | null>(null);
  const [periodicOccurrences, setPeriodicOccurrences] = useState<PeriodicOccurrence[]>([]);
  const [periodicLoading, setPeriodicLoading] = useState(false);
  const [reassignByOccurrence, setReassignByOccurrence] = useState<Record<string, string>>({});
  const [reassigningOccurrenceId, setReassigningOccurrenceId] = useState<string | null>(null);

  const isSuperAdminUser = isSuperAdmin();
  const isTenantAdminUser = isTenantAdmin();
  const canManageTeamDocuments =
    canManageAuthorizationDocuments || isSuperAdminUser || isTenantAdminUser;

  const teamLookupParams = useCallback((tenantIdFilter?: string) => {
    const params: Record<string, string> = {};
    if (partnerKey && partnerKey !== 'all') params.partnerKey = partnerKey;
    if (tenantIdFilter) params.tenantIdFilter = tenantIdFilter;
    return Object.keys(params).length > 0 ? params : undefined;
  }, [partnerKey]);

  const reloadDataForSubmit = useCallback(async () => {
    try {
      const [teamsRes, ordersRes, lookupsRes] = await Promise.all([
        api.get('/teams'),
        api.get('/workorders'),
        api.get('/teams/lookups', { params: teamLookupParams() }),
      ]);

      setTeams(teamsRes.data);
      setAllWorkOrders(ordersRes.data);
      setProjects(lookupsRes.data);

      if (isSuperAdminUser) {
        const tenantsRes = await api.get('/users/tenants');
        setGlobalTenants(tenantsRes.data);
      }
    } catch (error) {
      console.error("Veri yenilenirken hata:", error);
    }
  }, [teamLookupParams]);

  const loadProjectsForCreate = useCallback(async (tenantId?: string) => {
    try {
      const { data } = await api.get<ProjectLookup[]>('/teams/lookups', {
        params: teamLookupParams(tenantId),
      });
      setCreateFormProjects(data);
    } catch (error) {
      console.error('Proje listesi yüklenemedi:', error);
      setCreateFormProjects([]);
    }
  }, [teamLookupParams]);

  const handleTenantChange = useCallback((tenantId: string) => {
    setFormData((prev) => ({ ...prev, tenantId }));
    setSelectedProjectIds([]);
    if (!tenantId) {
      setCreateFormProjects([]);
      return;
    }
    void loadProjectsForCreate(tenantId);
  }, [loadProjectsForCreate]);

  const openCreateForm = useCallback(() => {
    setIsFormOpen(true);
    setSelectedProjectIds([]);
    if (isSuperAdminUser) {
      if (!formData.tenantId) {
        setCreateFormProjects([]);
        return;
      }
      void loadProjectsForCreate(formData.tenantId);
      return;
    }
    void loadProjectsForCreate();
  }, [isSuperAdminUser, formData.tenantId, loadProjectsForCreate]);

  useEffect(() => {
    let isMounted = true;
    const initPageData = async () => {
      setIsLoading(true);
      try {
        const [teamsRes, ordersRes, lookupsRes, capsRes] = await Promise.all([
          api.get('/teams'),
          api.get('/workorders'),
          api.get('/teams/lookups', { params: teamLookupParams() }),
          api.get<{ canManageAuthorizationDocuments?: boolean }>('/teams/capabilities').catch((err) => {
            console.warn('Teams capabilities alınamadı; rol bazlı varsayılan kullanılıyor.', err);
            return { data: { canManageAuthorizationDocuments: false } };
          }),
        ]);

        let tenantList: TenantLookup[] = [];
        if (isSuperAdminUser) {
          const tenantsRes = await api.get('/users/tenants');
          tenantList = tenantsRes.data;
        }

        if (isMounted) {
          setTeams(teamsRes.data);
          setAllWorkOrders(ordersRes.data);
          setProjects(lookupsRes.data);
          setGlobalTenants(tenantList);
          setCanManageAuthorizationDocuments(
            !!capsRes.data?.canManageAuthorizationDocuments || isSuperAdminUser || isTenantAdminUser,
          );
        }
      } catch (error) {
        console.error("İlk yükleme hatası:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initPageData();
    return () => { isMounted = false; };
  }, [isSuperAdminUser, isTenantAdminUser, partnerKey, teamLookupParams]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (isSuperAdminUser && !formData.tenantId) {
      alert('Lütfen hedef firma seçin.');
      return;
    }
    if (selectedProjectIds.length === 0) {
      alert('En az bir proje seçmelisiniz.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/teams', {
        ...formData,
        tenantId: isSuperAdminUser ? formData.tenantId : undefined,
        latitude: formData.lat,
        longitude: formData.lng,
        projectIds: selectedProjectIds,
      }, {
        params: teamLookupParams(isSuperAdminUser ? formData.tenantId : undefined),
      });
      setIsFormOpen(false);
      setFormData({ name: '', username: '', email: '', password: '', phone: '', teamLeader: '', plate: '', address: '', city: '', district: '', tenantId: '', lat: 39.92077, lng: 32.85411 });
      setSelectedProjectIds([]);
      setCreateFormProjects([]);
      await reloadDataForSubmit();
    } catch (err) {
      const error = err as AxiosErrorResponse;
      console.error(error);
      alert(error.response?.data?.message || error.response?.data?.Message || 'Ekip eklenemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    if (editProjectIds.length === 0) {
      alert('En az bir proje seçmelisiniz.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { password, lat, lng, ...rest } = editFormData;
      await api.put(`/teams/${selectedTeam.id}`, {
        ...rest,
        latitude: lat,
        longitude: lng,
        projectIds: editProjectIds,
        ...(password.trim() ? { password: password.trim() } : {}),
      }, {
        params: teamLookupParams(),
      });
      setIsEditingModal(false);
      setIsDetailModalOpen(false);
      await reloadDataForSubmit(); 
    } catch (err) {
      const error = err as AxiosErrorResponse;
      console.error(error);
      alert(error.response?.data?.message || "Değişiklikler kaydedilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshLocations = async () => {
    setRefreshingLocations(true);
    try {
      await reloadDataForSubmit();
      await refreshMapData();
      setLastLocationRefresh(new Date());
    } catch (error) {
      console.error('Canlı konumlar güncellenemedi:', error);
      alert('Canlı konumlar güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      setRefreshingLocations(false);
    }
  };

  const openTeamDetail = (team: TeamMemberData) => {
    setSelectedTeam(team);
    setEditFormData({
      name: team.name,
      username: team.username,
      email: team.email,
      password: '',
      phone: team.phone,
      teamLeader: team.teamLeader === '-' ? '' : team.teamLeader,
      plate: team.plate === '-' ? '' : team.plate,
      address: team.address === '-' ? '' : team.address,
      city: team.city === '-' ? '' : team.city,
      district: team.district === '-' ? '' : team.district,
      lat: team.position[0] || 39.92077,
      lng: team.position[1] || 32.85411,
    });
    setEditProjectIds(team.projectIds || []);
    setActiveTab('details');
    setAssignedJobStatusFilter('Tümü');
    setAssignedJobSearch('');
    setIsEditingModal(false);
    setIsDetailModalOpen(true);
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    const confirmed = window.confirm(
      `"${selectedTeam.name}" ekibini silmek istediğinize emin misiniz?\n\nAçık iş emirleri (Bekliyor / Devam Ediyor) Atanmamış'a çekilecek. Tamamlanan işler silinmez.`,
    );
    if (!confirmed) return;

    setIsDeletingTeam(true);
    try {
      const { data } = await api.delete<{ Message?: string; message?: string; unassignedWorkOrderCount?: number }>(
        `/teams/${selectedTeam.id}`,
      );
      alert(
        `${data.Message || data.message || 'Ekip silindi.'}${
          typeof data.unassignedWorkOrderCount === 'number'
            ? `\nAtanmamışa çekilen açık iş: ${data.unassignedWorkOrderCount}`
            : ''
        }`,
      );
      setIsDetailModalOpen(false);
      setSelectedTeam(null);
      await reloadDataForSubmit();
      await refreshMapData();
    } catch (error) {
      console.error('Ekip silinemedi:', error);
      alert('Ekip silinemedi. Yetkinizi veya bağlantınızı kontrol edin.');
    } finally {
      setIsDeletingTeam(false);
    }
  };

  const filteredTeams = teams.filter(team => 
    trIncludes(team.name, searchTerm) || 
    trIncludes(team.plate, searchTerm)
  );

  /** Düzenleme: lookups + personelin mevcut atamaları (çoklu seçim) */
  const editProjectOptions = useMemo(() => {
    const map = new Map<string, ProjectLookup>();
    for (const p of projects) map.set(p.id, p);
    for (const p of selectedTeam?.assignedProjects || []) {
      if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [projects, selectedTeam?.assignedProjects]);

  const teamAssignedJobsAll = useMemo(
    () =>
      allWorkOrders.filter(
        (order) =>
          order.assignedToUserId === selectedTeam?.id && !order.parentWorkOrderId,
      ),
    [allWorkOrders, selectedTeam?.id],
  );

  const assignedJobs = useMemo(() => {
    const filtered = teamAssignedJobsAll.filter((order) =>
      matchesAssignedJobStatusFilter(order.status, assignedJobStatusFilter),
    );
    const searched = assignedJobSearch.trim()
      ? filtered.filter(
          (order) =>
            trIncludes(order.customerName, assignedJobSearch) ||
            trIncludes(order.title, assignedJobSearch),
        )
      : filtered;
    return [...searched].sort(
      (a, b) => assignedJobSortKey(a.status) - assignedJobSortKey(b.status),
    );
  }, [teamAssignedJobsAll, assignedJobStatusFilter, assignedJobSearch]);

  const handleWithdrawJob = async (jobId: string) => {
    if (!isSuperAdminUser) {
      alert('İş emri ataması yalnızca Super Admin tarafından yapılabilir.');
      return;
    }
    if (!window.confirm('Bu iş emri ataması geri çekilsin mi?')) return;
    try {
      await api.put(`/workorders/${jobId}/assign`, { assignedToUserId: null });
      setAllWorkOrders((prev) =>
        prev.map((o) =>
          o.id === jobId
            ? { ...o, assignedToUserId: null, assignedToUserName: 'Atanmamış', status: 'Atanmamış' }
            : o
        )
      );
      await reloadDataForSubmit();
    } catch (error) {
      console.error(error);
      alert('İş emri geri çekilemedi.');
    }
  };

  const openPeriodicModal = async (job: AssignedWorkOrder) => {
    if (!isSuperAdminUser) return;
    setPeriodicJob(job);
    setPeriodicModalOpen(true);
    setPeriodicLoading(true);
    setPeriodicOccurrences([]);
    try {
      const templateId = job.isPeriodic ? job.id : (job.parentWorkOrderId ?? job.id);
      const { data } = await api.get<{ occurrences: PeriodicOccurrence[] }>(
        `/workorders/${templateId}/occurrences`,
      );
      setPeriodicOccurrences(data.occurrences ?? []);
    } catch (error) {
      console.error(error);
      alert('Periyodik dönemler yüklenemedi.');
    } finally {
      setPeriodicLoading(false);
    }
  };

  const handleReassignOccurrence = async (occurrenceId: string) => {
    const userId = reassignByOccurrence[occurrenceId];
    if (!userId) {
      alert('Yeni ekip üyesi seçin.');
      return;
    }
    setReassigningOccurrenceId(occurrenceId);
    try {
      await api.post(`/workorders/${occurrenceId}/reassign`, { assignedToUserId: userId });
      await reloadDataForSubmit();
      if (periodicJob) await openPeriodicModal(periodicJob);
      alert('Dönem ataması güncellendi.');
    } catch (error) {
      console.error(error);
      alert('Atama güncellenemedi.');
    } finally {
      setReassigningOccurrenceId(null);
    }
  };

  const handleReassignForward = async (occurrenceId: string) => {
    const userId = reassignByOccurrence[occurrenceId];
    if (!userId) {
      alert('Yeni ekip üyesi seçin.');
      return;
    }
    if (!window.confirm('Seçilen dönemden itibaren (dahil) sonraki tüm dönemlere bu atama uygulanacak. Devam edilsin mi?')) return;
    setReassigningOccurrenceId(occurrenceId);
    try {
      await api.post(`/workorders/${occurrenceId}/reassign-forward`, { assignedToUserId: userId });
      await reloadDataForSubmit();
      if (periodicJob) await openPeriodicModal(periodicJob);
      alert('Sonraki dönemler güncellendi.');
    } catch (error) {
      console.error(error);
      alert('Toplu atama güncellenemedi.');
    } finally {
      setReassigningOccurrenceId(null);
    }
  };

  const handleWithdrawPeriod = async (occurrenceId: string) => {
    if (!window.confirm('Bu dönemin ataması kaldırılsın mı?')) return;
    setReassigningOccurrenceId(occurrenceId);
    try {
      await api.put(`/workorders/${occurrenceId}/assign`, { assignedToUserId: null });
      await reloadDataForSubmit();
      if (periodicJob) await openPeriodicModal(periodicJob);
    } catch (error) {
      console.error(error);
      alert('Atama kaldırılamadı.');
    } finally {
      setReassigningOccurrenceId(null);
    }
  };

  const patchTeamById = (teamId: string, patch: Partial<TeamMemberData>) => {
    setSelectedTeam((prev) => (prev && prev.id === teamId ? { ...prev, ...patch } : prev));
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, ...patch } : t)));
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const documentIcon = (fileName: string, contentType: string) => {
    const lower = `${fileName} ${contentType}`.toLowerCase();
    if (lower.includes('pdf')) return '📄';
    if (lower.includes('image') || /\.(jpg|jpeg|png|webp)$/i.test(fileName)) return '🖼️';
    if (/\.(xls|xlsx)$/i.test(fileName) || lower.includes('sheet') || lower.includes('excel')) return '📊';
    if (/\.(doc|docx)$/i.test(fileName) || lower.includes('word')) return '📝';
    return '📎';
  };

  const loadTeamDocuments = async (teamId: string) => {
    setIsLoadingDocs(true);
    try {
      const { data } = await api.get<{ items: TeamDocumentItem[] }>(`/teams/${teamId}/documents`);
      const items = data.items || [];
      setTeamDocuments(items);
      const auth = items.find((d) => d.documentType === 'Authorization');
      const personnelCount = items.filter((d) => d.documentType === 'Personnel').length;
      patchTeamById(teamId, {
        hasAuthorizationDocument: !!auth,
        authorizationDocumentFileName: auth?.fileName ?? null,
        authorizationDocumentFileSize: auth?.fileSize ?? null,
        personnelDocumentCount: personnelCount,
      });
    } catch (error) {
      console.error(error);
      setTeamDocuments([]);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const openDocumentsModal = async (filter: 'all' | 'Authorization' | 'Personnel' = 'all') => {
    if (!selectedTeam || !canManageTeamDocuments) return;
    setDocsModalFilter(filter);
    setIsDocsModalOpen(true);
    await loadTeamDocuments(selectedTeam.id);
  };

  const handleUploadDocument = async (
    file: File | null,
    type: 'Authorization' | 'Personnel',
  ) => {
    if (!selectedTeam || !file) return;
    const teamId = selectedTeam.id;

    if (file.size > 27 * 1024 * 1024) {
      alert('Dosya boyutu en fazla 27 MB olabilir.');
      if (type === 'Authorization') setAuthDocInputKey((k) => k + 1);
      else setPersonnelDocInputKey((k) => k + 1);
      return;
    }

    if (type === 'Authorization') {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Yetki Belgesi yalnızca PDF olabilir.');
        setAuthDocInputKey((k) => k + 1);
        return;
      }
    } else {
      const ok = /\.(pdf|jpg|jpeg|png|webp|doc|docx|xls|xlsx)$/i.test(file.name);
      if (!ok) {
        alert('Personel evrakı: PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX.');
        setPersonnelDocInputKey((k) => k + 1);
        return;
      }
      if ((selectedTeam.personnelDocumentCount ?? 0) >= 10) {
        alert('Personel Evrak Bilgisi en fazla 10 dosya olabilir.');
        setPersonnelDocInputKey((k) => k + 1);
        return;
      }
    }

    setIsUploadingDoc(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/teams/${teamId}/documents?type=${type}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (type === 'Authorization') {
        patchTeamById(teamId, {
          hasAuthorizationDocument: true,
          authorizationDocumentFileName: data.fileName,
          authorizationDocumentFileSize: data.fileSize,
        });
      } else {
        patchTeamById(teamId, {
          personnelDocumentCount: (selectedTeam.personnelDocumentCount ?? 0) + 1,
        });
      }
      if (isDocsModalOpen) await loadTeamDocuments(teamId);
      alert(data.message || 'Dosya kaydedildi.');
    } catch (err) {
      const error = err as AxiosErrorResponse;
      console.error(error);
      alert(error.response?.data?.message || 'Dosya yüklenemedi.');
    } finally {
      setIsUploadingDoc(false);
      if (type === 'Authorization') setAuthDocInputKey((k) => k + 1);
      else setPersonnelDocInputKey((k) => k + 1);
    }
  };

  const handleViewDocument = async (doc: TeamDocumentItem) => {
    if (!selectedTeam) return;
    try {
      const { data } = await api.get(`/teams/${selectedTeam.id}/documents/${doc.id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([data], { type: doc.contentType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error(error);
      alert('Dosya açılamadı.');
    }
  };

  const handleDeleteDocument = async (doc: TeamDocumentItem) => {
    if (!selectedTeam) return;
    const teamId = selectedTeam.id;
    const label = doc.documentType === 'Authorization' ? 'Yetki Belgesi' : 'Personel evrakı';
    if (!window.confirm(`${label} silinsin mi?\n${doc.fileName}`)) return;
    try {
      const { data } = await api.delete(`/teams/${teamId}/documents/${doc.id}`);
      if (doc.documentType === 'Authorization') {
        patchTeamById(teamId, {
          hasAuthorizationDocument: false,
          authorizationDocumentFileName: null,
          authorizationDocumentFileSize: null,
        });
      } else {
        patchTeamById(teamId, {
          personnelDocumentCount: Math.max(0, (selectedTeam.personnelDocumentCount ?? 1) - 1),
        });
      }
      setTeamDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      alert(data.message || 'Silindi.');
    } catch (err) {
      const error = err as AxiosErrorResponse;
      console.error(error);
      alert(error.response?.data?.message || 'Silinemedi.');
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-white relative overflow-hidden">
      
      <div className="mb-4 space-y-3">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
          <input 
            type="text" placeholder="Arama" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-orange outline-none shadow-inner" 
          />
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 gap-3">
          <div className="text-[11px] text-slate-500 font-semibold">
            {lastLocationRefresh
              ? `Son güncelleme: ${lastLocationRefresh.toLocaleTimeString('tr-TR')}`
              : 'Canlı konum için Güncelle\'ye basın'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefreshLocations}
              disabled={refreshingLocations}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {refreshingLocations ? 'Güncelleniyor...' : '📍 Güncelle'}
            </button>
            <button onClick={openCreateForm} className="px-4 py-2 bg-white border border-blue-500 text-blue-500 rounded-lg text-sm font-bold hover:bg-blue-50 transition">
              + Ekip Ekle
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar pb-4">
        {isLoading ? (
          <PageLoading variant="panel" />
        ) : filteredTeams.length === 0 ? (
          <p className="text-sm text-slate-400 text-center mt-10">Kayıtlı ekip bulunmuyor.</p>
        ) : (
          filteredTeams.map((team) => {
            const pk = resolvePartnerKey({ tenantId: team.tenantId, name: team.project });
            const accent = partnerKey === 'all' ? getPartnerColor(pk) : '#B4D334';
            return (
            <div 
              key={team.id}
              onClick={() => team.position && setFocusedMarkerPosition([...team.position])}
              className="bg-white rounded-xl shadow-md border border-slate-200 border-l-[6px] p-4 cursor-pointer hover:shadow-lg transition relative group"
              style={{ borderLeftColor: accent }}
            >
              <div className="mb-2">
                <label className="flex min-w-0 cursor-pointer items-start gap-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="ga-checkbox mt-0.5" />
                  <span className="font-bold text-brand-navy text-base group-hover:text-brand-orange transition-colors wrap-break-word leading-snug">{team.name}</span>
                </label>
              </div>

              <div className="space-y-1 text-xs text-slate-700 font-medium pl-7">
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Proje:</span><span className="flex-1 font-bold text-slate-600 wrap-break-word" title={team.project}>{team.project}</span></div>
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Araç Plakası:</span><span className="flex-1 font-bold text-slate-600">{team.plate || 'Atanmamış'}</span></div>
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Telefon Numarası:</span><span className="flex-1 font-bold text-slate-600">{team.phone}</span></div>
                {/* 🚀 LİSTEDE İL VE İLÇE GÖSTERİMİ */}
                <div className="flex"><span className="w-28 text-slate-400 font-bold">Bölge:</span><span className="flex-1 font-bold text-slate-600">{team.city !== '-' ? `${team.city} / ${team.district}` : 'Belirtilmemiş'}</span></div>
                <div className="flex items-center">
                  <span className="w-28 text-slate-400 font-bold">Canlı Konum:</span>
                  <span className={`flex-1 font-bold ${team.hasLiveLocation ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {team.hasLiveLocation
                      ? `Aktif${team.locationUpdatedAt ? ` · ${formatTurkeyDateTime(team.locationUpdatedAt)}` : ''}`
                      : 'Mobil uygulamadan henüz gelmedi'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end mt-3 pt-2 border-t border-slate-100 pl-7">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openTeamDetail(team);
                  }}
                  className="text-xs text-blue-600 bg-blue-50 px-4 py-1.5 rounded-lg hover:bg-blue-100 transition font-bold shadow-sm"
                >
                  🔎 Detay
                </button>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Ekip ekleme — merkez modal */}
      {isFormOpen && (
        <ModalOverlay>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h2 className="text-base font-bold text-brand-navy">Ekip Ekle</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl px-2">×</button>
            </div>
        
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-sm">
          {isSuperAdminUser && (
            <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-200 mb-2 animate-fadeIn">
              <label className="block text-xs font-bold text-orange-800 mb-1 uppercase tracking-wider">🏢 Hedef Firma Seçiniz (Super Admin Yetkisi)</label>
              <select required className="w-full border border-orange-300 rounded-lg p-2.5 bg-white text-xs font-bold focus:ring-2 focus:ring-brand-orange outline-none" value={formData.tenantId} onChange={e => handleTenantChange(e.target.value)}>
                <option value="">Firma Seçiniz...</option>
                {globalTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Ad Soyad</label><input required placeholder="Ad Soyad" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Kullanıcı Adı</label><input required placeholder="Örn: utkuobuz" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-bold text-slate-700 mb-1">E-Posta Adresi</label><input type="email" required placeholder="E-Posta Adresi" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Giriş Şifresi</label><input type="password" required placeholder="••••••••" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Telefon Numarası</label><input required placeholder="0555..." className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
          </div>

          <div className="flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Enlem (Lat)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-brand-orange/20 font-mono text-xs" value={formData.lat} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Boylam (Lng)</label><input type="number" step="any" required className="w-full border border-slate-300 rounded-lg p-2 bg-white outline-none focus:ring-2 focus:ring-brand-orange/20 font-mono text-xs" value={formData.lng} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} /></div>
          </div>
          
          {/* 🚀 FORM: YENİ İL, İLÇE VE ADRES KUTULARI EKLENDİ */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex-1"><label className="block text-xs font-bold text-slate-700 mb-1">İl (Şehir)</label><input placeholder="Örn: Ankara" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
            <div className="flex-1"><label className="block text-xs font-bold text-slate-700 mb-1">İlçe</label><input placeholder="Örn: Çankaya" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} /></div>
            <div className="col-span-2"><label className="block text-xs font-bold text-slate-700 mb-1">Açık Adres</label><textarea rows={2} placeholder="Saha personelinin tam adresi..." className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ekip Lideri (Opsiyonel)</label>
            <select className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 outline-none focus:ring-2 focus:ring-brand-orange/20" value={formData.teamLeader} onChange={e => setFormData({...formData, teamLeader: e.target.value})}>
              <option value="">Seçiniz (Atanmamış)</option>
              {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Bağlı Olacağı Projeler *
              {selectedProjectIds.length > 0 && (
                <span className="ml-2 normal-case text-slate-400 font-semibold">· {selectedProjectIds.length} seçili</span>
              )}
            </label>
            <div className="w-full border border-slate-300 rounded-xl p-3 bg-slate-50 max-h-40 overflow-y-auto space-y-2.5 shadow-inner">
              {isSuperAdminUser && !formData.tenantId ? (
                <p className="text-[11px] text-slate-400 font-medium">Önce hedef firma seçin.</p>
              ) : createFormProjects.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium">Bu firma için seçilebilir proje bulunamadı.</p>
              ) : (
              createFormProjects.map((proj) => (
                <label key={proj.id} className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700">
                  <input type="checkbox" className="ga-checkbox" checked={selectedProjectIds.includes(proj.id)} onChange={() => setSelectedProjectIds(prev => prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id])} />
                  <span>{proj.name}</span>
                </label>
              ))
              )}
            </div>
          </div>

          <div><label className="block text-xs font-bold text-slate-700 mb-1">Araç Plakası (Opsiyonel)</label><input placeholder="Araç Plakası" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value})} /></div>

          <div className="flex justify-end gap-3 items-center pt-4 border-t">
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50">İptal</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md transition disabled:opacity-50">{isSubmitting ? '...' : '✓ Kaydet'}</button>
          </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* EDİTLENEBİLİR GELİŞMİŞ MERKEZ MODAL */}
      {isDetailModalOpen && selectedTeam && (
        <ModalOverlay>
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <h2 className="text-base font-bold text-brand-navy">👤 Ekip Personel Kartı {isEditingModal && '› Düzenleme Modu'}</h2>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-600 font-bold text-2xl transition-colors">×</button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-100/50 px-6 pt-2 shrink-0">
              <button disabled={isEditingModal} onClick={() => setActiveTab('details')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${activeTab === 'details' ? 'border-brand-orange text-brand-orange bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Ekip Bilgileri</button>
              <button disabled={isEditingModal} onClick={() => setActiveTab('jobs')} className={`px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${activeTab === 'jobs' ? 'border-brand-orange text-brand-orange bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Atanmış İşler ({teamAssignedJobsAll.length})</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-xs">
              {activeTab === 'details' && (
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm mb-4">👷 Personel: {selectedTeam.name}</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Adı Soyadı</label>
                      <input required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Kullanıcı Adı</label>
                      <input required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.username} onChange={e => setEditFormData({...editFormData, username: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">E-Posta Adresi</label>
                      <input type="email" required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Giriş Şifresi</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        disabled={!isEditingModal}
                        placeholder={isEditingModal ? 'Yeni şifre yazın (boş = değişmez)' : '••••••••'}
                        className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-400'}`}
                        value={editFormData.password}
                        onChange={e => setEditFormData({...editFormData, password: e.target.value})}
                      />
                      {isEditingModal && (
                        <p className="mt-1 text-[10px] text-slate-500 font-medium">Eski şifre sorulmaz; doldurursanız personelin şifresi güncellenir.</p>
                      )}
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Telefon Numarası</label>
                      <input required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider">Ekip Lideri</label>
                      {isEditingModal ? (
                        <select className="w-full border border-blue-400 rounded-lg p-2.5 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-100" value={editFormData.teamLeader} onChange={e => setEditFormData({...editFormData, teamLeader: e.target.value})}>
                          <option value="">Atanmamış</option>
                          {teams.filter(t => t.id !== selectedTeam.id).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      ) : (
                        <input disabled className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-lg p-2.5 cursor-not-allowed" value={selectedTeam.teamLeader || 'Atanmamış'} />
                      )}
                    </div>

                    {/* 🚀 MODAL: YENİ İL, İLÇE VE ADRES KUTULARI EKLENDİ */}
                    <div className="col-span-2 flex gap-4">
                      <div className="flex-1">
                        <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">İl (Şehir)</label>
                        <input disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.city} onChange={e => setEditFormData({...editFormData, city: e.target.value})} />
                      </div>
                      <div className="flex-1">
                        <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">İlçe</label>
                        <input disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.district} onChange={e => setEditFormData({...editFormData, district: e.target.value})} />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">Açık Adres</label>
                      {isEditingModal ? (
                        <textarea rows={2} className="w-full border border-blue-400 rounded-lg p-2.5 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-100" value={editFormData.address} onChange={e => setEditFormData({...editFormData, address: e.target.value})} />
                      ) : (
                        <textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedTeam.address || '-'} />
                      )}
                    </div>

                    <div className="col-span-2 flex gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner mt-1">
                      <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Kayıtlı Enlem (Lat)</label><input type="number" step="any" required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2 font-semibold outline-none font-mono text-xs ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`} value={editFormData.lat} onChange={e => setEditFormData({...editFormData, lat: parseFloat(e.target.value)})} /></div>
                      <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Kayıtlı Boylam (Lng)</label><input type="number" step="any" required={isEditingModal} disabled={!isEditingModal} className={`w-full border rounded-lg p-2 font-semibold outline-none font-mono text-xs ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-600'}`} value={editFormData.lng} onChange={e => setEditFormData({...editFormData, lng: parseFloat(e.target.value)})} /></div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">Araç Plakası</label>
                      <input disabled={!isEditingModal} className={`w-full border rounded-lg p-2.5 font-semibold outline-none ${isEditingModal ? 'bg-white border-blue-400 focus:ring-2 focus:ring-blue-100' : 'bg-slate-50 border-slate-200 cursor-not-allowed text-slate-700'}`} value={editFormData.plate} onChange={e => setEditFormData({...editFormData, plate: e.target.value})} />
                    </div>

                    {canManageTeamDocuments && (
                    <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Sol: Yetki Belgesi */}
                      <div>
                        <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">Yetki Belgesi</label>
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 min-h-27">
                          {selectedTeam.hasAuthorizationDocument ? (
                            <>
                              <p className="text-[11px] font-semibold text-slate-700 truncate" title={selectedTeam.authorizationDocumentFileName || undefined}>
                                📄 {selectedTeam.authorizationDocumentFileName || 'yetki-belgesi.pdf'}
                                {selectedTeam.authorizationDocumentFileSize
                                  ? ` · ${formatFileSize(selectedTeam.authorizationDocumentFileSize)}`
                                  : ''}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => openDocumentsModal('Authorization')} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                                  Görüntüle
                                </button>
                                <label className={`text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 cursor-pointer ${isUploadingDoc ? 'opacity-60 pointer-events-none' : ''}`}>
                                  {isUploadingDoc ? '…' : 'Değiştir'}
                                  <input
                                    key={authDocInputKey}
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    className="hidden"
                                    disabled={isUploadingDoc}
                                    onChange={(e) => handleUploadDocument(e.target.files?.[0] ?? null, 'Authorization')}
                                  />
                                </label>
                              </div>
                            </>
                          ) : (
                            <label className={`inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-800 cursor-pointer ${isUploadingDoc ? 'opacity-60 pointer-events-none' : ''}`}>
                              {isUploadingDoc ? 'Yükleniyor...' : '📎 PDF Yükle'}
                              <input
                                key={authDocInputKey}
                                type="file"
                                accept="application/pdf,.pdf"
                                className="hidden"
                                disabled={isUploadingDoc}
                                onChange={(e) => handleUploadDocument(e.target.files?.[0] ?? null, 'Authorization')}
                              />
                            </label>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium">1 PDF · max 27 MB · Faz 2 mobil paylaşım</p>
                        </div>
                      </div>

                      {/* Sağ: Personel Evrak Bilgisi */}
                      <div>
                        <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">Personel Evrak Bilgisi</label>
                        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2 min-h-27">
                          <p className="text-[11px] font-semibold text-slate-700">
                            {(selectedTeam.personnelDocumentCount ?? 0)} / 10 dosya
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => openDocumentsModal('Personnel')} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                              Evrakları Aç
                            </button>
                            <label className={`text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer ${isUploadingDoc || (selectedTeam.personnelDocumentCount ?? 0) >= 10 ? 'opacity-60 pointer-events-none' : ''}`}>
                              {isUploadingDoc ? '…' : '+ Ekle'}
                              <input
                                key={personnelDocInputKey}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                className="hidden"
                                disabled={isUploadingDoc || (selectedTeam.personnelDocumentCount ?? 0) >= 10}
                                onChange={(e) => handleUploadDocument(e.target.files?.[0] ?? null, 'Personnel')}
                              />
                            </label>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">PDF / görsel / Word / Excel · max 10 · 27 MB</p>
                        </div>
                      </div>
                    </div>
                    )}

                    <div className="col-span-2">
                      <label className="block font-bold text-slate-500 mb-1 uppercase tracking-wider mt-1">
                        Bağlı Olduğu Projeler (Çoklu Seçim)
                        {isEditingModal && (
                          <span className="ml-2 normal-case text-slate-400 font-semibold">
                            · {editProjectIds.length} seçili
                          </span>
                        )}
                      </label>
                      {isEditingModal ? (
                        <div className="w-full border border-blue-400 rounded-xl p-3 bg-white max-h-36 overflow-y-auto space-y-2 shadow-inner">
                          {editProjectOptions.map((proj) => (
                            <label key={proj.id} className="flex items-center gap-3 cursor-pointer text-xs font-semibold">
                              <input type="checkbox" className="ga-checkbox" checked={editProjectIds.includes(proj.id)} onChange={() => setEditProjectIds(prev => prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id])} />
                              <span>{proj.name}</span>
                            </label>
                          ))}
                          {editProjectOptions.length === 0 && (
                            <p className="text-[11px] text-slate-400 font-medium">Seçilebilir proje bulunamadı.</p>
                          )}
                        </div>
                      ) : (
                        <textarea disabled rows={2} className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg p-2.5 cursor-not-allowed resize-none" value={selectedTeam.project} />
                      )}
                    </div>
                  </div>

                  {isEditingModal && (
                    <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
                      <button type="button" onClick={() => setIsEditingModal(false)} className="bg-slate-400 text-white font-bold px-4 py-2 rounded-xl hover:bg-slate-500 transition">Vazgeç</button>
                      <button type="submit" disabled={isSubmitting} className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-emerald-700 shadow transition">{isSubmitting ? '...' : 'Değişiklikleri Kaydet'}</button>
                    </div>
                  )}
                </form>
              )}

              {activeTab === 'jobs' && (
                <div className="space-y-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Lokasyon / nokta / iş ara..."
                      value={assignedJobSearch}
                      onChange={(e) => setAssignedJobSearch(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-brand-orange outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pb-1">
                    {ASSIGNED_JOB_STATUS_FILTERS.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setAssignedJobStatusFilter(chip.key)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition ${
                          assignedJobStatusFilter === chip.key ? chip.active : chip.idle
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  {assignedJobs.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 font-medium">
                      {teamAssignedJobsAll.length === 0
                        ? '📭 Bu ekip üyesine henüz atanmış bir iş emri bulunmuyor.'
                        : assignedJobSearch.trim()
                          ? 'Arama kriterine uygun iş emri bulunmuyor.'
                          : 'Seçilen filtreye uygun iş emri bulunmuyor.'}
                    </div>
                  ) : (
                    assignedJobs.map((job) => (
                      <div key={job.id} className="border border-slate-200 bg-slate-50 rounded-xl p-3 flex justify-between items-center shadow-sm gap-3">
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-bold text-brand-navy text-sm truncate">{job.customerName}</h4>
                          <p className="text-slate-500 text-[11px] font-medium truncate">Özet: {job.title} | Tip: <span className="font-bold">{job.type}</span></p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-semibold border rounded px-1.5 py-0.5 ${jobStatusBadgeClass(job.status)}`}>{job.status}</span>
                          {isSuperAdminUser && job.isPeriodic && !job.parentWorkOrderId && (
                            <button
                              type="button"
                              onClick={() => openPeriodicModal(job)}
                              className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100"
                            >
                              Dönemler
                            </button>
                          )}
                          {isSuperAdminUser && (
                          <button
                            type="button"
                            onClick={() => handleWithdrawJob(job.id)}
                            className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg hover:bg-rose-100"
                          >
                            Geri Çek
                          </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between shrink-0 gap-3">
              <div className="flex gap-2">
                {!isEditingModal && activeTab === 'details' && (
                  <>
                    <button onClick={() => setIsEditingModal(true)} className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-blue-700 shadow transition">✏️ Ekibi Düzenle</button>
                    <button
                      type="button"
                      onClick={handleDeleteTeam}
                      disabled={isDeletingTeam}
                      className="bg-rose-600 text-white font-bold px-5 py-2 rounded-xl hover:bg-rose-700 shadow transition disabled:opacity-60"
                    >
                      {isDeletingTeam ? 'Siliniyor...' : '🗑️ Ekibi Sil'}
                    </button>
                  </>
                )}
              </div>
              <button disabled={isSubmitting || isDeletingTeam} onClick={() => setIsDetailModalOpen(false)} className="bg-slate-700 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 transition shadow">Kapat</button>
            </div>

          </div>
        </ModalOverlay>
      )}

      {isDocsModalOpen && selectedTeam && (
        <ModalOverlay className="animate-fadeIn">
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Evrak Yönetimi</p>
                <h2 className="text-lg font-bold text-brand-navy truncate">{selectedTeam.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Yetki Belgesi ve Personel Evrak Bilgisi</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDocsModalOpen(false)}
                className="text-slate-400 hover:text-rose-600 font-bold text-2xl leading-none px-1"
              >
                ×
              </button>
            </div>

            <div className="px-6 pt-4 flex flex-wrap gap-2">
              {([
                { key: 'all' as const, label: 'Tümü' },
                { key: 'Authorization' as const, label: 'Yetki Belgesi' },
                { key: 'Personnel' as const, label: 'Personel Evrak' },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDocsModalFilter(tab.key)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                    docsModalFilter === tab.key
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                {docsModalFilter !== 'Personnel' && (
                  <label className={`text-xs font-bold px-3 py-1.5 rounded-full bg-slate-800 text-white cursor-pointer hover:bg-slate-900 ${isUploadingDoc ? 'opacity-60 pointer-events-none' : ''}`}>
                    Yetki PDF
                    <input
                      key={`modal-auth-${authDocInputKey}`}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      disabled={isUploadingDoc}
                      onChange={(e) => handleUploadDocument(e.target.files?.[0] ?? null, 'Authorization')}
                    />
                  </label>
                )}
                {docsModalFilter !== 'Authorization' && (
                  <label className={`text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700 ${isUploadingDoc || (selectedTeam.personnelDocumentCount ?? 0) >= 10 ? 'opacity-60 pointer-events-none' : ''}`}>
                    + Personel Evrak
                    <input
                      key={`modal-pers-${personnelDocInputKey}`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
                      className="hidden"
                      disabled={isUploadingDoc || (selectedTeam.personnelDocumentCount ?? 0) >= 10}
                      onChange={(e) => handleUploadDocument(e.target.files?.[0] ?? null, 'Personnel')}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {isLoadingDocs ? (
                <div className="py-16 text-center text-sm font-bold text-slate-400 animate-pulse">Evraklar yükleniyor…</div>
              ) : (
                (() => {
                  const filtered = teamDocuments.filter((d) =>
                    docsModalFilter === 'all' ? true : d.documentType === docsModalFilter,
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center">
                        <div className="text-4xl mb-3 opacity-40">📂</div>
                        <p className="text-sm font-bold text-slate-500">Bu kategoride dosya yok</p>
                        <p className="text-xs text-slate-400 mt-1">Yukarıdan dosya ekleyebilirsiniz</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filtered.map((doc) => (
                        <div
                          key={doc.id}
                          className="group relative rounded-2xl border border-slate-200 bg-linear-to-br from-white to-slate-50 p-4 shadow-sm hover:shadow-md hover:border-brand-orange/40 transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                              {documentIcon(doc.fileName, doc.contentType)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                {doc.documentType === 'Authorization' ? 'Yetki Belgesi' : 'Personel Evrak'}
                              </p>
                              <p className="text-sm font-bold text-brand-navy truncate" title={doc.fileName}>
                                {doc.fileName}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {formatFileSize(doc.fileSize)}
                                {doc.uploadedAt ? ` · ${formatTurkeyDateTime(doc.uploadedAt)}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewDocument(doc)}
                              className="flex-1 text-[11px] font-bold px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                            >
                              Aç
                            </button>
                            {doc.documentType === 'Authorization' ? (
                              <label className="flex-1 text-center text-[11px] font-bold px-3 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 cursor-pointer">
                                Değiştir
                                <input
                                  type="file"
                                  accept="application/pdf,.pdf"
                                  className="hidden"
                                  disabled={isUploadingDoc}
                                  onChange={(e) => handleUploadDocument(e.target.files?.[0] ?? null, 'Authorization')}
                                />
                              </label>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc)}
                              className="text-[11px] font-bold px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDocsModalOpen(false)}
                className="bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-slate-900 transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {periodicModalOpen && periodicJob && (
        <ModalOverlay className="animate-fadeIn">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-brand-navy">Periyodik Dönem Atamaları</h3>
              <p className="text-sm text-slate-500 mt-1">{periodicJob.customerName} — {periodicJob.title}</p>
              <p className="text-[11px] text-slate-400 mt-1">Açılış ayından yıl sonuna kadar tüm dönemler listelenir. Tek dönem veya sonrasına toplu atama yapabilirsiniz.</p>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {periodicLoading ? (
                <p className="text-center text-slate-400 py-8">Dönemler yükleniyor...</p>
              ) : periodicOccurrences.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Dönem bulunamadı.</p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid sm:grid-cols-[2.5rem_1fr_1.2fr_1fr_auto] gap-2 px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>#</span>
                    <span>Dönem</span>
                    <span>Tarih</span>
                    <span>Atanan</span>
                    <span>İşlem</span>
                  </div>
                  {periodicOccurrences.map((occ) => (
                    <div
                      key={occ.id}
                      className={`rounded-xl border p-3 flex flex-col sm:grid sm:grid-cols-[2.5rem_1fr_1.2fr_1fr_auto] gap-2 sm:items-center ${periodRowClass(occ.status)}`}
                    >
                      <span className="text-xs font-bold text-slate-500">{occ.periodIndex ?? '—'}</span>
                      <div>
                        <p className="font-bold text-sm text-brand-navy">{occ.periodLabel ?? occ.startDate}</p>
                        <span className={`inline-block mt-0.5 text-[10px] font-semibold border rounded px-1.5 py-0.5 ${jobStatusBadgeClass(occ.status)}`}>
                          {occ.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{formatTurkeyDateTime(occ.startDate)} → {formatTurkeyDateTime(occ.endDate)}</p>
                      <p className="text-[11px] font-semibold text-slate-700">{occ.assignedToUserName}</p>
                      <div className="flex flex-wrap gap-1.5 sm:justify-end">
                        <select
                          className="border border-slate-300 rounded-lg p-1.5 text-[11px] font-semibold min-w-28"
                          value={reassignByOccurrence[occ.id] ?? ''}
                          onChange={(e) => setReassignByOccurrence((prev) => ({ ...prev, [occ.id]: e.target.value }))}
                        >
                          <option value="">Ekip seç</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={reassigningOccurrenceId === occ.id}
                          onClick={() => handleReassignOccurrence(occ.id)}
                          className="text-[10px] font-bold bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                        >
                          Ata
                        </button>
                        <button
                          type="button"
                          disabled={reassigningOccurrenceId === occ.id}
                          onClick={() => handleReassignForward(occ.id)}
                          className="text-[10px] font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                          title="Seçilen dönemden sonrasına uygula"
                        >
                          Sonrasına
                        </button>
                        <button
                          type="button"
                          disabled={reassigningOccurrenceId === occ.id}
                          onClick={() => handleWithdrawPeriod(occ.id)}
                          className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 disabled:opacity-60"
                        >
                          Geri Çek
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => { setPeriodicModalOpen(false); setPeriodicJob(null); }}
                className="bg-slate-700 text-white font-bold px-5 py-2 rounded-xl"
              >
                Kapat
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}