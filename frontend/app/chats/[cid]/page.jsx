'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/authContext';
import ContextMenu from '../../../components/contextMenu/ContextMenu';
import Popup from '../../../components/popup/Popup';
import Alert from '../../../components/alert/Alert';

const BASE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:8001/storage/';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5001';

// Дебаунс функция для поиска
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const normalizeReadByIds = (value) => {
    if (!Array.isArray(value)) return [];

    return [...new Set(
        value
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
    )];
};

const isMessagePinned = (message) => String(message?.is_pinned) === 'true';

const formatMessageTime = (value) => {
    if (!value) return new Date().toLocaleTimeString();

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleTimeString();
};
const resolveOutgoingStatus = ({ message, currentUserId, members = [] }) => {
    if (message?.delivery_status === 'sending' || message?.delivery_status === 'error') {
        return message.delivery_status;
    }

    if (Number(message?.author_id) !== Number(currentUserId)) {
        return null;
    }

    const memberIds = (members || [])
        .map((member) => Number(member?.id ?? member))
        .filter((id) => Number.isFinite(id) && id !== Number(currentUserId));

    const readByIds = normalizeReadByIds(message?.read_by_user_ids || []);

    if (memberIds.length > 0 && memberIds.every((id) => readByIds.includes(id))) {
        return 'read';
    }

    if (message?.status_for_current_user === 'read') {
        return 'read';
    }

    return 'sent';
};
const buildMessageState = (rawMessage, currentUserId, members = [], onlineUsers = []) => {

    const readByIds = normalizeReadByIds(rawMessage?.read_by_user_ids || []);
    const source = rawMessage?.source
        ? {
            id: rawMessage.source.id,
            name: rawMessage.source.name || rawMessage.source.url,
            type: rawMessage.source.type,
            url: rawMessage.source.url || rawMessage.source.name,
        }
        : null;

    const baseMessage = {
        id: rawMessage?.id,
        temp_id: rawMessage?.temp_id || null,
        author_id: rawMessage?.author_id,
        author_name: rawMessage?.author_name || rawMessage?.user?.name || `User ${rawMessage?.author_id}`,
        content: rawMessage?.content ?? null,
        created_at: formatMessageTime(rawMessage?.created_at),
        created_at_raw: rawMessage?.created_at || new Date().toISOString(),
        source,
        source_type: rawMessage?.source_type || rawMessage?.source?.type || null,
        answer_id: rawMessage?.answer_id || rawMessage?.message?.id || null,
        answer_content: rawMessage?.answer_content || rawMessage?.message?.content || null,
        is_pinned: rawMessage?.is_pinned || 'false',
        read_by_user_ids: readByIds,
        is_read_by_current_user: Boolean(rawMessage?.is_read_by_current_user || readByIds.includes(Number(currentUserId))),
        delivery_status: rawMessage?.delivery_status || null,
        error_message: rawMessage?.error_message || null,
        retry_payload: rawMessage?.retry_payload || null,
        status_for_current_user: rawMessage?.status_for_current_user || null,
    };

    return {
        ...baseMessage,
        delivery_status: resolveOutgoingStatus({
            message: { ...baseMessage, read_by_user_ids: readByIds },
            currentUserId,
            members,
            onlineUsers,
        }),
    };
};

const applyReadReceiptToMessage = (
    message,
    readerId,
    currentUserId,
    members = [],
    onlineUsers = []
) => {
    const nextReadByIds = normalizeReadByIds([...(message?.read_by_user_ids || []), readerId]);

    return buildMessageState({
        ...message,
        read_by_user_ids: nextReadByIds,
        is_read_by_current_user:
            message?.is_read_by_current_user || Number(readerId) === Number(currentUserId),
    }, currentUserId, members, onlineUsers);
};

const getUnreadIncomingMessageIds = (messageList, currentUserId) => {
    return (messageList || [])
        .filter((message) => {
            const isOwnMessage = Number(message?.author_id) === Number(currentUserId);
            const hasRealId = Number.isFinite(Number(message?.id));
            return !isOwnMessage && hasRealId && !message?.is_read_by_current_user;
        })
        .map((message) => Number(message.id));
};

const buildWsMessagePayload = (message) => ({
    id: message?.id,
    content: message?.content ?? null,
    author_id: message?.author_id,
    author_name: message?.author_name,
    chat_id: message?.chat_id,
    created_at: message?.created_at_raw || new Date().toISOString(),
    answer_id: message?.answer_id || null,
    answer_content: message?.answer_content || null,
    source: message?.source || null,
    source_type: message?.source_type || null,
    is_pinned: message?.is_pinned || 'false',
    read_by_user_ids: message?.read_by_user_ids || [],
    status_for_current_user: message?.delivery_status || null,
});

function StreamVideo({ stream, muted = false, className = '' }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream || null;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            className={className}
        />
    );
}

function StreamAudio({ stream }) {
    const audioRef = useRef(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.srcObject = stream || null;
        }
    }, [stream]);

    return <audio ref={audioRef} autoPlay playsInline />;
}

export default function Chat({ chat_id, chat_url }) {
    const params = useParams();
    const { user, get, post } = useAuth();

    // Refs
    const localVideoRef = useRef(null);
    const timerRef = useRef(null);
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const localStreamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioRefs = useRef({});
    const wsReconnectTimeout = useRef(null);
    const isInitialized = useRef(false);
    const heartbeatInterval = useRef(null);
    const lastPongRef = useRef(Date.now());
    const peerConnectionsRef = useRef(new Map());
    const pendingCandidatesRef = useRef(new Map());
    const callActiveRef = useRef(false);
    const callTypeRef = useRef(null);
    const readQueueRef = useRef(new Set());
    const readSyncTimeoutRef = useRef(null);

    // States
    const [incomingCall, setIncomingCall] = useState(null);
    const [callActive, setCallActive] = useState(false);
    const [callType, setCallType] = useState(null);
    const [callTime, setCallTime] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [callParticipants, setCallParticipants] = useState([]);
    const [chatData, setChatData] = useState(null);
    const [messages, setMessages] = useState([]);
    const [content, setContent] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [answer, setAnswer] = useState(null);
    const [file, setFile] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [closeContext, setCloseContext] = useState(false);
    const [selectedMess, setSelectedMess] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [showPinned, setShowPinned] = useState(false);
    const [forwardMessages, setForwardMessages] = useState([]);
    const [showForwardSelector, setShowForwardSelector] = useState(false);
    const [availableChats, setAvailableChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [remoteStreams, setRemoteStreams] = useState([]);

    useEffect(() => {
        callActiveRef.current = callActive;
    }, [callActive]);

    useEffect(() => {
        callTypeRef.current = callType;
    }, [callType]);

    // Get chat identifier
    const chatIdentifier = useCallback(() => {
        if (chat_id) return chat_id;
        if (chat_url) return chat_url;
        if (params?.cid) return params.cid;
        return params?.url || null;
    }, [chat_id, chat_url, params])();

    const syncPinnedMessages = useCallback((messageList = []) => {
        setPinnedMessages((messageList || []).filter((message) => isMessagePinned(message)));
    }, []);

    const updateMessagesState = useCallback((updater) => {
        setMessages((prevMessages) => {
            const nextMessages = typeof updater === 'function' ? updater(prevMessages) : updater;
            syncPinnedMessages(nextMessages);
            return nextMessages;
        });
    }, [syncPinnedMessages]);

    const syncLocalReadReceipts = useCallback((messageIds = [], readerId) => {
        if (!readerId || !Array.isArray(messageIds) || messageIds.length === 0) {
            return;
        }

        const messageIdSet = new Set(messageIds.map((id) => String(id)));

        updateMessagesState((prevMessages) => prevMessages.map((message) => {
            if (!messageIdSet.has(String(message.id))) {
                return message;
            }

            return applyReadReceiptToMessage(
                message,
                readerId,
                user?.id,
                chatData?.members || [],
                onlineUsers || []
            );
        }));
    }, [chatData?.members, updateMessagesState, user?.id]);

    const markMessagesAsRead = useCallback((messageIds = []) => {
        if (!chatData?.id || !user?.id || !isMember) {
            return;
        }

        const uniqueIds = [...new Set(
            messageIds
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id))
        )];

        if (uniqueIds.length === 0) {
            return;
        }

        uniqueIds.forEach((id) => readQueueRef.current.add(id));

        if (readSyncTimeoutRef.current) {
            return;
        }

        readSyncTimeoutRef.current = setTimeout(async () => {
            const queuedIds = Array.from(readQueueRef.current)
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id));

            readQueueRef.current.clear();
            readSyncTimeoutRef.current = null;

            if (queuedIds.length === 0) {
                return;
            }

            const response = await post('/messages/read', {
                chat_id: chatData.id,
                message_ids: queuedIds,
            }, { silent: true });

            if (!response?.success) {
                return;
            }

            const confirmedIds = Array.isArray(response?.data?.message_ids)
                ? response.data.message_ids
                : queuedIds;

            syncLocalReadReceipts(confirmedIds, user.id);

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'messages_read',
                    data: {
                        chat_id: chatData.id,
                        message_ids: confirmedIds,
                        reader_id: user.id,
                        reader_name: user.name,
                    },
                }));
            }
        }, 250);
    }, [chatData?.id, isMember, post, syncLocalReadReceipts, user?.id, user?.name]);

    useEffect(() => {
        return () => {
            if (readSyncTimeoutRef.current) {
                clearTimeout(readSyncTimeoutRef.current);
                readSyncTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!user?.id) return;

        updateMessagesState((prevMessages) =>
            prevMessages.map((message) =>
                buildMessageState(
                    message,
                    user.id,
                    chatData?.members || [],
                    onlineUsers || []
                )
            )
        );
    }, [onlineUsers, chatData?.members, user?.id, updateMessagesState]);

    useEffect(() => {
        if (!chatData?.id || !user?.id || !isMember) {
            return;
        }

        if (typeof document !== 'undefined' && document.hidden) {
            return;
        }

        const unreadIds = getUnreadIncomingMessageIds(messages, user.id);
        if (unreadIds.length > 0) {
            markMessagesAsRead(unreadIds);
        }
    }, [chatData?.id, isMember, markMessagesAsRead, messages, user?.id]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        const handleVisibilityChange = () => {
            if (document.hidden || !user?.id) {
                return;
            }

            const unreadIds = getUnreadIncomingMessageIds(messages, user.id);
            if (unreadIds.length > 0) {
                markMessagesAsRead(unreadIds);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [markMessagesAsRead, messages, user?.id]);

    // Загрузка данных чата
    const loadChatData = useCallback(async () => {
        if (!chatIdentifier || !user || isInitialized.current) return;

        try {
            setIsLoading(true);

            const endpoint = isNaN(chatIdentifier)
                ? `/get-chat-by-url/${chatIdentifier}`
                : `/get-chat-info/${chatIdentifier}`;

            const res = await get(endpoint);

            if (res?.data) {
                // Для personal чата находим второго участника
                let chatTitle = res.data.title;
                let chatAvatar = res.data.avatar;

                if (res.data.type === 'personal' && res.data.members) {
                    const otherMember = res.data.members.find(m => m.id !== user?.id);
                    if (otherMember) {
                        chatTitle = otherMember.name;
                        chatAvatar = otherMember.avatar;
                    }
                }

                setChatData({
                    ...res.data,
                    displayTitle: chatTitle,
                    displayAvatar: chatAvatar,
                });

                const formattedMessages = (res.data.messages || []).map((msg) =>
                    buildMessageState(msg, user?.id, res.data.members || [], onlineUsers || [])
                );

                setMessages(formattedMessages);
                setPinnedMessages(formattedMessages.filter((message) => isMessagePinned(message)));

                setIsMember(res.data.members?.some(m => m.id === user?.id) || false);

                isInitialized.current = true;
            }
        } catch (err) {
            console.error('Error loading chat data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [chatIdentifier, user, get]);

    // Загрузка списка чатов - нужно для перессылки
    const loadAvailableChats = useCallback(async () => {
        try {
            const res = await get("/get-chats");
            setAvailableChats(res?.data || []);
        } catch (err) {
            console.error('Error loading chats:', err);
        }
    }, [get]);

    useEffect(() => {
        if (user) {
            loadChatData();
            loadAvailableChats();
        }
    }, [user, loadChatData, loadAvailableChats]);

    const startHeartbeat = useCallback(() => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
        }

        heartbeatInterval.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'ping' }));

                if (Date.now() - lastPongRef.current > 15000) {
                    console.log('No pong received, reconnecting...');
                    wsRef.current.close();
                }
            }
        }, 5000);
    }, []);

    // WebSocket соединение
    useEffect(() => {
        if (!chatData?.id || !user?.id || !isMember) return;

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 10;
        let manualClose = false;

        const connectWebSocket = () => {
            if (manualClose || wsRef.current?.readyState === WebSocket.OPEN) return;

            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                reconnectAttempts = 0;
                lastPongRef.current = Date.now();

                startHeartbeat();

                ws.send(JSON.stringify({
                    type: 'join_chat',
                    chat_id: chatData.id,
                    token: getStoredToken(),
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message:', data.type, data);

                    switch (data.type) {
                        case 'ping':
                            ws.send(JSON.stringify({ type: 'pong' }));
                            lastPongRef.current = Date.now();
                            break;

                        case 'pong':
                            lastPongRef.current = Date.now();
                            break;

                        case 'joined_chat': {
                            setOnlineUsers(data.online_users || []);

                            if (data.active_call) {
                                const activeCall = data.active_call;
                                const participants = activeCall.participants || [];
                                syncCallParticipants(participants);

                                if (!callActiveRef.current) {
                                    const alreadyParticipant = participants.some(
                                        participant => String(participant.id) === String(user.id)
                                    );

                                    if (!alreadyParticipant) {
                                        setIncomingCall({
                                            chat_id: activeCall.chat_id,
                                            callType: activeCall.callType,
                                            caller_id: activeCall.startedBy,
                                            caller_name: activeCall.startedByName,
                                            participants,
                                        });
                                    }
                                }
                            } else {
                                setIncomingCall(null);
                            }
                            break;
                        }

                        case 'online_users':
                            setOnlineUsers(data.users || []);
                            break;

                        case 'typing_start':
                            setTypingUsers(prev => {
                                if (!prev.includes(data.user_name)) {
                                    return [...prev, data.user_name];
                                }
                                return prev;
                            });
                            break;

                        case 'typing_stop':
                            setTypingUsers(prev => prev.filter(name => name !== data.user_name));
                            break;

                        case 'new_message':
                            if (data.message && String(data.message.chat_id) === String(chatData.id)) {
                                updateMessagesState((prevMessages) => {
                                    if (prevMessages.some((message) => String(message.id) === String(data.message.id))) {
                                        return prevMessages;
                                    }

                                    const incomingMessage = buildMessageState(
                                        data.message,
                                        user?.id,
                                        chatData?.members || []
                                    );

                                    return [...prevMessages, incomingMessage];
                                });

                                const isIncomingForMe = Number(data.message.author_id) !== Number(user?.id);
                                const hasRealId = Number.isFinite(Number(data.message.id));
                                const isVisible = typeof document !== 'undefined' && !document.hidden;

                                if (isIncomingForMe && hasRealId && isVisible) {
                                    markMessagesAsRead([Number(data.message.id)]);
                                }
                            }
                            break;

                        case 'messages_read':
                            if (String(data.data?.chat_id) === String(chatData.id)) {
                                syncLocalReadReceipts(
                                    data.data?.message_ids || [],
                                    data.data?.reader_id
                                );
                            }
                            break;

                        case 'delete_message':
                            if (data.message?.id) {
                                updateMessagesState((prevMessages) => prevMessages.filter((item) => item.id !== data.message.id));
                            }
                            break;

                        case 'pin_message':
                            if (data.message?.id) {
                                updateMessagesState((prevMessages) => prevMessages.map((message) => (
                                    message.id === data.message.id
                                        ? buildMessageState({
                                            ...message,
                                            is_pinned: data.message.is_pinned,
                                        }, user?.id, chatData?.members || [], onlineUsers || [])
                                        : message
                                )));
                            }
                            break;

                        case 'call_started':
                            if (!callActiveRef.current) {
                                setIncomingCall({
                                    chat_id: data.data.chat_id,
                                    callType: data.data.callType,
                                    caller_id: data.data.caller_id,
                                    caller_name: data.data.caller_name,
                                    participants: data.data.participants || [],
                                });
                            }
                            break;

                        case 'call_participants':
                            syncCallParticipants(data.data?.participants || []);
                            break;

                        case 'call_participant_joined':
                            syncCallParticipants(data.data?.participants || []);
                            if (
                                callActiveRef.current &&
                                localStreamRef.current &&
                                String(data.data?.user_id) !== String(user.id)
                            ) {
                                createOfferForParticipant(
                                    data.data.user_id,
                                    data.data.user_name,
                                    data.data.callType || callTypeRef.current || 'audio'
                                );
                            }
                            break;

                        case 'call_offer':
                            handleIncomingOffer(data.data);
                            break;

                        case 'call_answer':
                            handleIncomingAnswer(data.data);
                            break;

                        case 'call_ice':
                            handleIncomingIce(data.data);
                            break;

                        case 'call_participant_left':
                            if (data.data?.participants) {
                                syncCallParticipants(data.data.participants);
                            } else if (data.data?.user_id) {
                                removeCallParticipant(data.data.user_id);
                            }
                            handleParticipantLeft(data.data?.user_id);
                            break;

                        case 'call_finished':
                            handleCallFinished();
                            break;

                        case 'call_busy':
                            cleanupCallResources(false);
                            setAlert({
                                content: 'В чате уже идет звонок',
                                type: 'err'
                            });
                            if (data.data) {
                                setIncomingCall({
                                    chat_id: data.data.chat_id,
                                    callType: data.data.callType,
                                    caller_id: data.data.startedBy,
                                    caller_name: data.data.startedByName,
                                    participants: data.data.participants || [],
                                });
                            }
                            break;

                        case 'error':
                            setAlert({
                                content: data.message || 'Ошибка websocket-соединения',
                                type: 'err'
                            });
                            break;

                        default:
                            console.log('Unknown message type:', data.type);
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
                setOnlineUsers([]);

                if (heartbeatInterval.current) {
                    clearInterval(heartbeatInterval.current);
                    heartbeatInterval.current = null;
                }

                if (!manualClose && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts += 1;
                    const timeout = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);

                    if (wsReconnectTimeout.current) {
                        clearTimeout(wsReconnectTimeout.current);
                    }

                    console.log(`Reconnecting in ${timeout}ms (attempt ${reconnectAttempts})`);
                    wsReconnectTimeout.current = setTimeout(connectWebSocket, timeout);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        };

        connectWebSocket();

        return () => {
            manualClose = true;

            if (heartbeatInterval.current) {
                clearInterval(heartbeatInterval.current);
                heartbeatInterval.current = null;
            }

            if (wsReconnectTimeout.current) {
                clearTimeout(wsReconnectTimeout.current);
                wsReconnectTimeout.current = null;
            }

            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'leave_chat',
                        chat_id: chatData.id
                    }));
                }
                wsRef.current.close();
                wsRef.current = null;
            }

            cleanupCallResources(false);
        };
    }, [chatData?.id, user?.id, isMember, startHeartbeat]);

    const handleTyping = useCallback(
        debounce((isTyping) => {
            if (wsRef.current?.readyState === WebSocket.OPEN && isConnected) {
                wsRef.current.send(JSON.stringify({
                    type: isTyping ? 'typing_start' : 'typing_stop',
                    user_id: user.id,
                    user_name: user.name,
                    chat_id: chatData?.id
                }));
            }
        }, 500),
        [user, chatData?.id, isConnected]
    );

    const handleInputChange = (e) => {
        const value = e.target.value;
        setContent(value);

        if (value.trim()) {
            handleTyping(true);
        } else {
            handleTyping(false);
        }
    };

    // поиск сообщений
    const debouncedSearch = useCallback(
        debounce((query) => {
            if (query.trim() === '') {
                setSearchResults([]);
                return;
            }

            const results = messages.filter(msg =>
                msg.content?.toLowerCase().includes(query.toLowerCase()) ||
                msg.author_name?.toLowerCase().includes(query.toLowerCase())
            );
            setSearchResults(results);
        }, 300),
        [messages]
    );

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        debouncedSearch(value);
    };

    // Скролл к последнему сообщению
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Таймер для звонков
    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setCallTime(prev => prev + 1);
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setCallTime(0);
    }, []);

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    // Отправка сообщения
    const handleSend = async (e) => {
        e.preventDefault();

        if (!content.trim() && !file && !recording && forwardMessages.length === 0) return;

        handleTyping(false);

        const messageContent = content;
        const answerMessage = answer ? { ...answer } : null;
        const selectedFile = file;
        const selectedRecording = recording;
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        let loadFile = null;
        let voiceFile = null;

        try {
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('author_id', user.id);
                loadFile = await post('/load-file', formData, { silent: true });

                if (!loadFile?.success) {
                    throw new Error(loadFile?.error || loadFile?.message || 'Не удалось загрузить файл.');
                }
            }

            if (selectedRecording?.blob) {
                const voiceFormData = new FormData();
                voiceFormData.append('file', selectedRecording.blob, selectedRecording.name);
                voiceFormData.append('author_id', user.id);
                voiceFormData.append('type', 'voice');
                voiceFile = await post('/load-file', voiceFormData, { silent: true });

                if (!voiceFile?.success) {
                    throw new Error(voiceFile?.error || voiceFile?.message || 'Не удалось загрузить голосовое сообщение.');
                }
            }

            const resolvedSource = voiceFile?.data || loadFile?.data || null;

            if (!isConnected) {
                throw new Error('Нет подключения к websocket-серверу.');
            }

            if (forwardMessages.length > 0) {
                for (const forwardedMessage of forwardMessages) {
                    const forwardResponse = await post('/send-message/chat', {
                        chat_id: chatData.id,
                        content: `📨 Пересланное сообщение от ${forwardedMessage.author_name}:\n${forwardedMessage.content || ''}`.trim(),
                        source_id: forwardedMessage.source?.id || null,
                        source_type: forwardedMessage.source_type,
                    }, { silent: true });

                    if (!forwardResponse?.success || !forwardResponse?.data?.id) {
                        throw new Error(forwardResponse?.error || forwardResponse?.message || 'Не удалось переслать сообщение.');
                    }

                    const sentForwardMessage = buildMessageState({
                        ...forwardResponse.data,
                        author_name: user.name,
                        source: forwardResponse.data.source || forwardedMessage.source || null,
                        source_type: forwardResponse.data.source_type || forwardedMessage.source_type,
                    }, user.id, chatData?.members || [], onlineUsers || []);

                    updateMessagesState((prevMessages) => [...prevMessages, sentForwardMessage]);

                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({
                            type: 'new_message',
                            message: buildWsMessagePayload({
                                ...sentForwardMessage,
                                chat_id: chatData.id,
                            }),
                        }));
                    }
                }

                setForwardMessages([]);
                setShowForwardSelector(false);

                if (!messageContent.trim() && !selectedFile && !selectedRecording) {
                    return;
                }
            }

            const retryPayload = {
                chat_id: chatData.id,
                content: messageContent,
                answer_id: answerMessage?.id || null,
                source_id: resolvedSource?.id || null,
                source_type: selectedRecording ? 'voice' : (selectedFile ? 'file' : null),
            };

            const optimisticMessage = buildMessageState({
                id: tempId,
                temp_id: tempId,
                author_id: user.id,
                author_name: user.name,
                content: messageContent || null,
                source: resolvedSource,
                source_type: retryPayload.source_type,
                created_at: new Date().toISOString(),
                answer_id: answerMessage?.id || null,
                answer_content: answerMessage?.content || null,
                delivery_status: 'sending',
                retry_payload: retryPayload,
            }, user.id, chatData?.members || [], onlineUsers || []);

            updateMessagesState((prevMessages) => [...prevMessages, optimisticMessage]);

            setContent('');
            setAnswer(null);
            setFile(null);
            if (selectedRecording) {
                URL.revokeObjectURL(selectedRecording.url);
                setRecording(null);
            }

            const response = await post('/send-message/chat', retryPayload, { silent: true });
            if (!response?.success || !response?.data?.id) {
                throw new Error(response?.error || response?.message || 'Не удалось отправить сообщение.');
            }

            const sentMessage = buildMessageState({
                ...response.data,
                author_name: user.name,
                source: response.data.source || resolvedSource,
                source_type: response.data.source_type || retryPayload.source_type,
            }, user.id, chatData?.members || [], onlineUsers || []);

            updateMessagesState((prevMessages) => prevMessages.map((message) => (
                String(message.id) === String(tempId)
                    ? { ...sentMessage, retry_payload: retryPayload }
                    : message
            )));

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'new_message',
                    message: buildWsMessagePayload({
                        ...sentMessage,
                        chat_id: chatData.id,
                    }),
                }));
            }
        } catch (err) {
            console.error('Error sending message:', err);

            const resolvedSource = voiceFile?.data || loadFile?.data || null;
            const failedMessage = buildMessageState({
                id: tempId,
                temp_id: tempId,
                author_id: user.id,
                author_name: user.name,
                content: messageContent || null,
                source: resolvedSource,
                source_type: selectedRecording ? 'voice' : (selectedFile ? 'file' : null),
                created_at: new Date().toISOString(),
                answer_id: answerMessage?.id || null,
                answer_content: answerMessage?.content || null,
                delivery_status: 'error',
                error_message: err?.message || 'Неизвестная ошибка отправки.',
                retry_payload: {
                    chat_id: chatData.id,
                    content: messageContent,
                    answer_id: answerMessage?.id || null,
                    source_id: resolvedSource?.id || null,
                    source_type: selectedRecording ? 'voice' : (selectedFile ? 'file' : null),
                },
            }, user.id, chatData?.members || [], onlineUsers || []);

            updateMessagesState((prevMessages) => {
                const existingIndex = prevMessages.findIndex((message) => String(message.id) === String(tempId));

                if (existingIndex !== -1) {
                    return prevMessages.map((message) => (
                        String(message.id) === String(tempId) ? failedMessage : message
                    ));
                }

                if (!messageContent.trim() && !resolvedSource) {
                    return prevMessages;
                }

                return [...prevMessages, failedMessage];
            });

            setAlert({ content: `Ошибка при отправке сообщения\n${err?.message || 'Неизвестная ошибка'}`, type: 'err' });
        }
    };

    const retryFailedMessage = async (message) => {
        if (!message?.retry_payload) {
            return;
        }

        updateMessagesState((prevMessages) => prevMessages.map((item) => (
            String(item.id) === String(message.id)
                ? buildMessageState({
                    ...item,
                    delivery_status: 'sending',
                    error_message: null,
                }, user?.id, chatData?.members || [], onlineUsers || [])
                : item
        )));

        try {
            const response = await post('/send-message/chat', message.retry_payload, { silent: true });
            if (!response?.success || !response?.data?.id) {
                throw new Error(response?.error || response?.message || 'Не удалось повторно отправить сообщение.');
            }

            const resentMessage = buildMessageState({
                ...response.data,
                author_name: user.name,
                source: response.data.source || message.source || null,
                source_type: response.data.source_type || message.source_type,
            }, user.id, chatData?.members || [], onlineUsers || []);

            updateMessagesState((prevMessages) => prevMessages.map((item) => (
                String(item.id) === String(message.id)
                    ? { ...resentMessage, retry_payload: message.retry_payload }
                    : item
            )));

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'new_message',
                    message: buildWsMessagePayload({
                        ...resentMessage,
                        chat_id: chatData.id,
                    }),
                }));
            }
        } catch (err) {
            console.error('Retry send error:', err);
            updateMessagesState((prevMessages) => prevMessages.map((item) => (
                String(item.id) === String(message.id)
                    ? buildMessageState({
                        ...item,
                        delivery_status: 'error',
                        error_message: err?.message || 'Повторная отправка не удалась.',
                    }, user?.id, chatData?.members || [], onlineUsers || [])
                    : item
            )));
            setAlert({ content: `Повторная отправка не удалась\n${err?.message || 'Неизвестная ошибка'}`, type: 'err' });
        }
    };

    // Удаление сообщения
    const deleteMess = async (message) => {
        try {
            await post('/delete-message', { message_id: message.id }, { silent: true });

            updateMessagesState((prevMessages) => prevMessages.filter((item) => item.id !== message.id));

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'delete_message',
                    message: { id: message.id, chat_id: chatData.id }
                }));
            }

            setCloseContext(true);
        } catch (err) {
            console.error('Error deleting message:', err);
            alert('Ошибка при удалении сообщения');
        }
    };

    // Закрепление сообщения
    const pinMessage = async (message) => {
        try {
            const newPinState = message.is_pinned == 'true' ? 'false' : 'true';
            await post('/pin-message', {
                message_id: message.id,
                is_pinned: newPinState
            }, { silent: true });

            updateMessagesState((prevMessages) => prevMessages.map((item) => (
                item.id === message.id
                    ? buildMessageState({
                        ...item,
                        is_pinned: newPinState,
                    }, user?.id, chatData?.members || [], onlineUsers || [])
                    : item
            )));

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'pin_message',
                    message: {
                        id: message.id,
                        is_pinned: newPinState,
                        user_id: user.id,
                        user_name: user.name
                    }
                }));
            }

            setCloseContext(true);
        } catch (err) {
            console.error('Error pinning message:', err);
            alert('Ошибка при закреплении сообщения');
        }
    };

    // Запись голоса
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            let chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);

                setRecording({
                    id: Date.now(),
                    url,
                    blob,
                    name: `recording-${Date.now()}.webm`,
                });

                stream.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            };

            mediaRecorder.start(1000);
            setIsRecording(true);
        } catch (error) {
            console.error('Ошибка доступа к микрофону:', error);
            alert('Не удалось получить доступ к микрофону.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    // Пересылка сообщения
    const forwardMessage = (message) => {
        setForwardMessages(prev => [...prev, message]);
        setShowForwardSelector(true);
        setCloseContext(true);
    };

    // Отправка пересланных сообщений
    const sendForwardedMessages = async (targetChatId) => {
        try {
            const sentMessages = [];

            for (const messageToForward of forwardMessages) {
                const response = await post('/send-message/chat', {
                    chat_id: targetChatId,
                    content: `📨 Пересланное сообщение от ${messageToForward.author_name}:\n${messageToForward.content || ''}`.trim(),
                    source_id: messageToForward.source?.id || null,
                    source_type: messageToForward.source_type,
                }, { silent: true });

                if (!response?.success || !response?.data?.id) {
                    throw new Error(response?.error || response?.message || 'Не удалось переслать сообщение.');
                }

                const sentForwardMessage = buildMessageState({
                    ...response.data,
                    author_name: user.name,
                    source: response.data.source || messageToForward.source || null,
                    source_type: response.data.source_type || messageToForward.source_type,
                }, user.id, chatData?.members || [], onlineUsers || []);

                sentMessages.push(sentForwardMessage);

                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'new_message',
                        message: buildWsMessagePayload({
                            ...sentForwardMessage,
                            chat_id: targetChatId,
                        }),
                    }));
                }
            }

            setForwardMessages([]);
            setShowForwardSelector(false);

            if (sentMessages.length > 0 && String(targetChatId) === String(chatData?.id)) {
                updateMessagesState((prevMessages) => [...prevMessages, ...sentMessages]);
            }
        } catch (err) {
            console.error('Error forwarding messages:', err);
            setAlert({
                content: `Ошибка при пересылке сообщений: ${err?.message || 'Неизвестная ошибка'}`,
                type: 'err'
            });
        }
    };

    // Вступление в чат
    const joinChat = async () => {
        try {
            await post('/subscribe', {
                chat_id: chatData.id,
            });

            await post("/send-message/chat", {
                author_id: user.id,
                chat_id: chatData.id,
                content: `Пользователь ${user.name} присоединился к чату`,
            });

            setIsMember(true);
            isInitialized.current = false;

            const res = await get(`/get-chat-info/${chatData.id}`);
            if (res?.data) {
                let chatTitle = res.data.title;
                let chatAvatar = res.data.avatar;

                if (res.data.type === 'personal' && res.data.members) {
                    const otherMember = res.data.members.find(m => m.id !== user?.id);
                    if (otherMember) {
                        chatTitle = otherMember.name;
                        chatAvatar = otherMember.avatar;
                    }
                }

                setChatData({
                    ...res.data,
                    displayTitle: chatTitle,
                    displayAvatar: chatAvatar
                });
            }
        } catch (err) {
            console.error('Error joining chat:', err);
        }
    };

    // Звонки
    const getStoredToken = () => {
        if (typeof window === 'undefined') {
            return null;
        }

        return localStorage.getItem('token');
    };

    const mergeParticipants = useCallback((participants = []) => {
        const map = new Map();

        participants.forEach((participant) => {
            if (!participant?.id) {
                return;
            }

            map.set(String(participant.id), {
                id: participant.id,
                name: participant.name || `User ${participant.id}`,
            });
        });

        return Array.from(map.values());
    }, []);

    const syncCallParticipants = useCallback((participants = []) => {
        setCallParticipants(mergeParticipants(participants));
    }, [mergeParticipants]);

    const upsertCallParticipant = useCallback((participant) => {
        if (!participant?.id) {
            return;
        }

        setCallParticipants((prev) => mergeParticipants([...prev, participant]));
    }, [mergeParticipants]);

    const removeCallParticipant = useCallback((participantId) => {
        setCallParticipants((prev) => prev.filter((participant) => String(participant.id) !== String(participantId)));
    }, []);

    const upsertRemoteStream = useCallback((userId, userName, stream) => {
        if (!userId || !stream) {
            return;
        }

        setRemoteStreams((prev) => {
            const next = prev.filter((remote) => String(remote.userId) !== String(userId));
            return [
                ...next,
                {
                    userId,
                    userName: userName || `User ${userId}`,
                    stream,
                },
            ];
        });
    }, []);

    const removeRemoteStream = useCallback((userId) => {
        setRemoteStreams((prev) => prev.filter((remote) => String(remote.userId) !== String(userId)));
    }, []);

    const closePeerConnection = useCallback((remoteUserId) => {
        const remoteKey = String(remoteUserId);
        const peer = peerConnectionsRef.current.get(remoteKey);

        if (peer) {
            try {
                peer.onicecandidate = null;
                peer.ontrack = null;
                peer.onconnectionstatechange = null;
                peer.close();
            } catch (error) {
                console.error('Error closing peer connection:', error);
            }
        }

        peerConnectionsRef.current.delete(remoteKey);
        pendingCandidatesRef.current.delete(remoteKey);
    }, []);

    const flushPendingCandidates = useCallback(async (remoteUserId) => {
        const remoteKey = String(remoteUserId);
        const peer = peerConnectionsRef.current.get(remoteKey);
        const queuedCandidates = pendingCandidatesRef.current.get(remoteKey) || [];

        if (!peer || !peer.remoteDescription) {
            return;
        }

        for (const candidate of queuedCandidates) {
            try {
                await peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error flushing ICE candidate:', error);
            }
        }

        pendingCandidatesRef.current.delete(remoteKey);
    }, []);

    const ensureLocalStream = useCallback(async (requestedCallType = 'audio') => {
        const needsVideo = requestedCallType === 'video';
        const currentStream = localStreamRef.current;
        const hasVideoTrack = currentStream?.getVideoTracks?.().length > 0;

        if (currentStream && (!needsVideo || hasVideoTrack)) {
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = needsVideo ? currentStream : null;
            }
            return currentStream;
        }

        if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: needsVideo,
        });

        localStreamRef.current = stream;
        setIsMuted(false);
        setIsVideoEnabled(needsVideo);

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = needsVideo ? stream : null;
            if (needsVideo) {
                localVideoRef.current.play().catch((error) => {
                    console.log('Error playing local video:', error);
                });
            }
        }

        return stream;
    }, []);

    const createPeerConnection = useCallback((remoteUserId, remoteUserName, requestedCallType = 'audio') => {
        const remoteKey = String(remoteUserId);
        const existingPeer = peerConnectionsRef.current.get(remoteKey);

        if (existingPeer && existingPeer.signalingState !== 'closed') {
            return existingPeer;
        }

        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        });

        peerConnectionsRef.current.set(remoteKey, peer);

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                peer.addTrack(track, localStreamRef.current);
            });
        }

        peer.onicecandidate = (event) => {
            if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'call_ice',
                    data: {
                        chat_id: chatData.id,
                        target_user_id: remoteUserId,
                        candidate: event.candidate,
                    },
                }));
            }
        };

        peer.ontrack = (event) => {
            const remoteStream = event.streams?.[0] || new MediaStream([event.track]);
            upsertRemoteStream(remoteUserId, remoteUserName, remoteStream);
        };

        peer.onconnectionstatechange = () => {
            if (['failed', 'closed'].includes(peer.connectionState)) {
                closePeerConnection(remoteUserId);
                removeRemoteStream(remoteUserId);
            }
        };

        flushPendingCandidates(remoteUserId).catch((error) => {
            console.error('Error flushing pending candidates after peer creation:', error);
        });

        return peer;
    }, [chatData?.id, closePeerConnection, flushPendingCandidates, removeRemoteStream, upsertRemoteStream]);

    const cleanupCallResources = useCallback((resetIncomingCall = true) => {
        peerConnectionsRef.current.forEach((peer, remoteUserId) => {
            try {
                peer.onicecandidate = null;
                peer.ontrack = null;
                peer.onconnectionstatechange = null;
                peer.close();
            } catch (error) {
                console.error(`Error closing peer ${remoteUserId}:`, error);
            }
        });

        peerConnectionsRef.current.clear();
        pendingCandidatesRef.current.clear();
        setRemoteStreams([]);

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        callActiveRef.current = false;
        callTypeRef.current = null;
        setCallActive(false);
        setCallType(null);
        setCallParticipants([]);
        setIsMuted(false);
        setIsVideoEnabled(true);
        stopTimer();

        if (resetIncomingCall) {
            setIncomingCall(null);
        }
    }, [stopTimer]);

    const createOfferForParticipant = useCallback(async (remoteUserId, remoteUserName, requestedCallType = 'audio') => {
        if (!remoteUserId || String(remoteUserId) === String(user?.id)) {
            return;
        }

        const peer = createPeerConnection(remoteUserId, remoteUserName, requestedCallType);
        const offer = await peer.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: requestedCallType === 'video',
        });

        await peer.setLocalDescription(offer);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'call_offer',
                data: {
                    chat_id: chatData.id,
                    target_user_id: remoteUserId,
                    callType: requestedCallType,
                    offer,
                },
            }));
        }
    }, [chatData?.id, createPeerConnection, user?.id]);

    const handleIncomingOffer = useCallback(async (payload) => {
        if (!payload) {
            return;
        }

        const remoteUserId = payload.caller_id || payload.user_id;
        const remoteUserName = payload.caller_name || payload.user_name;
        const requestedCallType = payload.callType === 'video' ? 'video' : 'audio';

        await ensureLocalStream(requestedCallType);

        callActiveRef.current = true;
        callTypeRef.current = requestedCallType;
        setCallActive(true);
        setCallType(requestedCallType);
        upsertCallParticipant({ id: user.id, name: user.name });
        upsertCallParticipant({ id: remoteUserId, name: remoteUserName });

        const peer = createPeerConnection(remoteUserId, remoteUserName, requestedCallType);
        await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
        await flushPendingCandidates(remoteUserId);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'call_answer',
                data: {
                    chat_id: chatData.id,
                    target_user_id: remoteUserId,
                    answer,
                },
            }));
        }
    }, [chatData?.id, createPeerConnection, ensureLocalStream, flushPendingCandidates, upsertCallParticipant, user?.id, user?.name]);

    const handleIncomingAnswer = useCallback(async (payload) => {
        const remoteUserId = payload?.user_id;
        const peer = peerConnectionsRef.current.get(String(remoteUserId));

        if (!peer || !payload?.answer) {
            return;
        }

        await peer.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await flushPendingCandidates(remoteUserId);
    }, [flushPendingCandidates]);

    const handleIncomingIce = useCallback(async (payload) => {
        const remoteUserId = payload?.user_id;
        const candidate = payload?.candidate;

        if (!remoteUserId || !candidate) {
            return;
        }

        const remoteKey = String(remoteUserId);
        const peer = peerConnectionsRef.current.get(remoteKey);

        if (!peer || !peer.remoteDescription) {
            const queue = pendingCandidatesRef.current.get(remoteKey) || [];
            queue.push(candidate);
            pendingCandidatesRef.current.set(remoteKey, queue);
            return;
        }

        try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }, []);

    const handleParticipantLeft = useCallback((remoteUserId) => {
        if (!remoteUserId) {
            return;
        }

        removeCallParticipant(remoteUserId);
        closePeerConnection(remoteUserId);
        removeRemoteStream(remoteUserId);
    }, [closePeerConnection, removeCallParticipant, removeRemoteStream]);

    const handleCallFinished = useCallback(() => {
        cleanupCallResources();
    }, [cleanupCallResources]);

    const startCall = async (type = 'audio') => {
        if (!chatData?.id || callActiveRef.current) {
            return;
        }

        try {
            if (wsRef.current?.readyState !== WebSocket.OPEN) {
                throw new Error('Нет подключения к websocket-серверу');
            }

            await ensureLocalStream(type);

            callActiveRef.current = true;
            callTypeRef.current = type;
            setCallActive(true);
            setCallType(type);
            setIncomingCall(null);
            syncCallParticipants([{ id: user.id, name: user.name }]);
            startTimer();

            wsRef.current.send(JSON.stringify({
                type: 'call_start',
                data: {
                    chat_id: chatData.id,
                    callType: type,
                },
            }));
        } catch (error) {
            console.error('Error starting call:', error);
            cleanupCallResources();
            setAlert({
                content: `Ошибка при начале звонка: ${error.message}`,
                type: 'err'
            });
        }
    };

    const acceptCall = async () => {
        if (!incomingCall || !chatData?.id) {
            return;
        }

        try {
            const requestedCallType = incomingCall.callType === 'video' ? 'video' : 'audio';

            if (wsRef.current?.readyState !== WebSocket.OPEN) {
                throw new Error('Нет подключения к websocket-серверу');
            }

            await ensureLocalStream(requestedCallType);

            callActiveRef.current = true;
            callTypeRef.current = requestedCallType;
            setCallActive(true);
            setCallType(requestedCallType);
            syncCallParticipants(
                mergeParticipants([
                    { id: user.id, name: user.name },
                    ...(incomingCall.participants || []),
                    { id: incomingCall.caller_id, name: incomingCall.caller_name },
                ])
            );
            setIncomingCall(null);
            startTimer();

            wsRef.current.send(JSON.stringify({
                type: 'call_join',
                data: {
                    chat_id: chatData.id,
                },
            }));
        } catch (error) {
            console.error('Error accepting call:', error);
            cleanupCallResources();
            setAlert({
                content: `Ошибка при ответе на звонок: ${error.message}`,
                type: 'err'
            });
        }
    };

    const rejectCall = () => {
        setIncomingCall(null);
    };

    const endCall = () => {
        if (wsRef.current?.readyState === WebSocket.OPEN && chatData?.id) {
            wsRef.current.send(JSON.stringify({
                type: 'call_end',
                data: {
                    chat_id: chatData.id,
                },
            }));
        }

        cleanupCallResources();
    };

    const toggleMute = () => {
        if (!localStreamRef.current) {
            return;
        }

        const nextMuted = !isMuted;
        localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = !nextMuted;
        });
        setIsMuted(nextMuted);
    };

    const toggleVideo = () => {
        if (!localStreamRef.current || callTypeRef.current !== 'video') {
            return;
        }

        const nextVideoEnabled = !isVideoEnabled;
        localStreamRef.current.getVideoTracks().forEach((track) => {
            track.enabled = nextVideoEnabled;
        });
        setIsVideoEnabled(nextVideoEnabled);
    };


    useEffect(() => {
        return () => {
            cleanupCallResources(false);
        };
    }, [cleanupCallResources]);

    const [alert, setAlert] = useState()

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main mx-auto mb-4"></div>
                    <p className="text-gray-500">Загрузка чата...</p>
                </div>
            </div>
        );
    }

    if (!chatData) {
        return (
            <div className="flex justify-center items-center h-full">
                <p className="text-gray-500">Чат не найден</p>
            </div>
        );
    }

    const isPersonalChat = chatData.type === 'personal';

    return (
        <div className="w-full h-full flex flex-col">
            {isMember ? (
                <>
                    {/* Header */}
                    <div className="bg-bg fixed w-full z-2 border-b-2 border-main p-4 flex items-center justify-between">
                        <a href="/chats" className='uppercase text-main font-bold'>назад</a>

                        <Popup
                            openTrigger={
                                <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                    {chatData.displayAvatar ? (
                                        <img
                                            src={`${BASE_URL}${chatData.displayAvatar}`}
                                            alt=""
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-main text-white flex items-center justify-center font-bold">
                                            {chatData.displayTitle?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="font-bold text-center truncate">{chatData.displayTitle || 'Чат'}</h2>
                                        {!isPersonalChat ? (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-gray-500">{chatData.members?.length || 0} участников</span>
                                                {isConnected ? (
                                                    <span className="text-green-500 flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                        {onlineUsers.length} онлайн
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                                        офлайн
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-gray-500">
                                                {isConnected ? (
                                                    <span className="text-green-500">в сети</span>
                                                ) : (
                                                    <span className="text-gray-400">не в сети</span>
                                                )}
                                            </div>
                                        )}
                                        {/* Индикатор печатания */}
                                        {typingUsers.length > 0 && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'печатает' : 'печатают'}...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            }
                        >
                            <div className="p-4">
                                <h3 className="text-xl font-bold mb-4">
                                    {isPersonalChat ? 'Информация о пользователе' : 'Участники чата'}
                                </h3>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {isPersonalChat ? (
                                        // Для personal чата показываем только второго участника
                                        chatData.members?.filter(m => m.id !== user?.id).map(member => (
                                            <div key={member.id} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg">
                                                <Link href={`/users/${member.id}`} className="flex items-center gap-3 flex-1">
                                                    {member.avatar ? (
                                                        <img
                                                            src={`${BASE_URL}${member.avatar}`}
                                                            alt=""
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-main text-white flex items-center justify-center font-bold">
                                                            {member.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-semibold">{member.name || 'Пользователь'}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {onlineUsers.some(u => u.id === member.id) ? 'В сети' : 'Не в сети'}
                                                        </p>
                                                    </div>
                                                </Link>
                                                {onlineUsers.some(u => u.id === member.id) ? (
                                                    <span className="text-green-500 text-sm flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                        онлайн
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">офлайн</span>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        // Для групповых чатов показываем всех участников
                                        chatData.members?.map(member => (
                                            <div key={member.id} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg">
                                                <Link href={`/users/${member.id}`} className="flex items-center gap-3 flex-1">
                                                    {member.avatar ? (
                                                        <img
                                                            src={`${BASE_URL}${member.avatar}`}
                                                            alt=""
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-main text-white flex items-center justify-center font-bold">
                                                            {member.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-semibold">{member.name || 'Пользователь'}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {member.id === chatData.owner_id ? 'Создатель' : 'Участник'}
                                                        </p>
                                                    </div>
                                                </Link>
                                                {onlineUsers.some(u => u.id === member.id) ? (
                                                    <span className="text-green-500 text-sm flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                        онлайн
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">офлайн</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </Popup>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSearch(!showSearch)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title="Поиск"
                            >
                                🔍
                            </button>

                            <button
                                onClick={() => setShowPinned(!showPinned)}
                                className="p-2 hover:bg-gray-100 rounded-full relative transition-colors"
                                title="Закрепленные сообщения"
                            >
                                📌
                                {pinnedMessages.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {pinnedMessages.length}
                                    </span>
                                )}
                            </button>

                            {!callActive ? (
                                <>
                                    <button
                                        onClick={() => startCall('audio')}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                        title="Аудиозвонок"
                                    >
                                        📞
                                    </button>
                                    <button
                                        onClick={() => startCall('video')}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                        title="Видеозвонок"
                                    >
                                        📹
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>

                    {/* Попап входящего звонка */}
                    {incomingCall && (
                        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 z-50 border-2 border-main min-w-[320px]">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 bg-main/20 rounded-full flex items-center justify-center">
                                    <span className="text-4xl">
                                        {incomingCall.callType === 'video' ? '📹' : '📞'}
                                    </span>
                                </div>
                                <p className="text-xl font-bold mb-2">
                                    Входящий {incomingCall.callType === 'video' ? 'видео' : 'аудио'} звонок
                                </p>
                                <p className="text-gray-600 mb-2">от {incomingCall.caller_name}</p>
                                <p className="text-sm text-gray-500 mb-6">
                                    Участников уже в звонке: {incomingCall.participants?.length || 1}
                                </p>
                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={acceptCall}
                                        className="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors flex items-center gap-2"
                                    >
                                        <span>✅</span> Ответить
                                    </button>
                                    <button
                                        onClick={rejectCall}
                                        className="px-6 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center gap-2"
                                    >
                                        <span>❌</span> Отклонить
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {callActive && callType === 'audio' && (
                        <div className="fixed top-[73px] left-0 right-0 z-40 bg-white border-b shadow-sm p-4">
                            <div className="max-w-5xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-semibold text-main">Групповой аудиозвонок</p>
                                    <p className="text-sm text-gray-600">
                                        {formatTime(callTime)} · Участники: {callParticipants.map(participant => participant.name).join(', ') || 'только вы'}
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={toggleMute}
                                        className={`px-4 py-2 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-100'} hover:opacity-80 transition-colors`}
                                    >
                                        {isMuted ? '🔇 Микрофон выкл.' : '🎤 Микрофон'}
                                    </button>
                                    <button
                                        onClick={endCall}
                                        className="px-4 py-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                                    >
                                        Завершить
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Попап активного видеозвонка */}
                    {callActive && callType === 'video' && (
                        <div className="fixed top-[73px] left-0 right-0 z-50 bg-black p-4" style={{ height: '420px' }}>
                            <div className="relative h-full flex flex-col gap-4">
                                <div className="flex items-center justify-between text-white">
                                    <div>
                                        <p className="font-semibold">Групповой видеозвонок</p>
                                        <p className="text-sm text-gray-300">
                                            {formatTime(callTime)} · Участники: {callParticipants.map(participant => participant.name).join(', ') || 'только вы'}
                                        </p>
                                    </div>
                                    <div className="text-sm text-gray-300">
                                        {callParticipants.length} участ.
                                    </div>
                                </div>

                                <div className={`grid flex-1 gap-4 ${remoteStreams.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {remoteStreams.length > 0 ? (
                                        remoteStreams.map((remote) => (
                                            <div key={`remote-video-${remote.userId}`} className="relative bg-gray-800 rounded-lg overflow-hidden">
                                                <StreamVideo
                                                    stream={remote.stream}
                                                    className="w-full h-full bg-gray-800 rounded-lg object-cover"
                                                />
                                                <div className="absolute left-3 bottom-3 bg-black/60 text-white text-sm px-2 py-1 rounded-full">
                                                    {remote.userName}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-center bg-gray-900 rounded-lg text-gray-300">
                                            Ожидание подключения участников...
                                        </div>
                                    )}
                                </div>

                                <div className="absolute bottom-20 right-4 w-48 h-36 bg-gray-800 rounded-lg border-2 border-white overflow-hidden shadow-lg">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 bg-black/50 p-2 rounded-full">
                                    <button
                                        onClick={toggleMute}
                                        className={`p-3 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'} hover:opacity-80 transition-colors`}
                                    >
                                        {isMuted ? '🔇' : '🎤'}
                                    </button>

                                    <button
                                        onClick={toggleVideo}
                                        className={`p-3 rounded-full ${!isVideoEnabled ? 'bg-red-500' : 'bg-gray-700'} hover:opacity-80 transition-colors`}
                                    >
                                        {isVideoEnabled ? '📹' : '🚫'}
                                    </button>

                                    <button
                                        onClick={endCall}
                                        className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                                    >
                                        📞
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {callType === 'audio' && remoteStreams.map((remote) => (
                        <StreamAudio key={`remote-audio-${remote.userId}`} stream={remote.stream} />
                    ))}

                    {/* Поискавая панель */}
                    {showSearch && (
                        <div className="p-4 border-b bg-white fixed w-full top-[73px] z-10 shadow-md">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                placeholder="Поиск по сообщениям..."
                                className="w-full p-2 border rounded-md focus:outline-none focus:border-main"
                                autoFocus
                            />
                            {searchResults.length > 0 && (
                                <div className="mt-2 max-h-60 overflow-y-auto">
                                    {searchResults.map(msg => (
                                        <div
                                            key={msg.id}
                                            onClick={() => {
                                                document.getElementById(msg.id)?.scrollIntoView({ behavior: 'smooth' });
                                                setShowSearch(false);
                                            }}
                                            className="p-2 hover:bg-gray-100 cursor-pointer border-b"
                                        >
                                            <span className="font-semibold">{msg.author_name}: </span>
                                            <span className="text-sm">{msg.content?.substring(0, 50)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pinned messages panel */}
                    {showPinned && (
                        <div className="p-4 border-b bg-bg fixed w-full top-[73px] z-10 shadow-md">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold uppercase text-main">Закрепленные сообщения</h3>
                                <button onClick={() => setShowPinned(false)} className="text-gray-500 hover:text-gray-700">
                                    ✕
                                </button>
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                                {pinnedMessages.length > 0 ? (
                                    pinnedMessages.map(msg => (
                                        <div
                                            key={msg.id}
                                            onClick={() => {
                                                document.getElementById(msg.id)?.scrollIntoView({ behavior: 'smooth' });
                                                setShowPinned(false);
                                            }}
                                            className="p-2 hover:bg-main/10 cursor-pointer border-b"
                                        >
                                            <p className="font-semibold text-sm">{msg.author_name}</p>
                                            <p className="text-sm truncate">{msg.content}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm">Нет закрепленных сообщений</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className={`flex-1 overflow-y-auto p-4 messages-container ${callActive && callType === 'video' ? 'mt-[calc(73px+17rem)]' : callActive && callType === 'audio' ? 'mt-[145px]' : 'mt-[73px]'} mb-24`}>
                        {chatData.commentable !== 'true' ? (
                            'Комментарии отключены'
                        ) : messages.length === 0 ? (
                            <p
                                className="text-gray-500 text-center p-4 cursor-pointer hover:text-gray-700"
                                onClick={() => setContent('Здравствуйте')}
                            >
                                Чат пуст! <br /> Поздороваться
                            </p>
                        ) : (
                            messages.map(message => (
                                message.type === 'system' ? (
                                    <div key={message.id} className="flex justify-center my-2">
                                        <div className="bg-gray-800/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-gray-600">
                                            {message.content}
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={`flex mb-4 ${message.author_id === user?.id ? 'justify-end' : 'justify-start'}`}
                                        key={message.id}
                                        id={`${message.id}`}
                                    >
                                        <div
                                            className={`max-w-[70%] ${message.author_id === user?.id
                                                ? 'bg-sec'
                                                : 'bg-main/30'
                                                } rounded-lg p-3 ${message.is_pinned == 'true' ? 'border-2 border-yellow-400' : ''
                                                } ${message.delivery_status === 'sending' ? 'opacity-70' : ''}`}
                                        >
                                            <div className="w-full">
                                                {message.author_id !== user?.id && (
                                                    <Link
                                                        href={`/users/${message.author_id}`}
                                                        className="text-sm font-semibold block hover:underline mb-1"
                                                    >
                                                        {message.author_name}
                                                    </Link>
                                                )}

                                                {message.answer_content && (
                                                    <div
                                                        onClick={() => {
                                                            document.getElementById(message.answer_id)?.scrollIntoView({ behavior: 'smooth' });
                                                        }}
                                                        className="border-l-2 border-gray-400 pl-2 mb-2 text-sm bg-white/50 rounded p-1 cursor-pointer hover:bg-white/70"
                                                    >
                                                        {message.answer_content.length > 50
                                                            ? message.answer_content.substring(0, 50) + '...'
                                                            : message.answer_content}
                                                    </div>
                                                )}

                                                <ContextMenu
                                                    closing={closeContext}
                                                    openTrigger={
                                                        <>
                                                            {message.source ? (
                                                                <div className="mb-2">
                                                                    {message.source_type?.includes('image') || message.source.type?.includes('image') ? (
                                                                        <Popup openTrigger={<img
                                                                            src={`${BASE_URL}${message.source.name || message.source.url}`}
                                                                            alt=""
                                                                            className="max-w-full max-h-80 rounded cursor-pointer"
                                                                            loading="lazy"
                                                                        />}>
                                                                            <img
                                                                                src={`${BASE_URL}${message.source.name || message.source.url}`}
                                                                                alt=""
                                                                                className="max-w-full m-auto max-h-[80vh] rounded cursor-pointer"
                                                                                loading="lazy"
                                                                            />
                                                                        </Popup>


                                                                    ) : message.source.type?.includes('webm') ? (
                                                                        <audio
                                                                            src={`${BASE_URL}${message.source.name}`}
                                                                            className="w-full min-w-[300px]"
                                                                            controls
                                                                            preload="none"
                                                                        />
                                                                    ) : (
                                                                        <a
                                                                            href={`${BASE_URL}${message.source.name}`}
                                                                            download
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-500 underline flex items-center gap-1 hover:text-blue-700"
                                                                        >
                                                                            📎 {message.source.name || 'Файл'}
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                            <p className="break-words">{message.content}</p>
                                                        </>
                                                    }
                                                >
                                                    <div className="flex flex-col gap-1 min-w-[150px]">
                                                        <button
                                                            className="px-3 py-2 hover:bg-gray-100 text-left"
                                                            onClick={() => {
                                                                setCloseContext(true);
                                                                setAnswer({ id: message.id, content: message.content });
                                                            }}
                                                        >
                                                            Ответить
                                                        </button>

                                                        <button
                                                            className="px-3 py-2 hover:bg-gray-100 text-left"
                                                            onClick={() => forwardMessage(message)}
                                                        >
                                                            Переслать
                                                        </button>

                                                        <button
                                                            className="px-3 py-2 hover:bg-gray-100 text-left"
                                                            onClick={() => pinMessage(message)}
                                                        >
                                                            {message.is_pinned == 'true' ? 'Открепить' : 'Закрепить'}
                                                        </button>

                                                        <button
                                                            className="px-3 py-2 hover:bg-gray-100 text-left"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(message.content);
                                                                setCloseContext(true);
                                                                setAlert({ content: 'текст скопирован в буфер обмена', type: '' })
                                                            }}
                                                        >
                                                            Копировать текст
                                                        </button>
                                                        <button
                                                            className="px-3 py-2 hover:bg-gray-100 text-left text-red-600"
                                                            onClick={() => deleteMess(message)}
                                                        >
                                                            Удалить
                                                        </button>
                                                    </div>
                                                </ContextMenu>

                                                <div className="flex justify-between items-center mt-1 text-xs text-gray-500 gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <span>{message.created_at}</span>
                                                        {message.is_pinned == 'true' && <span className="ml-1">📌</span>}
                                                    </div>

                                                    {message.author_id === user?.id && (
                                                        <div className="flex items-center gap-2">
                                                            {message.delivery_status === 'sending' && (
                                                                <span title="Отправляется">🕓</span>
                                                            )}

                                                            {message.delivery_status === 'sent' && (
                                                                <span title="Отправлено">✓</span>
                                                            )}

                                                            {message.delivery_status === 'delivered' && (
                                                                <span title="Доставлено">✓✓</span>
                                                            )}

                                                            {message.delivery_status === 'read' && (
                                                                <span
                                                                    className="text-sky-500"
                                                                    title={
                                                                        message.read_by_user_ids?.length > 0
                                                                            ? `Прочитано ${message.read_by_user_ids.length} участниками`
                                                                            : 'Прочитано'
                                                                    }
                                                                >
                                                                    ✓✓
                                                                </span>
                                                            )}

                                                            {message.delivery_status === 'error' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => retryFailedMessage(message)}
                                                                    className="text-red-600 hover:underline"
                                                                    title={message.error_message || 'Повторить отправку'}
                                                                >
                                                                    Ошибка
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="fixed bottom-0 w-full bg-bg border-t">
                        {showForwardSelector && (
                            <div className="p-4 border-t bg-gray-50">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold">Переслать {forwardMessages.length} сообщений</h3>
                                    <button
                                        onClick={() => {
                                            setForwardMessages([]);
                                            setShowForwardSelector(false);
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {availableChats.map(chat => (
                                        <button
                                            key={chat.id}
                                            onClick={() => sendForwardedMessages(chat.id)}
                                            className="flex-shrink-0 px-3 py-2 bg-white border rounded-md hover:bg-gray-50"
                                        >
                                            {chat.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {answer && (
                            <div className="p-2 border-t bg-gray-50 flex justify-between items-center">
                                <span className="text-sm truncate">
                                    Ответ на: {answer.content}
                                </span>
                                <button onClick={() => setAnswer(null)} className="text-gray-500 hover:text-gray-700">
                                    ✕
                                </button>
                            </div>
                        )}

                        {file && (
                            <div className="p-2 border-t bg-gray-50 flex justify-between items-center">
                                <span className="text-sm truncate">{file.name}</span>
                                <button onClick={() => setFile(null)} className="text-gray-500 hover:text-gray-700">
                                    ✕
                                </button>
                            </div>
                        )}

                        {recording && (
                            <div className="p-2 border-t bg-gray-50 flex items-center gap-2">
                                <audio
                                    ref={el => audioRefs.current[recording.id] = el}
                                    src={recording.url}
                                    className="flex-1"
                                    controls
                                />
                                <button
                                    onClick={() => {
                                        URL.revokeObjectURL(recording.url);
                                        setRecording(null);
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div className="p-4">
                            <form onSubmit={handleSend} className="flex gap-2">
                                <input
                                    type="text"
                                    value={content}
                                    onChange={handleInputChange}
                                    className="flex-1 p-2 border rounded-md focus:outline-none focus:border-main"
                                    placeholder="Введите сообщение..."
                                    disabled={isRecording}
                                />

                                {!recording && (
                                    <>
                                        <input
                                            type="file"
                                            id="file-input"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    setFile(e.target.files[0]);
                                                    e.target.value = ''
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor="file-input"
                                            className="p-2 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200"
                                        >
                                            📎
                                        </label>
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`p-2 rounded-md ${isRecording
                                        ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                                        : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                >
                                    {isRecording ? '⏹️' : '🎤'}
                                </button>

                                <button
                                    type="submit"
                                    disabled={!(content.trim() || file || recording || forwardMessages.length > 0)}
                                    className="px-4 py-2 bg-main text-white rounded-md hover:bg-opacity-80 disabled:bg-gray-400"
                                >
                                    Отправить
                                </button>
                            </form>
                        </div>

                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <p className="mb-4">Вы не состоите в этом чате</p>
                        <button
                            className="px-4 py-2 bg-main text-white rounded-md hover:bg-opacity-80"
                            onClick={joinChat}
                        >
                            Вступить
                        </button>
                    </div>
                </div>
            )}

            <Alert id={Date.now()} content={alert?.content} type={alert?.type} />
        </div>
    );
}