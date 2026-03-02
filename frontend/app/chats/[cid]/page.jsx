'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { MouseEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/authContext';
import ContextMenu from '../../../components/contextMenu/ContextMenu';
import Popup from '../../../components/popup/Popup';

const BASE_URL = 'http://localhost:8001/storage/';


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
    const [answer, setAnswer] = useState();
    const [file, setFile] = useState(null);

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

                    source: element.source?.name,

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

    const [chatInfo, setChatInfo] = useState()

    const getChatInfo = async (chat_id) => {
        const res = await get(`/get-chat-info/${chat_id}`);
        console.log(res)

        setChatInfo({
            id: res.data.id,
            title: res.data.title,
            source: res.data.avatar,
            type: res.data.type,
            created_at: new Date(res.data.created_at).toLocaleString(),
            member_length: res.data.members.length,
            members: res.data.members,
        })
    }

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

            getChatInfo(chatId)
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

        let loadFile = null
        if (file) {
            const formData = {
                file: file,
                author_id: user.id
            }

            loadFile = await post('/load-file', formData);
        }

        if (!isConnected) return;

        const messageContent = content;
        const tempId = Date.now();

        const optimisticMessage = {
            id: tempId,
            author_id: user.id,
            author_name: user.name || `User ${user.id}`,
            content: messageContent,
            source: loadFile?.data.name,
            created_at: new Date().toLocaleTimeString(),
            isSending: true
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setContent("");
        setAnswer(null)
        setFile(null)

        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        try {
            const newData = {
                author_id: user.id,
                chat_id: chatId,
                content: messageContent,
                answer_id: answer?.id || null,
                source_id: loadFile?.data.id,
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
                            content: res.data?.content,
                            created_at: new Date(res.data.created_at).toLocaleTimeString(),
                            isSending: false,
                            answer_id: res.data?.answer_id,
                            answer_content: res.data.message?.content,
                            source: loadFile?.data.name,
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
                        answer_content: res.data.message.content,
                        source: loadFile.data.name,
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
        if (isConnected && window.location.hash) {
            setTimeout(() => {

                history.replaceState(null, null, window.location.pathname + window.location.search);
                setSelectedMess(0)

            }, 2000)
            const str = window.location.hash
            setSelectedMess(str.split('#')[1])
        }
    }, [window?.location.hash])

    return (
        <div className="w-full">
            <div className={`p-2 flex items-center mb-4 border-b-2 border-main`}>
                <div className="max-lg:hidden px-5">
                    <button onClick={() => { setChatId('0') }}>
                        ⬅
                    </button>
                </div>
                <div className="lg:hidden px-5">
                    <Link href="/chats">
                        ⬅
                    </Link>
                </div>
                <div className="flex gap-5 items-center">{
                    chatInfo?.source ? (
                        <img src={`${BASE_URL + chatInfo?.source}`} alt="" className='w-10 h-10 rounded-full' />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-main flex items-center justify-center font-bold uppercase text-bg"
                        >{chatInfo?.title[0]}</div>
                    )
                }
                    <p>
                        {chatInfo?.title}
                    </p></div>




            </div>

            <div className="messages m-auto h-110 mb-4 max-h-180 overflow-y-auto p-2 w-full">
                {messages.length === 0 ? (
                    <p className="text-gray-500 text-center p-4" onClick={() => { setContent('Здравствуйте') }}>Чат пуст! <br /> Поздороваться</p>
                ) : (
                    messages.map(message => (
                        <div className={`w-full p-3 mb-2 rounded-md w-max
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

                                        {message.source ? (
                                            <img src={`${BASE_URL}${message.source}`} alt="" className="m-auto w-full max-lg:h-40 h-80" />
                                        ) : (null)}

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
            <form onSubmit={(e) => handleSend(e, post.id)}
                className='w-full flex flex-col gap-2 mt-10'>
                {user ? (
                    <>
                        {answer ? (
                            <div className="flex justify-between">
                                <a href={`#${answer?.id}`}>{answer?.content}</a>
                                <button onClick={() => { setAnswer(null) }}>❌</button>
                            </div>
                        ) : (null)}

                        {file ? (
                            <div className="flex justify-between">
                                {file?.name}
                                <button onClick={() => { setFile(null) }}>❌</button>
                            </div>
                        ) : (null)}

                        <div className="flex w-full justify-start gap-10 items-center">
                            <input
                                type="text"
                                value={content}
                                name="content"
                                onChange={(e) => setContent(e.target.value)}
                                className='w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:border-main'
                                placeholder="Комментировать..."
                            />

                            <input type="file" name="source_com" id="source_com" className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setFile(e.target.files[0])
                                    }
                                }}
                            />
                            <label htmlFor="source_com" className="text-4xl rotate-45">📎</label>

                            <button
                                type="submit"
                                className='text-xl p-3 bg-main text-white rounded-md disabled:bg-gray-400 min-w-20'
                                disabled={!(content.trim() || file)}
                            >
                                ➤
                            </button>
                        </div>
                    </>
                ) : (
                    <p className="text-xl text-center">
                        Для того чтобы оставить Комментарий, нужно войти в аккаунт
                        <br />
                        <a href="/login" className="text-main">
                            Войти
                        </a>
                    </p>

                )}
            </form>
        </div >
    );
}