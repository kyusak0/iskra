'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
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
    const remoteAudioRef = useRef(null);
   
    const [incomingCall, setIncomingCall] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [callTime, setCallTime] = useState(0);


    const timerRef = useRef(null);
    const [chatId, setChatId] = useState(cid);
    const [messages, setMessages] = useState([]);
    const [content, setContent] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [answer, setAnswer] = useState();
    const [file, setFile] = useState(null);
    
    const peerRef = useRef(null);
    const localStreamRef = useRef(null);

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

                    content: element.content,
                    created_at: new Date(element.created_at).toLocaleTimeString(),

                    source: element.source,

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

    const [chatInfo, setChatInfo] = useState();
    const [isMember, setIsMember] = useState(false);

    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setCallTime(prev => prev + 1);
        }, 1000);
    };

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const stopTimer = () => {
        clearInterval(timerRef.current);
        setCallTime(0);
    };

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
        });

        setIsMember(res.data.members.filter(element => element.user.id == user?.id).length > 0)
    }



    useEffect(() => {
        wsRef.current = new WebSocket('ws://localhost:5001');

        wsRef.current.onopen = () => {
            setIsConnected(true);
        };

        wsRef.current.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'call_offer') {

                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                    peerRef.current = new RTCPeerConnection({
                        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
                    });

                    stream.getTracks().forEach(track => {
                        peerRef.current.addTrack(track, stream);
                    });

                    await peerRef.current.setRemoteDescription(data.data.offer);

                    const answer = await peerRef.current.createAnswer();
                    await peerRef.current.setLocalDescription(answer);

                    wsRef.current.send(JSON.stringify({
                        type: "call_answer",
                        data: {
                            chat_id: chatId,
                            answer: answer
                        }
                    }));
                }

                if (data.type === 'call_answer') {
                    await peerRef.current.setRemoteDescription(data.data.answer);
                }

                if (data.type === 'call_ice') {
                    await peerRef.current.addIceCandidate(data.data.candidate);
                }

                if (data.type === 'call_end') {
                    peerRef.current?.close();
                    setCallActive(false);
                }

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
        let voiceFile = null

        // Обработка обычного файла
        if (file) {
            const formData = {
                file: file,
                author_id: user.id
            }
            loadFile = await post('/load-file', formData);
        }

        // Обработка голосового сообщения
        if (recording) {
            const voiceFormData = new FormData();
            voiceFormData.append('file', recording.blob);
            voiceFormData.append('author_id', user.id);
            voiceFormData.append('type', 'voice');

            voiceFile = await post('/load-file', voiceFormData);
        }

        if (!isConnected) return;

        const messageContent = recording ? '🎤 Голосовое сообщение' : content;
        const tempId = Date.now();

        const optimisticMessage = {
            id: tempId,
            author_id: user.id,
            author_name: user.name || `User ${user.id}`,
            content: messageContent,
            source: loadFile?.data.name || voiceFile?.data.name,
            source_type: recording ? 'voice' : (loadFile ? 'file' : null),
            created_at: new Date().toLocaleTimeString(),
            isSending: true
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setContent("");
        setAnswer(null)
        setFile(null)
        setRecording(null) // очищаем голосовое сообщение после отправки

        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);

        try {
            const newData = {
                author_id: user.id,
                chat_id: chatId,
                content: content,
                answer_id: answer?.id || null,
                source_id: voiceFile?.data.id || loadFile?.data.id,
                source_type: recording ? 'voice' : (loadFile ? 'file' : null),
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
                            content: recording ? '🎤 Голосовое сообщение' : res.data?.content,
                            created_at: new Date(res.data.created_at).toLocaleTimeString(),
                            isSending: false,
                            answer_id: res.data?.answer_id,
                            answer_content: res.data.message?.content,
                            source: voiceFile?.data.name || loadFile?.data.name,
                            source_type: recording ? 'voice' : (loadFile ? 'file' : null),
                            source_url: recording ? voiceFile?.data.url : null, // URL для аудио
                        }
                        : msg
                )
            );

            if (wsRef.current && isConnected) {
                const messageData = {
                    type: 'new_message',
                    message: {
                        id: res.data.id,
                        content: recording ? '🎤 Голосовое сообщение' : res.data.content,
                        author_id: res.data.author_id,
                        author_name: user.name || `User ${user.id}`,
                        chat_id: res.data.chat_id,
                        created_at: res.data.created_at,
                        answer_id: res.data.answer_id,
                        answer_content: res.data.message?.content,
                        source: voiceFile?.data.name || loadFile?.data.name,
                        source_type: recording ? 'voice' : (loadFile ? 'file' : null),
                        source_url: recording ? voiceFile?.data.url : null,
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
    }, [window?.location.hash]);

    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const audioRefs = useRef({});

    const startRecording = async () => {
        try {
            setFile(null)
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;


            streamRef.current = stream;


            let chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                try {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    const url = URL.createObjectURL(blob);


                    const newRecording = {
                        id: Date.now(),
                        url: url,
                        blob: blob,
                        name: `recording-${new Date().toLocaleString()}.webm`,
                        timestamp: Date.now()
                    };


                    if (recording?.url) {
                        URL.revokeObjectURL(recording.url);
                    }


                    setRecording(newRecording);


                    if (streamRef.current) {
                        streamRef.current.getTracks().forEach(track => track.stop());
                    }





                    chunks = [];

                } catch (error) {
                    console.error('Ошибка при остановке записи:', error);
                }
            };


            mediaRecorder.start(1000);
            setIsRecording(true);

        } catch (error) {
            console.error('Ошибка доступа к микрофону:', error);
            alert('Не удалось получить доступ к микрофону. Пожалуйста, проверьте настройки микрофона.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const deleteRecording = (recordingToDelete) => {

        if (recordingToDelete?.url) {
            URL.revokeObjectURL(recordingToDelete.url);
        }


        if (recordingToDelete?.id && audioRefs.current[recordingToDelete.id]) {
            delete audioRefs.current[recordingToDelete.id];
        }


        setRecording(null);


        setPlayingId(null);
    };

    const subscribed = async () => {

        const tempId = Date.now();
        try {
            const data = {
                user_id: user?.id,
                chat_id: chatId,
            }
            const res = await post('/subscribe', data);
            console.log(res);

            const newData = {
                author_id: user.id,
                chat_id: chatId,
                content: `Пользователь ${user.name} присоединился к группе`,
            };

            const sendRes = await post("/send-message/chat", newData);

            setMessages(prev =>
                prev.map(msg =>
                    msg.id === tempId
                        ? {
                            id: sendRes.data.id,
                            author_id: sendRes.data.author_id,
                            author_name: user.name,
                            content: sendRes.data?.content,
                            created_at: new Date(sendRes.data.created_at).toLocaleTimeString(),
                            isSending: false,
                            answer_id: null,
                            answer_content: null,
                            source: null,
                            source_type: null,
                            source_url: null,
                        }
                        : msg
                )
            );

            setIsMember(true)
        } catch (err) {
            console.log(err.message)
        }

    }

    return (
        <div className="w-full"> 
          {isMember ? (
                <div className="w-full">
                    <div className="messages m-auto h-110 mb-4 max-h-180 overflow-y-auto p-2 w-full">
                        {messages.length === 0 ? (
                            <p className="text-gray-500 text-center p-4" onClick={() => { setContent('Здравствуйте') }}>Чат пуст! <br /> Поздороваться</p>
                        ) : (
                            messages.map(message => (
                                <div className={`w-full p-3 mb-2 rounded-md w-max
                            ${selectedMess == message.id ? 'shadow-lg shadow-main/50' : ''}
                            ${message.author_id === user?.id
                                        ? 'bg-sec ml-auto'
                                        : 'bg-main/30 mr-auto'
                                    }`} key={message.id}
                                    id={`${message.id}`}>
                                    <ContextMenu
                                        closing={closeContext}
                                        openTrigger={
                                            <div id={`${message.id}`} className="w-full text-foreground">
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
                                                    message.source?.type?.includes('image') ?
                                                        (
                                                            <img src={`${BASE_URL}${message.source.name}`} alt="" className="m-auto w-full max-lg:h-40 h-80" />
                                                        ) : message.source.type.includes('webm') ? (
                                                            <audio
                                                                src={`${BASE_URL}${message.source.name}`}
                                                                className="w-full mb-3 block min-w-[300px]"
                                                                onEnded={() => setPlayingId(null)}
                                                                controls
                                                            />
                                                        ) : ('не поддерживает предпросмотр')
                                                ) : (null)}

                                                <p className="mt-1">{message.content}</p>
                                                <p className="text-xs flex justify-end  right-0">
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
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {answer ? (
                        <div className="flex justify-between items-center mb-2 m-auto bg-main/20 px-2 py-1 rounded-md">
                            <a href={`#${answer?.id}`}>{answer?.content}</a>
                            <button onClick={() => { setAnswer(null) }}>❌</button>
                        </div>
                    ) : (null)}

                    {file ? (
                        <div className="flex justify-between items-center mb-2 m-auto bg-main/20 px-2 py-1 rounded-md">
                            {file?.name}
                            <button onClick={() => { setFile(null) }}>❌</button>
                        </div>
                    ) : (null)}

                    {recording ? (
                        <div
                            key={recording.id}
                            className="flex justify-between items-center mb-2 m-auto px-2 py-1 rounded-md"
                        >
                            <audio
                                ref={el => audioRefs.current[recording.id] = el}
                                src={recording?.url}
                                className="w-full mb-3"
                                onEnded={() => setPlayingId(null)}
                                controls
                            />

                            <button
                                onClick={() => deleteRecording(recording)}
                            >
                                ❌
                            </button>
                        </div>
                    ) : (null)}

                    <div className="w-full flex gap-5 items-center mt-10">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`rounded-md w-max px-2 py-1 text-4xl  ${isRecording
                                ? 'bg-red-500 '
                                : 'bg-main'
                                }`}
                        >
                            {isRecording ? <img src="/micro-record.svg" alt=""  className='m-auto w-10 h-10'/> : <img src="/micro.svg" alt="" className='w-10 h-10'/>}
                        </button>
                        <form onSubmit={handleSend} className='w-full flex flex-col gap-2'>
                            <div className="flex w-full justify-start gap-10 items-center">
                                <input
                                    type="text"
                                    value={content}
                                    name="content"
                                    onChange={(e) => setContent(e.target.value)}
                                    className='w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:border-main'
                                    placeholder="Комментировать..."
                                />

                                {!recording ? (<>
                                    <input type="file" name="source_com" id="source_com" className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setFile(e.target.files[0])
                                            }
                                        }}
                                    />
                                    <label htmlFor="source_com" className="text-4xl"><img src="/file.svg" alt=""  className='m-auto w-10 h-10'/></label>
                                </>) : (null)}

                                <button
                                type='button'
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`rounded-md w-max px-2 py-1 text-4xl  ${isRecording
                                ? 'bg-red-500 '
                                : 'bg-main'
                                }`}
                        >
                            {isRecording ? <img src="/micro-record.svg" alt=""  className='m-auto w-10 h-10'/> : <img src="/micro.svg" alt="" className='w-10 h-10'/>}
                        </button>



                                {isRecording ? (
                                    'Запись'
                                ) : (
                                    <button
                                        type='submit'
                                        className='text-xl p-3 bg-main text-white rounded-md disabled:bg-gray-400 min-w-20'
                                        disabled={!(content.trim() || file || recording)}
                                    >
                                        <img src="/send.svg" alt="" className='m-auto w-10 h-10'/>
                                    </button>
                                )}

                            </div>
                        </form>
                    </div>

                </div>
            ) : (
                <div className="relative h-[70vh]">
                    <div className="absolute bottom-0 left-0 w-full">
                        <div className="flex flex-col items-center gap-5">
                            <p>вы не состоите в этой группе. вступить?</p>
                            <button className="w-full btn rounded-md"
                                onClick={subscribed}
                            >Вступить</button>
                        </div>
                    </div>
                </div>
            )}



        </div >
    );
}