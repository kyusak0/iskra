'use client'

import MainLayout from "../../layouts/MainLayout"
import { useState, useEffect } from "react";
import Link from "next/link";

import ChatWindow from './[cid]/page';
import ContextMenu from "../../components/contextMenu/ContextMenu";
import Popup from "../../components/popup/Popup";
import { useAuth } from "../../context/authContext";
import { useRouter } from "next/navigation";

const BASE_URL = 'http://localhost:8001/storage/';

export default function Friends() {

    const [senderId, setSenderId] = useState(0);
    const [chatId, setChatId] = useState(0);
    const [isSelectedChat, setIsSelectedChat] = useState(false);

    const [creatingData, setCreatingData] = useState();

    const { user, loading, post, get } = useAuth();

    const router = useRouter();

    if (!user && !loading) {
        router.push('/unauth');
    }

    const chatSelect = (chat) => {
        if (!chat.id) {
            return;
        }
        setChatId(chat.id - 1);
        setIsSelectedChat(true)
    }

    const [file, setFile] = useState(null);

    const createChat = async (e) => {
        e.preventDefault()
        try {
            let loadFile = null
            if (file) {
                const formData = {
                    file: file,
                    author_id: user.id
                }

                loadFile = await post('/load-file', formData);
            }


            const newData = { ...creatingData, owner_id: user.id, avatar: loadFile?.data.name }
            console.log(newData);
            const res = await post("/create-chat", newData);

            setChats([...prev, {
                id: res.data.id,
                title: res.data.title,
                source: loadFile?.data.name,
                type: res.data.type,
                member_length: res.data?.members.length,
                members: res.data?.members,
            }])
        } catch (error) {

        }

    }

    const [chats, setChats] = useState([]);

    const showChats = async () => {
        const res = await get("/get-chats");
        setChats([])

        console.log(res)

        res.data.forEach(element => {
            const newRecord = {
                id: element.id,
                title: element.title,
                source: element.avatar,
                type: element.type,
                created_at: new Date(element.created_at).toLocaleString(),
                member_length: element.members.length,
                members: element.members,
                lastMess: element.messages[element.messages.length - 1]?.content,
                lastMess_img: element.messages[element.messages.length - 1]?.source?.name,
                lastMessTime: element.messages.length > 0
                    ? new Date(element.messages[element?.messages?.length - 1]?.created_at).toLocaleString()
                    : ''
            }

            setChats(prev => [...prev, newRecord]);
        });


    }

    useEffect(() => {
        showChats();
    }, [])

    const [chatListWidth, setChatListWidth] = useState('w-2/4');

    const handleSelectWidth = (e) => {
        console.log(e.target.value)
        setChatListWidth(e.target.value);
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        let type;
        if ([name] == 'type') {
            type = e.target.id
            setCreatingData({ ...creatingData, type: type })
        } else {
            setCreatingData({ ...creatingData, [name]: value })
        }
    }

    return (
        <MainLayout>
            <div className="w-full flex items-center border-r-2 border-main">
                <div className=" overflow-auto max-lg:w-full lg:resize-x lg:min-w-1/4 lg:max-w-full">
                    <div className="flex justify-around items-center">
                        <h2 className="text-lg font-bold my-4">Чаты</h2>
                        <Popup id="settingsChat" openTrigger={<button>...</button>}>
                            <h3 className="text-xl">
                                Создание Чата
                            </h3>
                            <form className="w-3/4 flex flex-col gap-5" onSubmit={createChat}>
                                <input type="file" name="source" id="source" className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setFile(e.target.files[0])
                                        }
                                    }}
                                />
                                <div className="flex gap-5">
                                    <label htmlFor="source"
                                        className="underline text-main"
                                    >Загрузить аватар</label>
                                    {file?.name}
                                </div>
                                <input type="text"
                                    name="title"
                                    className="px-3 py-2 border-2 border-main rounded-md"
                                    onChange={handleChange}
                                    placeholder="Название..."
                                />
                                <textarea
                                    name="bio"
                                    className="px-3 py-2 border-2 border-main rounded-md"
                                    onChange={handleChange}
                                    placeholder="Описание..."
                                />
                                <div className="w-full">
                                    <h3>
                                        Тип чата
                                    </h3>
                                    <div className="flex gap-5 mt-5 px-5 items-start rounded-t-md border-2 border-main w-full">
                                        <input className="ml-7 mt-7 p-5" type="radio" name="type" id="public"
                                            onChange={handleChange} />
                                        <label htmlFor="public" className="flex-1 py-5">
                                            Публичный
                                            <p className="text-xs">
                                                Чат доступен всем пользователям.
                                            </p>
                                        </label>
                                    </div>
                                    <div className="flex gap-5 px-5 items-start rounded-b-md border-2 border-main w-full">
                                        <input className="ml-7 mt-7 p-5" type="radio" name="type" id="private"
                                            onChange={handleChange} />
                                        <label htmlFor="private" className="flex-1 py-5">
                                            Приватный
                                            <p className="text-xs">
                                                Чат доступен только по приглашению.
                                            </p>
                                        </label>
                                    </div>
                                </div>
                                <button className="px-3 py-2 bg-main hover:opacity-80 rounded-md">Создать</button>
                            </form>
                        </Popup>
                    </div>
                    <div className="h-130 overflow-y-auto w-full">
                        {chats.map(chat => (
                            <div key={chat.id}
                                className={`w-full ${chat.type == 'public'
                                    ? ''
                                    : chat.members.map(member => (
                                        `${member?.user_id == user?.id ? '' : `hidden`}`
                                    ))}`}>
                                <div className='max-lg:hidden lg:block'>
                                    <div onClick={() => chatSelect(chat)}
                                        className={`block px-3 py-5 rounded w-full flex items-center gap-2 ${chat.id - 1 === chatId
                                            ? 'bg-main/20 border border-main'
                                            : 'hover:bg-fg/20'
                                            }`}>
                                        {chat.source ? (
                                            <img src={`${BASE_URL}${chat.source}`} alt="" className="w-10 h-10 rounded-full" />
                                        ) : (
                                            <div
                                                className="w-10 h-10 rounded-full flex justify-center items-center bg-main text-bg uppercase font-bold"
                                            > {chat.title[0]} </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="flex justify-between items-center w-full">
                                                <span>{chat.title}</span>
                                                <span className="text-xs">{chat.lastMessTime || chat.created_at}</span></p>
                                            <div className="text-xs italic">
                                                {(chat.lastMess_img || chat.lastMess)
                                                    ? (<div className="flex items-center gap-2">
                                                        {chat.lastMess_img ? (
                                                            <img src={BASE_URL + chat.lastMess_img} className="w-8" />
                                                        ) : (null)}
                                                        {chat?.lastMess}
                                                    </div>)
                                                    : 'Чат пуст'}
                                            </div>
                                        </div>

                                        {/* <ContextMenu
                                            openTrigger={
                                                <button>...</button>
                                            }>
                                            <h3>{chat.title}</h3>
                                            <button>edit</button>
                                            <button>delete</button>
                                            <button>forward</button>
                                        </ContextMenu> */}
                                    </div>
                                </div>
                                <div className="max-lg:block lg:hidden">
                                    <Link href={`chats/${chat.id}`}
                                        onClick={() => chatSelect(chat.id)}
                                        className={`flex px-3 py-5 rounded w-full ${chat.id - 1 === chatId
                                            ? 'bg-blue-100 border border-blue-300'
                                            : 'hover:bg-fg/20'
                                            }`}
                                    >
                                        {chat.source ? (
                                            <img src={`${BASE_URL}${chat.source}`} alt="" className="w-10 h-10 rounded-full" />
                                        ) : (
                                            <div
                                                className="w-10 h-10 rounded-full flex justify-center items-center bg-main text-bg uppercase font-bold"
                                            > {chat.title[0]} </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="flex justify-between items-center w-full">
                                                <span>{chat.title}</span>
                                                <span className="text-xs">{chat.lastMessTime || chat.created_at}</span></p>
                                            <div className="text-xs italic">
                                                {(chat.lastMess_img || chat.lastMess)
                                                    ? (<div className="flex items-center gap-2">
                                                        {chat.lastMess_img ? (
                                                            <img src={BASE_URL + chat.lastMess_img} className="w-8" />
                                                        ) : (null)}
                                                        {chat?.lastMess}
                                                    </div>)
                                                    : 'Чат пуст'}
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-full max-lg:hidden">
                    {isSelectedChat ? (
                        <ChatWindow key={chatId + 1} chat_id={chatId + 1} />
                    ) : (
                        <span className="m-auto w-1/4 p-5 flex justify-center rounded-md bg-main/20">
                            Выберите чат для начала общения
                        </span>
                    )}
                </div></div>
        </MainLayout >
    )
}