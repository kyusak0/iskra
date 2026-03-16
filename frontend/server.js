const http = require('http');
const WebSocket = require('ws');

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8001/api';
const PORT = Number(process.env.PORT || 5000);
const PING_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 60000;

let socketSequence = 1;

const clients = new Map(); // socketId -> client data
const chatRooms = new Map(); // chatId -> Set(socketId)
const userSockets = new Map(); // userId -> Set(socketId)
const activeCalls = new Map(); // chatId -> { chatId, callType, participants:Set(userId), startedBy, startedByName, startedAt }

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'websocket-signaling' }));
});

const wss = new WebSocket.Server({ server });

function normalizeKey(value) {
    return String(value);
}

function toPublicId(value) {
    if (value === null || value === undefined) {
        return value;
    }

    const num = Number(value);
    return Number.isNaN(num) ? value : num;
}

function sendJson(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function sendError(ws, message, extra = {}) {
    sendJson(ws, {
        type: 'error',
        message,
        ...extra,
    });
}

async function validateChatAccess(token, chatId) {
    if (!token) {
        return {
            ok: false,
            status: 401,
            message: 'Отсутствует токен авторизации для подключения к чату.',
        };
    }

    try {
        const response = await fetch(`${BACKEND_API_URL}/ws/chat-access/${encodeURIComponent(chatId)}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        const raw = await response.text();
        let payload = null;

        try {
            payload = raw ? JSON.parse(raw) : null;
        } catch (error) {
            payload = null;
        }

        if (!response.ok || !payload?.success || !payload?.data) {
            return {
                ok: false,
                status: response.status,
                message: payload?.message || 'Не удалось проверить доступ к чату.',
            };
        }

        return {
            ok: true,
            data: payload.data,
        };
    } catch (error) {
        console.error('Chat access validation error:', error);
        return {
            ok: false,
            status: 500,
            message: 'Ошибка проверки доступа к чату.',
        };
    }
}

function getClient(socketId) {
    return clients.get(normalizeKey(socketId)) || null;
}

function addSocketToRoom(socketId, chatId) {
    const roomKey = normalizeKey(chatId);
    const socketKey = normalizeKey(socketId);

    if (!chatRooms.has(roomKey)) {
        chatRooms.set(roomKey, new Set());
    }

    chatRooms.get(roomKey).add(socketKey);
}

function removeSocketFromRoom(socketId, chatId) {
    const roomKey = normalizeKey(chatId);
    const socketKey = normalizeKey(socketId);
    const room = chatRooms.get(roomKey);

    if (!room) {
        return;
    }

    room.delete(socketKey);

    if (room.size === 0) {
        chatRooms.delete(roomKey);
    }
}

function addUserSocket(userId, socketId) {
    const userKey = normalizeKey(userId);
    const socketKey = normalizeKey(socketId);

    if (!userSockets.has(userKey)) {
        userSockets.set(userKey, new Set());
    }

    userSockets.get(userKey).add(socketKey);
}

function removeUserSocket(userId, socketId) {
    const userKey = normalizeKey(userId);
    const socketKey = normalizeKey(socketId);
    const sockets = userSockets.get(userKey);

    if (!sockets) {
        return;
    }

    sockets.delete(socketKey);

    if (sockets.size === 0) {
        userSockets.delete(userKey);
    }
}

function resolveUserName(userId) {
    const userKey = normalizeKey(userId);
    const socketIds = userSockets.get(userKey);

    if (!socketIds) {
        return `User ${toPublicId(userId)}`;
    }

    for (const socketId of socketIds) {
        const client = getClient(socketId);
        if (client?.userName) {
            return client.userName;
        }
    }

    return `User ${toPublicId(userId)}`;
}

function getOnlineUsersInChat(chatId) {
    const roomKey = normalizeKey(chatId);
    const room = chatRooms.get(roomKey);

    if (!room) {
        return [];
    }

    const seenUsers = new Set();
    const users = [];

    for (const socketId of room) {
        const client = getClient(socketId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            continue;
        }

        if (seenUsers.has(client.userId)) {
            continue;
        }

        seenUsers.add(client.userId);
        users.push({
            id: toPublicId(client.userId),
            name: client.userName || `User ${toPublicId(client.userId)}`,
            role: client.role || 'user',
        });
    }

    return users;
}

function sendToUser(userId, payload, options = {}) {
    const { excludeSocketId = null, chatId = null } = options;
    const userKey = normalizeKey(userId);
    const excluded = excludeSocketId ? normalizeKey(excludeSocketId) : null;
    const chatKey = chatId !== null ? normalizeKey(chatId) : null;
    const socketIds = userSockets.get(userKey);

    if (!socketIds) {
        return 0;
    }

    let sent = 0;

    for (const socketId of socketIds) {
        if (excluded && socketId === excluded) {
            continue;
        }

        const client = getClient(socketId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            continue;
        }

        if (chatKey !== null && client.currentChatId !== chatKey) {
            continue;
        }

        sendJson(client.ws, payload);
        sent += 1;
    }

    return sent;
}

function broadcastToChat(chatId, payload, options = {}) {
    const { excludeSocketId = null, participantsOnly = null } = options;
    const roomKey = normalizeKey(chatId);
    const excluded = excludeSocketId ? normalizeKey(excludeSocketId) : null;
    const room = chatRooms.get(roomKey);

    if (!room) {
        return 0;
    }

    const allowedParticipants = participantsOnly
        ? new Set(Array.from(participantsOnly, (value) => normalizeKey(value)))
        : null;

    let sent = 0;

    for (const socketId of room) {
        if (excluded && socketId === excluded) {
            continue;
        }

        const client = getClient(socketId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            continue;
        }

        if (allowedParticipants && !allowedParticipants.has(client.userId)) {
            continue;
        }

        sendJson(client.ws, payload);
        sent += 1;
    }

    return sent;
}

function getActiveCall(chatId) {
    return activeCalls.get(normalizeKey(chatId)) || null;
}

function getCallParticipants(chatId) {
    const call = getActiveCall(chatId);

    if (!call) {
        return [];
    }

    return Array.from(call.participants).map((userId) => ({
        id: toPublicId(userId),
        name: resolveUserName(userId),
    }));
}

function getActiveCallPayload(chatId) {
    const call = getActiveCall(chatId);

    if (!call) {
        return null;
    }

    return {
        chat_id: toPublicId(call.chatId),
        callType: call.callType,
        startedBy: toPublicId(call.startedBy),
        startedByName: call.startedByName,
        startedAt: call.startedAt,
        participants: getCallParticipants(chatId),
    };
}

function broadcastCallParticipants(chatId) {
    const payload = getActiveCallPayload(chatId);

    if (!payload) {
        return;
    }

    broadcastToChat(chatId, {
        type: 'call_participants',
        data: payload,
    });
}

function isUserStillInRoom(userId, chatId) {
    const roomKey = normalizeKey(chatId);
    const userKey = normalizeKey(userId);
    const room = chatRooms.get(roomKey);

    if (!room) {
        return false;
    }

    for (const socketId of room) {
        const client = getClient(socketId);
        if (client?.userId === userKey && client.ws.readyState === WebSocket.OPEN) {
            return true;
        }
    }

    return false;
}

function leaveCall(chatId, userId) {
    const chatKey = normalizeKey(chatId);
    const userKey = normalizeKey(userId);
    const call = activeCalls.get(chatKey);

    if (!call) {
        return {
            wasParticipant: false,
            ended: false,
            remainingCount: 0,
        };
    }

    const wasParticipant = call.participants.delete(userKey);
    const remainingCount = call.participants.size;

    if (remainingCount < 2) {
        activeCalls.delete(chatKey);
        return {
            wasParticipant,
            ended: true,
            remainingCount,
        };
    }

    return {
        wasParticipant,
        ended: false,
        remainingCount,
    };
}

function requireAuthorizedClient(ws, chatId = null) {
    const socketId = normalizeKey(ws.socketId);
    const client = getClient(socketId);

    if (!client) {
        sendError(ws, 'Сокет не авторизован. Сначала выполните join_chat.');
        return null;
    }

    if (chatId !== null && client.currentChatId !== normalizeKey(chatId)) {
        sendError(ws, 'Сокет не привязан к указанному чату.');
        return null;
    }

    return client;
}

function cleanupChatPresence(chatId, userId, userName, options = {}) {
    const { reason = 'left' } = options;
    const roomKey = normalizeKey(chatId);
    const userKey = normalizeKey(userId);

    if (isUserStillInRoom(userKey, roomKey)) {
        return;
    }

    const leaveResult = leaveCall(roomKey, userKey);

    if (leaveResult.wasParticipant) {
        broadcastToChat(roomKey, {
            type: 'call_participant_left',
            data: {
                chat_id: toPublicId(roomKey),
                user_id: toPublicId(userKey),
                user_name: userName || resolveUserName(userKey),
                participants: leaveResult.ended ? [] : getCallParticipants(roomKey),
            },
        });
    }

    if (leaveResult.ended) {
        broadcastToChat(roomKey, {
            type: 'call_finished',
            data: {
                chat_id: toPublicId(roomKey),
                reason: reason === 'disconnect' ? 'participant_disconnected' : 'not_enough_participants',
            },
        });
    } else if (leaveResult.wasParticipant) {
        broadcastCallParticipants(roomKey);
    }

    broadcastToChat(roomKey, {
        type: 'online_users',
        users: getOnlineUsersInChat(roomKey),
    });
}

function handleSocketDisconnect(ws) {
    const socketId = normalizeKey(ws.socketId);
    const client = getClient(socketId);

    if (!client) {
        return;
    }

    clients.delete(socketId);
    removeSocketFromRoom(socketId, client.currentChatId);
    removeUserSocket(client.userId, socketId);

    cleanupChatPresence(client.currentChatId, client.userId, client.userName, {
        reason: 'disconnect',
    });
}

wss.on('connection', (ws, req) => {
    ws.socketId = normalizeKey(socketSequence++);
    ws.isAlive = true;

    console.log('New websocket connection:', ws.socketId, req.socket.remoteAddress);

    ws.on('pong', () => {
        ws.isAlive = true;
        const client = getClient(ws.socketId);
        if (client) {
            client.lastSeen = Date.now();
        }
    });

    ws.on('message', async (message) => {
        let payload;

        try {
            payload = JSON.parse(message.toString());
        } catch (error) {
            sendError(ws, 'Некорректный JSON в сообщении.');
            return;
        }

        const type = payload?.type;
        const client = getClient(ws.socketId);
        if (client) {
            client.lastSeen = Date.now();
        }

        try {
            switch (type) {
                case 'join_chat': {
                    const chatId = payload.chat_id;
                    const token = payload.token;

                    if (!chatId) {
                        sendError(ws, 'chat_id обязателен для join_chat.');
                        break;
                    }

                    const access = await validateChatAccess(token, chatId);
                    if (!access.ok) {
                        sendError(ws, access.message, { chat_id: toPublicId(chatId) });
                        break;
                    }

                    const roomKey = normalizeKey(chatId);
                    const userData = access.data;
                    const userKey = normalizeKey(userData.id);
                    const existingClient = getClient(ws.socketId);

                    if (existingClient?.currentChatId && existingClient.currentChatId !== roomKey) {
                        removeSocketFromRoom(ws.socketId, existingClient.currentChatId);
                        cleanupChatPresence(existingClient.currentChatId, existingClient.userId, existingClient.userName, {
                            reason: 'switch_chat',
                        });
                    }

                    clients.set(normalizeKey(ws.socketId), {
                        ws,
                        socketId: normalizeKey(ws.socketId),
                        userId: userKey,
                        userName: userData.name,
                        role: userData.role || 'user',
                        currentChatId: roomKey,
                        lastSeen: Date.now(),
                    });

                    addSocketToRoom(ws.socketId, roomKey);
                    addUserSocket(userKey, ws.socketId);

                    sendJson(ws, {
                        type: 'joined_chat',
                        chat_id: toPublicId(roomKey),
                        online_users: getOnlineUsersInChat(roomKey),
                        active_call: getActiveCallPayload(roomKey),
                        user: {
                            id: toPublicId(userKey),
                            name: userData.name,
                            role: userData.role || 'user',
                        },
                    });

                    broadcastToChat(roomKey, {
                        type: 'online_users',
                        users: getOnlineUsersInChat(roomKey),
                    }, { excludeSocketId: ws.socketId });
                    break;
                }

                case 'leave_chat': {
                    const currentClient = requireAuthorizedClient(ws, payload.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    removeSocketFromRoom(ws.socketId, currentClient.currentChatId);
                    cleanupChatPresence(currentClient.currentChatId, currentClient.userId, currentClient.userName, {
                        reason: 'leave_chat',
                    });
                    break;
                }

                case 'get_online_users': {
                    const currentClient = requireAuthorizedClient(ws, payload.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    sendJson(ws, {
                        type: 'online_users',
                        users: getOnlineUsersInChat(currentClient.currentChatId),
                    });
                    break;
                }

                case 'typing_start':
                case 'typing_stop': {
                    const currentClient = requireAuthorizedClient(ws, payload.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    broadcastToChat(currentClient.currentChatId, {
                        type,
                        user_id: toPublicId(currentClient.userId),
                        user_name: currentClient.userName,
                        chat_id: toPublicId(currentClient.currentChatId),
                    }, { excludeSocketId: ws.socketId });
                    break;
                }

                case 'messages_read': {
                    const readData = payload.data || {};
                    const currentClient = requireAuthorizedClient(ws, readData.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    const messageIds = Array.isArray(readData.message_ids)
                        ? readData.message_ids.map((id) => toPublicId(id))
                        : [];

                    if (messageIds.length === 0) {
                        break;
                    }

                    broadcastToChat(currentClient.currentChatId, {
                        type: 'messages_read',
                        data: {
                            chat_id: toPublicId(currentClient.currentChatId),
                            message_ids: messageIds,
                            reader_id: toPublicId(currentClient.userId),
                            reader_name: currentClient.userName,
                        },
                    }, { excludeSocketId: ws.socketId });
                    break;
                }

                case 'new_message':
                case 'delete_message':
                case 'pin_message': {
                    const messageData = payload.message || {};
                    const currentClient = requireAuthorizedClient(ws, messageData.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    const outgoing = {
                        type,
                        message: {
                            ...messageData,
                            chat_id: toPublicId(currentClient.currentChatId),
                        },
                    };

                    broadcastToChat(currentClient.currentChatId, outgoing, {
                        excludeSocketId: ws.socketId,
                    });
                    break;
                }

                case 'call_start': {
                    const currentClient = requireAuthorizedClient(ws, payload?.data?.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    const roomKey = currentClient.currentChatId;
                    const existingCall = getActiveCall(roomKey);

                    if (existingCall) {
                        sendJson(ws, {
                            type: 'call_busy',
                            data: getActiveCallPayload(roomKey),
                        });
                        break;
                    }

                    const callType = payload?.data?.callType === 'video' ? 'video' : 'audio';
                    activeCalls.set(roomKey, {
                        chatId: roomKey,
                        callType,
                        participants: new Set([currentClient.userId]),
                        startedBy: currentClient.userId,
                        startedByName: currentClient.userName,
                        startedAt: new Date().toISOString(),
                    });

                    sendJson(ws, {
                        type: 'call_participants',
                        data: getActiveCallPayload(roomKey),
                    });

                    broadcastToChat(roomKey, {
                        type: 'call_started',
                        data: {
                            chat_id: toPublicId(roomKey),
                            callType,
                            caller_id: toPublicId(currentClient.userId),
                            caller_name: currentClient.userName,
                            participants: getCallParticipants(roomKey),
                            startedAt: getActiveCall(roomKey)?.startedAt,
                        },
                    }, { excludeSocketId: ws.socketId });
                    break;
                }

                case 'call_join': {
                    const currentClient = requireAuthorizedClient(ws, payload?.data?.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    const roomKey = currentClient.currentChatId;
                    const call = getActiveCall(roomKey);

                    if (!call) {
                        sendError(ws, 'Активный звонок не найден.', { chat_id: toPublicId(roomKey) });
                        break;
                    }

                    const alreadyInCall = call.participants.has(currentClient.userId);
                    call.participants.add(currentClient.userId);

                    sendJson(ws, {
                        type: 'call_participants',
                        data: getActiveCallPayload(roomKey),
                    });

                    if (!alreadyInCall) {
                        broadcastToChat(roomKey, {
                            type: 'call_participant_joined',
                            data: {
                                chat_id: toPublicId(roomKey),
                                user_id: toPublicId(currentClient.userId),
                                user_name: currentClient.userName,
                                callType: call.callType,
                                participants: getCallParticipants(roomKey),
                            },
                        }, {
                            excludeSocketId: ws.socketId,
                            participantsOnly: call.participants,
                        });
                    }

                    broadcastCallParticipants(roomKey);
                    break;
                }

                case 'call_offer':
                case 'call_answer':
                case 'call_ice': {
                    const currentClient = requireAuthorizedClient(ws, payload?.data?.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    const roomKey = currentClient.currentChatId;
                    const targetUserId = payload?.data?.target_user_id;
                    const call = getActiveCall(roomKey);

                    if (!targetUserId) {
                        sendError(ws, 'target_user_id обязателен для signaling-события.', { chat_id: toPublicId(roomKey) });
                        break;
                    }

                    if (!call || !call.participants.has(normalizeKey(targetUserId))) {
                        sendError(ws, 'Указанный участник не состоит в активном звонке.', {
                            chat_id: toPublicId(roomKey),
                            target_user_id: toPublicId(targetUserId),
                        });
                        break;
                    }

                    const commonData = {
                        chat_id: toPublicId(roomKey),
                        user_id: toPublicId(currentClient.userId),
                        user_name: currentClient.userName,
                        target_user_id: toPublicId(targetUserId),
                        callType: call.callType,
                    };

                    if (type === 'call_offer') {
                        sendToUser(targetUserId, {
                            type: 'call_offer',
                            data: {
                                ...commonData,
                                caller_id: toPublicId(currentClient.userId),
                                caller_name: currentClient.userName,
                                offer: payload?.data?.offer,
                            },
                        }, { chatId: roomKey });
                    }

                    if (type === 'call_answer') {
                        sendToUser(targetUserId, {
                            type: 'call_answer',
                            data: {
                                ...commonData,
                                answer: payload?.data?.answer,
                            },
                        }, { chatId: roomKey });
                    }

                    if (type === 'call_ice') {
                        sendToUser(targetUserId, {
                            type: 'call_ice',
                            data: {
                                ...commonData,
                                candidate: payload?.data?.candidate,
                            },
                        }, { chatId: roomKey });
                    }
                    break;
                }

                case 'call_end': {
                    const currentClient = requireAuthorizedClient(ws, payload?.data?.chat_id || client?.currentChatId);
                    if (!currentClient) {
                        break;
                    }

                    const roomKey = currentClient.currentChatId;
                    const leaveResult = leaveCall(roomKey, currentClient.userId);

                    if (!leaveResult.wasParticipant) {
                        break;
                    }

                    broadcastToChat(roomKey, {
                        type: 'call_participant_left',
                        data: {
                            chat_id: toPublicId(roomKey),
                            user_id: toPublicId(currentClient.userId),
                            user_name: currentClient.userName,
                            participants: leaveResult.ended ? [] : getCallParticipants(roomKey),
                        },
                    });

                    if (leaveResult.ended) {
                        broadcastToChat(roomKey, {
                            type: 'call_finished',
                            data: {
                                chat_id: toPublicId(roomKey),
                                reason: 'not_enough_participants',
                            },
                        });
                    } else {
                        broadcastCallParticipants(roomKey);
                    }
                    break;
                }

                case 'ping': {
                    sendJson(ws, { type: 'pong' });
                    break;
                }

                case 'pong': {
                    const currentClient = getClient(ws.socketId);
                    if (currentClient) {
                        currentClient.lastSeen = Date.now();
                    }
                    break;
                }

                default: {
                    sendError(ws, `Неизвестный тип события: ${type}`);
                }
            }
        } catch (error) {
            console.error('WebSocket message handling error:', error);
            sendError(ws, 'Внутренняя ошибка websocket-сервера.');
        }
    });

    ws.on('close', () => {
        handleSocketDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

const interval = setInterval(() => {
    const now = Date.now();

    for (const [socketId, client] of clients.entries()) {
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            continue;
        }

        if (now - client.lastSeen > CONNECTION_TIMEOUT) {
            console.warn('Closing stale websocket:', socketId);
            client.ws.terminate();
            continue;
        }

        try {
            client.ws.isAlive = false;
            client.ws.ping();
        } catch (error) {
            console.error('Ping error:', error);
        }
    }
}, PING_INTERVAL);

wss.on('close', () => {
    clearInterval(interval);
});

server.listen(PORT, () => {
    console.log(`WebSocket signaling server listening on port ${PORT}`);
    console.log(`Laravel API endpoint for auth: ${BACKEND_API_URL}`);
});
