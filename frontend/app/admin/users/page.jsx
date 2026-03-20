'use client'

import { useEffect, useState } from "react";
import Popup from "../../../components/popup/Popup";
import { useAuth } from "../../../context/authContext";
import AdminLayout from "../../../layouts/AdminLayout";

export default function AdminPanel() {
    const { user, post, get } = useAuth();

    const [userData, setUserData] = useState({
        name: ''
    })

    const [users, setUsers] = useState([]);

    const blockUser = async (user) => {
        const blockData = {
            id: user.id,
            is_blocked: user.is_blocked == 'false' ? 'true' : 'false',
        }

        await post('/block-user', blockData);

        setUsers(prevData =>
            prevData.map(u =>
                u?.id === user.id && u?.role === 'admin'
                    ? { ...u, is_blocked: blockData.is_blocked }
                    : u
            )
        );
    }


    const getUsers = async () => {
        const res = await get('/get-users');
        setUsers([])

        setUsers(res.data.map(el =>
            el.id !== user.id
                ? { id: el.id, name: el.name, is_blocked: el.is_blocked }
                : null
        )
        )
    }

    useEffect(() => {
        getUsers();
    }, [])

    const [alert, setAlert] = useState();

    return (
        <AdminLayout alertMess={alert?.content} alertType={alert?.type}>
            <h2 className="text-3xl">
                Добро пожаловать, <span className="text-main">{user?.name}</span>!
            </h2>
            <div className="w-full flex justify-evenly items-center border-b-2 border-main py-5 mb-5">
                <h3 className="text-2xl text-main">
                    Пользователи
                </h3>
            </div>
            {users?.map(user => (
                user ? (
                    <div key={user.id} className="w-3/4 grid grid-cols-5">
                        <div className="col-span-1 border border-main p-2">
                            {user.id}
                        </div>
                        <div className="col-span-2 border border-main p-2">
                            {user.name}
                        </div>
                        <div className="col-span-2 border border-main p-2 flex justify-evenly">
                            <button onClick={() => blockUser(user)}>
                                {user.is_blocked == 'true' ? 'Разблокировать' : 'Заблокировать'}
                            </button>
                        </div>
                    </div>

                ) : (null)
                
            ))}
        </AdminLayout>
    )
}