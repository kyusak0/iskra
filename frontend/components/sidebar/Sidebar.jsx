'use client'

import { useAuth } from "../../context/authContext";
// import { api, AppUser } from "@/app/lib/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar({ children }) {
    const router = useRouter()
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
        <div className="grid grid-cols-12">
            <div className={`relative transition-all duration-300 ${open ? 'max-lg:w-3/4 col-span-2 pl-20' : 'max-lg:hidden col-span-1'} z-2 h-screen bg-main text-fg left-0 flex flex-col items-center gap-10 justify-evenly`}>
                <div
                    className="absolute top-5 right-5 cursor-pointer text-white font-bold uppercase"
                    onClick={() => {
                        setOpen(!open)
                    }}
                >
                    {open ? 'Закрыть' : 'Открыть'}
                </div>
                <div className="logo" title="На главную">
                    <a href="/" className={`uppercase transition-all duration-300 ${open ? 'rounded-l-full pr-10' : 'rounded-full'} w-max flex font-bold p-5 items-center`}>
                        <img src="/logo.svg" alt="На главную" className="w-full h-10"/>
                        <span className={`transition-all duration-300 ${open ? 'ml-5' : 'hidden'} text-bg`}>искра</span>
                    </a>
                </div>
                <div className={`flex flex-col opacity-100`}>
                    <Link href="/"
                        className={`${clientPathname == '/' ? `bg-bg uppercase transition-all duration-300 ${open ? 'rounded-l-full pr-10' : 'rounded-full'} w-max` : ''} flex font-bold p-5`}>
                        <span title="Главная"><img src="/home.svg" className="w-5 h-5" alt="" /></span>
                        <span className={`transition-all duration-300 ${open ? 'ml-5' : 'hidden'}`}>Главная</span></Link>
                    <Link href="/chats"
                        className={`${clientPathname.includes('/chats') ? `bg-bg uppercase transition-all duration-300 ${open ? 'rounded-l-full pr-10' : 'rounded-full'} w-max` : ''} flex font-bold p-5`}>
                        <span title="Чаты"><img src="/comment.svg" className="w-5 h-5" alt="" /></span>
                        <span className={`transition-all duration-300 ${open ? 'ml-5' : 'hidden'}`}>Чаты</span></Link>
                    <Link href="/videos"
                        className={`${clientPathname == '/videos' ? `bg-bg uppercase transition-all duration-300 ${open ? 'rounded-l-full pr-10' : 'rounded-full'} w-max` : ''} flex font-bold p-5`}>
                        <span title="Видео"><img src="/video.svg" className="w-5 h-5" alt="" /></span>
                        <span className={`transition-all duration-300 ${open ? 'ml-5' : 'hidden'}`}>Видео</span></Link>
                    <Link href={`/users/${user?.id}`}
                        className={`${clientPathname.includes('/users/') ? `bg-bg uppercase transition-all duration-300 ${open ? 'rounded-l-full pr-10' : 'rounded-full'} w-max` : ''} flex font-bold p-5`}>
                        <span title="Профиль"><img src="/profile.svg" className="w-5 h-5" alt="" /></span>
                        <span className={`transition-all duration-300 ${open ? 'ml-5' : 'hidden'}`}>Профиль</span></Link>
                </div>
                <div className="flex flex-col gap-5 items-center">
                    <Link href="/docs"
                        className={`${clientPathname.includes('/docs') ? `bg-bg uppercase transition-all duration-300 ${open ? 'rounded-l-full pr-10' : 'rounded-full'} w-max` : ''} flex font-bold p-5`}>
                        <span title="Справка"><img src="/docs.svg" className="w-5 h-5" alt="" /></span>
                        <span className={`transition-all duration-300 ${open ? 'ml-5' : 'hidden'}`}>Справка</span></Link>
                    {user ? (
                        <button onClick={logout} title="Выйти"
                            className="w-max py-1 px-3 rounded-lg shadow-sm border-2 hover:bg-bg hover:text-main text-white font-bold uppercase">
                            {open ? 'Выйти' : (<img src="/logout.svg" className="w-5 h-5" alt="" />)}
                        </button>
                    ) : (<button onClick={logout} title="Выйти"
                            className="w-max py-1 px-3 rounded-lg shadow-sm border-2 hover:bg-bg hover:text-main text-white font-bold uppercase">
                            {open ? 'Войти' : (<img src="/logout.svg" className="w-5 h-5" alt="" />)}
                        </button>)}

                </div>
            </div>

            <div className={`transition-all duration-300 ${open ? 'col-span-10 max-lg:col-span-12  ' : 'col-span-11  max-lg:col-span-12 '} `}
                onClick={() => {
                    if (open) {
                        setOpen(false)
                    }

                }}>
                <header className="flex justify-between items-center h-15 px-10 bg-main shadow-sm relative w-full z-1">
                    <button
                        className="lg:hidden px-3 py-1 border-2 border-main rounded-full"
                        onClick={() => setOpen(!open)}
                    >i</button>

                    <button
                        className='border-b-2 border-bg btn '
                        onClick={back}>Назад</button>
                    <Link
                        href={user?.name ? `/users/${user?.id}` : "/login"}
                        className={`btn border-b-2 border-bg `}
                    >
                        {user?.name ? user.name : "Войти"}
                    </Link>
                </header>
                <div className="mt-5">
                    {children}
                </div>
            </div>
        </div>
    )
}