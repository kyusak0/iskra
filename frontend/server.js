// Добавьте обработку ошибок и восстановление соединения
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Хранилище подключений
const clients = new Map(); // userId -> { ws, lastPing }
const chatRooms = new Map(); // chatId -> Set of userIds
const userChats = new Map(); // userId -> Set of chatIds

// Обработка ping/pong для обнаружения мертвых соединений
const PING_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 60000;

wss.on('connection', (ws, req) => {
    console.log('New client connected from:', req.socket.remoteAddress);
    let currentUser = null;
    let currentChat = null;
    
    // Устанавливаем таймаут для соединения
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data.type, 'from user:', currentUser);

            switch (data.type) {
                case 'join_chat':
                    const { user_id, chat_id } = data;
                    currentUser = user_id;
                    currentChat = chat_id;
                    
                    // Сохраняем соединение
                    clients.set(user_id, { ws, lastPing: Date.now() });
                    
                    // Добавляем в комнату чата
                    if (!chatRooms.has(chat_id)) {
                        chatRooms.set(chat_id, new Set());
                    }
                    chatRooms.get(chat_id).add(user_id);
                    
                    // Сохраняем связь пользователь-чаты
                    if (!userChats.has(user_id)) {
                        userChats.set(user_id, new Set());
                    }
                    userChats.get(user_id).add(chat_id);
                    
                    console.log(`User ${user_id} joined chat ${chat_id}`);
                    
                    // Уведомляем других участников
                    broadcastToChat(chat_id, {
                        type: 'user_joined',
                        data: {
                            user_id,
                            chat_id,
                            timestamp: new Date().toISOString()
                        }
                    }, ws);
                    break;

                case 'new_message':
                    const { message: msgData } = data;
                    // Валидация сообщения
                    if (!msgData.content && !msgData.source_id) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            error: 'Message content or source is required'
                        }));
                        return;
                    }
                    
                    broadcastToChat(msgData.chat_id, {
                        type: 'new_message',
                        message: {
                            ...msgData,
                            timestamp: new Date().toISOString()
                        }
                    }, ws);
                    
                    // Сохраняем в историю (если нужно)
                    // saveMessageToHistory(msgData);
                    break;

                case 'typing':
                    // Индикатор набора текста
                    broadcastToChat(data.chat_id, {
                        type: 'typing',
                        user_id: currentUser,
                        chat_id: data.chat_id,
                        is_typing: data.is_typing
                    }, ws);
                    break;

                case 'mark_read':
                    // Отметка о прочтении
                    broadcastToChat(data.chat_id, {
                        type: 'mark_read',
                        user_id: currentUser,
                        chat_id: data.chat_id,
                        message_id: data.message_id
                    }, ws);
                    break;

                case 'delete_message':
                    broadcastToChat(data.message.chat_id, {
                        type: 'delete_message',
                        message: data.message
                    }, ws);
                    break;

                case 'pin_message':
                    broadcastToChat(currentChat, {
                        type: 'pin_message',
                        message: data.message
                    }, ws);
                    break;

                // Звонки с улучшенной обработкой
                case 'call_offer':
                    console.log(`Call offer in chat ${data.data.chat_id}`);
                    // Проверяем, не занят ли кто-то уже звонком
                    if (isCallActive(data.data.chat_id)) {
                        ws.send(JSON.stringify({
                            type: 'call_busy',
                            data: { chat_id: data.data.chat_id }
                        }));
                        return;
                    }
                    
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_offer',
                        data: {
                            chat_id: data.data.chat_id,
                            offer: data.data.offer,
                            callType: data.data.callType || 'audio',
                            caller_id: currentUser
                        }
                    }, ws);
                    break;

                case 'call_answer':
                    console.log(`Call answer in chat ${data.data.chat_id}`);
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_answer',
                        data: {
                            chat_id: data.data.chat_id,
                            answer: data.data.answer,
                            user_id: currentUser
                        }
                    }, ws);
                    break;

                case 'call_ice':
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_ice',
                        data: {
                            chat_id: data.data.chat_id,
                            candidate: data.data.candidate
                        }
                    }, ws);
                    break;

                case 'call_end':
                    console.log(`Call ended in chat ${data.data.chat_id}`);
                    broadcastToChat(data.data.chat_id, {
                        type: 'call_end',
                        data: {
                            chat_id: data.data.chat_id,
                            user_id: currentUser
                        }
                    }, ws);
                    break;

                case 'pong':
                    // Обновляем время последнего ответа
                    if (currentUser) {
                        const client = clients.get(currentUser);
                        if (client) {
                            client.lastPing = Date.now();
                        }
                    }
                    break;

                default:
                    console.log('Unknown message type:', data.type);
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Unknown message type'
                    }));
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Invalid message format'
            }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected:', currentUser);
        if (currentUser) {
            // Удаляем из всех чатов
            const userChatsList = userChats.get(currentUser) || new Set();
            userChatsList.forEach(chatId => {
                const room = chatRooms.get(chatId);
                if (room) {
                    room.delete(currentUser);
                    
                    // Уведомляем других о выходе
                    broadcastToChat(chatId, {
                        type: 'user_left',
                        data: {
                            user_id: currentUser,
                            chat_id: chatId,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            });
            
            clients.delete(currentUser);
            userChats.delete(currentUser);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Функция для проверки активности звонка
function isCallActive(chatId) {
    // Реализуйте логику проверки активного звонка
    return false;
}

// Функция для рассылки сообщения всем участникам чата
function broadcastToChat(chatId, message, senderWs = null) {
    const room = chatRooms.get(chatId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    room.forEach(userId => {
        const clientData = clients.get(userId);
        if (clientData && clientData.ws !== senderWs && clientData.ws.readyState === WebSocket.OPEN) {
            try {
                clientData.ws.send(messageStr);
                sentCount++;
            } catch (error) {
                console.error(`Error sending to user ${userId}:`, error);
            }
        }
    });

    console.log(`Broadcast to chat ${chatId}: sent to ${sentCount} users`);
}

// Функция для отправки личного сообщения
function sendToUser(userId, message) {
    const clientData = clients.get(userId);
    if (clientData && clientData.ws.readyState === WebSocket.OPEN) {
        clientData.ws.send(JSON.stringify(message));
        return true;
    }
    return false;
}

// Пинг для поддержания соединения и проверки живых соединений
setInterval(() => {
    clients.forEach((clientData, userId) => {
        const { ws, lastPing } = clientData;
        
        // Проверяем, не умерло ли соединение
        if (Date.now() - lastPing > CONNECTION_TIMEOUT) {
            console.log(`Terminating inactive connection for user ${userId}`);
            ws.terminate();
            clients.delete(userId);
            return;
        }
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    });
}, PING_INTERVAL);

// Очистка пустых комнат
setInterval(() => {
    chatRooms.forEach((users, chatId) => {
        if (users.size === 0) {
            chatRooms.delete(chatId);
        }
    });
}, 60000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
    console.log(`Ping interval: ${PING_INTERVAL}ms`);
    console.log(`Connection timeout: ${CONNECTION_TIMEOUT}ms`);
});