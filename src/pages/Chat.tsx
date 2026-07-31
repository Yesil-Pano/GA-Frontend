import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { isAxiosError } from 'axios';
import { MessageCircle, Search, Send } from 'lucide-react';
import api from '../services/api';

type ChatTab = 'field' | 'office';

interface FieldConversationRow {
  id: string;
  fieldWorkerUserId: string;
  fieldWorkerName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

interface FieldChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  isFromFieldWorker: boolean;
  body: string;
  sentAt: string;
  clientMessageId?: string | null;
}

interface OfficeConversationRow {
  id: string | null;
  otherUserId: string;
  otherUserName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

interface OfficeChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  isMine: boolean;
  body: string;
  sentAt: string;
  clientMessageId?: string | null;
}

const POLL_MS = 4_000;

function getHubBaseUrl(): string {
  const base = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
  return `${base}/hubs/chat`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
}

function FieldMessageBubble({ message }: { message: FieldChatMessage }) {
  const isOffice = !message.isFromFieldWorker;

  return (
    <div className={`flex w-full ${isOffice ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
          isOffice
            ? 'rounded-br-md bg-[#F97316] text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p
          className={`mb-1 text-[11px] font-semibold ${
            isOffice ? 'text-white/90' : 'text-slate-500'
          }`}
        >
          {isOffice ? `${message.senderName} · Operasyon` : message.senderName}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            isOffice ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          {formatTime(message.sentAt)}
        </p>
      </div>
    </div>
  );
}

function OfficeMessageBubble({ message }: { message: OfficeChatMessage }) {
  const isMine = message.isMine;

  return (
    <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
          isMine
            ? 'rounded-br-md bg-[#F97316] text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p
          className={`mb-1 text-[11px] font-semibold ${
            isMine ? 'text-white/90' : 'text-slate-500'
          }`}
        >
          {message.senderName}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            isMine ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          {formatTime(message.sentAt)}
        </p>
      </div>
    </div>
  );
}

const Chat: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ChatTab>('field');

  // --- Field chat state ---
  const [fieldConversations, setFieldConversations] = useState<FieldConversationRow[]>([]);
  const [fieldSelectedId, setFieldSelectedId] = useState<string | null>(null);
  const [fieldMessages, setFieldMessages] = useState<FieldChatMessage[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldLoadingList, setFieldLoadingList] = useState(true);
  const [fieldLoadingMessages, setFieldLoadingMessages] = useState(false);
  const [fieldSending, setFieldSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'polling'>('connecting');

  // --- Office chat state ---
  const [officeConversations, setOfficeConversations] = useState<OfficeConversationRow[]>([]);
  const [officeSelectedId, setOfficeSelectedId] = useState<string | null>(null);
  const [officeSelectedUserId, setOfficeSelectedUserId] = useState<string | null>(null);
  const [officeMessages, setOfficeMessages] = useState<OfficeChatMessage[]>([]);
  const [officeSearch, setOfficeSearch] = useState('');
  const [officeLoadingList, setOfficeLoadingList] = useState(false);
  const [officeLoadingMessages, setOfficeLoadingMessages] = useState(false);
  const [officeSending, setOfficeSending] = useState(false);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const fieldSelectedIdRef = useRef<string | null>(null);
  const fieldMessagesRef = useRef<FieldChatMessage[]>([]);
  const officeSelectedIdRef = useRef<string | null>(null);
  const officeMessagesRef = useRef<OfficeChatMessage[]>([]);

  useEffect(() => {
    fieldSelectedIdRef.current = fieldSelectedId;
  }, [fieldSelectedId]);

  useEffect(() => {
    fieldMessagesRef.current = fieldMessages;
  }, [fieldMessages]);

  useEffect(() => {
    officeSelectedIdRef.current = officeSelectedId;
  }, [officeSelectedId]);

  useEffect(() => {
    officeMessagesRef.current = officeMessages;
  }, [officeMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const upsertFieldIncoming = useCallback((dto: FieldChatMessage) => {
    if (dto.conversationId !== fieldSelectedIdRef.current) return;
    setFieldMessages((prev) => (prev.some((m) => m.id === dto.id) ? prev : [...prev, dto]));
    setTimeout(scrollToBottom, 50);
  }, []);

  const loadFieldConversations = useCallback(async () => {
    try {
      const { data } = await api.get<FieldConversationRow[]>('/chat/conversations');
      setError(null);
      setFieldConversations(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Konuşmalar yüklenemedi.'));
    } finally {
      setFieldLoadingList(false);
    }
  }, []);

  const loadFieldMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setFieldLoadingMessages(true);
    try {
      const { data } = await api.get<FieldChatMessage[]>(
        `/chat/conversations/${conversationId}/messages`,
        { params: { take: 100 } },
      );
      const list = Array.isArray(data) ? data : [];
      setFieldMessages(list);
      if (!silent) {
        await api.post(`/chat/conversations/${conversationId}/read`).catch(() => undefined);
        setFieldConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
        );
        setTimeout(scrollToBottom, 50);
      } else {
        const prevIds = new Set(fieldMessagesRef.current.map((m) => m.id));
        const hasNew = list.some((m) => !prevIds.has(m.id));
        if (hasNew) setTimeout(scrollToBottom, 50);
      }
    } catch (err: unknown) {
      if (!silent) setError(getApiErrorMessage(err, 'Mesajlar yüklenemedi.'));
    } finally {
      if (!silent) setFieldLoadingMessages(false);
    }
  }, []);

  const loadOfficeConversations = useCallback(async () => {
    try {
      const { data } = await api.get<OfficeConversationRow[]>('/office-chat/conversations');
      setError(null);
      setOfficeConversations(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Ofis konuşmaları yüklenemedi.'));
    } finally {
      setOfficeLoadingList(false);
    }
  }, []);

  const loadOfficeMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setOfficeLoadingMessages(true);
    try {
      const { data } = await api.get<OfficeChatMessage[]>(
        `/office-chat/conversations/${conversationId}/messages`,
        { params: { take: 100 } },
      );
      const list = Array.isArray(data) ? data : [];
      setOfficeMessages(list);
      if (!silent) {
        await api.post(`/office-chat/conversations/${conversationId}/read`).catch(() => undefined);
        setOfficeConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
        );
        setTimeout(scrollToBottom, 50);
      } else {
        const prevIds = new Set(officeMessagesRef.current.map((m) => m.id));
        const hasNew = list.some((m) => !prevIds.has(m.id));
        if (hasNew) setTimeout(scrollToBottom, 50);
      }
    } catch (err: unknown) {
      if (!silent) setError(getApiErrorMessage(err, 'Mesajlar yüklenemedi.'));
    } finally {
      if (!silent) setOfficeLoadingMessages(false);
    }
  }, []);

  const joinConversation = useCallback(async (conversationId: string) => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== HubConnectionState.Connected) return;
    try {
      await conn.invoke('JoinConversation', conversationId);
    } catch (err) {
      console.warn('[Chat] JoinConversation:', err);
    }
  }, []);

  const handleSelectFieldConversation = useCallback(
    (conversationId: string) => {
      setFieldSelectedId(conversationId);
      void loadFieldMessages(conversationId);
      void joinConversation(conversationId);
    },
    [loadFieldMessages, joinConversation],
  );

  const handleSelectOfficeConversation = useCallback(
    async (row: OfficeConversationRow) => {
      setOfficeSelectedUserId(row.otherUserId);
      setError(null);

      if (row.id) {
        setOfficeSelectedId(row.id);
        void loadOfficeMessages(row.id);
        return;
      }

      setOfficeLoadingMessages(true);
      try {
        const { data } = await api.post<OfficeConversationRow>('/office-chat/conversations/start', {
          targetUserId: row.otherUserId,
        });
        setOfficeSelectedId(data.id);
        setOfficeConversations((prev) =>
          prev.map((c) =>
            c.otherUserId === row.otherUserId
              ? { ...c, id: data.id, unreadCount: data.unreadCount }
              : c,
          ),
        );
        void loadOfficeMessages(data.id!);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Konuşma başlatılamadı.'));
        setOfficeLoadingMessages(false);
      }
    },
    [loadOfficeMessages],
  );

  useEffect(() => {
    let cancelled = false;
    void api
      .get<FieldConversationRow[]>('/chat/conversations')
      .then(({ data }) => {
        if (cancelled) return;
        setError(null);
        setFieldConversations(Array.isArray(data) ? data : []);
        setFieldLoadingList(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, 'Konuşmalar yüklenemedi.'));
        setFieldLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'office') return;
    setOfficeLoadingList(true);
    void loadOfficeConversations();
  }, [activeTab, loadOfficeConversations]);

  useEffect(() => {
    setInput('');
    setError(null);
  }, [activeTab]);

  // SignalR — field chat only
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLiveStatus('polling');
        return;
      }

      try {
        setLiveStatus('connecting');
        const connection = new HubConnectionBuilder()
          .withUrl(`${getHubBaseUrl()}?access_token=${encodeURIComponent(token)}`)
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(LogLevel.Warning)
          .build();

        connection.on('MessageCreated', (dto: FieldChatMessage) => {
          upsertFieldIncoming(dto);
          if (dto.conversationId === fieldSelectedIdRef.current) {
            api.post(`/chat/conversations/${dto.conversationId}/read`).catch(() => undefined);
          }
          setFieldConversations((prev) => {
            const exists = prev.find((c) => c.id === dto.conversationId);
            if (!exists) {
              void loadFieldConversations();
              return prev;
            }
            return prev
              .map((c) =>
                c.id === dto.conversationId
                  ? {
                      ...c,
                      lastMessageAt: dto.sentAt,
                      lastMessagePreview: dto.body,
                      unreadCount:
                        fieldSelectedIdRef.current === c.id
                          ? 0
                          : c.unreadCount + (dto.isFromFieldWorker ? 1 : 0),
                    }
                  : c,
              )
              .sort(
                (a, b) =>
                  new Date(b.lastMessageAt || 0).getTime() -
                  new Date(a.lastMessageAt || 0).getTime(),
              );
          });
        });

        connection.on('ConversationUpdated', () => {
          void loadFieldConversations();
        });

        connection.onreconnected(() => {
          setLiveStatus('live');
          if (fieldSelectedIdRef.current) {
            void connection.invoke('JoinConversation', fieldSelectedIdRef.current);
          }
        });

        connection.onclose(() => {
          if (!cancelled) setLiveStatus('polling');
        });

        await connection.start();
        if (cancelled) {
          await connection.stop();
          return;
        }
        connectionRef.current = connection;
        setLiveStatus('live');
        if (fieldSelectedIdRef.current) {
          await connection.invoke('JoinConversation', fieldSelectedIdRef.current);
        }
      } catch (err) {
        console.warn('[Chat] SignalR bağlanamadı, polling ile devam:', err);
        if (!cancelled) setLiveStatus('polling');
      }
    };

    void connect();

    return () => {
      cancelled = true;
      const conn = connectionRef.current;
      connectionRef.current = null;
      conn?.stop().catch(() => undefined);
    };
  }, [loadFieldConversations, upsertFieldIncoming]);

  useEffect(() => {
    if (activeTab !== 'field' || !fieldSelectedId) return;
    const tick = () => {
      void loadFieldMessages(fieldSelectedId, true);
      void loadFieldConversations();
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [activeTab, fieldSelectedId, loadFieldMessages, loadFieldConversations]);

  useEffect(() => {
    if (activeTab !== 'office' || !officeSelectedId) return;
    const tick = () => {
      void loadOfficeMessages(officeSelectedId, true);
      void loadOfficeConversations();
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [activeTab, officeSelectedId, loadOfficeMessages, loadOfficeConversations]);

  const sendFieldMessage = async () => {
    const text = input.trim();
    if (!text || !fieldSelectedId || fieldSending) return;
    setFieldSending(true);
    try {
      const { data } = await api.post<FieldChatMessage>(
        `/chat/conversations/${fieldSelectedId}/messages`,
        { body: text, clientMessageId: `${Date.now()}` },
      );
      setFieldMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setInput('');
      setFieldConversations((prev) =>
        prev
          .map((c) =>
            c.id === fieldSelectedId
              ? {
                  ...c,
                  lastMessageAt: data.sentAt,
                  lastMessagePreview: data.body,
                }
              : c,
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt || 0).getTime() -
              new Date(a.lastMessageAt || 0).getTime(),
          ),
      );
      setTimeout(scrollToBottom, 50);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Mesaj gönderilemedi.'));
    } finally {
      setFieldSending(false);
    }
  };

  const sendOfficeMessage = async () => {
    const text = input.trim();
    if (!text || !officeSelectedId || officeSending) return;
    setOfficeSending(true);
    try {
      const { data } = await api.post<OfficeChatMessage>(
        `/office-chat/conversations/${officeSelectedId}/messages`,
        { body: text, clientMessageId: `${Date.now()}` },
      );
      setOfficeMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setInput('');
      setOfficeConversations((prev) =>
        prev
          .map((c) =>
            c.id === officeSelectedId
              ? {
                  ...c,
                  lastMessageAt: data.sentAt,
                  lastMessagePreview: data.body,
                }
              : c,
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageAt || 0).getTime() -
              new Date(a.lastMessageAt || 0).getTime(),
          ),
      );
      setTimeout(scrollToBottom, 50);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Mesaj gönderilemedi.'));
    } finally {
      setOfficeSending(false);
    }
  };

  const sendMessage = () => {
    if (activeTab === 'field') void sendFieldMessage();
    else void sendOfficeMessage();
  };

  const fieldFiltered = fieldConversations.filter((c) =>
    c.fieldWorkerName.toLowerCase().includes(fieldSearch.trim().toLowerCase()),
  );

  const officeFiltered = officeConversations.filter((c) =>
    c.otherUserName.toLowerCase().includes(officeSearch.trim().toLowerCase()),
  );

  const selectedField = fieldConversations.find((c) => c.id === fieldSelectedId);
  const selectedOffice = officeConversations.find(
    (c) => c.otherUserId === officeSelectedUserId || c.id === officeSelectedId,
  );

  const isFieldTab = activeTab === 'field';
  const loadingList = isFieldTab ? fieldLoadingList : officeLoadingList;
  const loadingMessages = isFieldTab ? fieldLoadingMessages : officeLoadingMessages;
  const sending = isFieldTab ? fieldSending : officeSending;
  const hasSelection = isFieldTab ? !!fieldSelectedId : !!officeSelectedId;
  const search = isFieldTab ? fieldSearch : officeSearch;
  const setSearch = isFieldTab ? setFieldSearch : setOfficeSearch;

  const refreshAll = () => {
    setError(null);
    if (isFieldTab) {
      setFieldLoadingList(true);
      void loadFieldConversations();
      if (fieldSelectedId) void loadFieldMessages(fieldSelectedId);
    } else {
      setOfficeLoadingList(true);
      void loadOfficeConversations();
      if (officeSelectedId) void loadOfficeMessages(officeSelectedId);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-120 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-[#1A233A]">
            <div className="flex items-center gap-2">
              <MessageCircle size={20} className="text-[#F97316]" />
              <h2 className="text-lg font-bold">Sohbet</h2>
            </div>
            {isFieldTab && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  liveStatus === 'live'
                    ? 'bg-emerald-100 text-emerald-700'
                    : liveStatus === 'connecting'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {liveStatus === 'live'
                  ? 'Canlı'
                  : liveStatus === 'connecting'
                    ? 'Bağlanıyor'
                    : 'Yenileniyor'}
              </span>
            )}
            {!isFieldTab && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Yenileniyor
              </span>
            )}
          </div>

          <div className="mb-3 flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('field')}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                activeTab === 'field'
                  ? 'bg-[#F97316] text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Saha Personeli
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('office')}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                activeTab === 'office'
                  ? 'bg-[#F97316] text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Ofis Mesajları
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isFieldTab ? 'Saha personeli ara...' : 'Ofis kullanıcısı ara...'
              }
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F97316]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && !hasSelection && (
            <button
              type="button"
              onClick={refreshAll}
              className="m-3 w-[calc(100%-1.5rem)] rounded-lg bg-orange-50 px-3 py-2 text-left text-xs font-medium text-[#F97316]"
            >
              {error} — Yenile
            </button>
          )}
          {loadingList ? (
            <p className="p-4 text-sm text-slate-500">Yükleniyor...</p>
          ) : isFieldTab ? (
            fieldFiltered.length === 0 && !error ? (
              <p className="p-4 text-sm text-slate-500">
                Bu firmada kayıtlı saha personeli bulunamadı.
              </p>
            ) : (
              fieldFiltered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectFieldConversation(c.id)}
                  className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left transition-colors ${
                    fieldSelectedId === c.id
                      ? 'border-l-4 border-l-[#F97316] bg-orange-50'
                      : 'border-l-4 border-l-transparent hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-[#1A233A]">
                      {c.fieldWorkerName}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-slate-500">
                    {c.lastMessagePreview || 'Mesaj yok'}
                  </span>
                  <span className="text-[10px] text-slate-400">{formatTime(c.lastMessageAt)}</span>
                </button>
              ))
            )
          ) : officeFiltered.length === 0 && !error ? (
            <p className="p-4 text-sm text-slate-500">
              Bu firmada mesajlaşabileceğiniz ofis kullanıcısı bulunamadı.
            </p>
          ) : (
            officeFiltered.map((c) => (
              <button
                key={c.otherUserId}
                type="button"
                onClick={() => void handleSelectOfficeConversation(c)}
                className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left transition-colors ${
                  officeSelectedUserId === c.otherUserId
                    ? 'border-l-4 border-l-[#F97316] bg-orange-50'
                    : 'border-l-4 border-l-transparent hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#1A233A]">
                    {c.otherUserName}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <span className="truncate text-xs text-slate-500">
                  {c.lastMessagePreview || 'Mesaj yok'}
                </span>
                <span className="text-[10px] text-slate-400">{formatTime(c.lastMessageAt)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-[#F8FAFC]">
        {!hasSelection ? (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
            <MessageCircle size={48} className="mb-3 opacity-40" />
            <p className="text-sm">
              {isFieldTab
                ? 'Bir saha personeli seçerek yazışmaya başlayın.'
                : 'Bir ofis kullanıcısı seçerek yazışmaya başlayın.'}
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <div>
                <h3 className="font-bold text-[#1A233A]">
                  {isFieldTab
                    ? selectedField?.fieldWorkerName || 'Saha personeli'
                    : selectedOffice?.otherUserName || 'Ofis kullanıcısı'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isFieldTab ? 'Ofis ↔ saha 1:1 sohbet' : 'Ofis ↔ ofis 1:1 sohbet'}
                </p>
              </div>
            </header>

            {error && (
              <button
                type="button"
                onClick={refreshAll}
                className="bg-orange-50 px-4 py-2 text-left text-xs font-medium text-[#F97316]"
              >
                {error} — Yenilemek için tıklayın
              </button>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {loadingMessages ? (
                <p className="text-sm text-slate-500">Mesajlar yükleniyor...</p>
              ) : isFieldTab ? (
                fieldMessages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400">
                    Henüz mesaj yok. İlk mesajı siz yazabilirsiniz.
                  </p>
                ) : (
                  fieldMessages.map((m) => <FieldMessageBubble key={m.id} message={m} />)
                )
              ) : officeMessages.length === 0 ? (
                <p className="text-center text-sm text-slate-400">
                  Henüz mesaj yok. İlk mesajı siz yazabilirsiniz.
                </p>
              ) : (
                officeMessages.map((m) => <OfficeMessageBubble key={m.id} message={m} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder={
                    isFieldTab
                      ? 'Saha personeline mesaj yazın...'
                      : 'Ofis kullanıcısına mesaj yazın...'
                  }
                  className="max-h-28 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#F97316]"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F97316] text-white transition disabled:bg-slate-300"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Chat;
