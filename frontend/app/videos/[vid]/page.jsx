'use client'

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../../context/authContext";
import MainLayout from "../../../layouts/MainLayout";
import { notFound, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Cookies from 'js-cookie';
import ContextMenu from "../../../components/contextMenu/ContextMenu";

const BASE_URL = 'http://localhost:8001/storage/';
const VIEW_COOKIE_PREFIX = 'video_viewed_';
const VIEW_COOKIE_EXPIRY = 1; // дней

export default function Videos() {
    const { user, get, post } = useAuth();
    const params = useParams();
    const vid = params.vid;

    const videoRef = useRef(null);
    const viewRecordedRef = useRef(false);
    const watchTimerRef = useRef(null);
    const [viewRecorded, setViewRecorded] = useState(false);

    const [video, setVideo] = useState(null);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [closeContext, setCloseContext] = useState(null);

    const [answer, setAnswer] = useState()
    const [file, setFile] = useState()
    const [content, setContent] = useState("");

    const handleSend = async (e) => {
        e.preventDefault();

        try {
            let loadFile = null
            if (file) {
                const formData = {
                    file: file,
                    author_id: user.id
                }

                loadFile = await post('/load-file', formData);
            }

            console.log(loadFile)


            const newData = {
                author_id: user.id,
                video_id: video.id,
                content: content,
                answer_id: answer?.id,
                source_id: loadFile?.data.id
            };

            const res = await post(`/send-message/video/${video.id}`, newData);
            console.log(res)

            setVideo({
                ...video,
                messages: [
                    ...(video.messages || []),
                    {
                        id: res.data.id,
                        content: res.data.content,
                        message: res.data.message,
                        created_at: new Date(res.data.created_at).toLocaleDateString(),
                        source: res.data.source,
                        user: res.data.user,
                    }
                ]
            });

            setContent('');
            setAnswer(null);
            setFile(null);

        } catch (err) {
            console.log(err.message)
        }

    };

    const hasViewedVideo = useCallback((videoId) => {
        const cookieName = `${VIEW_COOKIE_PREFIX}${videoId}`;
        return Cookies.get(cookieName) === 'true';
    }, []);

    const markVideoAsViewed = useCallback((videoId) => {
        const cookieName = `${VIEW_COOKIE_PREFIX}${videoId}`;
        Cookies.set(cookieName, 'true', { expires: VIEW_COOKIE_EXPIRY });
    }, []);

    const recordView = useCallback(async () => {
        if (viewRecordedRef.current || viewRecorded) {
            return;
        }

        if (hasViewedVideo(vid)) {
            console.log('Видео уже было просмотрено ранее');
            viewRecordedRef.current = true;
            setViewRecorded(true);
            return;
        }

        try {
            console.log('Отправка просмотра на сервер...');
            await get(`/view/${vid}`);

            markVideoAsViewed(vid);
            viewRecordedRef.current = true;
            setViewRecorded(true);

            console.log('Просмотр засчитан');
        } catch (err) {
            console.error('Ошибка при записи просмотра:', err);
        }
    }, [vid, get, hasViewedVideo, markVideoAsViewed, viewRecorded]);

    const handleTimeUpdate = useCallback(() => {
        if (viewRecordedRef.current || viewRecorded) return;

        if (videoRef.current && videoRef.current.currentTime >= 1) {
            recordView();
        }
    }, [recordView, viewRecorded]);

    const handleEnded = useCallback(() => {
        if (!viewRecordedRef.current && !viewRecorded) {
            recordView();
        }
    }, [recordView, viewRecorded]);

    useEffect(() => {
        return () => {
            if (watchTimerRef.current) {
                clearTimeout(watchTimerRef.current);
            }
        };
    }, []);

    const getVideo = useCallback(async () => {
        try {
            setLoading(true);
            const res = await get(`/get-video/${vid}`);

            if (!res?.data) {
                notFound();
            }

            const el = res.data;
            console.log(res)
            const newRecord = {
                id: el.id,
                video: el.source,
                duration: el.duration,
                created_at: new Date(el.created_at).toDateString(),
                author: el.user,
                title: el.title,
                desc: el.desc,
                tags: el.tags || [],
                views: el.views_count || 0,
                messages: el.messages || [],
                commentable: res.data?.commentable,
                url: res.data.url
            };

            setVideo(newRecord);

            if (el.tags?.length) {
                await getRelatedVideos(el.tags);
            }
        } catch (err) {
            console.error('Error fetching video:', err);
            setError('Failed to load video');
        } finally {
            setLoading(false);
        }
    }, [vid, get]);

    const reportMessage = async (message, desc) => {
        if (!desc.trim()) {
            return;
        }

        try {
            const reportData = {
                desc: desc,
                target: `comment_${message.id}_video_${video?.id}_user_${message.user.id}`
            };

            const response = await post('/create-report', reportData);

        } catch (error) {
            console.error('Ошибка при отправке жалобы:', error);
        }
    };

    // Функция удаления комментария
    const deleteMessage = async (message) => {
        try {
            const response = await post('/delete-message', { id: message.id });

            if (response.success) {
                // Обновляем список комментариев
                setComments(prev => prev.filter(c => c.id !== message.id));
            }
        } catch (error) {
            console.error('Ошибка при удалении комментария:', error);
            alert('Не удалось удалить комментарий');
        }
    };

    // Функция закрепления комментария
    const pinMessage = async (message) => {
        try {
            const response = await post('/pin-message', {
                id: message.id,
                post_id: postData?.id
            });

            if (response.success) {
                alert('Комментарий закреплен');
            }
        } catch (error) {
            console.error('Ошибка при закреплении комментария:', error);
            alert('Не удалось закрепить комментарий');
        }
    };

    const selectedMess = 0

    const getRelatedVideos = async (currentVideoTags) => {
        try {
            const res = await get(`/get-videos?page=1`);

            if (!res?.data?.data) return;

            const currentTagIds = currentVideoTags.map(tag => tag.id);

            const filteredVideos = res.data.data.filter(video =>
                video.id !== vid &&
                video.tags?.some(tag => currentTagIds.includes(tag.id))
            );

            const videoRecords = filteredVideos.map(el => ({
                id: el.id,
                cover: el.cover?.name,
                duration: el.duration,
                created_at: new Date(el.created_at).toDateString(),
                author: el.source.user,
                title: el.title,
                tags: el.tags || [],
                views: el.views_count || 0
            }));

            setVideos(videoRecords);
        } catch (err) {
            console.error('Error fetching related videos:', err);
        }
    };

    useEffect(() => {
        getVideo();
    }, [getVideo]);

    // Сброс состояния просмотра при смене видео
    useEffect(() => {
        viewRecordedRef.current = false;
        setViewRecorded(false);

        // Проверяем куки при загрузке нового видео
        if (vid && hasViewedVideo(vid)) {
            viewRecordedRef.current = true;
            setViewRecorded(true);
        }
    }, [vid, hasViewedVideo]);

    // Альтернативный вариант с использованием setTimeout для большей надежности
    useEffect(() => {
        if (!videoRef.current || viewRecordedRef.current || viewRecorded) return;

        const handleFirstSecond = () => {
            if (videoRef.current && videoRef.current.currentTime >= 1) {
                recordView();
                // Удаляем обработчик после срабатывания
                videoRef.current.removeEventListener('timeupdate', handleFirstSecond);
            }
        };

        videoRef.current.addEventListener('timeupdate', handleFirstSecond);

        return () => {
            if (videoRef.current) {
                videoRef.current.removeEventListener('timeupdate', handleFirstSecond);
            }
        };
    }, [videoRef.current, recordView, viewRecorded]);

    const commentability = async () => {
        const data = {
            video_id: video.id,
            commentable: video.commentable == 'false' ? 'true' : 'false'
        }
        const res = await post('/commentable/video', data);
        console.log(res)

        // setVideo(prev, {commentable: data.commentable})
    }

    const repost = async () => {
        const data = {
            post_id: video.id,
            user_id: user.id,
            link: `/videos/${video.url}`
        }

        await post('/repost', data)
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center min-h-[80vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main"></div>
                </div>
            </MainLayout>
        );
    }

    if (error || !video) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center min-h-[80vh]">
                    <p className="text-red-500">{error || 'Сбой загрузки'}</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="w-full flex flex-col max-lg:flex-col-reverse">
                <div className="w-full grid grid-cols-3">
                    <div className="col-span-2 h-[85vh] overflow-y-auto max-lg:col-span-3">
                        <div className="flex flex-col gap-2">
                            <video
                                ref={videoRef}
                                src={`${BASE_URL}${video.video.name}`}
                                controls
                                className="h-[60vh] w-full bg-black"
                                playsInline
                                // Убираем onTimeUpdate из пропсов, используем useEffect
                                onEnded={handleEnded}
                            />

                            {/* Tags */}
                            {video.tags.length > 0 && (
                                <ul className="flex gap-2 flex-wrap">
                                    {video.tags.map(tag => (
                                        <li
                                            key={tag.id}
                                            className="bg-main/20 px-3 py-1 rounded-full text-sm"
                                        >
                                            {tag.name}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Title */}
                            <h1 className="text-2xl font-bold">
                                {video.title}
                            </h1>

                            {/* Author and interactions */}
                            <div className="flex justify-between items-center">
                                <Link
                                    href={`/users/${video.author.id}`}
                                    className="flex gap-2 items-center hover:opacity-80 transition-opacity"
                                >
                                    {video.author.avatar && (
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200">
                                            <img
                                                src={`${BASE_URL}${video.author.avatar}`}
                                                alt={video.author.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <span className="font-medium">{video.author.name}</span>
                                </Link>

                                <button onClick={repost} className="w-max btn rounded-md">Репост</button>

                                <div className="flex gap-5 items-center">
                                    <button className="px-4 py-2 border border-main rounded-full hover:bg-main/10 transition-colors">
                                        👍 0
                                    </button>
                                    <button className="px-4 py-2 border border-main rounded-full hover:bg-main/10 transition-colors">
                                        👎 0
                                    </button>
                                    <span className="text-gray-600">
                                        Просмотры: {video.views}
                                    </span>
                                </div>
                            </div>

                            {/* Description */}
                            {video.desc && (
                                <div className="mt-4">
                                    <h3 className="font-semibold mb-2">Описание:</h3>
                                    <p className="text-gray-700">{video.desc}</p>
                                </div>
                            )}

                            <div className="mt-6 text-gray-500 py-4 border-t border-gray-200">
                                <h3 className="text-xl mb-5">
                                    Комментарии
                                </h3>
                                {video.commentable == 'true' && (<button onClick={commentability}
                                    className="btn rounded-md">Отключить</button>)}

                                {video.commentable !== 'true' ? (
                                    <div className=" flex flex-col gap-5 items-center"><p>Комментарии отключены</p>
                                        {video.author.id == user.id && (
                                            <button onClick={commentability}
                                                className="btn rounded-md">Включить</button>)}
                                    </div>
                                ) : (<>
                                    <div
                                        className="lg:h-100 lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-lg:mb-10">
                                        {video?.messages?.map((message) => (
                                            <div
                                                className={`w-full mb-5 ${selectedMess == message.id ? 'shadow-lg shadow-main/50' : ''}`}
                                                key={message.id}
                                                id={`${message.id}`}
                                            >
                                                <div className="flex flex-col items-start">
                                                    <a
                                                        href={`/users/${message.user?.id}`}
                                                        className="flex items-center gap-3 w-full mb-2 hover:opacity-80 transition-opacity"
                                                    >
                                                        {message.user?.avatar ? (
                                                            <img
                                                                src={`${BASE_URL}${message.user?.avatar}`}
                                                                alt={`Аватар ${message.user?.name}`}
                                                                className="rounded-full w-10 h-10 object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-main text-lg font-bold text-white flex items-center justify-center">
                                                                {message.user?.name?.[0]?.toUpperCase()}
                                                            </div>
                                                        )}

                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-900">
                                                                {message.user?.name}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(message.created_at).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </a>

                                                    <div className="w-full pl-13">
                                                        <ContextMenu
                                                            closeContext={closeContext}
                                                            openTrigger={
                                                                <div className="w-full">
                                                                    {message.message?.content && (
                                                                        <div className="mb-2">
                                                                            <a
                                                                                href={`#${message.message.id}`}
                                                                                onClick={() => setCloseContext(true)}
                                                                                className={`
                                                                            block border-l-4 rounded-r-md p-3 text-sm
                                                                            ${message.author_id === user?.id
                                                                                        ? 'bg-main/10 border-main'
                                                                                        : 'bg-gray-100 border-gray-400'
                                                                                    }
                                                                            hover:bg-opacity-80 transition-colors
                                                                        `}
                                                                            >
                                                                                <span className="text-xs text-gray-500 block mb-1">
                                                                                    Ответ на комментарий:
                                                                                </span>
                                                                                {message.message?.content}
                                                                            </a>
                                                                        </div>
                                                                    )}

                                                                    {/* Текст комментария */}
                                                                    <p className="text-gray-800 whitespace-pre-wrap break-words">
                                                                        {message.content}
                                                                    </p>
                                                                </div>
                                                            }
                                                        >
                                                            <div className="bg-white min-w-[200px]">
                                                                {/* Форма жалобы */}
                                                                <form
                                                                    onSubmit={(e) => {
                                                                        e.preventDefault();
                                                                        const formData = new FormData(e.target);
                                                                        reportMessage(message, formData.get('report_desc'));
                                                                    }}
                                                                    className="mb-2"
                                                                >
                                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                                        Пожаловаться
                                                                    </label>
                                                                    <div className="flex gap-2">
                                                                        <input
                                                                            type="text"
                                                                            name="report_desc"
                                                                            placeholder="Причина жалобы..."
                                                                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-main"
                                                                            required
                                                                        />
                                                                        <button
                                                                            type="submit"
                                                                            className="btn text-sm rounded-md transition-colors"
                                                                        >
                                                                            Отправить
                                                                        </button>
                                                                    </div>
                                                                </form>

                                                                <div className="border-t border-gray-200 pt-2">
                                                                    <button
                                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
                                                                        onClick={() => {
                                                                            setCloseContext(true);
                                                                            setAnswer({
                                                                                id: message.id,
                                                                                content: message.content,
                                                                                userName: message.user?.name
                                                                            });
                                                                        }}
                                                                    >
                                                                        Ответить
                                                                    </button>

                                                                    {/* Кнопка копирования */}
                                                                    <button
                                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(message.content);
                                                                            setCloseContext(true);
                                                                        }}
                                                                    >
                                                                        Копировать текст
                                                                    </button>

                                                                    {/* Кнопка удаления (только для своих комментариев или автора видео) */}
                                                                    {(message.author_id === user?.id && message.author_id === video.user?.id) && (
                                                                        <button
                                                                            className="w-full text-red-300 text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2"
                                                                            onClick={() => {

                                                                                setCloseContext(true);
                                                                            }}
                                                                        >
                                                                            Удалить
                                                                        </button>
                                                                    )}

                                                                    {video?.author_id === user?.id && (
                                                                        <button
                                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
                                                                            onClick={() => {
                                                                                pinMessage(message);
                                                                                setCloseContext(true);
                                                                            }}
                                                                        >
                                                                            Закрепить
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </ContextMenu>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <form onSubmit={handleSend}
                                        className='w-full flex flex-col gap-2 mt-10 max-lg:fixed  max-lg:bg-bg max-lg:bottom-0'>
                                        {user ? (
                                            <>
                                                {answer ? (
                                                    <div className="flex justify-between">
                                                        <a href={`#${answer?.id}`}>{answer?.content}</a>
                                                        <button onClick={() => { setAnswer(null) }}>❌</button>
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

                                                    <button
                                                        type="submit"
                                                        className='text-xl p-3 bg-main text-white rounded-md disabled:bg-gray-400 min-w-20'
                                                        disabled={!(content.trim() || file)}
                                                    >
                                                        ➤
                                                    </button></div>
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
                                    </form></>
                                )}



                            </div>
                        </div>
                    </div>

                    {/* Related videos section */}
                    <div className="col-span-1 max-lg:hidden p-4">
                        {videos.length > 0 ? (
                            <>
                                <h3 className="px-4 py-2 border-2 border-main rounded-md uppercase text-center mb-4">
                                    похожие видео
                                </h3>
                                <div className="h-[75vh] overflow-y-auto space-y-4">
                                    {videos.map(relatedVideo => (
                                        <Link
                                            href={`/videos/${relatedVideo.id}`}
                                            key={relatedVideo.id}
                                            className="block border-2 border-main rounded-lg overflow-hidden hover:border-main/70 transition-colors"
                                        >
                                            <div className="relative">
                                                {relatedVideo.cover && (
                                                    <img
                                                        src={`${BASE_URL}${relatedVideo.cover}`}
                                                        alt={relatedVideo.title}
                                                        className="w-full h-48 object-cover"
                                                    />
                                                )}
                                                <span className="absolute bottom-2 right-2 bg-main/70 text-white px-2 py-1 rounded-full text-sm">
                                                    {relatedVideo.duration}
                                                </span>
                                            </div>

                                            <div className="p-3 space-y-2">
                                                <h4 className="text-lg font-semibold line-clamp-2">
                                                    {relatedVideo.title}
                                                </h4>

                                                <p className="text-sm text-gray-600">
                                                    {relatedVideo.author.name}
                                                </p>

                                                {relatedVideo.tags.length > 0 && (
                                                    <ul className="flex gap-1 flex-wrap">
                                                        {relatedVideo.tags.slice(0, 3).map(tag => (
                                                            <li
                                                                key={tag.id}
                                                                className="bg-main/20 px-2 py-0.5 rounded-full text-xs"
                                                            >
                                                                {tag.name}
                                                            </li>
                                                        ))}
                                                        {relatedVideo.tags.length > 3 && (
                                                            <li className="text-xs text-gray-500">
                                                                +{relatedVideo.tags.length - 3}
                                                            </li>
                                                        )}
                                                    </ul>
                                                )}

                                                <p className="text-sm text-gray-500">
                                                    Просмотры: {relatedVideo.views}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-gray-500 mt-8">
                                Нет похожих видео
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}