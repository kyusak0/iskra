'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/authContext';
import ContextMenu from '../../../components/contextMenu/ContextMenu';
import Popup from '../../../components/popup/Popup';

const BASE_URL = 'http://localhost:8001/storage/';
const WS_URL = 'ws://localhost:5000';

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

export default function Chat({ chat_id, chat_url }) {
    const params = useParams();
    const router = useRouter();
    const { user, get, post } = useAuth();

    // Refs
    const remoteAudioRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localVideoRef = useRef(null);
    const timerRef = useRef(null);
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const peerRef = useRef(null);
    const localStreamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioRefs = useRef({});
    const wsReconnectTimeout = useRef(null);
    const isInitialized = useRef(false);
    const heartbeatInterval = useRef(null);
    const lastPongRef = useRef(Date.now());

    // States
    const [incomingCall, setIncomingCall] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [callTime, setCallTime] = useState(0);
    const [callActive, setCallActive] = useState(false);
    const [callType, setCallType] = useState(null);
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

    // Get chat identifier
    const chatIdentifier = useCallback(() => {
        if (chat_id) return chat_id;
        if (chat_url) return chat_url;
        if (params?.cid) return params.cid;
        return params?.url || null;
    }, [chat_id, chat_url, params])();

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
                    displayAvatar: chatAvatar
                });
                
                const formattedMessages = (res.data.messages || []).map(msg => ({
                    id: msg.id,
                    author_id: msg.author_id,
                    author_name: msg.user?.name || `User ${msg.author_id}`,
                    content: msg.content,
                    created_at: new Date(msg.created_at).toLocaleTimeString(),
                    source: msg.source ? {
                        id: msg.source.id,
                        name: msg.source.name,
                        type: msg.source.type,
                        url: msg.source.url
                    } : null,
                    answer_content: msg?.message?.content || null,
                    answer_id: msg?.message?.id,
                    is_pinned: msg.is_pinned || false
                }));
                
                setMessages(formattedMessages);
                setPinnedMessages(formattedMessages.filter(m => m.is_pinned));
                
                setIsMember(res.data.members?.some(m => m.id === user?.id) || false);
                
                isInitialized.current = true;
            }
        } catch (err) {
            console.error('Error loading chat data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [chatIdentifier, user, get]);

    // Загрузка списка чатов
    const loadAvailableChats = useCallback(async () => {
        try {
            const res = await get("/get-chats");
            setAvailableChats(res?.data || []);
        } catch (err) {
            console.error('Error loading chats:', err);
        }
    }, [get]);

    // Инициализация
    useEffect(() => {
        if (user) {
            loadChatData();
            loadAvailableChats();
        }
    }, [user, loadChatData, loadAvailableChats]);

    // Heartbeat для проверки соединения
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

        const connectWebSocket = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) return;

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
                    user_id: user.id,
                    user_name: user.name,
                    chat_id: chatData.id
                }));
                
                // Запрашиваем список онлайн пользователей только для групповых чатов
                if (chatData.type !== 'personal') {
                    ws.send(JSON.stringify({
                        type: 'get_online_users',
                        chat_id: chatData.id
                    }));
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'pong':
                            lastPongRef.current = Date.now();
                            break;
                            
                        case 'online_users':
                            // Обновляем онлайн пользователей только для групповых чатов
                            if (chatData.type !== 'personal') {
                                console.log('Online users update:', data.users);
                                setOnlineUsers(data.users || []);
                            }
                            break;
                            
                        case 'user_online':
                            // Обновляем онлайн пользователей только для групповых чатов
                            if (chatData.type !== 'personal') {
                                setOnlineUsers(prev => {
                                    if (!prev.some(u => u.id === data.user.id)) {
                                        return [...prev, data.user];
                                    }
                                    return prev;
                                });
                            }
                            break;
                            
                        case 'user_offline':
                            // Обновляем онлайн пользователей только для групповых чатов
                            if (chatData.type !== 'personal') {
                                setOnlineUsers(prev => prev.filter(u => u.id !== data.user_id));
                            }
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
                            if (data.message) {
                                setMessages(prev => {
                                    if (prev.some(m => m.id === data.message.id)) return prev;
                                    
                                    const newMess = {
                                        id: data.message.id,
                                        author_id: data.message.author_id,
                                        author_name: data.message.author_name || `User ${data.message.author_id}`,
                                        content: data.message.source_type === 'voice' ? '🎤 Голосовое сообщение' : data.message.content,
                                        source: data.message.source || null,
                                        source_type: data.message.source_type,
                                        created_at: new Date(data.message.created_at).toLocaleTimeString(),
                                        answer_id: data.message.answer_id,
                                        answer_content: data.message.answer_content,
                                        is_pinned: data.message.is_pinned || false
                                    };
                                    
                                    return [...prev, newMess];
                                });
                            }
                            break;

                        case 'delete_message':
                            if (data.message?.id) {
                                setMessages(prev => prev.filter(item => item.id !== data.message.id));
                            }
                            break;

                        case 'pin_message':
                            if (data.message?.id) {
                                setMessages(prev => {
                                    const updated = prev.map(msg =>
                                        msg.id === data.message.id
                                            ? { ...msg, is_pinned: data.message.is_pinned }
                                            : msg
                                    );
                                    setPinnedMessages(updated.filter(m => m.is_pinned));
                                    return updated;
                                });
                            }
                            break;

                        case 'user_joined':
                            // Показываем системные сообщения только для групповых чатов
                            if (chatData.type !== 'personal') {
                                const joinMsg = {
                                    id: `join-${Date.now()}`,
                                    type: 'system',
                                    content: `👋 Пользователь ${data.user_name} присоединился к чату`,
                                    timestamp: Date.now()
                                };
                                setMessages(prev => [...prev, joinMsg]);
                                setTimeout(() => {
                                    setMessages(prev => prev.filter(m => m.id !== joinMsg.id));
                                }, 5000);
                            }
                            break;

                        case 'user_left':
                            // Показываем системные сообщения только для групповых чатов
                            if (chatData.type !== 'personal') {
                                const leftMsg = {
                                    id: `left-${Date.now()}`,
                                    type: 'system',
                                    content: `👋 Пользователь ${data.user_name} покинул чат`,
                                    timestamp: Date.now()
                                };
                                setMessages(prev => [...prev, leftMsg]);
                                setTimeout(() => {
                                    setMessages(prev => prev.filter(m => m.id !== leftMsg.id));
                                }, 5000);
                            }
                            break;

                        default:
                            break;
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
                
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
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
                        user_id: user.id,
                        user_name: user.name,
                        chat_id: chatData.id
                    }));
                }
                wsRef.current.close();
                wsRef.current = null;
            }
            
            if (peerRef.current) {
                peerRef.current.close();
                peerRef.current = null;
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            stopTimer();
        };
    }, [chatData?.id, user?.id, isMember, startHeartbeat, chatData?.type]);

    // Отправка статуса печатания
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

    // Debounced поиск
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

    // Таймер
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

        let loadFile = null;
        let voiceFile = null;
        const tempId = Date.now();

        try {
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('author_id', user.id);
                loadFile = await post('/load-file', formData);
            }

            if (recording?.blob) {
                const voiceFormData = new FormData();
                voiceFormData.append('file', recording.blob, recording.name);
                voiceFormData.append('author_id', user.id);
                voiceFormData.append('type', 'voice');
                voiceFile = await post('/load-file', voiceFormData);
            }

            if (!isConnected) {
                alert('Нет подключения к серверу');
                return;
            }

            if (forwardMessages.length > 0) {
                for (const fwdMsg of forwardMessages) {
                    await post("/send-message/chat", {
                        author_id: user.id,
                        chat_id: chatData.id,
                        content: `📨 Пересланное сообщение от ${fwdMsg.author_name}:\n${fwdMsg.content}`,
                        source_id: fwdMsg.source?.id || null,
                        source_type: fwdMsg.source_type,
                    });
                }
                setForwardMessages([]);
                setShowForwardSelector(false);
            }

            const optimisticMessage = {
                id: tempId,
                author_id: user.id,
                author_name: user.name,
                content: recording ? '🎤 Голосовое сообщение' : content,
                source: loadFile?.data || voiceFile?.data || null,
                source_type: recording ? 'voice' : (file ? 'file' : null),
                created_at: new Date().toLocaleTimeString(),
                isSending: true
            };

            setMessages(prev => [...prev, optimisticMessage]);

            setContent("");
            setAnswer(null);
            setFile(null);
            if (recording) {
                URL.revokeObjectURL(recording.url);
                setRecording(null);
            }

            const res = await post("/send-message/chat", {
                author_id: user.id,
                chat_id: chatData.id,
                content: content,
                answer_id: answer?.id || null,
                source_id: voiceFile?.data?.id || loadFile?.data?.id || null,
                source_type: recording ? 'voice' : (file ? 'file' : null),
            });

            setMessages(prev =>
                prev.map(msg =>
                    msg.id === tempId
                        ? {
                            id: res.data.id,
                            author_id: res.data.author_id,
                            author_name: user.name,
                            content: recording ? '🎤 Голосовое сообщение' : res.data.content,
                            created_at: new Date(res.data.created_at).toLocaleTimeString(),
                            isSending: false,
                            answer_id: res.data.answer_id,
                            answer_content: res.data.message?.content,
                            source: voiceFile?.data || loadFile?.data || null,
                            source_type: recording ? 'voice' : (file ? 'file' : null),
                        }
                        : msg
                )
            );

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'new_message',
                    message: {
                        id: res.data.id,
                        content: recording ? '🎤 Голосовое сообщение' : res.data.content,
                        author_id: res.data.author_id,
                        author_name: user.name,
                        chat_id: chatData.id,
                        created_at: res.data.created_at,
                        answer_id: res.data.answer_id,
                        answer_content: res.data.message?.content,
                        source: voiceFile?.data || loadFile?.data || null,
                        source_type: recording ? 'voice' : (file ? 'file' : null),
                    }
                }));
            }
        } catch (err) {
            console.error('Error sending message:', err);
            alert('Ошибка при отправке сообщения');
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
        }
    };

    // Удаление сообщения
    const deleteMess = async (message) => {
        try {
            await post('/delete-message', { message_id: message.id });

            setMessages(prev => prev.filter(item => item.id !== message.id));

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
            });

            setMessages(prev => {
                const updated = prev.map(msg =>
                    msg.id === message.id ? { ...msg, is_pinned: newPinState } : msg
                );
                setPinnedMessages(updated.filter(m => m.is_pinned));
                return updated;
            });

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
            for (const msg of forwardMessages) {
                await post("/send-message/chat", {
                    author_id: user.id,
                    chat_id: targetChatId,
                    content: `📨 Пересланное сообщение от ${msg.author_name}:\n${msg.content}`,
                    source_id: msg.source?.id || null,
                    source_type: msg.source_type,
                });
            }
            setForwardMessages([]);
            setShowForwardSelector(false);
            alert('Сообщения успешно пересланы');
        } catch (err) {
            console.error('Error forwarding messages:', err);
            alert('Ошибка при пересылке сообщений');
        }
    };

    // Вступление в чат
    const joinChat = async () => {
        try {
            await post('/subscribe', {
                user_id: user.id,
                chat_id: chatData.id,
            });

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'user_joined',
                    user_id: user.id,
                    user_name: user.name,
                    chat_id: chatData.id
                }));
            }

            await post("/send-message/chat", {
                author_id: user.id,
                chat_id: chatData.id,
                content: `Пользователь ${user.name} присоединился к чату`,
            });

            setIsMember(true);
            
            const res = await get(`/get-chat-info/${chatData.id}`);
            if (res?.data) {
                // Обновляем данные с учетом personal чата
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
    const startCall = async (type = 'audio') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: type === 'video'
            });
            
            localStreamRef.current = stream;

            if (type === 'video' && localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            const peer = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" }
                ]
            });
            peerRef.current = peer;

            stream.getTracks().forEach(track => peer.addTrack(track, stream));

            peer.onicecandidate = (event) => {
                if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: "call_ice",
                        data: { chat_id: chatData.id, candidate: event.candidate }
                    }));
                }
            };

            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: "call_offer",
                    data: { chat_id: chatData.id, offer, callType: type }
                }));
            }

            setCallActive(true);
            setCallType(type);
            startTimer();
        } catch (err) {
            console.error('Error starting call:', err);
        }
    };

    const endCall = () => {
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "call_end",
                data: { chat_id: chatData.id }
            }));
        }

        setCallActive(false);
        setCallType(null);
        stopTimer();
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTracks = localStreamRef.current.getAudioTracks();
            audioTracks.forEach(track => { track.enabled = !isMuted; });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current && callType === 'video') {
            const videoTracks = localStreamRef.current.getVideoTracks();
            videoTracks.forEach(track => { track.enabled = !isVideoEnabled; });
            setIsVideoEnabled(!isVideoEnabled);
        }
    };

    // Очистка при размонтировании
    useEffect(() => {
        return () => {
            if (heartbeatInterval.current) {
                clearInterval(heartbeatInterval.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (recording?.url) {
                URL.revokeObjectURL(recording.url);
            }
        };
    }, []);

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
                    <div className="bg-bg fixed w-full z-10 border-b-2 border-main p-4 flex items-center justify-between">
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
                                                            {member.id === chatData.created_by ? 'Создатель' : 'Участник'}
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
                            ) : (
                                <div className="flex items-center gap-2 bg-green-100 rounded-lg px-3 py-1">
                                    <span className="text-green-600 animate-pulse">●</span>
                                    <span>{formatTime(callTime)}</span>
                                    <button onClick={toggleMute} className="px-2 hover:bg-green-200 rounded">
                                        {isMuted ? '🔇' : '🔊'}
                                    </button>
                                    {callType === 'video' && (
                                        <button onClick={toggleVideo} className="px-2 hover:bg-green-200 rounded">
                                            {isVideoEnabled ? '📹' : '🚫'}
                                        </button>
                                    )}
                                    <button
                                        onClick={endCall}
                                        className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                                    >
                                        Завершить
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Search panel */}
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

                    {/* Video call */}
                    {callActive && callType === 'video' && (
                        <div className="p-4 bg-black fixed top-[73px] w-full z-10">
                            <div className="relative">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-64 bg-gray-800 rounded-lg object-cover"
                                />
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="absolute bottom-2 right-2 w-32 h-24 bg-gray-800 rounded-lg border-2 border-white object-cover"
                                />
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    <div className={`flex-1 overflow-y-auto p-4 messages-container ${callActive && callType === 'video' ? 'mt-[calc(73px+16rem)]' : 'mt-[73px]'} mb-24`}>
                        {messages.length === 0 ? (
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
                                            className={`max-w-[70%] ${
                                                message.author_id === user?.id
                                                    ? 'bg-sec'
                                                    : 'bg-main/30'
                                            } rounded-lg p-3 ${
                                                message.is_pinned == 'true' ? 'border-2 border-yellow-400' : ''
                                            } ${message.isSending ? 'opacity-70' : ''}`}
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
                                                                        <img
                                                                            src={`${BASE_URL}${message.source.name || message.source.url}`}
                                                                            alt=""
                                                                            className="max-w-full max-h-80 rounded cursor-pointer"
                                                                            loading="lazy"
                                                                            onClick={() => window.open(`${BASE_URL}${message.source.name || message.source.url}`, '_blank')}
                                                                        />
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
                                                            }}
                                                        >
                                                            Копировать текст
                                                        </button>

                                                        {message.author_id === user?.id && (
                                                            <button
                                                                className="px-3 py-2 hover:bg-gray-100 text-left text-red-600"
                                                                onClick={() => deleteMess(message)}
                                                            >
                                                                Удалить
                                                            </button>
                                                        )}
                                                    </div>
                                                </ContextMenu>

                                                <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                                                    <span>{message.created_at}</span>
                                                    {message.is_pinned == 'true' && <span className="ml-2">📌</span>}
                                                    {message.isSending && <span className="ml-2">⏳</span>}
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
                                    className={`p-2 rounded-md ${
                                        isRecording 
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

                        <audio ref={remoteAudioRef} autoPlay />
                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center h-full">
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
        </div>
    );
}