'use client'

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/authContext";
import MainLayout from "../../../layouts/MainLayout";
import { notFound, useParams } from "next/navigation";


const BASE_URL = 'http://localhost:8001/storage/';

export default function Videos() {

    const { user, get, post } = useAuth();
    const params = useParams();
    const vid = params.vid;

    const [video, setVideo] = useState()
    const [videos, setVideos] = useState([])

    const getVideo = async () => {
        const res = await get(`/get-video/${vid}`);
        const el = res.data;

        if (!el) return notFound;

        const newRecord = {
            id: vid,
            video: el.source,
            duration: el.duration,
            created_at: new Date(el.created_at).toDateString(),
            author: el.source.user,
            title: el.title,
            desc: el.desc,
            tags: el.tags,
            views: el.views_count
        };

        setVideo(newRecord);

        // После установки текущего видео, загружаем и фильтруем другие видео по тегам
        await getVideos(el.tags);
    }

    const getVideos = async (currentVideoTags) => {
        const res = await get(`/get-videos?page=1`);

        // Получаем ID тегов текущего видео
        const currentTagIds = currentVideoTags.map(tag => tag.id);

        // Фильтруем видео, у которых есть хотя бы один совпадающий тег
        const filteredVideos = res.data.data.filter(video =>
            video.tags?.some(tag => currentTagIds.includes(tag.id))
        );

        // Преобразуем отфильтрованные видео в нужный формат
        const videoRecords = filteredVideos.map(el => ({
            id: el.id,
            cover: el.cover.name,
            duration: el.duration,
            created_at: new Date(el.created_at).toDateString(),
            author: el.source.user,
            title: el.title,
            tags: el.tags,
            views: el.views_count
        }));

        setVideos(videoRecords);
        setLastPage(res.data.last_page);
    }

    useEffect(() => {
        getVideo();
        getVideos();
    }, []);



    const views = async () => {
        const video = document.querySelector('video');
        if (!video) return;

        // Флаг для предотвращения множественных запросов
        let viewRecorded = false;

        // Проверяем cookie при загрузке
        const hasViewed = document.cookie.split('; ').some(row =>
            row.startsWith(`view_video_${vid}=${user.id}`)
        );

        if (!hasViewed) {
            video.addEventListener('timeupdate', async function onTimeUpdate() {
                // Записываем просмотр когда видео прошло 1 секунду
                if (video.currentTime >= 1 && !viewRecorded) {
                    viewRecorded = true;

                    try {
                        const res = await get(`/view/${vid}`);
                        console.log('View recorded:', res);

                        // Устанавливаем cookie на 24 часа
                        const expires = new Date();
                        expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);
                        document.cookie = `view_video_${vid}=${user.id}; expires=${expires.toUTCString()}; path=/`;

                        // Удаляем обработчик после записи просмотра
                        video.removeEventListener('timeupdate', onTimeUpdate);
                    } catch (error) {
                        console.error('Failed to record view:', error);
                        viewRecorded = false;
                    }
                }
            });
        }
    }

    return (
        <MainLayout>
            <div className="w-full flex flex-col max-lg:flex-col-reverse">
                <div className="w-full grid grid-cols-3">
                    <div className="col-span-2 border-r-2 border-main max-lg:col-span-3">
                        {video ? (
                            <div className="flex flex-col gap-2">
                                <video
                                    onPlay={views}
                                    src={`${BASE_URL + video.video.name}`} controls className="h-[60vh] w-full"></video>

                                <ul className="flex gap-2 flex-wrap">
                                    {video.tags.map(tag => (
                                        <li key={tag.id}
                                            className="bg-main/20 px-2 py-1 rounded-full text-xs ">
                                            {tag.name}
                                        </li>
                                    ))}

                                </ul>

                                <p className="text-2xl">
                                    {video.title}
                                </p>

                                <div className="flex justify-between">

                                    <a href={`/users/${video.author.id}`} className="flex gap-2 items-center">
                                        <img src={`${BASE_URL + video.author.avatar}`} alt="" className="w-10 h-10 rounded-full" /> {video.author.name}
                                    </a>

                                    <div className="flex gap-5 items-center pr-5">
                                        <button className="px-2 py-1 border border-main rounded-full">
                                            👍0
                                        </button>
                                        <button className="px-2 py-1 border border-main rounded-full">
                                            👎0
                                        </button>
                                        <p>
                                            Просмотры: {video.views}
                                        </p>

                                    </div>

                                </div>
                                <p className="">
                                    Описание: {video.desc}
                                </p>

                                <div className="mt-auto">
                                    Комментарии отключены
                                </div>
                            </div>
                        ) : (null)}

                    </div>

                    <div className="col-span-1 flex flex-col items-center gap-5 max-lg:hidden">
                        {videos.length > 0 ? (<>
                            <h3 className="px-2 py-1 border-2 border-main rounded-md uppercase">
                                похожие видео
                            </h3>
                            <div className=" h-[80vh] overflow-auto">
                                {videos.map(vid => (
                                    <a href={`/videos/${vid.id}`} className="w-full border-2 border-main rounded-lg" key={vid.id}>
                                        <div className="relative">
                                            <img src={`${BASE_URL + vid.cover}`} alt="Ошибка загрузки изображения"
                                                // onError={this.setAtribute('src', NoMedia.src)}
                                                className="border-main w-full h-50 flex text-center" />
                                            <p className="rounded-full px-2 py-1 bg-main/70 absolute bottom-2 right-2 text-white">
                                                {vid.duration}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2 p-2">
                                            <p className="text-2xl">
                                                {vid.title}
                                            </p>

                                            <p className="">
                                                {vid.author.name}
                                            </p>

                                            <ul className="flex gap-2 flex-wrap">
                                                {vid.tags.map(tag => (
                                                    <li key={tag.id}
                                                        className="bg-main/20 px-2 py-1 rounded-full text-xs ">
                                                        {tag.name}
                                                    </li>
                                                ))}

                                            </ul>

                                            <div className="my-auto">
                                                <p>
                                                    Просмотры: {vid.views}
                                                </p>
                                            </div>
                                        </div>
                                    </a>

                                ))}
                            </div>
                        </>
                        ) : ("Ничего не найдено")}
                    </div>
                </div>
            </div>
        </MainLayout >
    );
}
