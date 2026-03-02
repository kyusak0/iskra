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

    const getPostInfo = async (postId) => {
        try {
            const res = await get('/get-post/' + postId);
            if (res.success) {
                setPostData({
                    title: res.data.title,
                    desc: res.data.desc,
                    source: res.data.source,
                    comments: res.data.messages,
                    author: res.data.user,
                });

                console.log(res)
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
                post_id: params.pid,
                content: content,
                answer_id: answer?.id,
                source_id: loadFile?.data.id
            };



            const res = await post("/send-message/post", newData);
            console.log(res)

            setPostData({
                ...postData,
                comments: [
                    ...(postData.comments || []),
                    {
                        id: res.data.id,
                        content: res.data.content,
                        answer_id: res.data.answer_id,
                        created_at: new Date(res.data.created_at).toLocaleDateString(),
                        source: loadFile?.data.name,
                        user_id: res.data.author_id,
                        user_name: res.data?.user?.name || 'loading...',
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

    return (
        <MainLayout>
            {!loading && (
                <div className="grid grid-cols-4 gap-5">

                    <div className="col-span-2 max-lg:col-span-4 flex flex-col gap-10 border-r-2 border-main lg:h-[80vh] lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ">

                        {postData.source ? (
                            postData.source?.type.includes('image') ? (
                                <img src={`${BASE_URL + postData.source.name}`} alt="" className="m-auto w-2/4" />
                            ) : (
                                <p className=" h-100">Для этого файлы предпросмотр недоступен</p>
                            )
                        ) : (null)}
                        <h3 className="text-3xl">
                            {postData.title}
                        </h3>
                        <p className="">
                            {postData.desc}
                        </p>

                    </div>
                    <div className="flex flex-col col-span-2 max-lg:col-span-4">
                        <h3 className="text-xl mb-5">
                            Комментарии
                        </h3>
                        <div
                            className="lg:h-100 lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-lg:mb-10">
                            {postData.comments.map((message) => (
                                <div className={`w-full mb-5 ${selectedMess == message.id ? 'shadow-lg shadow-main/50' : ''}`}

                                    key={message.id} id={`${message.id}`}>
                                    <div className="flex flex-col items-start">
                                        <a
                                            href={`users/${message.user.id}`}
                                            className="grid grid-cols-3 grid-rows-2 "
                                        ><img alt="avaatr" className="rounded-full w-10 h-10 col-span-1 row-span-2 mr-5" />
                                            <p className="col-span-2 row-span-1">
                                                {message.user.name}
                                            </p>
                                            <p className="text-xs col-span-2 row-span-1">
                                                {new Date(message.created_at).toLocaleString()}
                                            </p>
                                        </a>
                                        <ContextMenu
                                            closing={closeContext}
                                            openTrigger={
                                                <div className="w-full block">

                                                    {message.message?.content ? (
                                                        <div className='w-full'>
                                                            <a
                                                                href={`#${message.message?.id}`}
                                                                onClick={() => {
                                                                    setCloseContext(true);
                                                                }}
                                                                className={`w-full block border-l-2 rounded-l-md p-2 mb-2 ${message.author_id === user?.id
                                                                    ? 'bg-main/20 border-main'
                                                                    : 'bg-gray-200 border-gray-500'
                                                                    }`}
                                                            >
                                                                {message.message?.content}
                                                            </a>


                                                        </div>
                                                    ) : (null)}

                                                    {message.source ? (
                                                        <img src={`${BASE_URL + message.source.name}`} alt="" className="m-auto w-full" />
                                                    ) : (null)}
                                                    <p>
                                                        {message.content}
                                                    </p>
                                                </div>
                                            }>
                                            <div className="flex flex-col gap-5">
                                                <div className="">
                                                    <label htmlFor="">
                                                        Пожаловаться
                                                    </label>
                                                    <input type="text"
                                                        className="border-2 border-main rounded-md w-full"
                                                        placeholder="Причина..." />
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
                                            </div>
                                        </ContextMenu>
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
                                                    setFile(e.target.files[0])
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

                    </div>
                </div>
            )}
        </MainLayout >
    )
}