'use client'

import { useEffect, useState } from "react";
import Popup from "../../../components/popup/Popup";
import { useAuth } from "../../../context/authContext";
import AdminLayout from "../../../layouts/AdminLayout";

export default function AdminPanel() {
    const { user, post, get } = useAuth();

    const [tagData, setTagData] = useState({
        name: ''
    })

    const [tags, setTags] = useState([]);

    const createTag = async (e) => {
        e.preventDefault()
        const res = await post('/create-tag', tagData)
        console.log(res)
        setTagData({name: ''})
    }

    const editTag = async (e, tagId) => {
        e.preventDefault()
        const newData = {
            id: tagId,
            name: tagData.name
        }
        const res = await post('/edit-tag', newData)
        console.log(res)

        setAlert({ content: 'Тег успешно изменен', type: '' })
    }

    const deleteTag = async (e, tagId) => {
        e.preventDefault()
        const res = await get(`/delete-tag/${tagId}`)
        console.log(res)

        setAlert({ content: 'Тег успешно удален', type: '' })
    }

    const getTags = async () => {
        const res = await get('/get-tags');
        setTags([])

        res.data.map(el => (
            setTags(prev => [...prev, {
                id: el.id,
                name: el.name
            }]
            )
        ))
    }

    useEffect(() => {
        getTags();
    }, [])

    const [alert, setAlert] = useState();

    return (
        <AdminLayout alertMess={alert?.content} alertType={alert?.type}>
            <h2 className="text-3xl">
                Добро пожаловать, <span className="text-main">{user?.name}</span>!
            </h2>
            <div className="w-full flex justify-evenly items-center border-b-2 border-main py-5 mb-5">
                <h3 className="text-2xl text-main">
                    Теги
                </h3>

                <Popup openTrigger={
                    <button className="btn rounded-md">
                        Новый тег
                    </button>
                }>
                    <form action="" onSubmit={createTag} className="flex flex-col gap-5 h-60 justify-center">
                        <input type="text" className="px-3 py-2 border-2 border-main rounded-md"
                            value={tagData.name}
                            onChange={(e) => {
                                setTagData({ name: e.target.value })
                            }}
                            placeholder="Название тега..." />
                        <button type="submit" className="btn rounded-md">
                            Добавить
                        </button>
                    </form>
                </Popup>
            </div>
            {tags?.map(tag => (
                <div key={tag.id} className="w-3/4 grid grid-cols-5">
                    <div className="col-span-1 border border-main p-2">
                        {tag.id}
                    </div>
                    <div className="col-span-2 border border-main p-2">
                        {tag.name}
                    </div>
                    <div className="col-span-2 border border-main p-2 flex justify-evenly">
                        <Popup openTrigger={
                            <button>
                                Редактировать
                            </button>
                        }>
                            <form action="" onSubmit={(e) => editTag(e, tag.id)} className="flex flex-col gap-5 h-60 justify-center">
                                <input type="text" className="px-3 py-2 border-2 border-main rounded-md"
                                    value={tagData.name || tag.name}
                                    onChange={(e) => {
                                        setTagData({ name: e.target.value })
                                    }}
                                    placeholder="Название тега..." />
                                <button type="submit" className="btn rounded-md">
                                    Редактировать
                                </button>
                            </form>
                        </Popup>
                        <Popup openTrigger={
                            <button>
                                Удалить
                            </button>
                        }>
                            <form action="" onSubmit={(e) => deleteTag(e, tag.id)} className="flex flex-col gap-5 h-60 justify-center items-center">
                                <p className="">Вы уверены что хотите <span className="text-main uppercase">Удалить</span> тег <span className="text-main uppercase">{tag.name}</span></p>
                                <button type="submit" className="w-max btn rounded-md">
                                    Удалить
                                </button>
                            </form>
                        </Popup>
                    </div>
                </div>

            ))}
        </AdminLayout>
    )
}