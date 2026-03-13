import { WebSocket, WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 5000 });

// Хранилище клиентов с информацией о чатах
const clients = new Map(); // key: ws, value: { chatId: number, userId: number }

wss.on('connection', function (ws) {
    console.log('New client connected');

    // Отправляем приветствие новому клиенту
    ws.send(JSON.stringify({
        type: 'system',
        message: 'Welcome to chat!'
    }));

    // Уведомляем других о новом пользователе
    broadcastMessage({
        type: 'system',
        message: 'New user joined'
    }, ws);

    ws.on('message', function (data) {
        try {
            console.log('Received:', data.toString());

            const messageData = JSON.parse(data.toString());

            if (messageData.type === 'join_chat') {
                clients.set(ws, {
                    chatId: messageData.data.chat_id,
                    userId: messageData.data.user_id
                });
                console.log(`User ${messageData.data.user_id} joined chat ${messageData.data.chat_id}`);
                return;
            }

            if (messageData.type === 'delete_message') {
                console.log(`Deleting message ${messageData.data.message_id} in chat ${messageData.data.chat_id}`);

                broadcastToChat(messageData.data.chat_id, {
                    type: 'message_deleted',
                    data: {
                        message_id: messageData.data.message_id,
                        chat_id: messageData.data.chat_id
                    }
                }, ws);
                return;
            }
            // Запрос на звонок
            if (messageData.type === 'call_request') {
                broadcastToChat(messageData.data.chat_id, {
                    type: 'incoming_call',
                    data: messageData.data
                }, ws);
                return;
            }

            // WebRTC offer
            if (messageData.type === 'call_offer') {
                broadcastToChat(messageData.data.chat_id, {
                    type: 'call_offer',
                    data: messageData.data
                }, ws);
                return;
            }

            // WebRTC answer
            if (messageData.type === 'call_answer') {
                broadcastToChat(messageData.data.chat_id, {
                    type: 'call_answer',
                    data: messageData.data
                }, ws);
                return;
            }

            // ICE candidates
            if (messageData.type === 'call_ice') {
                broadcastToChat(messageData.data.chat_id, {
                    type: 'call_ice',
                    data: messageData.data
                }, ws);
                return;
            }

            // завершение звонка
            if (messageData.type === 'call_end') {
                broadcastToChat(messageData.data.chat_id, {
                    type: 'call_end',
                    data: messageData.data
                }, ws);
                return;
            }


            broadcastMessage(messageData, ws);

        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process message'
            }));
        }
    });

    ws.on('close', function () {
        console.log('Client disconnected');

        const clientInfo = clients.get(ws);
        if (clientInfo) {
            broadcastToChat(clientInfo.chatId, {
                type: 'system',
                message: `User ${clientInfo.userId} left the chat`
            }, ws);

            clients.delete(ws);
        }
    });
});

function broadcastMessage(data, excludeWs = null) {
    const message = JSON.stringify(data);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
            client.send(message);
        }
    });
}

function broadcastToChat(chatId, data, excludeWs = null) {
    const message = JSON.stringify(data);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
            const clientInfo = clients.get(client);
            if (clientInfo && clientInfo.chatId === chatId) {
                client.send(message);
            }
        }
    });
}
console.log('WebSocket server running on port 5000');