import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { isAxiosError } from 'axios';
import { CheckCheck, MessageCircle, Search, Send } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import { formatTurkeyDateTime } from '../utils/dateTime';
import { getAuthProfile } from '../utils/authSession';
import { registerWebPushIfNeeded } from '../utils/webPush';
import PageLoading from '../components/PageLoading';

interface DirectContact {
  conversationId: string | null;
  userId: string;
  fullName: string;
  isGaManagement: boolean;
  badgeLabel: string | null;
  companyName: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

interface DirectMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  isMine: boolean;
  body: string;
  sentAt: string;
  clientMessageId?: string | null;
  isReadByOther: boolean;
}

function getHubBaseUrl(): string {
  const base = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
  return `${base}/hubs/chat`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return formatTurkeyDateTime(iso);
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
}

function normalizeUserId(id: string | null | undefined): string {
  return (id ?? '').trim().replace(/[{}]/g, '').toLowerCase();
}

function normalizeMessage(message: DirectMessage, myUserId: string | null): DirectMessage {
  if (!myUserId) return message;
  const isMine = normalizeUserId(message.senderUserId) === normalizeUserId(myUserId);
  return { ...message, isMine, isReadByOther: isMine ? message.isReadByOther : false };
}

function MessageBubble({ message }: { message: DirectMessage }) {
  return (
    <div className={`flex w-full ${message.isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
          message.isMine
            ? 'rounded-br-md bg-[#F97316] text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {!message.isMine && (
          <p className="mb-1 text-[11px] font-semibold text-slate-500">{message.senderName}</p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
        <div
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            message.isMine ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(message.sentAt)}</span>
          {message.isMine && message.isReadByOther && (
            <CheckCheck size={14} className="text-sky-200" aria-label="Okundu" />
          )}
        </div>
      </div>
    </div>
  );
}

const Chat: React.FC = () => {
  const { partnerKey } = useOutletContext<{ partnerKey?: string }>();

  const [contacts, setContacts] = useState<DirectContact[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const myUserIdRef = useRef<string | null>(getAuthProfile()?.userId ?? null);

  useEffect(() => {
    myUserIdRef.current = getAuthProfile()?.userId ?? null;
  }, []);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await api.get<DirectContact[]>('/office-chat/contacts', {
        params: { partnerKey: partnerKey || undefined },
      });
      setContacts(data);
      setError(null);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Kişi listesi yüklenemedi.'));
    } finally {
      setLoadingList(false);
    }
  }, [partnerKey]);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const { data } = await api.get<DirectMessage[]>(
        `/office-chat/conversations/${conversationId}/messages`,
        { params: { take: 100 } },
      );
      setMessages(data.map((m) => normalizeMessage(m, myUserIdRef.current)));
      await api.post(`/office-chat/conversations/${conversationId}/read`).catch(() => undefined);
      setContacts((prev) =>
        prev.map((c) =>
          c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      );
      setError(null);
      if (!silent) setTimeout(scrollToBottom, 50);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Mesajlar yüklenemedi.'));
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const handleSelectContact = useCallback(
    async (contact: DirectContact) => {
      setSelectedUserId(contact.userId);
      setTypingUserId(null);
      try {
        let conversationId = contact.conversationId;
        if (!conversationId) {
          const { data } = await api.post<DirectContact>('/office-chat/conversations/start', {
            targetUserId: contact.userId,
          });
          conversationId = data.conversationId;
          setContacts((prev) =>
            prev.map((c) =>
              c.userId === contact.userId
                ? {
                    ...c,
                    ...data,
                    userId: contact.userId,
                    conversationId: data.conversationId,
                  }
                : c,
            ),
          );
        }
        if (!conversationId) return;
        setSelectedConversationId(conversationId);
        const conn = connectionRef.current;
        if (conn?.state === HubConnectionState.Connected) {
          await conn.invoke('JoinConversation', conversationId);
        }
        await loadMessages(conversationId);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Konuşma açılamadı.'));
      }
    },
    [loadMessages],
  );

  useEffect(() => {
    setLoadingList(true);
    void loadContacts();
    void registerWebPushIfNeeded();
  }, [loadContacts]);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const { getAccessToken } = await import('../utils/sessionTokens');
        const token = getAccessToken();
        const connection = new HubConnectionBuilder()
          .withUrl(getHubBaseUrl(), { accessTokenFactory: () => token || '' })
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Warning)
          .build();

        connection.on('DirectMessageCreated', (dto: DirectMessage) => {
          const normalized = normalizeMessage(dto, myUserIdRef.current);
          if (normalized.conversationId === selectedConversationIdRef.current) {
            setMessages((prev) =>
              prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized],
            );
            void api
              .post(`/office-chat/conversations/${normalized.conversationId}/read`)
              .catch(() => undefined);
            setTimeout(scrollToBottom, 50);
          }
          void loadContacts();
        });

        connection.on('DirectConversationUpdated', () => {
          void loadContacts();
        });

        connection.on('DirectMessagesRead', (payload: { conversationId: string; userId: string }) => {
          if (payload.conversationId !== selectedConversationIdRef.current) return;
          setMessages((prev) =>
            prev.map((m) => (m.isMine ? { ...m, isReadByOther: true } : m)),
          );
        });

        connection.on('DirectTyping', (payload: { conversationId: string; userId: string }) => {
          if (payload.conversationId !== selectedConversationIdRef.current) return;
          setTypingUserId(payload.userId);
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setTypingUserId(null), 2500);
        });

        connection.onreconnected(async () => {
          setLiveStatus('live');
          if (selectedConversationIdRef.current) {
            await connection.invoke('JoinConversation', selectedConversationIdRef.current);
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
        if (selectedConversationIdRef.current) {
          await connection.invoke('JoinConversation', selectedConversationIdRef.current);
        }
      } catch (err) {
        console.warn('[Chat] SignalR bağlanamadı:', err);
        if (!cancelled) setLiveStatus('polling');
      }
    };

    void connect();

    return () => {
      cancelled = true;
      connectionRef.current?.stop().catch(() => undefined);
      connectionRef.current = null;
    };
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedConversationId || liveStatus === 'live') return;
    const id = window.setInterval(() => {
      void loadMessages(selectedConversationId, true);
      void loadContacts();
    }, 4000);
    return () => window.clearInterval(id);
  }, [selectedConversationId, liveStatus, loadMessages, loadContacts]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedConversationId || sending) return;
    setSending(true);
    try {
      const { data } = await api.post<DirectMessage>(
        `/office-chat/conversations/${selectedConversationId}/messages`,
        { body: text, clientMessageId: `${Date.now()}` },
      );
      const normalized = normalizeMessage(data, myUserIdRef.current);
      setMessages((prev) => (prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized]));
      setInput('');
      setContacts((prev) =>
        prev
          .map((c) =>
            c.conversationId === selectedConversationId
              ? { ...c, lastMessageAt: data.sentAt, lastMessagePreview: data.body }
              : c,
          )
          .sort(
            (a, b) =>
              Number(b.isGaManagement) - Number(a.isGaManagement) ||
              new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime(),
          ),
      );
      setTimeout(scrollToBottom, 50);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Mesaj gönderilemedi.'));
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    const conn = connectionRef.current;
    if (conn?.state === HubConnectionState.Connected && selectedConversationId) {
      void conn.invoke('SendTyping', selectedConversationId);
    }
  };

  const filtered = contacts.filter((c) =>
    c.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const selectedContact = contacts.find((c) => c.userId === selectedUserId);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-120 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-[#1A233A]">
            <div className="flex items-center gap-2">
              <MessageCircle size={20} className="text-[#F97316]" />
              <h2 className="text-lg font-bold">Sohbet</h2>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                liveStatus === 'live'
                  ? 'bg-emerald-100 text-emerald-700'
                  : liveStatus === 'connecting'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-200 text-slate-600'
              }`}
            >
              {liveStatus === 'live' ? 'Canlı' : liveStatus === 'connecting' ? 'Bağlanıyor' : 'Yenileniyor'}
            </span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kişi ara..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F97316]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && !selectedConversationId && (
            <button
              type="button"
              onClick={() => void loadContacts()}
              className="m-3 w-[calc(100%-1.5rem)] rounded-lg bg-orange-50 px-3 py-2 text-left text-xs font-medium text-[#F97316]"
            >
              {error} — Yenile
            </button>
          )}
          {loadingList ? (
            <PageLoading variant="panel" className="min-h-[280px]" />
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Mesajlaşabileceğiniz kişi bulunamadı.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => void handleSelectContact(c)}
                className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left transition-colors ${
                  selectedUserId === c.userId
                    ? 'border-l-4 border-l-[#F97316] bg-orange-50'
                    : 'border-l-4 border-l-transparent hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-[#1A233A]">
                    {c.isGaManagement && (
                      <span className="mr-1 rounded bg-brand-navy px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {c.badgeLabel || 'GA Yönetim'}
                      </span>
                    )}
                    {c.fullName}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                {!c.isGaManagement && c.companyName && (
                  <span className="text-[10px] font-medium text-slate-400">{c.companyName}</span>
                )}
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
        {!selectedConversationId ? (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
            <MessageCircle size={48} className="mb-3 opacity-40" />
            <p className="text-sm">Bir kişi seçerek yazışmaya başlayın.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <div>
                <h3 className="font-bold text-[#1A233A]">
                  {selectedContact?.isGaManagement && (
                    <span className="mr-2 rounded bg-brand-navy px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {selectedContact.badgeLabel || 'GA Yönetim'}
                    </span>
                  )}
                  {selectedContact?.fullName || 'Sohbet'}
                </h3>
                {typingUserId && typingUserId !== selectedUserId && (
                  <p className="text-xs text-emerald-600">Yazıyor...</p>
                )}
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {loadingMessages ? (
                <p className="text-sm text-slate-500">Mesajlar yükleniyor...</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-slate-400">Henüz mesaj yok. İlk mesajı siz yazın.</p>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} message={m} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="border-t border-slate-200 bg-white p-4">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Mesaj yazın..."
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#F97316]"
                />
                <button
                  type="button"
                  disabled={sending || !input.trim()}
                  onClick={() => void sendMessage()}
                  className="flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  <Send size={16} />
                  Gönder
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
};

export default Chat;
