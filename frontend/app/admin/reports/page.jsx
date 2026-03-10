'use client'

import { useAuth } from "../../../context/authContext";
import AdminLayout from "../../../layouts/AdminLayout";

export default function AdminPanel() {
    const { user } = useAuth();
    return (
        <AdminLayout>
            <h2 className="text-3xl">
                Добро пожаловать, <span className="text-main">{user?.name}</span>!
            </h2>


        </AdminLayout>
    )
}