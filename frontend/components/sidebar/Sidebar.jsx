'use client'

import { useAuth } from "../../context/authContext";
// import { api, AppUser } from "@/app/lib/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar({ children }) {

    const [open, setOpen] = useState(false);

    const { user, logout, loading } = useAuth();

    const pathname = usePathname()
    const [clientPathname, setClientPathname] = useState('')

    useEffect(() => {
        setClientPathname(pathname)
    }, [pathname])

    const back = () => {
        router.back();
    }
    return (
        <div className="w-full grid grid-cols-12">
            <div className={`fixed ${open ? 'col-span-2 pl-20' : 'col-span-1 pl-2'}  h-screen bg-main text-fg left-0 flex flex-col gap-10 justify-evenly `}>
                <div
                    className="absolute top-5 right-5 cursor-pointer text-white font-bold"
                    onClick={() => {
                        setOpen(!open)
                    }}
                >
                    {open ? '<' : '>'}
                </div>
                <div className="logo">
                    <a href="/">
                        <img src="/" alt="На главную" title="На главную" />
                    </a>
                </div>
                <div className={`flex flex-col opacity-100`}>

                    <Link href="/"
                        className={`${clientPathname == '/' ? `bg-fg text-main ${open ? 'rounded-l-full pr-10' : 'rounded-full'}  w-max` : ''} p-5`}>
                        <span title="Главная">🏠</span>
                        <span className={open ? 'ml-5' : 'hidden'}>Главная</span></Link>
                    <Link href="/chats"
                        className={`${clientPathname.includes('/chats') ? `bg-fg text-main ${open ? 'rounded-l-full pr-10' : 'rounded-full'}  w-max` : ''} p-5`}>
                        <span title="Чаты">💬</span>
                        <span className={open ? 'ml-5' : 'hidden'}>Чаты</span></Link>
                    <Link href="/videos"
                        className={`${clientPathname == '/videos' ? `bg-fg text-main ${open ? 'rounded-l-full pr-10' : 'rounded-full'}  w-max` : ''} p-5`}>
                        <span title="Видео">📹</span>
                        <span className={open ? 'ml-5' : 'hidden'}>Видео</span></Link>
                    <Link href={`/users/${user?.id}`}
                        className={`${clientPathname.includes('/users/') ? `bg-fg text-main ${open ? 'rounded-l-full pr-10' : 'rounded-full'}  w-max` : ''} p-5`}>
                        <span title="Профиль">👤</span>
                        <span className={open ? 'ml-5' : 'hidden'}>Профиль</span></Link>
                </div>
                <div className="flex flex-col">
                    <Link href="/docs"
                        className={`${clientPathname.includes('/docs') ? 'bg-fg text-main rounded-full w-max' : ''} p-5 text-left `}>
                        <span title="Справка">📑</span>
                        <span className={open ? 'ml-5' : 'hidden'}>Справка</span></Link>
                    {user ? (
                        <button onClick={logout}
                            className="w-max py-1 px-3 ml-5 rounded-lg shadow-sm border-2 hover:bg-gray-100 hover:text-main-hover text-white">
                            {open ? 'Выйти' : '⬅'}
                        </button>
                    ) : (null)}

                </div>
            </div>

            <div className={`${open ? 'col-span-10 col-start-3' : 'col-span-11  col-start-2'} `}>
                <header className="flex justify-between items-center h-15 px-10 bg-white shadow-sm relative w-full">
                    <button
                        className='border-b-2 border-main px-2 hover:text-main-hover'
                        onClick={back}>Назад</button>
                    <Link
                        href={user?.name ? `/users/${user?.id}` : "/login"}
                        className={`flex items-center justify-center px-2 py-1 border-2 text-base font-medium rounded-lg 
                        ${user?.name
                                ? "hover:text-main-hover border-transparent"
                                : "hover:text-white border border-main hover:bg-main-hover"
                            } md:py-2 md:text-lg md:px-5`}
                    >
                        {user?.name ? user.name : "Войти"}
                    </Link>
                </header>
                <div className="m-10">
                    {children}
                </div>
            </div>
        </div>
    )
}