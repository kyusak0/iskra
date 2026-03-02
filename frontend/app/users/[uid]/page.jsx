'use client'

import { notFound, useParams } from "next/navigation"
import MainLayout from "../../../layouts/MainLayout";
import { useAuth } from "../../../context/authContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = 'http://localhost:8001/storage/';

export default function ProfilePage() {
    const params = useParams();
    console.log(params);

    const [userData, setUserData] = useState(null);
    const router = useRouter()
    const [disable2FAOpen, setDisable2FAOpen] = useState(false);
    const [disableCode, setDisableCode]= useState();
    const [disableForm, setDisableForm] = useState({
        email: '',
        password: '',
        code: '',
    });
    const [disableLoading, setDisableLoading] = useState(false);
    const [disableError, setDisableError] = useState('');

    const { user, get, post, loading } = useAuth()

    useEffect(() => {
        getUserInfo(params.uid);
    }, []);

    const getUserInfo = async (userId) => {
        try {
            const res = await get('/user-info/' + userId);
            if (res.success) {
                setUserData({
                    name: res.data.name,
                    avatar: res.data.avatar,
                    posts: res.data.posts,
                    google2fa_enabled: !!res.data.google2fa_enabled,
                });
            } else {
                router.push('/404')
            }


        } catch (error) {
            console.log(error.message)
        }
    }
    const handleDisableChange = (e) => {
        const { name, value } = e.target;

        setDisableForm((prev) => ({
            ...prev,
            [name]: name === 'code' ? value.replace(/\D/g, '') : value,
        }));
    };
    const handleDisable2FA = async (e) => {
        e.preventDefault();
        setDisableLoading(true);
        setDisableError('');

        try {
            const res = await post('/2fa/disable', disableForm);

            if (res.success === false) {
                setDisableError(res.error || 'Не удалось отключить 2FA');
                return;
            }

            setUserData((prev) => ({
                ...prev,
                google2fa_enabled: false,
            }));

            setDisableForm({
                email: '',
                password: '',
                code: '',
            });

            setDisable2FAOpen(false);
        } catch (error) {
            setDisableError(error.message || 'Ошибка отключения 2FA');
        } finally {
            setDisableLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="flex pb-2 flex-col items-center gap-5 border-b-2 border-main">
                {userData?.source ? (
                    <img src={`${BASE_URL + userData.avatar}`} alt="" />
                ) : (
                    <div className="w-20 h-20 rounded-full bg-main text-4xl font-bold text-white flex items-center justify-center">
                        {userData?.name[0]}
                    </div>
                )}
                <h2 className="text-2xl ">
                    {userData?.name}
                </h2>

                <div className="grid grid-cols-3 gap-5 text-center">
                    {user && String(user.id) === String(params.uid) && (
                        <div className="col-span-3 flex flex-col gap-3 items-center">
                            {!userData?.google2fa_enabled ? (
                                <button
                                    onClick={() => router.push(`/users/${params.uid}/2fa`)}
                                    className="px-4 py-2 bg-main text-white font-bold rounded-md"
                                >
                                    Включить 2FA
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setDisable2FAOpen((prev) => !prev);
                                            setDisableError('');
                                            setDisableCode('');
                                        }}
                                        className="px-4 py-2 bg-red-600 text-white font-bold rounded-md"
                                    >
                                        Выключить 2FA
                                    </button>

                                    {disable2FAOpen && (
                                     
                                            <form
                                                onSubmit={handleDisable2FA}
                                                className="flex flex-col gap-3 w-full max-w-sm"
                                            >
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={disableForm.email}
                                                    onChange={handleDisableChange}
                                                    placeholder="Введите email"
                                                    className="w-full px-3 py-2 border-2 border-main rounded-md"
                                                    required
                                                />

                                                <input
                                                    type="password"
                                                    name="password"
                                                    value={disableForm.password}
                                                    onChange={handleDisableChange}
                                                    placeholder="Введите пароль"
                                                    className="w-full px-3 py-2 border-2 border-main rounded-md"
                                                    required
                                                />

                                                <input
                                                    type="text"
                                                    name="code"
                                                    inputMode="numeric"
                                                    maxLength={6}
                                                    value={disableForm.code}
                                                    onChange={handleDisableChange}
                                                    placeholder="123456"
                                                    className="w-full px-3 py-2 border-2 border-main rounded-md text-center text-xl tracking-[0.3em]"
                                                    required
                                                />

                                                {disableError && (
                                                    <p className="text-red-500 text-center">{disableError}</p>
                                                )}

                                                <button
                                                    type="submit"
                                                    disabled={
                                                        disableForm.code.length !== 6 ||
                                                        !disableForm.email ||
                                                        !disableForm.password ||
                                                        disableLoading
                                                    }
                                                    className="px-4 py-2 bg-main text-white font-bold rounded-md disabled:bg-gray-300"
                                                >
                                                    {disableLoading ? 'Проверка...' : 'Подтвердить отключение'}
                                                </button>
                                           

                                            
                                        </form>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    <div className="col-span-1">подписчиков</div>
                    <div className="col-span-1">подписки</div>
                    <div className="col-span-1">???</div>
                    <div className="col-span-1 font-bold">0</div>
                    <div className="col-span-1 font-bold">0</div>
                    <div className="col-span-1 font-bold">??</div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-5 pt-5 h-[50vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {userData?.posts.map(post => (
                    <div className="col-span-1 max-lg:col-span-3 border-2 border-main p-5 flex flex-col justify-center" key={post.id}>
                        <div className="flex gap-2 pb-2 items-center">
                            {(post.source && post.source.type.includes('image/')) ? (
                                <img src={`${BASE_URL}${post.source.name}`} alt="" className=" h-20 z-index-[-1]" />
                            ) : post.source ? (
                                // <button onClick={() => downloadFile(post.source)}>
                                //   Скачать прикрепленный файл
                                // </button>
                                null
                            ) : (<span className="text-center italic">нет фото или видео</span>)}
                            <div className=""><p className="lg:text-2xl max-lg:text-xl">
                                {post.title}
                            </p>
                                <p>
                                    {post.desc}
                                </p>
                            </div>

                        </div>
                        <a href={`/post/${post.id}`} className="w-full px-2 py-1 bg-main text-white font-bold uppercase rounded-md text-center">перейти</a>
                    </div>
                ))}</div>
        </MainLayout>
    )
}