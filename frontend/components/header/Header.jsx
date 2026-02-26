'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AppUser } from "@/app/lib/api";
import Link from 'next/link';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await api.getUser();
      setUser(userData);
    } finally {
      setLoading(false);
    }
  };





  const back = () => {
    router.back();
  }
  return (
    <header className="flex justify-between items-center h-15 px-10 top-0 right-0 bg-white shadow-sm z-index-3 col-span-6">
      {/* <div className="logo">
        <a href="/">
          <img src="/" alt="logo" title="На главная" />
        </a>
      </div>
      <nav>
        <ul className="flex gap-10">
          <li><Link href="/" className="hover:text-green-500">Главная</Link></li>
          <li><Link href="/tasks" className="hover:text-green-500">Задания</Link></li>
          <li><Link href="/contacts" className="hover:text-green-500">Задать вопрос</Link></li>
          <li><Link href="/bookings" className="hover:text-green-500">Посмотреть заявки</Link></li>
          <li><Link href="/marks" className="hover:text-green-500">Журнал</Link></li>
        </ul>
      </nav> */}
      
        <button className='border-b-2 border-main px-2 hover:text-main-hover' onClick={back}>Назад</button>
      
      <Link
        href={user?.name ? `/users/${user?.id}` : "/login"}
        className={`flex items-center justify-center px-2 py-1 border-2 text-base font-medium rounded-lg ${user?.name
          ? "hover:text-main-hover border-transparent"
          : "hover:text-white border border-main hover:bg-main-hover"
          } md:py-2 md:text-lg md:px-5`}
      >
        {user?.name ? user.name : "Войти"}
      </Link>
      
      

    </header>

  )
}