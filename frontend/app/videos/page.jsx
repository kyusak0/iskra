'use client'

import { useEffect, useState } from "react";
import Popup from "../../components/popup/Popup";
import { useAuth } from "../../context/authContext";
import MainLayout from "../../layouts/MainLayout";
import NoMedia from "../../public/no-media.png"

const BASE_URL = 'http://localhost:8001/storage/';

export default function Videos() {

    const { user, get, post } = useAuth();
    const [file, setFile] = useState(null);
    const [video, setVideo] = useState(null);
    const [creatingData, setCreatingData] = useState({
        title: '',
        desc: '',
    });

    const createVideo = async (e) => {
        e.preventDefault()
        let cover_id = null, video_id = null;

        if (file) {
            if (!file.type.startsWith('image/')) {
                setAlert({ content: 'Файл обложки должен быть изображением', type: 'err' });
                return;
            }

            const formData = {
                file: file,
                author_id: user.id
            }

            const loadFile = await post('/load-file', formData);
            cover_id = loadFile.data.id
        } else {
            setAlert({ content: 'Сначала выберите обложку', type: 'err' });
            return;
        }

        if (video) {
            if (!video.type.startsWith('video/')) {
                setAlert({ content: 'Файл должен быть видео', type: 'err' });
                return;
            }

            const formData = {
                file: video,
                author_id: user.id
            }

            const loadVideo = await post('/load-file', formData);
            video_id = loadVideo.data.id;

            const videoData = {
                title: creatingData.title,
                desc: creatingData.desc,
                source_id: video_id,
                cover_id: cover_id,
                duration: '11',
                tags: selectedTags
            }

            const res = await post('/create-video', videoData);

            console.log(res)

        } else {
            setAlert({ content: 'Сначала выберите видео', type: 'err' });
            return;
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCreatingData({ ...creatingData, [name]: value })
    }

    const [videos, setVideos] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(0);

    const getVideos = async () => {
        let curPage = currentPage
        if (videos.length > 0) {
            setCurrentPage(currentPage + 1);
            curPage++
        }

        const res = await get(`/get-videos?page=${curPage}`);

        if (curPage == 1) {
            setVideos([])
        }

        setLastPage(res.data.last_page)

        res.data.data.forEach(el => {
            const newRecord = {
                id: el.id,
                cover: el.cover.name,
                duration: el.duration,
                created_at: new Date(el.created_at).toDateString(),
                author: el.source.user,
                title: el.title,
                tags: el.tags,
                views: el.views_count
            };

            console.log(newRecord);
            setVideos(prevVideos => [...prevVideos, newRecord]);
        });
    }

    useEffect(() => {
        getVideos();
        getTags();
    }, []);

    const [tags, setTags] = useState([]);

    const getTags = async () => {
        const res = await get('/get-tags');
        setTags([])

        res.data.map(el => (
            setTags(prev => [...prev, {
                id: el.id,
                name: el.name
            }]
            )
        ))
    }

    const [selectedTags, setSelectedTags] = useState([]);

    const toggleTag = (tagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const search = (e) => {
        e.preventDefault();
        console.log(e.target.searchVideo?.value)

        const searchTerm = e.target?.searchVideo?.value?.toLowerCase();
        if (searchTerm) {
            setVideos(
                videos.filter(el =>
                    el.title?.toLowerCase().includes(searchTerm)
                )
            );
        } else {
            getVideos();
        }
    }

    const selectTag = (e) => {
        e.preventDefault();
        console.log(e.target?.value)

        const searchTerm = e.target?.value;
        if (searchTerm && searchTerm != 0) {
            const filteredVideos = videos.filter(video =>
                video.tags?.some(tag => tag.id == searchTerm)
            );
            setVideos(filteredVideos);
        } else {
            getVideos()
        }
    }

    return (
        <MainLayout>
            <div className="w-full flex flex-col max-lg:flex-col-reverse">
                <div className="w-full flex justify-evenly gap-5 lg:mt-10 max-lg:pt-5 lg:pb-5 lg:border-b-2 lg:border-main">
                    <select name="" id=""
                        onChange={selectTag}
                        className="px-3 py-2 border-2 border-main max-lg:rounded-md rounded-md" >
                        <option value='0'>
                            Все теги
                        </option>
                        {tags.map(tag => (
                            <option value={`${tag.id}`} key={`${tag.id}`}>
                                {tag.name}
                            </option>
                        ))}
                    </select>
                    <form action="" className="flex max-lg:hidden" onSubmit={search}>
                        <input type="search" name="searchVideo"
                            id="searchVideo" placeholder="Искать видео..."
                            className="px-3 py-2 border-2 border-main max-lg:rounded-md rounded-l-md" />
                        <button className="px-3 py-2 bg-main hover:opacity-80 rounded-r-md max-lg:rounded-md text-white font-bold uppercase">Искать</button>
                    </form>
                    <form action="" className="flex flex-col gap-2 lg:hidden" onSubmit={search}>
                        <input type="search" name="searchVideo"
                            id="searchVideo" placeholder="Искать видео..."
                            className="border-2 max-lg:rounded-md rounded-l-md btn" />
                    </form>
                    <Popup
                        id="create-video"
                        openTrigger={<>
                            <button
                                className="w-full btn lg:hidden rounded-md"
                                title="Создать Видео"
                            >+</button>
                            <button
                                className="w-full max-lg:hidden rounded-md btn"
                                title="Создать Видео"
                            >Создать Видео</button>
                        </>

                        }>
                        {user ? (
                            <form className="w-full flex flex-col gap-5" onSubmit={createVideo}>
                                <h3 className="text-xl font-bold">
                                    Создать Видео
                                </h3>
                                <input type="file" name="cover" id="cover" className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setFile(e.target.files[0])
                                        }
                                    }}
                                    accept='image/*'
                                />
                                <div className="flex gap-5">
                                    <label htmlFor="cover"
                                        className="underline text-main"
                                    >Обложка видео(фото)</label>
                                    {file?.name}
                                </div>
                                <input type="file" name="source" id="source" className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setVideo(e.target.files[0])
                                        }
                                    }}
                                    accept='video/*'
                                />
                                <div className="flex gap-5">
                                    <label htmlFor="source"
                                        className="underline text-main"
                                    >Видео</label>
                                    {video?.name}
                                </div>
                                <input type="text"
                                    name="title"
                                    className="px-3 py-2 border-2 border-main rounded-md"
                                    onChange={handleChange}
                                    placeholder="Название..."
                                    value={creatingData?.title} />
                                <textarea
                                    name="desc"
                                    className="px-3 py-2 border-2 border-main rounded-md resize-none"
                                    onChange={handleChange}
                                    placeholder="Описание..."
                                    value={creatingData?.desc} />
                                {/* <div className="space-y-2 border-2 border-main rounded-md p-3 overflow-auto h-40">
                                    <div className="font-medium mb-2">Теги:</div>
                                    {tags.map(tag => (
                                        <label key={tag.id} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="tags[]"
                                                value={tag.id}
                                                className="w-4 h-4 text-main"
                                            />
                                            <span>{tag.name}</span>
                                        </label>
                                    ))}
                                </div> */}

                                <div>
                                    <input
                                        type="hidden"
                                        name="tags"
                                        value={JSON.stringify(selectedTags)}
                                    />

                                    {selectedTags.length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {selectedTags.map(tagId => {
                                                const tag = tags.find(t => t.id === tagId);
                                                return (
                                                    <span key={tagId} className="bg-main text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                                        {tag?.name}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleTag(tagId)}
                                                            className="hover:text-red-300"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-4 py-2 rounded-full border-2 text-sm transition-colors ${selectedTags.includes(tag.id)
                                                    ? 'bg-main text-white border-main'
                                                    : 'border-main'
                                                    }`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button className="px-3 py-2 bg-main hover:opacity-80 rounded-md text-bg uppercase font-bold">Создать</button>
                            </form>
                        ) : (
                            <div className="flex flex-col justify-center text-center"><p>
                                Кажется вы не вошли в аккаунт. Вы не можете создать видео.</p>
                                <a href="/login" className="text-main">Войти</a>
                            </div>
                        )}
                    </Popup>
                </div>

                <div className="grid grid-cols-3 my-5 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-10">
                    {videos.length > 0 ? (
                        videos.map(vid => (
                            <a href={`/videos/${vid.id}`} className="col-span-1 border-2 border-main rounded-lg" key={vid.id}>
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
                        ))
                    ) : ("Ничего не найдено")}
                </div>
                <button
                    onClick={getVideos}
                    className={`btn rounded-md ${currentPage == lastPage ? 'hidden' : ''}`}>
                    Показать еще
                </button>
            </div>
        </MainLayout>
    );
}
