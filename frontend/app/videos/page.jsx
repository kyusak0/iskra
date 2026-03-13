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

    // Новая функция для извлечения кадра из видео
    const extractFrameFromVideo = (videoFile) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            video.preload = 'metadata';
            
            video.onloadeddata = () => {
                // Устанавливаем размеры canvas равными размерам видео
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Рисуем первый кадр на canvas
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                // Конвертируем canvas в blob (файл)
                canvas.toBlob((blob) => {
                    // Создаем файл из blob
                    const frameFile = new File([blob], 'video-frame.jpg', { type: 'image/jpeg' });
                    
                    // Очищаем ресурсы
                    URL.revokeObjectURL(video.src);
                    
                    resolve(frameFile);
                }, 'image/jpeg', 0.9); // Качество 90%
            };
            
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('Не удалось загрузить видео для извлечения кадра'));
            };
            
            video.src = URL.createObjectURL(videoFile);
            
            // Устанавливаем время на 1 секунду для более интересного кадра
            video.currentTime = 1;
        });
    };

    const getVideoDuration = (file) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                const duration = Math.round(video.duration);
                resolve(duration);
            };
            
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('Не удалось загрузить метаданные видео'));
            };
            
            video.src = URL.createObjectURL(file);
        });
    };

    // Обновленная функция createVideo
    const createVideo = async (e) => {
        e.preventDefault();
        let cover_id = null, video_id = null;

        try {
            if (!video) {
                setAlert({ content: 'Сначала выберите видео', type: 'err' });
                return;
            }

            if (!video.type.startsWith('video/')) {
                setAlert({ content: 'Файл должен быть видео', type: 'err' });
                return;
            }

            const durationInSeconds = await getVideoDuration(video);
            
            const minutes = Math.floor(durationInSeconds / 60);
            const seconds = Math.floor(durationInSeconds % 60);
            const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const videoFormData = {
                file: video,
                author_id: user.id
            };
            const loadVideo = await post('/load-file', videoFormData);
            video_id = loadVideo.data.id;

            if (file) {
                if (!file.type.startsWith('image/')) {
                    setAlert({ content: 'Файл обложки должен быть изображением', type: 'err' });
                    return;
                }

                const coverFormData = {
                    file: file,
                    author_id: user.id
                };
                const loadFile = await post('/load-file', coverFormData);
                cover_id = loadFile.data.id;
            } else {
                try {
                    setAlert({ content: 'Извлечение обложки из видео...', type: 'info' });
                    
                    const frameFile = await extractFrameFromVideo(video);
                    
                    const coverFormData = {
                        file: frameFile,
                        author_id: user.id
                    };
                    const loadFile = await post('/load-file', coverFormData);
                    cover_id = loadFile.data.id;
                    
                    setAlert({ content: 'Обложка успешно извлечена из видео', type: 'success' });
                } catch (frameError) {
                    console.error('Ошибка извлечения кадра:', frameError);
                    setAlert({ content: 'Не удалось извлечь обложку из видео', type: 'err' });
                    return;
                }
            }

            // Создаем видео с обложкой
            const videoData = {
                title: creatingData.title,
                desc: creatingData.desc,
                source_id: video_id,
                cover_id: cover_id,
                duration: formattedDuration,
                tags: selectedTags,
                author_id: user.id,
            };

            const res = await post('/create-video', videoData);
            console.log(res);
            
            setFile(null);
            setVideo(null);
            setCreatingData({ title: '', desc: '' });
            setSelectedTags([]);
            
            getVideos(false);
            
            setAlert({ content: 'Видео успешно создано!', type: 'success' });

        } catch (error) {
            console.error('Ошибка создания видео:', error);
            setAlert({ content: 'Ошибка при создании видео', type: 'err' });
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCreatingData({ ...creatingData, [name]: value });
    };

    const [videos, setVideos] = useState([]);
    const [videosOrig, setVideosOrig] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(0);
    const [alert, setAlert] = useState(null);

    const getVideos = async (paginate = true) => {
        let curPage = currentPage;
        if (videos.length > 0 && paginate) {
            setCurrentPage(currentPage + 1);
            curPage++;
        }

        const res = await get(`/get-videos?page=${curPage}`);

        if (curPage == 1) {
            setVideos([]);
        }

        setLastPage(res.data.last_page);

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
            setVideosOrig(prevVideos => [...prevVideos, newRecord]);
        });
    };

    useEffect(() => {
        getVideos();
        getTags();
    }, []);

    const [tags, setTags] = useState([]);

    const getTags = async () => {
        const res = await get('/get-tags');
        setTags([]);

        res.data.map(el => (
            setTags(prev => [...prev, {
                id: el.id,
                name: el.name
            }])
        ));
    };

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
        console.log(e.target.searchVideo?.value);

        const searchTerm = e.target?.searchVideo?.value?.toLowerCase();
        if (searchTerm) {
            setVideos(
                videos.filter(el =>
                    el.title?.toLowerCase().includes(searchTerm)
                )
            );
        } else {
            setVideos(videosOrig);
        }
    };

    const selectTag = (e) => {
        e.preventDefault();
        setVideos(videosOrig);
        console.log(e.target?.value);

        const searchTerm = e.target?.value;
        if (searchTerm && searchTerm != 0) {
            const filteredVideos = videos.filter(video =>
                video.tags?.some(tag => tag.id == searchTerm)
            );
            setVideos(filteredVideos);
        } else {
            setVideos(videosOrig);
        }
    };
    
    return (
        <MainLayout alertMess={alert?.content} alertType={alert?.type}>
            <div className="w-full flex flex-col max-lg:flex-col-reverse">
                <div className="w-full flex max-lg:flex-wrap justify-evenly gap-5 lg:mt-10 max-lg:pt-5 lg:pb-5 lg:border-b-2 lg:border-main">
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
                        </>}>
                        {user ? (
                            <form className="w-full flex flex-col gap-5" onSubmit={createVideo}>
                                <h3 className="text-xl font-bold">
                                    Создать Видео
                                </h3>
                                
                                {/* Обложка (необязательно) */}
                                <input type="file" name="cover" id="cover" className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setFile(e.target.files[0]);
                                        }
                                    }}
                                    accept='image/*'
                                />
                                <div className="flex gap-5 items-center">
                                    <label htmlFor="cover"
                                        className="underline text-main cursor-pointer hover:text-main/80"
                                    >Выбрать обложку (необязательно)</label>
                                    {file?.name && (
                                        <span className="text-sm text-gray-600">
                                            Выбрано: {file.name}
                                            <button 
                                                type="button"
                                                onClick={() => setFile(null)}
                                                className="ml-2 text-red-500 hover:text-red-700"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    )}
                                    {!file && (
                                        <span className="text-sm text-gray-500 italic">
                                            (будет использован первый кадр видео)
                                        </span>
                                    )}
                                </div>

                                {/* Видео (обязательно) */}
                                <input type="file" name="source" id="source" className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setVideo(e.target.files[0]);
                                        }
                                    }}
                                    accept='video/*'
                                    required
                                />
                                <div className="flex gap-5">
                                    <label htmlFor="source"
                                        className="underline text-main cursor-pointer hover:text-main/80"
                                    >Выбрать видео *</label>
                                    {video?.name}
                                </div>

                                <input type="text"
                                    name="title"
                                    className="px-3 py-2 border-2 border-main rounded-md"
                                    onChange={handleChange}
                                    placeholder="Название..."
                                    value={creatingData?.title}
                                    required />
                                
                                <textarea
                                    name="desc"
                                    className="px-3 py-2 border-2 border-main rounded-md resize-none"
                                    onChange={handleChange}
                                    placeholder="Описание..."
                                    value={creatingData?.desc}
                                    rows="3" />

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

                                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border-2 border-main rounded-md">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-4 py-2 rounded-full border-2 text-sm transition-colors ${selectedTags.includes(tag.id)
                                                    ? 'bg-main text-white border-main'
                                                    : 'border-main hover:bg-main/10'
                                                    }`}
                                            >
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    type="submit"
                                    className="px-3 py-2 bg-main hover:opacity-80 rounded-md text-bg uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!video || !creatingData.title}
                                >
                                    Создать видео
                                </button>
                            </form>
                        ) : (
                            <div className="flex flex-col justify-center text-center">
                                <p>
                                    Кажется вы не вошли в аккаунт. Вы не можете создать видео.
                                </p>
                                <a href="/login" className="text-main hover:underline">Войти</a>
                            </div>
                        )}
                    </Popup>
                </div>
                <div className="grid grid-cols-3 my-5 max-h-[65vh] overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] gap-10">
                    {videos.length > 0 ? (
                        videos.map(vid => (
                            <a href={`/videos/${vid.id}`} className="col-span-1 max-lg:col-span-3 border-2 border-main rounded-lg hover:shadow-lg transition-shadow" key={vid.id}>
                                <div className="relative">
                                    <img 
                                        src={`${BASE_URL + vid.cover}`} 
                                        alt={vid.title || "Обложка видео"}
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = NoMedia.src;
                                        }}
                                        className="border-main w-full h-50 object-cover rounded-t-lg" />
                                    <p className="rounded-full px-2 py-1 bg-main/70 absolute bottom-2 right-2 text-white text-sm">
                                        {vid.duration}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 p-2">
                                    <p className="text-2xl font-semibold truncate">
                                        {vid.title}
                                    </p>

                                    <p className="text-gray-600">
                                        {vid.author.name}
                                    </p>

                                    <ul className="flex gap-2 flex-wrap">
                                        {vid.tags.map(tag => (
                                            <li key={tag.id}
                                                className="bg-main/20 px-2 py-1 rounded-full text-xs">
                                                {tag.name}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="my-auto text-sm text-gray-500">
                                        <p>
                                            Просмотры: {vid.views}
                                        </p>
                                    </div>
                                </div>
                            </a>
                        ))
                    ) : (
                        <div className="col-span-3 text-center py-10 text-gray-500">
                            Ничего не найдено
                        </div>
                    )}
                </div>
                
                {videos.length > 0 && currentPage < lastPage && (
                    <button
                        onClick={getVideos}
                        className="btn rounded-md mx-auto px-8 py-2 bg-main text-white hover:opacity-80 transition-opacity">
                        Показать еще
                    </button>
                )}
            </div>
        </MainLayout>
    );
}