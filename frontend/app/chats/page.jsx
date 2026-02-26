'use client'

import MainLayout from "../../layouts/MainLayout"
import { MouseEvent } from 'react';

import { useState, useEffect } from "react";

import Link from "next/link";

import ChatWindow from './[cid]/page';
import ContextMenu from "../../components/contextMenu/ContextMenu";
import Popup from "../../components/popup/Popup";
import { useAuth } from "../../context/authContext";



export default function Friends() {

    const [senderId, setSenderId] = useState(0);
    const [chatId, setChatId] = useState(0);
    const [isSelectedChat, setIsSelectedChat] = useState(false);

    const [creatingData, setCreatingData] = useState();

    const { user, post, get } = useAuth();

    const chatSelect = (id) => {
        if (!id) {
            return;
        }
        setChatId(id - 1);
        setIsSelectedChat(true)
    }

    const createChat = async (e) => {
        e.preventDefault()
        const newData = { ...creatingData, owner_id: user.id }
        console.log(newData)
        const res = await post("/create-chat", newData);

        console.log(res)
    }

    const [chats, setChats] = useState([]);

    const showChats = async () => {
        //  потом заменить на пост и добавить в тело передачу только тех где состоит пользователь
        const res = await get("/get-chats");
        setChats([])

        console.log(res)

        res.data.forEach(element => {
            const newRecord = {
                id: element.id,
                title: element.title,
                lastMess: element.messages[element.messages.length - 1]?.content,
                lastMessTime: new Date(element.messages[element.messages.length - 1]?.created_at).toLocaleString()
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
            <div className="w-full flex justify-center">
                <div className={`${chatListWidth} border-r-2 border-main`}>
                    <div className="flex justify-around items-center">
                        <h2 className="text-lg font-bold my-4">Чаты</h2>
                        <div className="">Ширина:
                            <select name="" id="" className=" btn btn-reverse" onChange={(e) => handleSelectWidth(e)}>
                                <option value='w-2/4'>По умолчанию</option>
                                <option value='w-1/4'>1/4</option>
                                <option value='w-full'>1/2</option>
                            </select></div>
                        <Popup id="settingsChat" openTrigger={<button>...</button>}>
                            <h3 className="text-xl">
                                Создание Чата
                            </h3>
                            <form className="w-3/4 flex flex-col gap-5" onSubmit={createChat}>
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
                    <div className="max-h-140 overflow-y-auto">
                        {chats.map(chat => (
                            <div key={chat.id}>
                                <div className='max-lg:hidden lg:block'>
                                    <div onClick={() => chatSelect(chat.id)}

                                        className={`block px-3 py-5 rounded w-full flex items-center gap-2 ${chat.id - 1 === chatId
                                            ? 'bg-blue-100 border border-blue-300'
                                            : 'hover:bg-gray-100'
                                            }`}>
                                        <div className="flex-1">
                                            <p className="flex justify-between items-center w-full"><span>{chat.title}</span> <span className="text-xs">{chat.lastMessTime}</span></p>
                                            <p className="text-xs italic">
                                                {chat.lastMess ? (chat.lastMess) : 'Чат пуст'}
                                            </p>
                                        </div>

                                        <ContextMenu 
                                        openTrigger={
                                            <button>...</button>
                                        }>
                                            <h3>{chat.title}</h3>
                                            <button>edit</button>
                                            <button>delete</button>
                                            <button>forward</button>
                                        </ContextMenu>
                                    </div>
                                </div>
                                <div className="max-lg:block lg:hidden">
                                    <Link href={`chats/${chat.id}`}
                                        onClick={() => chatSelect(chat.id)}
                                        className={`block px-3 py-5 rounded w-full ${chat.id - 1 === chatId
                                            ? 'bg-blue-100 border border-blue-300'
                                            : 'hover:bg-gray-100'
                                            }`}
                                    >
                                        <div
                                        >
                                            {chat.title}
                                            {chat.lastMess ? chat.lastMess : 'Чат пуст'}

                                            <ContextMenu contextMenuId={chatId} openContextMenuText="..." secondaryActivator={null} >
                                                <h3>{chat.name}</h3>
                                                <button>edit</button>
                                                <button>delete</button>
                                                <button>forward</button>
                                            </ContextMenu>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={`${isSelectedChat ? '' : 'hidden'} w-full`}>
                    <ChatWindow key={chatId + 1} chat_id={chatId + 1} />
                </div>
                <div className={`${isSelectedChat ? 'hidden' : ''} text-center flex justify-center w-2/4 items-center`}>
                    <span className="p-5 rounded-md bg-main/20">
                        Select chat and start message
                    </span>
                </div>
            </div>
        </MainLayout>
    )
}