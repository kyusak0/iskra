'use client'

import { notFound, useParams } from "next/navigation"
import MainLayout from "../../../layouts/MainLayout";
import { useAuth } from "../../../context/authContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Popup from "../../../components/popup/Popup";

const BASE_URL = 'http://localhost:8001/storage/';

export default function ProfilePage() {
    const params = useParams();
    console.log(params);

    const [userData, setUserData] = useState(null);
    const router = useRouter()
    const [disable2FAOpen, setDisable2FAOpen] = useState(false);
    const [disableCode, setDisableCode]= useState();
    const [disableForm, setDisableForm] = useState({
        email: '',
        password: '',
        code: '',
    });
    const [disableLoading, setDisableLoading] = useState(false);
    const [disableError, setDisableError] = useState('');
    const [activeTab, setActiveTab] = useState('posts'); // 'posts', 'videos', 'reposts'

    const { user, get, post, loading } = useAuth()

    useEffect(() => {
        getUserInfo(params.uid);
    }, []);

    const getUserInfo = async (userId) => {
        try {
            const res = await get('/user-info/' + userId);
            console.log(res)
            if (res.success) {
                setUserData({
                    name: res.data.name,
                    avatar: res.data.avatar,
                    posts: res.data.posts,
                    google2fa_enabled: !!res.data.google2fa_enabled,
                    // videos извлекаем из sources
                    videos: res.data.videos || []
                });
            } else {
                notFound()
                // router.push('/404')
            }


        } catch (error) {
            console.log(error.message)
        }
    }
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
                const formData = {
                    file: file,
                    author_id: user.id
                }
                loadFile = await post('/load-file', formData);

                setUserData(userData, {
                    avatar: loadFile.data.name,
                });

                const data = {
                    user_id: user.id,
                    avatar: loadFile.data.name
                }

                const editUser = await post('/set-avatar', data)

                console.log(editUser)
            }
        } catch (error) {
            console.log(error.message)
        }

    }

    // Фильтрация контента в зависимости от активной вкладки
    const getFilteredContent = () => {
        if (!userData) return [];

        switch(activeTab) {
            case 'posts':
                return userData.posts || [];
            case 'videos':
                return userData.videos || [];
            case 'reposts':
                return []; // Заглушка для репостов
            default:
                return [];
        }
    };

    // Проверка, является ли файл видео
    const isVideoFile = (source) => {
        if (!source || !source.name) return false;
        const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
        const extension = source.name.split('.').pop()?.toLowerCase();
        return videoExtensions.includes(extension);
    };

    // Проверка, является ли файл изображением
    const isImageFile = (source) => {
        if (!source || !source.name) return false;
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const extension = source.name.split('.').pop()?.toLowerCase();
        return imageExtensions.includes(extension);
    };

    const renderContent = () => {
        const content = getFilteredContent();

        if (activeTab === 'reposts') {
            // Заглушка для репостов
            return (
                <div className="col-span-3 flex flex-col items-center justify-center py-10 text-gray-500">
                    <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <p className="text-xl font-semibold">Репостов пока нет</p>
                    <p className="text-sm">Когда пользователь сделает репост, они появятся здесь</p>
                </div>
            );
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
            // Отображение видео из sources
            return content.map((source, index) => {
                // Проверяем, есть ли вложенные видео
                const videoItem = source.videos && source.videos.name ? source.videos : source;
                
                return (
                    <div className="col-span-1 max-lg:col-span-3 border-2 border-main p-5 flex flex-col justify-center" key={source.id || index}>
                        <div className="flex gap-2 pb-2 items-center">
                            {videoItem.name && isVideoFile(videoItem) ? (
                                <video 
                                    src={`${BASE_URL}${videoItem.name}`} 
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
                            href={`/videos/${source.id}`}
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
                    href={`/posts/${post.id}`}
                    className="w-full px-2 py-1 bg-main text-white font-bold uppercase rounded-md text-center hover:bg-main-dark transition-colors"
                >
                    читать пост
                </a>
            </div>
        ));
    };

    return (
        <MainLayout>
            <div className="flex pb-2 flex-col items-center gap-5 border-b-2 border-main">
                <button
                    onClick={()=>{console.log(userData)}}
                    className="hidden"
                >
                    test
                </button>
                <Popup
                    openTrigger={userData?.avatar ? (
                        <img src={`${BASE_URL + userData.avatar}`} alt="" className="w-20 h-20 rounded-full bg-main cursor-pointer hover:opacity-80 transition-opacity"/>
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-main text-4xl font-bold text-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                            {userData?.name ? userData.name[0] : '?'}
                        </div>
                    )}
                >
                    <form className="w-full flex flex-col gap-5 items-center" onSubmit={setAvatar}>
                        {userData?.avatar ? (
                            <img src={`${BASE_URL + userData.avatar}`} alt=""  className="w-20 h-20 rounded-full bg-main"/>
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
                    {user && String(user.id) === String(params.uid) && (
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
                    )}
                    <div className="col-span-1">подписчиков</div>
                    <div className="col-span-1">подписки</div>
                    
                    <div className="col-span-1 font-bold">0</div>
                    <div className="col-span-1 font-bold">0</div>
                    
                </div>
            </div>

            {/* Табы для переключения между контентом */}
            <div className="flex justify-center gap-5 pt-5 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('posts')}
                    className={`pb-2 px-4 font-semibold transition-colors ${
                        activeTab === 'posts' 
                            ? 'text-main border-b-2 border-main' 
                            : 'text-gray-500 hover:text-main'
                    }`}
                >
                    Посты ({userData?.posts?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('videos')}
                    className={`pb-2 px-4 font-semibold transition-colors ${
                        activeTab === 'videos' 
                            ? 'text-main border-b-2 border-main' 
                            : 'text-gray-500 hover:text-main'
                    }`}
                >
                    Видео ({userData?.videos?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('reposts')}
                    className={`pb-2 px-4 font-semibold transition-colors ${
                        activeTab === 'reposts' 
                            ? 'text-main border-b-2 border-main' 
                            : 'text-gray-500 hover:text-main'
                    }`}
                >
                    Репосты (0)
                </button>
            </div>

            <div className="grid grid-cols-3 gap-5 pt-5 lg:max-h-[50vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {renderContent()}
            </div>
        </MainLayout>
    )
}