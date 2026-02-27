'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { MouseEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/authContext';
import ContextMenu from '../../../components/contextMenu/ContextMenu';
import Popup from '../../../components/popup/Popup';




export default function Chat({ chat_id }) {
    const params = useParams();
    let cid = params.cid;

    if (chat_id && chat_id !== cid) {
        cid = chat_id;
    }
    const [chatId, setChatId] = useState(cid);
    const [messages, setMessages] = useState([]);
    const [content, setContent] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [answer, setAnswer] = useState()

    const lastMessageCount = useRef(0);

    const { user, get, post } = useAuth();

    const getMessages = useCallback(async () => {
        if (!chatId || chatId === '0' || isLoading) return;

        try {
            setIsLoading(true);
            const res = await post("/get-messages/chat/" + chatId);

            if (res.data?.length !== lastMessageCount.current) {
                console.log(res.data)
                const newMessages = res.data.map(element => ({
                    id: element.id,
                    author_id: element.author_id,
                    author_name: element.user.name,
                    source: null,
                    content: element.content,
                    created_at: new Date(element.created_at).toLocaleTimeString(),

                    answer_content: element?.message?.content,
                    answer_id: element?.message?.id,
                }));

                setMessages(newMessages);
                lastMessageCount.current = res.data.length;
            }
        } catch (err) {
            console.error("Error loading messages:", err);
        } finally {
            setIsLoading(false);
        }
    }, [chatId, post]);

    useEffect(() => {
        wsRef.current = new WebSocket('ws://localhost:5000');

        wsRef.current.onopen = () => {
            setIsConnected(true);
        };

        wsRef.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'new_message' && data.message) {
                    setMessages(prev => {
                        if (prev.some(m => m.id === data.message.id)) {
                            return prev;
                        }

                        const newMess = {
                            id: data.message.id,
                            author_id: data.message.author_id,
                            source: null,
                            content: data.message.content,
                            created_at: new Date(data.message.created_at).toLocaleTimeString(),
                        };
                        return [...prev, newMess];
                    });
                } else if (data.type === 'delete_message') {
                    const messageId = data.message?.id

                    setMessages(prevMessages =>
                        prevMessages.filter(item => item.id !== messageId)
                    );

                }
            } catch (error) {
                console.log('Raw WebSocket message:', event.data);
            }
        };

        wsRef.current.onclose = () => {
            setIsConnected(false);
        };

        wsRef.current.onerror = (error) => {
            console.log('WebSocket error:', error);
            setIsConnected(false);
        };

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (isConnected && user && chatId && chatId !== '0') {
            wsRef.current?.send(JSON.stringify({
                type: 'join_chat',
                user_id: user.id,
                chat_id: chatId
            }));
        }
    }, [isConnected, user, chatId]);

    useEffect(() => {
        if (chatId && chatId !== '0') {
            getMessages();
        }
    }, [chatId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();

        if (!content.trim() || !isConnected) return;

        const messageContent = content;
        const tempId = Date.now();

        const optimisticMessage = {
            id: tempId,
            author_id: user.id,
            author_name: user.name || `User ${user.id}`,
            content: messageContent,
            created_at: new Date().toLocaleTimeString(),
            isSending: true
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setContent("");
        setAnswer(null)

        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        try {
            const newData = {
                author_id: user.id,
                chat_id: chatId,
                content: messageContent,
                answer_id: answer?.id || null
            };

            const res = await post("/send-message/chat", newData);

            console.log(res)

            setMessages(prev =>
                prev.map(msg =>
                    msg.id === tempId
                        ? {
                            id: res.data.id,
                            author_id: res.data.author_id,
                            author_name: user.name || `User ${user.id}`,
                            content: res.data.content,
                            created_at: new Date(res.data.created_at).toLocaleTimeString(),
                            isSending: false,
                            answer_id: res.data.answer_id,
                            answer_content: res.data.message.content
                        }
                        : msg
                )
            );

            if (wsRef.current && isConnected) {
                const messageData = {
                    type: 'new_message',
                    message: {
                        id: res.data.id,
                        content: res.data.content,
                        author_id: res.data.author_id,
                        author_name: user.name || `User ${user.id}`,
                        chat_id: res.data.chat_id,
                        created_at: res.data.created_at,
                        answer_id: res.data.answer_id,
                        answer_content: res.data.message.content
                    }
                };
                wsRef.current.send(JSON.stringify(messageData));
            }
        } catch (err) {
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
            alert(err.message);
        }
    };

    const joinChat = (chatId, userId) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'join_chat',
                data: {
                    chat_id: chatId,
                    user_id: userId
                }
            }));
        }
    };

    const deleteMess = async (message) => {
        // if (confirm('Вы уверены что хотите удалить данное сообщение? \nФункция восстановления недоступна на данный момент')) {
        await post('/delete-message', { message_id: message.id })

        setMessages(prevMessages => prevMessages.filter(item => item.id !== message.id));

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'delete_message',
                message: {
                    id: message.id,
                    chat_id: message.chat_id
                }
            }));
        }

        setCloseContext(true)
        // }

        // else {
        //     alert('Оп оп живем');
        // }
    }

    const [closeContext, setCloseContext] = useState(null)

    useEffect(() => {
        if (closeContext) {
            setCloseContext(false)
        }

    }, [closeContext])


    if (chatId == '0' || !chatId) {
        return
    }

    const [selectedMess, setSelectedMess] = useState(0)

    useEffect(() => {
        setTimeout(() => {
            if (window.location.hash) {
                history.replaceState(null, null, window.location.pathname + window.location.search);
                setSelectedMess(0)
            }
        }, 2000)
        const str = window.location.hash
        setSelectedMess(str.split('#')[1])
    }, [window?.location.hash])

    return (
        <div className="">
            <div className={`p-2 flex justify-evenly mb-4 text-white ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="max-lg:hidden">
                    <button onClick={() => { setChatId('0') }}>
                        Back
                    </button>
                </div>
                <div className="lg:hidden">
                    <Link href="/chats">
                        Back
                    </Link>
                </div>

                <p>WebSocket: {isConnected ? 'Connected' : 'Disconnected'}</p>
                <p>User ID: {user?.id}</p>
                <p>Chat ID: {chatId}</p>
                <p>Messages' count: {messages.length}</p>
            </div>

            <div className="messages m-auto h-110 mb-4 max-h-180 overflow-y-auto p-2 w-full">
                {messages.length === 0 ? (
                    <p className="text-gray-500 text-center p-4" onClick={() => { setContent('Здравствуйте') }}>Чат пуст! <br /> Поздороваться</p>
                ) : (
                    messages.map(message => (
                        <div className={`p-3 mb-2 rounded-md w-max
                            ${selectedMess == message.id ? 'shadow-lg shadow-main/50' : ''}
                            ${message.author_id === user?.id
                                ? 'bg-main/10 ml-auto'
                                : 'bg-gray-100 mr-auto'
                            }`} key={message.id}
                            id={`${message.id}`}>
                            <ContextMenu
                                closing={closeContext}
                                openTrigger={
                                    <div id={`${message.id}`} className="w-full">
                                        {message.author_id !== user?.id ? (
                                            <a
                                                href={`user/${message.author_id}`}
                                                className="text-sm font-semibold w-full ">
                                                {message.author_name}
                                            </a>
                                        ) : (null)}

                                        {message.answer_content ? (
                                            <div className='w-full'>
                                                <a
                                                    href={`#${message.answer_id}`}
                                                    onClick={() => {
                                                        setCloseContext(true);
                                                    }}
                                                    className={`w-full block border-l-2 rounded-l-md p-2 mb-2 ${message.author_id === user?.id
                                                            ? 'bg-main/20 border-main'
                                                            : 'bg-gray-200 border-gray-500'
                                                        }`}
                                                >
                                                    {message.answer_content}
                                                </a>
                                            </div>
                                        ) : null}

                                        <p className="text-gray-800 mt-1">{message.content}</p>
                                        <p className="text-xs text-gray-500 flex justify-end  right-0">
                                            {message.created_at}
                                        </p>
                                    </div>
                                }>
                                <div className="flex flex-col gap-2 items-start text-left">
                                    <button className='w-full text-left border-b-2 border-main'
                                        onClick={() => {
                                            setCloseContext(true)
                                            setAnswer({
                                                id: message.id,
                                                content: message.content,
                                            })
                                        }}>Ответить</button>
                                    <button
                                        className='w-full text-left border-b-2 border-main'
                                        onClick={() => deleteMess(message)}
                                    >Удалить</button>
                                    <button className='w-full text-left border-b-2 border-main'
                                        onClick={() => {
                                            navigator.clipboard.writeText(message.content);
                                            setCloseContext(true)
                                        }}
                                    >Копировать текст</button>
                                    <button className='w-full text-left border-b-2 border-main'>Закрепить</button>

                                    <Popup
                                        openTrigger={
                                            <button className='w-full text-left border-b-2 border-main'>Переслать</button>
                                        }>
                                        123
                                    </Popup>
                                </div>
                            </ContextMenu>
                        </div>

                    ))
                )
                }


                <div ref={messagesEndRef} />


            </div >
            {
                answer ? (
                    <div className="w-full flex justify-between" >
                        <a href={`#mess${answer?.id}`}>{answer?.content}</a>
                        <button onClick={() => { setAnswer(null) }}>❌</button>
                    </div>
                ) : (null)}



            <form onSubmit={handleSend} className='flex gap-2 items-center w-full'>
                <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className='p-3 border border-gray-300  rounded-md flex-1 focus:outline-none focus:border-main'
                    placeholder="Введите Ваше сообщение..."
                    disabled={!isConnected}
                />
                <button
                    type="submit"
                    className='text-xl p-3 bg-main text-white rounded-md disabled:bg-gray-400 min-w-20'
                    disabled={!isConnected || !content.trim()}
                >
                    ➤
                </button>
            </form>
        </div >
    );
}