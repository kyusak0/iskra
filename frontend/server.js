const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map(); // user_id -> { ws, lastPing, userName, currentChat }
const chatRooms = new Map(); // chat_id -> Set(user_ids)

const PING_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 60000;

wss.on('connection', (ws, req) => {
    console.log('New client connected from:', req.socket.remoteAddress);
    let currentUser = null;
    let currentUserName = null;
    
    ws.isAlive = true;
    
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type, 'from user:', currentUser || 'unknown');

            switch (data.type) {
                case 'join_chat':
                    const { user_id, user_name, chat_id } = data;
                    currentUser = user_id;
                    currentUserName = user_name;
                    
                    // Сохраняем клиента
                    clients.set(user_id, { 
                        ws, 
                        lastPing: Date.now(),
                        userName: user_name,
                        currentChat: chat_id 
                    });
                    
                    // Добавляем в комнату чата
                    if (!chatRooms.has(chat_id)) {
                        chatRooms.set(chat_id, new Set());
                    }
                    chatRooms.get(chat_id).add(user_id);
                    
                    console.log(`User ${user_id} (${user_name}) joined chat ${chat_id}`);
                    
                    // Отправляем список онлайн пользователей
                    const onlineUsersInChat = getOnlineUsersInChat(chat_id);
                    ws.send(JSON.stringify({
                        type: 'online_users',
                        users: onlineUsersInChat
                    }));
                    
                    // Уведомляем других участников о новом онлайн пользователе
                    broadcastToChat(chat_id, {
                        type: 'online_users',
                        users: getOnlineUsersInChat(chat_id)
                    }, ws);
                    
                    break;

                case 'leave_chat':
                    if (currentUser && data.chat_id) {
                        const room = chatRooms.get(data.chat_id);
                        if (room) {
                            room.delete(currentUser);
                            
                            // Уведомляем остальных об изменении списка онлайн
                            broadcastToChat(data.chat_id, {
                                type: 'online_users',
                                users: getOnlineUsersInChat(data.chat_id)
                            }, ws);
                        }
                    }
                    break;

                case 'get_online_users':
                    if (data.chat_id) {
                        const onlineUsers = getOnlineUsersInChat(data.chat_id);
                        ws.send(JSON.stringify({
                            type: 'online_users',
                            users: onlineUsers
                        }));
                    }
                    break;

                case 'typing_start':
                case 'typing_stop':
                    if (currentUser && currentUserName && data.chat_id) {
                        broadcastToChat(data.chat_id, {
                            type: data.type,
                            user_id: currentUser,
                            user_name: currentUserName,
                            chat_id: data.chat_id
                        }, ws);
                    }
                    break;

                case 'new_message':
                    if (data.message && data.message.chat_id) {
                        console.log(`New message in chat ${data.message.chat_id} from ${data.message.author_id}`);
                        broadcastToChat(data.message.chat_id, {
                            type: 'new_message',
                            message: data.message
                        }, ws);
                    }
                    break;

                case 'delete_message':
                    if (data.message && data.message.chat_id) {
                        broadcastToChat(data.message.chat_id, {
                            type: 'delete_message',
                            message: data.message
                        }, ws);
                    }
                    break;

                case 'pin_message':
                    if (data.message && data.message.chat_id) {
                        broadcastToChat(data.message.chat_id, {
                            type: 'pin_message',
                            message: data.message
                        }, ws);
                    }
                    break;

                case 'call_offer':
                    console.log(`Call offer in chat ${data.data.chat_id} from ${currentUser}`);
                    
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_offer',
                        data: {
                            chat_id: data.data.chat_id,
                            offer: data.data.offer,
                            callType: data.data.callType || 'audio',
                            caller_id: currentUser,
                            caller_name: currentUserName
                        }
                    }, ws);
                    break;

                case 'call_answer':
                    console.log(`Call answer in chat ${data.data.chat_id} from ${currentUser}`);
                    
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_answer',
                        data: {
                            chat_id: data.data.chat_id,
                            answer: data.data.answer,
                            user_id: currentUser,
                            user_name: currentUserName
                        }
                    }, ws);
                    break;

                case 'call_ice':
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_ice',
                        data: {
                            chat_id: data.data.chat_id,
                            candidate: data.data.candidate,
                            user_id: currentUser
                        }
                    }, ws);
                    break;

                case 'call_end':
                    console.log(`Call ended in chat ${data.data.chat_id} by ${currentUser}`);
                    
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_end',
                        data: {
                            chat_id: data.data.chat_id,
                            user_id: currentUser,
                            user_name: currentUserName
                        }
                    }, ws);
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;

                case 'pong':
                    if (currentUser) {
                        const client = clients.get(currentUser);
                        if (client) {
                            client.lastPing = Date.now();
                        }
                    }
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected:', currentUser);
        handleUserDisconnect(currentUser);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function handleUserDisconnect(userId) {
    if (!userId) return;
    
    // Удаляем пользователя из всех чатов
    chatRooms.forEach((users, chatId) => {
        if (users.has(userId)) {
            users.delete(userId);
            
            // Уведомляем остальных об изменении списка онлайн
            broadcastToChat(chatId, {
                type: 'online_users',
                users: getOnlineUsersInChat(chatId)
            });
        }
    });
    
    clients.delete(userId);
}

function getOnlineUsersInChat(chatId) {
    const room = chatRooms.get(chatId);
    if (!room) return [];
    
    const onlineUsers = [];
    room.forEach(userId => {
        const clientData = clients.get(userId);
        if (clientData && clientData.ws.readyState === WebSocket.OPEN) {
            onlineUsers.push({
                id: userId,
                name: clientData.userName || `User ${userId}`
            });
        }
    });
    
    return onlineUsers;
}

function broadcastToChat(chatId, message, excludeWs = null) {
    const room = chatRooms.get(chatId);
    if (!room) {
        console.log(`No room found for chat ${chatId}`);
        return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    room.forEach(userId => {
        const clientData = clients.get(userId);
        if (clientData && 
            clientData.ws !== excludeWs && 
            clientData.ws.readyState === WebSocket.OPEN) {
            try {
                clientData.ws.send(messageStr);
                sentCount++;
            } catch (error) {
                console.error(`Error sending to user ${userId}:`, error);
            }
        }
    });

    if (sentCount > 0) {
        console.log(`Broadcast to chat ${chatId}: ${message.type} sent to ${sentCount} users`);
    }
}

// Пинг для поддержания соединения
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, PING_INTERVAL);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});