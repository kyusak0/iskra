'use client'

import { useAuth } from "../../context/authContext";
import AdminLayout from "../../layouts/AdminLayout";

export default function AdminPanel() {
    const { user } = useAuth();
    return (
        <AdminLayout>
            <h2 className="text-2xl">
                Добро пожаловать, <span className="text-main">{user?.name}</span>!
            </h2>
            <ul className="flex gap-5 mt-5">
                <li>
                    <a href="/admin/tags" className="btn rounded-md">
                        теги
                    </a>
                </li>
                <li>
                    <a href="/admin/reports" className="btn rounded-md">
                        жалобы
                    </a>
                </li>
                <li>
                    <a href="/admin/users" className="btn rounded-md">
                        пользователи
                    </a>
                </li>
            </ul>
        </AdminLayout>
    )
}