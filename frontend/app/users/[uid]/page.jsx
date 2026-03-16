'use client'

import { notFound, useParams } from "next/navigation"
import MainLayout from "../../../layouts/MainLayout";
import { useAuth } from "../../../context/authContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Popup from "../../../components/popup/Popup";

const BASE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:8001/storage/';

export default function ProfilePage() {
    const params = useParams();

    const [userData, setUserData] = useState(null);
    const router = useRouter()
    const [disable2FAOpen, setDisable2FAOpen] = useState(false);
    const [disableCode, setDisableCode] = useState();
    const [disableForm, setDisableForm] = useState({
        email: '',
        password: '',
        code: '',
    });
    const [disableLoading, setDisableLoading] = useState(false);
    const [disableError, setDisableError] = useState('');
    const [activeTab, setActiveTab] = useState('posts');
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [relationship, setRelationship] = useState(null);
    const [relationLoading, setRelationLoading] = useState(false);
    const [friendStats, setFriendStats] = useState({
        friends: 0,
        incoming_requests: 0,
        outgoing_requests: 0,
        blocked_users: 0,
    });

    const { user, get, post, loading } = useAuth()

    useEffect(() => {
        getUserInfo(params.uid);
    }, [params.uid]);

    const getUserInfo = async (userId) => {
        try {
            const res = await get('/user-info/' + userId);
            if (res.success) {
                setUserData({
                    id: res.data.id,
                    name: res.data.name,
                    avatar: res.data.avatar,
                    posts: res.data.posts,
                    google2fa_enabled: !!res.data.google2fa_enabled,
                    videos: res.data.videos || [],
                    reposts: res.data.reposts || [],
                    friends_count: res.data.friends_count || 0,
                });
            } else {
                notFound()
                // router.push('/404')
            }


        } catch (error) {
        }
    }


    const loadFriendRelation = async (userId) => {
        if (!user || String(user.id) === String(userId)) {
            setRelationship(null);
            return;
        }

        const res = await get(`/friends/relation/${userId}`, { silent: true });
        if (res?.success) {
            setRelationship(res.data);
        }
    };

    const loadFriendStats = async () => {
        if (!user) return;

        const res = await get('/friends/stats', { silent: true });
        if (res?.success && res.data) {
            setFriendStats(res.data);
        }
    };

    useEffect(() => {
        if (!user) {
            setRelationship(null);
            return;
        }

        if (String(user.id) === String(params.uid)) {
            loadFriendStats();
            setRelationship(null);
        } else {
            loadFriendRelation(params.uid);
        }
    }, [user, params.uid]);

    const handleFriendAction = async (endpoint) => {
        if (!userData?.id) return;

        setRelationLoading(true);
        try {
            const res = await post(endpoint, { user_id: userData.id });

            if (res?.success && res?.data) {
                setRelationship(res.data);
            }

            await getUserInfo(params.uid);
            if (user && String(user.id) === String(params.uid)) {
                await loadFriendStats();
            } else if (user) {
                await loadFriendRelation(params.uid);
            }
        } finally {
            setRelationLoading(false);
        }
    };

    const handleCreatePersonalChat = async () => {
        if (!user || !userData) return;

        setIsCreatingChat(true);
        try {
            // Отправляем запрос на создание/получение чата
            const res = await post('/get-or-create-personal-chat', {
                other_user_id: userData.id,
            });

            if (res.success && res.data?.id) {
                // Переходим в чат (существующий или новый)
                router.push(`/chats/${res.data.id}`);

                // Можно показать уведомление
                if (res.isNew) {
                    alert('Новый чат создан');
                } else {
                    // Просто переходим в существующий чат без уведомления
                }
            } else {
                console.error('Failed to get/create chat');
                alert('Не удалось создать чат');
            }
        } catch (error) {
            console.error('Error creating chat:', error);
            alert('Ошибка при создании чата');
        } finally {
            setIsCreatingChat(false);
        }
    };

    const handleDisableChange = (e) => {
        const { name, value } = e.target;

        setDisableForm((prev) => ({
            ...prev,
            [name]: name === 'code' ? value.replace(/\D/g, '') : value,
        }));
    };
    const handleDisable2FA = async (e) => {
        e.preventDefault();
        setDisableLoading(true);
        setDisableError('');

        try {
            const res = await post('/2fa/disable', disableForm);

            if (res.success === false) {
                setDisableError(res.error || 'Не удалось отключить 2FA');
                return;
            }

            setUserData((prev) => ({
                ...prev,
                google2fa_enabled: false,
            }));

            setDisableForm({
                email: '',
                password: '',
                code: '',
            });

            setDisable2FAOpen(false);
        } catch (error) {
            setDisableError(error.message || 'Ошибка отключения 2FA');
        } finally {
            setDisableLoading(false);
        }
    };

    const [file, setFile] = useState(null);

    const setAvatar = async (e) => {
        e.preventDefault()
        try {
            let loadFile = null
            if (file && file.type.includes('image')) {
                const formData = new FormData();
                formData.append('file', file);
                loadFile = await post('/load-file', formData);

                if (loadFile?.data?.name) {
                    const editUser = await post('/set-avatar', {
                        avatar: loadFile.data.name
                    });

                    if (editUser.success) {
                        setUserData(prev => ({
                            ...prev,
                            avatar: loadFile.data.name,
                        }));
                    }
                }
            }
        } catch (error) {
        }

    }

    // Фильтрация контента в зависимости от активной вкладки
    const getFilteredContent = () => {
        if (!userData) return [];

        switch (activeTab) {
            case 'posts':
                return userData.posts || [];
            case 'videos':
                return userData.videos || [];
            case 'reposts':
                return userData.reposts || [];
            default:
                return [];
        }
    };

    const isVideoFile = (source) => {
        if (!source || !source.name) return false;
        const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
        const extension = source.name.split('.').pop()?.toLowerCase();
        return videoExtensions.includes(extension);
    };

    const isImageFile = (source) => {
        if (!source || !source.name) return false;
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const extension = source.name.split('.').pop()?.toLowerCase();
        return imageExtensions.includes(extension);
    };

    const renderContent = () => {
        const content = getFilteredContent();

        if (activeTab === 'reposts') {
            return content.map((post, index) => (
                <div className="col-span-1 max-lg:col-span-3 border-2 border-main p-5 flex flex-col justify-center" key={post.id}>
                    <div className="flex gap-2 pb-2 items-center">
                        {post.source && post.source.type && post.source.type.includes('image') ? (
                            <img
                                src={`${BASE_URL+ post.link.includes('posts/') ? post.posts.source.name : post.videos.cover.name || post.source.name}`}
                                alt={post.title}
                                className="h-20 w-20 object-cover bg-gray-100"
                            />
                        ) : (
                            post.link.includes('posts/') ? (<div className="h-20 w-20 bg-gray-200 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>) : (<div className="h-20 w-20 bg-gray-200 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>)

                        )}
                        <div className="w-full">
                            <p className="lg:text-2xl max-lg:text-xl truncate">
                                {post.link.includes('posts/') ? post.posts.title : post.videos.title || 'Без названия'}
                            </p>

                            <p className="text-sm text-gray-600" title={post.desc}>
                                {post.link.includes('posts/') ? post.posts.desc : post.videos.desc || 'Нет описания'}
                            </p>
                        </div>
                    </div>
                    <a
                        href={`${post.link}`}
                        className="w-full px-2 py-1 bg-main text-white font-bold uppercase rounded-md text-center hover:bg-main-dark transition-colors"
                    >
                        {post.link.includes('posts/') ? 'читать пост' : 'Смотреть видео'}
                    </a>
                </div>
            ));
        }

        if (content.length === 0) {
            return (
                <div className="col-span-3 flex flex-col items-center justify-center py-10 text-gray-500">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xl font-semibold">
                        {activeTab === 'posts' ? 'Постов пока нет' : 'Видео пока нет'}
                    </p>
                    <p className="text-sm">
                        {activeTab === 'posts'
                            ? 'Когда пользователь опубликует пост, он появится здесь'
                            : 'Когда пользователь загрузит видео, оно появится здесь'}
                    </p>
                </div>
            );
        }

        if (activeTab === 'videos') {
            return content.map((source, index) => {
                const videoItem = source.videos && source.videos.name ? source.videos : source;

                return (
                    <div className="col-span-1 max-lg:col-span-3 border-2 border-main p-5 flex flex-col justify-center" key={source.id || index}>
                        <div className="flex gap-2 pb-2 items-center">
                            {videoItem.name && isVideoFile(videoItem) ? (
                                <video
                                    src={`${BASE_URL}${videoItem.source.name}`}
                                    className="h-20 w-20 object-cover bg-gray-100"
                                    controls={false}
                                    muted
                                >
                                    <source src={`${BASE_URL}${videoItem.name}`} type={`video/${videoItem.name.split('.').pop()}`} />
                                </video>
                            ) : (
                                <div className="h-20 w-20 bg-gray-200 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                            <div className="w-full">
                                <p className="lg:text-2xl max-lg:text-xl truncate">
                                    {videoItem.title || source.title || 'Без названия'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    {videoItem.desc || source.desc || 'Нет описания'}
                                </p>
                                {videoItem.name && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        {videoItem.name.split('.').pop()} • {((videoItem.size || 0) / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                )}
                            </div>
                        </div>
                        <a
                            href={`/videos/${source.url}`}
                            className="w-full px-2 py-1 bg-main text-white font-bold uppercase rounded-md text-center hover:bg-main-dark transition-colors"
                        >
                            смотреть видео
                        </a>
                    </div>
                );
            });
        }

        return content.map(post => (
            <div className="col-span-1 max-lg:col-span-3 border-2 border-main p-5 flex flex-col justify-center" key={post.id}>
                <div className="flex gap-2 pb-2 items-center">
                    {post.source && post.source.type && post.source.type.includes('image') ? (
                        <img
                            src={`${BASE_URL}${post.source.name}`}
                            alt={post.title}
                            className="h-20 w-20 object-cover bg-gray-100"
                        />
                    ) : (
                        <div className="h-20 w-20 bg-gray-200 flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}
                    <div className="w-full">
                        <p className="lg:text-2xl max-lg:text-xl truncate">
                            {post.title || 'Без названия'}
                        </p>
                        <p className="text-sm text-gray-600" title={post.desc}>
                            {post.desc || 'Нет описания'}
                        </p>
                    </div>
                </div>
                <a
                    href={`/posts/${post.url}`}
                    className="w-full px-2 py-1 bg-main text-white font-bold uppercase rounded-md text-center hover:bg-main-dark transition-colors"
                >
                    читать пост
                </a>
            </div>
        ));
    };

    // Проверяем, является ли просматриваемый профиль профилем текущего пользователя
    const isOwnProfile = user && String(user.id) === String(params.uid);

    const relationState = relationship || {
        relation: 'none',
        can_message: true,
        can_send_request: true,
        can_accept_request: false,
        can_decline_request: false,
        can_cancel_request: false,
        can_remove_friend: false,
        can_block: true,
        can_unblock: false,
    };

    const relationTextMap = {
        self: 'Это ваш профиль',
        none: 'Вы пока не в друзьях',
        friends: 'Вы уже друзья',
        outgoing_request: 'Заявка отправлена',
        incoming_request: 'У вас входящая заявка',
        blocked_by_me: 'Пользователь заблокирован вами',
        blocked_me: 'Пользователь заблокировал вас',
    };

    const relationText = relationTextMap[relationState.relation] || 'Вы пока не в друзьях';

    const renderProfileActions = () => {
        if (isOwnProfile || !user) {
            return null;
        }

        return (
            <div className="col-span-2 flex flex-col gap-3 items-center">
                {relationState.can_message && (
                    <button
                        onClick={handleCreatePersonalChat}
                        disabled={isCreatingChat || relationLoading}
                        className="px-6 py-2 bg-main text-white font-bold rounded-md hover:bg-main-dark transition-colors disabled:bg-gray-300 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {isCreatingChat ? 'Создание чата...' : 'Написать сообщение'}
                    </button>
                )}

                <div className="flex flex-wrap justify-center gap-3">
                    {relationState.can_send_request && (
                        <button
                            onClick={() => handleFriendAction('/friends/request')}
                            disabled={relationLoading}
                            className="px-4 py-2 bg-main text-white font-bold rounded-md hover:bg-main-dark transition-colors disabled:bg-gray-300"
                        >
                            Добавить в друзья
                        </button>
                    )}

                    {relationState.can_accept_request && (
                        <button
                            onClick={() => handleFriendAction('/friends/accept')}
                            disabled={relationLoading}
                            className="px-4 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-300"
                        >
                            Принять заявку
                        </button>
                    )}

                    {relationState.can_decline_request && (
                        <button
                            onClick={() => handleFriendAction('/friends/decline')}
                            disabled={relationLoading}
                            className="px-4 py-2 bg-gray-600 text-white font-bold rounded-md hover:bg-gray-700 transition-colors disabled:bg-gray-300"
                        >
                            Отклонить
                        </button>
                    )}

                    {relationState.can_cancel_request && (
                        <button
                            onClick={() => handleFriendAction('/friends/cancel')}
                            disabled={relationLoading}
                            className="px-4 py-2 bg-gray-600 text-white font-bold rounded-md hover:bg-gray-700 transition-colors disabled:bg-gray-300"
                        >
                            Отозвать заявку
                        </button>
                    )}

                    {relationState.can_remove_friend && (
                        <button
                            onClick={() => handleFriendAction('/friends/remove')}
                            disabled={relationLoading}
                            className="px-4 py-2 bg-amber-600 text-white font-bold rounded-md hover:bg-amber-700 transition-colors disabled:bg-gray-300"
                        >
                            Удалить из друзей
                        </button>
                    )}

                    {relationState.can_block && (
                        <button
                            onClick={() => handleFriendAction('/friends/block')}
                            disabled={relationLoading}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-300"
                        >
                            Заблокировать
                        </button>
                    )}

                    {relationState.can_unblock && (
                        <button
                            onClick={() => handleFriendAction('/friends/unblock')}
                            disabled={relationLoading}
                            className="px-4 py-2 bg-main text-white font-bold rounded-md hover:bg-main-dark transition-colors disabled:bg-gray-300"
                        >
                            Разблокировать
                        </button>
                    )}
                </div>

                <p className="text-sm text-gray-600 text-center">{relationText}</p>

                <button
                    type="button"
                    onClick={() => router.push('/friends')}
                    className="underline text-main hover:text-main-dark"
                >
                    Открыть раздел друзей
                </button>
            </div>
        );
    };

    return (
        <MainLayout>
            <div className="flex pb-2 flex-col items-center gap-5 border-b-2 border-main">
                <Popup
                    openTrigger={userData?.avatar ? (
                        <img src={`${BASE_URL + userData.avatar}`} alt="" className="w-20 h-20 rounded-full bg-main cursor-pointer hover:opacity-80 transition-opacity" />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-main text-4xl font-bold text-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                            {userData?.name ? userData.name[0] : '?'}
                        </div>
                    )}
                >
                    <form className="w-full flex flex-col gap-5 items-center" onSubmit={setAvatar}>
                        {userData?.avatar ? (
                            <img src={`${BASE_URL + userData.avatar}`} alt="" className="w-20 h-20 rounded-full bg-main" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-main text-4xl font-bold text-white flex items-center justify-center">
                                {userData?.name ? userData.name[0] : '?'}
                            </div>
                        )}
                        <h3 className="text-xl">
                            Загрузить аватар
                        </h3>
                        <input type="file" name="source" id="source" className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setFile(e.target.files[0])
                                }
                            }}
                        />
                        <div className="flex gap-5">
                            <label htmlFor="source"
                                className="underline text-main cursor-pointer hover:text-main-dark"
                            >Загрузить аватар</label>
                            {file?.name && <span className="text-gray-600">{file.name}</span>}
                        </div>
                        <button type="submit"
                            className="w-max px-4 py-2 bg-main text-white font-bold uppercase rounded-md text-center hover:bg-main-dark transition-colors disabled:bg-gray-300"
                            disabled={!file}
                        >Загрузить</button>
                    </form>
                </Popup>

                <h2 className="text-2xl">
                    {userData?.name}
                </h2>

                <div className="grid grid-cols-2 gap-5 text-center">
                    {isOwnProfile ? (
                        <div className="col-span-2 flex flex-col gap-3 items-center">
                            {!userData?.google2fa_enabled ? (
                                <button
                                    onClick={() => router.push(`/users/${params.uid}/2fa`)}
                                    className="px-4 py-2 bg-main text-white font-bold rounded-md hover:bg-main-dark transition-colors"
                                >
                                    Включить 2FA
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setDisable2FAOpen((prev) => !prev);
                                            setDisableError('');
                                            setDisableCode('');
                                        }}
                                        className="px-4 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition-colors"
                                    >
                                        Выключить 2FA
                                    </button>

                                    {disable2FAOpen && (
                                        <form
                                            onSubmit={handleDisable2FA}
                                            className="flex flex-col gap-3 w-full max-w-sm"
                                        >
                                            <input
                                                type="email"
                                                name="email"
                                                value={disableForm.email}
                                                onChange={handleDisableChange}
                                                placeholder="Введите email"
                                                className="w-full px-3 py-2 border-2 border-main rounded-md focus:outline-none focus:border-main-dark"
                                                required
                                            />

                                            <input
                                                type="password"
                                                name="password"
                                                value={disableForm.password}
                                                onChange={handleDisableChange}
                                                placeholder="Введите пароль"
                                                className="w-full px-3 py-2 border-2 border-main rounded-md focus:outline-none focus:border-main-dark"
                                                required
                                            />

                                            <input
                                                type="text"
                                                name="code"
                                                inputMode="numeric"
                                                maxLength={6}
                                                value={disableForm.code}
                                                onChange={handleDisableChange}
                                                placeholder="123456"
                                                className="w-full px-3 py-2 border-2 border-main rounded-md text-center text-xl tracking-[0.3em] focus:outline-none focus:border-main-dark"
                                                required
                                            />

                                            {disableError && (
                                                <p className="text-red-500 text-center">{disableError}</p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={
                                                    disableForm.code.length !== 6 ||
                                                    !disableForm.email ||
                                                    !disableForm.password ||
                                                    disableLoading
                                                }
                                                className="px-4 py-2 bg-main text-white font-bold rounded-md disabled:bg-gray-300 hover:bg-main-dark transition-colors"
                                            >
                                                {disableLoading ? 'Проверка...' : 'Подтвердить отключение'}
                                            </button>
                                        </form>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        renderProfileActions()
                    )}
                    <div className="col-span-1">друзей</div>
                    <div className="col-span-1">{isOwnProfile ? 'входящих заявок' : 'статус'}</div>

                    <div className="col-span-1 font-bold">{isOwnProfile ? friendStats.friends : (userData?.friends_count || 0)}</div>
                    <div className="col-span-1 font-bold text-sm">{isOwnProfile ? friendStats.incoming_requests : relationText}</div>

                </div>
            </div>

            {/* Табы для переключения между контентом */}
            <div className="flex justify-center gap-5 pt-5 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('posts')}
                    className={`pb-2 px-4 font-semibold transition-colors ${activeTab === 'posts'
                        ? 'text-main border-b-2 border-main'
                        : 'text-gray-500 hover:text-main'
                        }`}
                >
                    Посты ({userData?.posts?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('videos')}
                    className={`pb-2 px-4 font-semibold transition-colors ${activeTab === 'videos'
                        ? 'text-main border-b-2 border-main'
                        : 'text-gray-500 hover:text-main'
                        }`}
                >
                    Видео ({userData?.videos?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('reposts')}
                    className={`pb-2 px-4 font-semibold transition-colors ${activeTab === 'reposts'
                        ? 'text-main border-b-2 border-main'
                        : 'text-gray-500 hover:text-main'
                        }`}
                >
                    Репосты ({userData?.reposts?.length || 0})
                </button>
            </div>

            <div className="grid grid-cols-3 gap-5 pt-5 lg:max-h-[50vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderContent()}
            </div>
        </MainLayout>
    )
}