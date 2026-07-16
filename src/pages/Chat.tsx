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

interface ConversationRow {
  id: string;
  fieldWorkerUserId: string;
  fieldWorkerName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  isFromFieldWorker: boolean;
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

/** Ofis görünümü: saha solda (beyaz), operasyon sağda (turuncu). */
function MessageBubble({ message }: { message: ChatMessage }) {
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

const Chat: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'polling'>('connecting');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const upsertIncoming = useCallback((dto: ChatMessage) => {
    if (dto.conversationId !== selectedIdRef.current) return;
    setMessages((prev) => (prev.some((m) => m.id === dto.id) ? prev : [...prev, dto]));
    setTimeout(scrollToBottom, 50);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get<ConversationRow[]>('/chat/conversations');
      setError(null);
      setConversations(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Konuşmalar yüklenemedi.'));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const { data } = await api.get<ChatMessage[]>(
        `/chat/conversations/${conversationId}/messages`,
        { params: { take: 100 } },
      );
      const list = Array.isArray(data) ? data : [];
      setMessages(list);
      if (!silent) {
        await api.post(`/chat/conversations/${conversationId}/read`).catch(() => undefined);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
        );
        setTimeout(scrollToBottom, 50);
      } else {
        const prevIds = new Set(messagesRef.current.map((m) => m.id));
        const hasNew = list.some((m) => !prevIds.has(m.id));
        if (hasNew) setTimeout(scrollToBottom, 50);
      }
    } catch (err: unknown) {
      if (!silent) setError(getApiErrorMessage(err, 'Mesajlar yüklenemedi.'));
    } finally {
      if (!silent) setLoadingMessages(false);
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

  const handleSelectConversation = useCallback(
    (conversationId: string) => {
      setSelectedId(conversationId);
      void loadMessages(conversationId);
      void joinConversation(conversationId);
    },
    [loadMessages, joinConversation],
  );

  useEffect(() => {
    let cancelled = false;
    void api
      .get<ConversationRow[]>('/chat/conversations')
      .then(({ data }) => {
        if (cancelled) return;
        setError(null);
        setConversations(Array.isArray(data) ? data : []);
        setLoadingList(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, 'Konuşmalar yüklenemedi.'));
        setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // SignalR — bağlan + seçili konuşmaya katıl + yeniden bağlanmada tekrar join
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

        connection.on('MessageCreated', (dto: ChatMessage) => {
          upsertIncoming(dto);
          if (dto.conversationId === selectedIdRef.current) {
            api.post(`/chat/conversations/${dto.conversationId}/read`).catch(() => undefined);
          }
          setConversations((prev) => {
            const exists = prev.find((c) => c.id === dto.conversationId);
            if (!exists) {
              void loadConversations();
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
                        selectedIdRef.current === c.id
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
          void loadConversations();
        });

        connection.onreconnected(() => {
          setLiveStatus('live');
          if (selectedIdRef.current) {
            void connection.invoke('JoinConversation', selectedIdRef.current);
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
        if (selectedIdRef.current) {
          await connection.invoke('JoinConversation', selectedIdRef.current);
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
  }, [loadConversations, upsertIncoming]);

  // Polling yedek — SignalR düşse bile mesajlar gelsin
  useEffect(() => {
    if (!selectedId) return;
    const tick = () => {
      void loadMessages(selectedId, true);
      void loadConversations();
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [selectedId, loadMessages, loadConversations]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      const { data } = await api.post<ChatMessage>(
        `/chat/conversations/${selectedId}/messages`,
        { body: text, clientMessageId: `${Date.now()}` },
      );
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      setInput('');
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === selectedId
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
      setSending(false);
    }
  };

  const filtered = conversations.filter((c) =>
    c.fieldWorkerName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const selected = conversations.find((c) => c.id === selectedId);

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
              placeholder="Saha personeli ara..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F97316]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && !selectedId && (
            <button
              type="button"
              onClick={() => {
                setLoadingList(true);
                void loadConversations();
              }}
              className="m-3 w-[calc(100%-1.5rem)] rounded-lg bg-orange-50 px-3 py-2 text-left text-xs font-medium text-[#F97316]"
            >
              {error} — Yenile
            </button>
          )}
          {loadingList ? (
            <p className="p-4 text-sm text-slate-500">Yükleniyor...</p>
          ) : filtered.length === 0 && !error ? (
            <p className="p-4 text-sm text-slate-500">
              Bu firmada kayıtlı saha personeli bulunamadı.
            </p>
          ) : filtered.length === 0 ? null : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelectConversation(c.id)}
                className={`flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left transition-colors ${
                  selectedId === c.id
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
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-[#F8FAFC]">
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
            <MessageCircle size={48} className="mb-3 opacity-40" />
            <p className="text-sm">Bir saha personeli seçerek yazışmaya başlayın.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <div>
                <h3 className="font-bold text-[#1A233A]">
                  {selected?.fieldWorkerName || 'Saha personeli'}
                </h3>
                <p className="text-xs text-slate-500">Ofis ↔ saha 1:1 sohbet</p>
              </div>
            </header>

            {error && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void loadConversations();
                  if (selectedId) void loadMessages(selectedId);
                }}
                className="bg-orange-50 px-4 py-2 text-left text-xs font-medium text-[#F97316]"
              >
                {error} — Yenilemek için tıklayın
              </button>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {loadingMessages ? (
                <p className="text-sm text-slate-500">Mesajlar yükleniyor...</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-slate-400">
                  Henüz mesaj yok. İlk mesajı siz yazabilirsiniz.
                </p>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} message={m} />)
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
                  placeholder="Saha personeline mesaj yazın..."
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
