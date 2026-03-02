'use client'

import { notFound, useParams } from "next/navigation"
import MainLayout from "../../../layouts/MainLayout";
import { useAuth } from "../../../context/authContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Popup from "../../../components/popup/Popup";

const BASE_URL = 'http://localhost:8001/storage/';

export default function ProfilePage() {
    const params = useParams();
    console.log(params);

    const [userData, setUserData] = useState(null);
    const router = useRouter()

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
                    posts: res.data.posts
                });
            } else {
                router.push('/404')
            }


        } catch (error) {
            console.log(error.message)
        }
    }

    const [file, setFile] = useState(null);

    const setAvatar = async (e) => {
        e.preventDefault()
        try {
            let loadFile = null
            if (file && file.type.includes('image')) {
                const formData = {
                    file: file,
                    author_id: user.id
                }
                loadFile = await post('/load-file', formData);

                setUserData(userData, {
                    avatar: loadFile.data.name,
                });

                const data = {
                    user_id: user.id,
                    avatar: loadFile.data.name
                }

                const editUser = await post('/set-avatar', data)

                console.log(editUser)
            }
        } catch (error) {
            console.log(error.message)
        }

    }

    return (
        <MainLayout>
            <div className="flex pb-2 flex-col items-center gap-5 border-b-2 border-main">
                <Popup
                    openTrigger={userData?.avatar ? (
                        <img src={`${BASE_URL + userData.avatar}`} alt="" className="w-20 h-20 rounded-full bg-main"/>
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-main text-4xl font-bold text-white flex items-center justify-center">
                            {userData?.name[0]}
                        </div>
                    )}
                >


                    <form className="w-full flex flex-col gap-5 items-center" onSubmit={setAvatar}>
                        {userData?.avatar ? (
                            <img src={`${BASE_URL + userData.avatar}`} alt=""  className="w-20 h-20 rounded-full bg-main"/>
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-main text-4xl font-bold text-white flex items-center justify-center">
                                {userData?.name[0]}
                            </div>
                        )}
                        <h3 className="text-xl">
                            Загрузить аватар
                        </h3>
                        <input type="file" name="source" id="source" className="hidden"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setFile(e.target.files[0])
                                }
                            }}
                        />
                        <div className="flex gap-5">
                            <label htmlFor="source"
                                className="underline text-main"
                            >Загрузить аватар</label>
                            {file?.name}
                        </div>
                        <button type="submit"
                            className="w-max px-2 py-1 bg-main text-white font-bold uppercase rounded-md text-center"
                        >Загрузить</button>
                    </form>
                </Popup>

                <h2 className="text-2xl ">
                    {userData?.name}
                </h2>

                <div className="grid grid-cols-3 gap-5 text-center">
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
                            {(post.source && post.source.type.includes('image')) ? (
                                <img src={`${BASE_URL}${post.source.name}`} alt="" className=" h-20 z-index-[-1]" />
                            ) : (
                                <span className="text-center italic">нет фото или видео</span>
                            )}
                            <div className="w-full">
                                <p className="lg:text-2xl max-lg:text-xl">
                                    {post.title}
                                </p>
                                <p>
                                    {post.desc}
                                </p>
                            </div>

                        </div>
                        <a href={`/posts/${post.id}`}
                            className="w-full px-2 py-1 bg-main text-white font-bold uppercase rounded-md text-center">перейти</a>
                    </div>
                ))}</div>
        </MainLayout>
    )
}