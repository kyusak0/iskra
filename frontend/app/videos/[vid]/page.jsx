'use client'

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../../../context/authContext";
import MainLayout from "../../../layouts/MainLayout";
import { notFound, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Cookies from 'js-cookie';

const BASE_URL = 'http://localhost:8001/storage/';
const VIEW_COOKIE_PREFIX = 'video_viewed_';
const VIEW_COOKIE_EXPIRY = 1; // дней

export default function Videos() {
    const { user, get } = useAuth();
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

    // Функция проверки, был ли уже просмотр
    const hasViewedVideo = useCallback((videoId) => {
        const cookieName = `${VIEW_COOKIE_PREFIX}${videoId}`;
        return Cookies.get(cookieName) === 'true';
    }, []);

    // Функция отметки просмотра в куки
    const markVideoAsViewed = useCallback((videoId) => {
        const cookieName = `${VIEW_COOKIE_PREFIX}${videoId}`;
        Cookies.set(cookieName, 'true', { expires: VIEW_COOKIE_EXPIRY });
    }, []);

    // Функция отправки просмотра на сервер
    const recordView = useCallback(async () => {
        // Проверяем, не был ли уже отправлен просмотр
        if (viewRecordedRef.current || viewRecorded) {
            return;
        }

        // Проверяем куки перед отправкой
        if (hasViewedVideo(vid)) {
            console.log('Видео уже было просмотрено ранее');
            viewRecordedRef.current = true;
            setViewRecorded(true);
            return;
        }

        try {
            console.log('Отправка просмотра на сервер...');
            // Отправляем запрос на сервер
            await get(`/view/${vid}`);
            
            // Отмечаем в куки и ref
            markVideoAsViewed(vid);
            viewRecordedRef.current = true;
            setViewRecorded(true);
            
            console.log('Просмотр засчитан');
        } catch (err) {
            console.error('Ошибка при записи просмотра:', err);
        }
    }, [vid, get, hasViewedVideo, markVideoAsViewed, viewRecorded]);

    // Обработчик времени воспроизведения
    const handleTimeUpdate = useCallback(() => {
        // Если просмотр уже засчитан - выходим
        if (viewRecordedRef.current || viewRecorded) return;

        // Если видео просмотрено хотя бы 1 секунду
        if (videoRef.current && videoRef.current.currentTime >= 1) {
            recordView();
        }
    }, [recordView, viewRecorded]);

    // Обработчик окончания видео
    const handleEnded = useCallback(() => {
        if (!viewRecordedRef.current && !viewRecorded) {
            recordView();
        }
    }, [recordView, viewRecorded]);

    // Очистка при размонтировании
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
            const newRecord = {
                id: vid,
                video: el.source,
                duration: el.duration,
                created_at: new Date(el.created_at).toDateString(),
                author: el.source.user,
                title: el.title,
                desc: el.desc,
                tags: el.tags || [],
                views: el.views_count || 0
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
    }, [videoRef.current, recordView, viewRecorded]); // Зависимость от videoRef.current

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

                            {/* Comments */}
                            <div className="mt-6 text-gray-500 text-center py-4 border-t border-gray-200">
                                Комментарии отключены
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