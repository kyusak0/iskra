'use client'

import MainLayout from "../../layouts/MainLayout"
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

import ChatWindow from './[cid]/page';
import ContextMenu from "../../components/contextMenu/ContextMenu";
import Popup from "../../components/popup/Popup";
import { useAuth } from "../../context/authContext";
import { useRouter } from "next/navigation";

const BASE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:8001/storage/';

export default function Friends() {
    const [senderId, setSenderId] = useState(0);
    const [chatId, setChatId] = useState(0);
    const [isSelectedChat, setIsSelectedChat] = useState(false);

    const [creatingData, setCreatingData] = useState({
        title: '',
        bio: '',
        type: 'public'
    });

    const { user, loading, post, get } = useAuth();
    const router = useRouter();

    // Состояние для поиска
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState('all'); // all, public, private

    if (!user && !loading) {
        router.push('/unauth');
    }

    const chatSelect = (chat) => {
        if (!chat.id) {
            return;
        }
        setChatId(chat.id);
        setIsSelectedChat(true);
    }

    const [file, setFile] = useState(null);
    const [chats, setChats] = useState([]);
    const [isCreating, setIsCreating] = useState(false);

    const generateChatUrl = (title) => {
        const translit = (text) => {
            const ru = {
                'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
                'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
                'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
                'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
                'я': 'ya'
            };

            return text.toLowerCase().split('').map(char => ru[char] || char).join('');
        };

        let url = translit(title)
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);

        return `${url}-${timestamp}-${random}`;
    };

    const createChat = async (e) => {
        e.preventDefault();
        setIsCreating(true);

        try {
            let loadFile = null;

            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('author_id', user.id);
                loadFile = await post('/load-file', formData);
            }

            const chatUrl = generateChatUrl(creatingData.title);

            const newData = {
                ...creatingData,
                owner_id: user.id,
                avatar: loadFile?.data?.name,
                url: chatUrl
            };

            console.log('Creating chat with data:', newData);
            const res = await post("/create-chat", newData);

            const createdChat = res.data;
            const newChat = {
                id: createdChat.id,
                title: createdChat.title,
                bio: createdChat.bio,
                source: createdChat.avatar || loadFile?.data?.name,
                type: createdChat.type,
                url: createdChat.url,
                created_at: new Date(createdChat.created_at).toLocaleString(),
                member_length: createdChat?.members?.length || 1,
                members: createdChat?.members || [{ id: user.id }],
                lastMess: null,
                lastMess_img: null,
                lastMessTime: ''
            };

            setChats(prev => [newChat, ...prev]);

            setCreatingData({ title: '', bio: '', type: 'public' });
            setFile(null);

            document.getElementById('closePopup')?.click();

            alert('Чат успешно создан! Ссылка: ' + chatUrl);

        } catch (error) {
            console.error('Error creating chat:', error);
            alert('Ошибка при создании чата: ' + error.message);
        } finally {
            setIsCreating(false);
        }
    };

   
    const showChats = async () => {
        if (!user?.id) return;
    
        try {
            const res = await get("/get-chats");
    
            const newChats = (res?.data || []).map((element) => {
                const sortedMessages = [...(element.messages || [])].sort(
                    (a, b) => new Date(a.created_at) - new Date(b.created_at)
                );
    
                const lastMessage = sortedMessages[sortedMessages.length - 1];
    
                let displayTitle = element.title || 'Личный чат';
    
                if (element.type === 'personal' && Array.isArray(element.members)) {
                    const otherMember = element.members.find(
                        (m) => Number(m.id) !== Number(user.id)
                    );
    
                    if (otherMember?.name) {
                        displayTitle = otherMember.name;
                    }
                }
    
                return {
                    id: element.id,
                    title: displayTitle,
                    bio: element.bio,
                    source: element.type === 'personal'
                        ? element.members?.find((m) => Number(m.id) !== Number(user.id))?.avatar
                        : element.avatar,
                    type: element.type,
                    url: element.url,
                    created_at: new Date(element.created_at).toLocaleString(),
                    member_length: element.members?.length || 0,
                    members: element.members || [],
                    lastMess: lastMessage?.content || '',
                    lastMess_img: lastMessage?.source?.name || null,
                    lastMessTime: lastMessage?.created_at
                        ? new Date(lastMessage.created_at).toLocaleString()
                        : '',
                };
            });
    
            setChats(newChats);
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    };

    useEffect(() => {
        if (user?.id) {
            showChats();
        }
    }, [user?.id]);

    // Фильтрация чатов по поиску
    const filteredChats = useMemo(() => {
        return chats.filter(chat => {
            // Фильтр по типу
            if (searchType !== 'all' && chat.type !== searchType) {
                return false;
            }

            // Фильтр по поисковому запросу
            if (searchQuery.trim() === '') {
                return true;
            }

            const query = searchQuery.toLowerCase().trim();

            // Поиск по названию
            const titleMatch = chat.title.toLowerCase().includes(query);

            // Поиск по описанию
            const bioMatch = chat.bio?.toLowerCase().includes(query) || false;

            // Поиск по ссылке
            const urlMatch = chat.url?.toLowerCase().includes(query) || false;

            // Поиск по участникам (можно добавить позже)

            return titleMatch || bioMatch || urlMatch;
        });
    }, [chats, searchQuery, searchType]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'type') {
            setCreatingData({ ...creatingData, type: value });
        } else {
            setCreatingData({ ...creatingData, [name]: value });
        }
    };

    const copyChatLink = (url) => {
        const fullUrl = `${window.location.origin}/chats/${url}`;
        navigator.clipboard.writeText(fullUrl);
        alert('Ссылка на чат скопирована!');
    };

    return (
        <MainLayout>
            <div className="w-full flex items-center border-r-2 border-main">
                <div className="overflow-auto max-lg:w-full lg:resize-x lg:min-w-1/4 lg:max-w-full">
                    <div className="flex justify-around items-center">
                        <h2 className="text-lg font-bold my-4">Чаты</h2>
                        <Popup
                            id="settingsChat"
                            openTrigger={<button className="px-3 py-1 bg-main text-white rounded-md">Создать чат</button>}
                        >
                            <h3 className="text-xl mb-4">Создание чата</h3>
                            <form className="w-full flex flex-col gap-5" onSubmit={createChat}>
                                {/* Аватар */}
                                <div className="flex items-center gap-3">
                                    <input
                                        type="file"
                                        name="source"
                                        id="source"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setFile(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor="source"
                                        className="px-4 py-2 bg-gray-200 rounded-md cursor-pointer hover:bg-gray-300"
                                    >
                                        Выбрать аватар
                                    </label>
                                    {file && (
                                        <span className="text-sm truncate max-w-[200px]">
                                            {file.name}
                                        </span>
                                    )}
                                </div>

                                {/* Название чата */}
                                <input
                                    type="text"
                                    name="title"
                                    value={creatingData.title}
                                    className="px-3 py-2 border-2 border-main rounded-md"
                                    onChange={handleChange}
                                    placeholder="Название чата *"
                                    required
                                />

                                {/* Описание */}
                                <textarea
                                    name="bio"
                                    value={creatingData.bio}
                                    className="px-3 py-2 border-2 border-main rounded-md min-h-[100px]"
                                    onChange={handleChange}
                                    placeholder="Описание чата (необязательно)"
                                />

                                {/* Тип чата */}
                                <div className="w-full">
                                    <h3 className="font-semibold mb-2">Тип чата</h3>
                                    <div className="flex flex-col gap-3">
                                        <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="radio"
                                                name="type"
                                                value="public"
                                                checked={creatingData.type === 'public'}
                                                onChange={handleChange}
                                                className="w-4 h-4"
                                            />
                                            <div>
                                                <span className="font-medium">Публичный</span>
                                                <p className="text-xs text-gray-500">
                                                    Чат доступен всем пользователям. Можно найти через поиск.
                                                </p>
                                            </div>
                                        </label>

                                        <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="radio"
                                                name="type"
                                                value="private"
                                                checked={creatingData.type === 'private'}
                                                onChange={handleChange}
                                                className="w-4 h-4"
                                            />
                                            <div>
                                                <span className="font-medium">Приватный</span>
                                                <p className="text-xs text-gray-500">
                                                    Чат доступен только по ссылке-приглашению.
                                                </p>
                                            </div>
                                        </label>

                                        {/* <label className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="radio"
                                                name="type"
                                                value="personal"
                                                checked={creatingData.type === 'personal'}
                                                onChange={handleChange}
                                                className="w-4 h-4"
                                            />
                                            <div>
                                                <span className="font-medium">Личный</span>
                                                <p className="text-xs text-gray-500">
                                                    Чат для общения с конкретным пользователем.
                                                </p>
                                            </div>
                                        </label> */}
                                    </div>
                                </div>

                                {/* Предпросмотр ссылки */}
                                {creatingData.title && (
                                    <div className="p-3 bg-gray-100 rounded-md">
                                        <p className="text-sm font-medium mb-1">Ссылка на чат:</p>
                                        <p className="text-xs text-gray-600 break-all">
                                            {window.location.origin}/chats/{generateChatUrl(creatingData.title)}
                                        </p>
                                    </div>
                                )}

                                {/* Кнопки */}
                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={isCreating || !creatingData.title.trim()}
                                        className="flex-1 px-4 py-2 bg-main text-white rounded-md hover:bg-opacity-80 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {isCreating ? 'Создание...' : 'Создать чат'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreatingData({ title: '', bio: '', type: 'public' });
                                            setFile(null);
                                        }}
                                        className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                                    >
                                        Очистить
                                    </button>
                                </div>
                            </form>
                        </Popup>
                    </div>

                    {/* Поиск */}
                    <div className="px-3 py-4 border-b">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Поиск чатов..."
                                className="w-full px-4 py-2 pl-10 border rounded-md focus:outline-none focus:border-main"
                            />
                            <svg
                                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Фильтры по типу */}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => setSearchType('all')}
                                className={`px-3 py-1 rounded-full text-sm ${searchType === 'all'
                                    ? 'bg-main text-white'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                Все
                            </button>
                            <button
                                onClick={() => setSearchType('public')}
                                className={`px-3 py-1 rounded-full text-sm ${searchType === 'public'
                                    ? 'bg-main text-white'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                Публичные
                            </button>
                            <button
                                onClick={() => setSearchType('private')}
                                className={`px-3 py-1 rounded-full text-sm ${searchType === 'private'
                                    ? 'bg-main text-white'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                Приватные
                            </button>

                            <button
                                onClick={() => setSearchType('personal')}
                                className={`px-3 py-1 rounded-full text-sm ${searchType === 'personal'
                                    ? 'bg-main text-white'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                    }`}
                            >
                                Личные
                            </button>
                        </div>

                        {/* Результаты поиска */}
                        {searchQuery && (
                            <div className="mt-2 text-sm text-gray-500">
                                Найдено чатов: {filteredChats.length}
                            </div>
                        )}
                    </div>

                    {/* Список чатов */}
<div className="h-96 overflow-y-auto w-full">
    {filteredChats.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'Чаты не найдены' : 'Нет доступных чатов'}
        </div>
    ) : (
        filteredChats.map((chat) => {
            const canOpen =
                chat.type === 'public' ||
                (chat.members || []).some((m) => Number(m.id) === Number(user?.id));

            if (!canOpen) return null;

            const chatHref = `/chats/${chat.type === 'personal' ? chat.id : chat.url}`;

            return (
                <div key={chat.id} className="w-full">
                    <div className="max-lg:hidden lg:block">
                        <a
                            href={chatHref}
                            className={`block px-3 py-4 rounded w-full flex items-center gap-3 cursor-pointer ${
                                chat.id === chatId
                                    ? 'bg-main/20 border border-main'
                                    : 'hover:bg-fg/20'
                            }`}
                        >
                            {/* Аватар */}
                            {chat.source ? (
                                <img
                                    src={`${BASE_URL}${chat.source}`}
                                    alt={chat.title}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full flex justify-center items-center bg-main text-bg uppercase font-bold text-lg">
                                    {chat.title ? chat.title[0] : ''}
                                </div>
                            )}

                            {/* Информация о чате */}
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold truncate">
                                            {chat.title}
                                        </span>

                                        {chat.type === 'private' && (
                                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full">
                                                Приватный
                                            </span>
                                        )}

                                        {chat.type === 'public' && (
                                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                                                Публичный
                                            </span>
                                        )}
                                    </div>

                                    <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                                        {chat.lastMessTime || chat.created_at}
                                    </span>
                                </div>

                                {/* Последнее сообщение */}
                                <div className="text-sm text-gray-600 truncate mt-1">
                                    {chat.lastMess_img ? (
                                        <div className="flex items-center gap-1">
                                            <span>📷</span>
                                            {chat.lastMess && <span>{chat.lastMess}</span>}
                                        </div>
                                    ) : (
                                        chat.lastMess || 'Нет сообщений'
                                    )}
                                </div>

                                {/* Количество участников и ссылка */}
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    <span>👥 {chat.member_length}</span>

                                    {chat.type === 'private' && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                copyChatLink(chat.url);
                                            }}
                                            className="text-main hover:underline"
                                        >
                                            🔗 Копировать ссылку
                                        </button>
                                    )}
                                </div>
                            </div>
                        </a>
                    </div>

                    {/* Мобильная версия */}
                    <div className="max-lg:block lg:hidden">
                        <Link
                            href={chatHref}
                            className={`flex px-3 py-4 rounded w-full items-center gap-3 ${
                                chat.id === chatId
                                    ? 'bg-blue-100 border border-blue-300'
                                    : 'hover:bg-fg/20'
                            }`}
                        >
                            {chat.source ? (
                                <img
                                    src={`${BASE_URL}${chat.source}`}
                                    alt={chat.title}
                                    className="w-12 h-12 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full flex justify-center items-center bg-main text-bg uppercase font-bold text-lg">
                                    {chat.title ? chat.title[0] : ''}
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <p className="flex justify-between items-center">
                                    <span className="font-semibold truncate">{chat.title}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                        {chat.lastMessTime || chat.created_at}
                                    </span>
                                </p>

                                <div className="text-sm text-gray-600 truncate">
                                    {chat.lastMess_img ? (
                                        <div className="flex items-center gap-1">
                                            <span>📷</span>
                                            {chat.lastMess && <span>{chat.lastMess}</span>}
                                        </div>
                                    ) : (
                                        chat.lastMess || 'Нет сообщений'
                                    )}
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            );
        })
    )}
</div>
</div>

{/* Окно чата */}
<div className="w-full max-lg:hidden">
    {isSelectedChat ? (
        <ChatWindow key={chatId} chat_id={chatId} />
    ) : (
        <div className="flex items-center justify-center h-full">
            <span className="p-5 rounded-md bg-main/20 text-center">
                Выберите чат для начала общения
            </span>
        </div>
    )}
</div>
</div>
</MainLayout>
)
}