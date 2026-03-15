'use client'

import { notFound, useParams } from "next/navigation"
import MainLayout from "../../../layouts/MainLayout";
import { useAuth } from "../../../context/authContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ContextMenu from "../../../components/contextMenu/ContextMenu";
import Popup from "../../../components/popup/Popup";

const BASE_URL = 'http://localhost:8001/storage/';

export default function ProfilePage() {
    const params = useParams();
    console.log(params);

    const [postData, setPostData] = useState(null);
    const router = useRouter()

    const { user, post, get, loading } = useAuth()

    useEffect(() => {
        getPostInfo(params.pid);
    }, []);

    const commentability = async () => {
        const data = {
            post_id: postData.id,
            commentable: postData.commentable == 'false' ? 'true' : 'false'
        }
        const res = await post('/commentable/post', data);
        window.location.reload()
    }

    const [isReposted, setIsReposted] = useState(false);

    const getPostInfo = async (postId) => {
        try {
            const res = await get('/get-post/' + postId);
            console.log(res)
            if (res.success) {
                setPostData({
                    id: res.data.id,
                    title: res.data.title,
                    desc: res.data.desc,
                    source: res.data.source?.name,
                    author: res.data.user,
                    messages: res.data.messages || [],
                    commentable: res.data.commentable || 'false',
                    url: res.data.url
                });

                setIsReposted(res.data.reposts.filter(el => el.link.includes('posts/') && el.user_id == user?.id).length > 0)


            } else {

            }
        } catch (error) {
            console.log(error.message)
        }
    }




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
                post_id: postData.id,
                content: content,
                answer_id: answer?.id,
                source_id: loadFile?.data.id
            };

            const res = await post(`/send-message/post/${postData.id}`, newData);
            console.log(res)

            setPostData({
                ...postData,
                messages: [
                    ...(postData.messages || []),
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

    const [closeContext, setCloseContext] = useState(null);

    const [selectedMess, setSelectedMess] = useState(0)

    useEffect(() => {
        if (closeContext) {
            setCloseContext(false)
        }

    }, [closeContext]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setTimeout(() => {
                if (window.location.hash) {
                    history.replaceState(null, null, window.location.pathname + window.location.search);
                    setSelectedMess(0)
                }
            }, 2000)
            const str = window.location.hash
            setSelectedMess(str.split('#')[1])
        }
    }, []);


    const [answer, setAnswer] = useState()
    const [file, setFile] = useState()
    const [content, setContent] = useState("");

    const reportMessage = async (message, desc) => {
        if (!desc.trim()) {
            return;
        }

        try {
            const reportData = {
                desc: desc,
                target: `comment_${message.id}_post_${postData?.id}_user_${message.user.id}`
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

    const repost = async () => {
        const data = {
            post_id: postData.id,
            user_id: user.id,
            link: `/posts/${postData.url}`
        }

        await post('/repost', data)

        setIsReposted(!isReposted)
    }

    return (
        <MainLayout>
            {!loading && (
                <div className="grid grid-cols-4 gap-5">

                    <div className="col-span-2 max-lg:col-span-4 flex flex-col gap-10 border-r-2 border-main lg:h-[80vh] lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-y-style:none] [scrollbar-width:none]">
                        <div className="w-full flex flex-col gap-10">
                            {/* Media section */}
                            {postData?.source ? (
                                postData.source?.type?.includes('image') ? (
                                    <Popup
                                        openTrigger={
                                            <img
                                                src={`${BASE_URL}${postData.source.name}`}
                                                alt={postData.title || 'Post image'}
                                                className="m-auto w-2/4 object-contain max-h-96"
                                                loading="lazy"
                                            />}>
                                        <img
                                            src={`${BASE_URL}${postData.source.name}`}
                                            alt={postData.title || 'Post image'}
                                            className="m-auto mt-5 fit-contain hover:scale-[1.2]"
                                            loading="lazy"
                                        />
                                    </Popup>
                                ) : postData.source?.type?.includes('postData') ? (
                                    <postData
                                        src={`${BASE_URL}${postData.source.name}`}
                                        controls
                                        className="m-auto w-2/4 max-h-96"
                                    />
                                ) : (
                                    <div className="h-40 flex items-center justify-center bg-gray-100 rounded-lg">
                                        <p className="text-gray-500">
                                            {postData.source?.type
                                                ? `Предпросмотр для файлов типа ${postData.source.type} недоступен`
                                                : 'Для этого файла предпросмотр недоступен'}
                                        </p>
                                    </div>
                                )
                            ) : (
                                <div className="h-40 flex items-center justify-center bg-gray-100 rounded-lg">
                                    <p className="text-gray-500">Нет медиафайлов</p>
                                </div>
                            )}

                            {/* Tags section */}
                            {postData?.tags?.length > 0 && (
                                <ul className="flex gap-2 flex-wrap">
                                    {postData.tags.map(tag => (
                                        <li
                                            key={tag.id}
                                            className="bg-main/20 px-3 py-1.5 rounded-full text-xs hover:bg-main/30 transition-colors cursor-default"
                                        >
                                            #{tag.name}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div className="flex justify-between ">

                                {postData?.title && (
                                    <a href={`/users/${postData.author.id}`} className="text-xl flex items-center gap-2 font-semibold leading-tight">
                                        {postData.author?.avatar ? (
                                            <img src={`${BASE_URL + postData.author.avatar}`} alt="" className="w-10 h-10 rounded-full bg-main cursor-pointer hover:opacity-80 transition-opacity" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-main text-2xl font-bold text-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity">
                                                {postData.author?.name ? postData.author.name[0] : '?'}
                                            </div>
                                        )}
                                        {postData.author.name}
                                    </a>
                                )}

                                {isReposted ? (<button onClick={repost} className="w-max px-4 py-2 uppercase font-bold text-bg bg-gray-300 rounded-md">Уже в репостах</button>) : (<button onClick={repost} className="w-max btn rounded-md">Репост</button>)}
                            </div>

                            {/* Title */}
                            {postData?.title && (
                                <h3 className="text-3xl font-semibold leading-tight">
                                    {postData.title}
                                </h3>
                            )}

                            {/* Description */}
                            {postData?.desc && (
                                <p className="text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
                                    {postData.desc}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col col-span-2 max-lg:col-span-4">
                        <h3 className="text-xl mb-5">
                            Комментарии
                        </h3>
                        {postData?.commentable == 'true' && (<button onClick={commentability}
                            className="btn rounded-md">Отключить</button>)}

                        {postData?.commentable !== 'true' ? (
                            <div className=" flex flex-col gap-5 items-center"><p>Комментарии отключены</p>
                                {postData?.author.id == user.id && (
                                    <button onClick={commentability}
                                        className="btn rounded-md">Включить</button>)}
                            </div>
                        ) : (
                            <>
                                <div
                                    className="lg:h-100 lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-lg:mb-10">
                                    {postData?.messages?.map((message) => (
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

                                                {/* Контекстное меню и контент комментария */}
                                                <div className="w-full pl-13">
                                                    <ContextMenu
                                                        closing={closeContext}
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

                                                                {message.source && (
                                                                    <div className="mb-3 max-w-md">
                                                                        <Popup
                                                                            openTrigger={
                                                                                message.source?.type?.includes('postData') ? (
                                                                                    <postData
                                                                                        src={`${BASE_URL}${message.source.name}`}
                                                                                        controls
                                                                                        className="m-auto w-2/4 max-h-96"
                                                                                    />
                                                                                ) : (
                                                                                    <img
                                                                                        src={`${BASE_URL}${message.source.name}`}
                                                                                        alt="Прикрепленное изображение"
                                                                                        className=" rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                                                                    />)
                                                                            }
                                                                        >
                                                                            {message.source?.type?.includes('postData') ? (
                                                                                <postData
                                                                                    src={`${BASE_URL}${message.source.name}`}
                                                                                    controls
                                                                                    className="m-auto w-2/4 max-h-96"
                                                                                />) : (<img
                                                                                    src={`${BASE_URL}${message.source.name}`}
                                                                                    alt="Прикрепленное изображение"
                                                                                    className="w-full m-auto max-h-[80vh] mt-5 "
                                                                                />)
                                                                            }



                                                                        </Popup>
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
                                                                {/* Кнопка ответа */}
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
                                                                        // Можно добавить уведомление об успешном копировании
                                                                    }}
                                                                >
                                                                    Копировать текст
                                                                </button>

                                                                {/* Кнопка удаления (только для своих комментариев) */}
                                                                {message.author_id === user?.id && (
                                                                    <button
                                                                        className="w-full text-red-300 text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2"
                                                                        onClick={() => {

                                                                            setCloseContext(true);
                                                                        }}
                                                                    >
                                                                        Удалить
                                                                    </button>
                                                                )}

                                                                {/* Кнопка закрепления (только для авторов поста) */}
                                                                {postData?.author_id === user?.id && (
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
                                                            setFile(e.target.files[0]);
                                                            e.target.value = ''
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
                                </form>
                            </>)
                        }
                    </div>
                </div>

            )}
        </MainLayout >
    )
}