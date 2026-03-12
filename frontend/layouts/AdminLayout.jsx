'use client'

import { useEffect, useState } from "react"
import { useAuth } from "../context/authContext";
import { notFound, usePathname } from "next/navigation";
import Alert from "../components/alert/Alert";

export default function AdminLayout({ children, alertMess, alertType }) {
    const [sidebarIsOpen, setSidebarIsOpen] = useState(false);

    const openSidebar = () => { setSidebarIsOpen(true) }
    const closeSidebar = () => { setSidebarIsOpen(false) }

    const { user, loading } = useAuth();

    useEffect(() => {
        if (user?.role != 'admin' && !loading) {
            return notFound();
        }
    });

    const link = usePathname()

    return (
        <section className="grid grid-cols-12">
            <header className={`${sidebarIsOpen ? 'col-span-2' : 'col-span-1'} bg-main relative h-screen flex flex-col items-center`}>
                <div className="absolute top-5 right-5">
                    <button onClick={sidebarIsOpen ? closeSidebar : openSidebar} className="btn">
                        {sidebarIsOpen ? 'Закрыть' : 'Открыть'}
                    </button>
                </div>

                <ul className="h-full flex flex-col gap-10 justify-center ">
                    <li className="w-full">
                        <a href="/admin/tags" className={`p-5 ${link.includes('/tags') ? 'rounded-full bg-bg' : ''} flex gap-5 items-center uppercase font-bold`}>
                            <span><img src="/tags.svg" alt="" className="w-10 h-10" /></span>
                            <span className={`${sidebarIsOpen ? '' : 'hidden'}`}> теги </span>
                        </a>
                    </li>
                    <li className="w-full">
                        <a href="/admin/reports" className={`p-5 ${link.includes('/reports') ? 'rounded-full bg-bg' : ''} flex gap-5 items-center uppercase font-bold`}>
                            <span><img src="/docs.svg" alt="" className="w-10 h-10" /></span>
                            <span className={`${sidebarIsOpen ? '' : 'hidden'}`}> жалобы </span>
                        </a>
                    </li>
                    <li className="w-full">
                        <a href="/admin/users" className={`p-5 ${link.includes('/users') ? 'rounded-full bg-bg' : ''} flex gap-5 items-center uppercase font-bold`}>
                            <span><img src="/profile.svg" alt="" className="w-10 h-10" /></span>
                            <span className={`${sidebarIsOpen ? '' : 'hidden'}`}> пользователи </span>
                        </a>
                    </li>
                </ul>

            </header>
            <main className={`${sidebarIsOpen ? 'col-span-10' : 'col-span-11'} flex flex-col items-center justify-center`}>{children}</main>

            <Alert id={Date.now()} content={alertMess} type={alertType}>

            </Alert>
        </section>
    )
}