'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MainLayout from '../../layouts/MainLayout';
import { useAuth } from '../../context/authContext';

const BASE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:8001/storage/';

const tabs = [
    { key: 'friends', label: 'Друзья' },
    { key: 'incoming_requests', label: 'Входящие' },
    { key: 'outgoing_requests', label: 'Исходящие' },
    { key: 'blocked_users', label: 'Блокировки' },
];

function UserAvatar({ user }) {
    if (user?.avatar) {
        return (
            <img
                src={`${BASE_URL}${user.avatar}`}
                alt={user?.name || 'User avatar'}
                className="w-14 h-14 rounded-full object-cover bg-main/10"
            />
        );
    }

    return (
        <div className="w-14 h-14 rounded-full bg-main text-white font-bold flex items-center justify-center text-xl">
            {user?.name?.[0] || '?'}
        </div>
    );
}

export default function FriendsPage() {
    const { user, get, post } = useAuth();
    const [activeTab, setActiveTab] = useState('friends');
    const [friendsData, setFriendsData] = useState({
        friends: [],
        incoming_requests: [],
        outgoing_requests: [],
        blocked_users: [],
        counts: {
            friends: 0,
            incoming_requests: 0,
            outgoing_requests: 0,
            blocked_users: 0,
        },
    });
    const [isLoading, setIsLoading] = useState(true);
    const [actionUserId, setActionUserId] = useState(null);

    const loadFriends = useCallback(async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const response = await get('/friends', { silent: true });
        if (response?.success && response?.data) {
            setFriendsData(response.data);
        }
        setIsLoading(false);
    }, [get, user]);

    useEffect(() => {
        loadFriends();
    }, [loadFriends]);

    const handleAction = useCallback(async (endpoint, userId) => {
        setActionUserId(userId);
        try {
            const response = await post(endpoint, { user_id: userId });
            if (response?.success) {
                await loadFriends();
            }
        } finally {
            setActionUserId(null);
        }
    }, [loadFriends, post]);

    const currentItems = useMemo(() => friendsData?.[activeTab] || [], [activeTab, friendsData]);

    const renderActions = (item) => {
        const isBusy = actionUserId === item.id;

        if (activeTab === 'friends') {
            return (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleAction('/friends/remove', item.id)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:bg-gray-300"
                    >
                        {isBusy ? 'Секунду...' : 'Удалить из друзей'}
                    </button>
                    <button
                        onClick={() => handleAction('/friends/block', item.id)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:bg-gray-300"
                    >
                        Заблокировать
                    </button>
                </div>
            );
        }

        if (activeTab === 'incoming_requests') {
            return (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleAction('/friends/accept', item.id)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:bg-gray-300"
                    >
                        {isBusy ? 'Секунду...' : 'Принять'}
                    </button>
                    <button
                        onClick={() => handleAction('/friends/decline', item.id)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-md bg-gray-600 text-white font-semibold hover:bg-gray-700 disabled:bg-gray-300"
                    >
                        Отклонить
                    </button>
                    <button
                        onClick={() => handleAction('/friends/block', item.id)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:bg-gray-300"
                    >
                        Заблокировать
                    </button>
                </div>
            );
        }

        if (activeTab === 'outgoing_requests') {
            return (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleAction('/friends/cancel', item.id)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-md bg-gray-600 text-white font-semibold hover:bg-gray-700 disabled:bg-gray-300"
                    >
                        {isBusy ? 'Секунду...' : 'Отозвать заявку'}
                    </button>
                    <button
                        onClick={() => handleAction('/friends/block', item.id)}
                        disabled={isBusy}
                        className="px-3 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 disabled:bg-gray-300"
                    >
                        Заблокировать
                    </button>
                </div>
            );
        }

        return (
            <button
                onClick={() => handleAction('/friends/unblock', item.id)}
                disabled={isBusy}
                className="px-3 py-2 rounded-md bg-main text-white font-semibold hover:bg-main-dark disabled:bg-gray-300"
            >
                {isBusy ? 'Секунду...' : 'Разблокировать'}
            </button>
        );
    };

    const emptyStateText = {
        friends: 'Список друзей пока пуст.',
        incoming_requests: 'Входящих заявок пока нет.',
        outgoing_requests: 'Исходящих заявок пока нет.',
        blocked_users: 'У вас пока нет заблокированных пользователей.',
    };

    return (
        <MainLayout>
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
                <div className="flex flex-col gap-2 border-b-2 border-main pb-4">
                    <h1 className="text-3xl font-bold">Друзья и заявки</h1>
                    <p className="text-gray-600">Управляйте друзьями, входящими и исходящими заявками, а также блокировками.</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-xl border-2 p-4 text-left transition-colors ${activeTab === tab.key ? 'border-main bg-main/5' : 'border-main/20 hover:border-main/50'}`}
                        >
                            <div className="text-sm text-gray-600">{tab.label}</div>
                            <div className="text-2xl font-bold">{friendsData?.counts?.[tab.key] || 0}</div>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-3 border-b border-gray-200 pb-3">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-full font-semibold transition-colors ${activeTab === tab.key ? 'bg-main text-white' : 'bg-main/10 text-main hover:bg-main/20'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {!user ? (
                    <div className="p-6 rounded-xl border border-main/20 bg-main/5">
                        Чтобы пользоваться друзьями и заявками, войдите в аккаунт.
                    </div>
                ) : isLoading ? (
                    <div className="p-6 rounded-xl border border-main/20 bg-main/5">Загрузка списка друзей...</div>
                ) : currentItems.length === 0 ? (
                    <div className="p-6 rounded-xl border border-main/20 bg-main/5">{emptyStateText[activeTab]}</div>
                ) : (
                    <div className="grid gap-4">
                        {currentItems.map((item) => (
                            <div key={`${activeTab}-${item.id}`} className="border-2 border-main/20 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <UserAvatar user={item} />
                                    <div className="min-w-0">
                                        <Link href={`/users/${item.id}`} className="text-xl font-semibold hover:underline break-all">
                                            {item.name}
                                        </Link>
                                        <div className="text-sm text-gray-600 mt-1">
                                            {activeTab === 'friends' && item.responded_at && `В друзьях с ${new Date(item.responded_at).toLocaleDateString()}`}
                                            {activeTab === 'incoming_requests' && item.requested_at && `Заявка пришла ${new Date(item.requested_at).toLocaleDateString()}`}
                                            {activeTab === 'outgoing_requests' && item.requested_at && `Заявка отправлена ${new Date(item.requested_at).toLocaleDateString()}`}
                                            {activeTab === 'blocked_users' && item.blocked_at && `Заблокирован ${new Date(item.blocked_at).toLocaleDateString()}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                    <Link
                                        href={`/users/${item.id}`}
                                        className="px-3 py-2 rounded-md border border-main text-main font-semibold hover:bg-main/5"
                                    >
                                        Профиль
                                    </Link>
                                    {renderActions(item)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
