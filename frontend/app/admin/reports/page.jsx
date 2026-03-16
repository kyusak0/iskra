'use client'

import { useEffect, useState } from "react";
import Popup from "../../../components/popup/Popup";
import { useAuth } from "../../../context/authContext";
import AdminLayout from "../../../layouts/AdminLayout";

export default function AdminPanel() {
    const { user, post, get } = useAuth();

    const [reportData, setreportData] = useState({
        name: ''
    })

    const [reports, setreports] = useState([]);


    const deleteReport = async (e, reportId) => {
        e.preventDefault()
        const res = await get(`/delete-report/${reportId}`)

        if (res.success) {
            setreports(prev => prev.filter(report => report.id !== reportId));
            setAlert({ content: 'Жалоба успешно удалена', type: '' })
        }
    }

    const getReports = async () => {
        const res = await get('/get-reports');
        setreports([])

        res.data.map(el => (
            setreports(prev => [...prev, {
                id: el.id,
                desc: el.desc,
                target: el.target
            }]
            )
        ))
    }

    useEffect(() => {
        getReports();
    }, [])

    const [alert, setAlert] = useState();

    return (
        <AdminLayout alertMess={alert?.content} alertType={alert?.type}>
            <h2 className="text-3xl">
                Добро пожаловать, <span className="text-main">{user?.name}</span>!
            </h2>
            <div className="w-full flex justify-evenly items-center border-b-2 border-main py-5 mb-5">
                <h3 className="text-2xl text-main">
                    Жалобы
                </h3>

            </div>
            {reports?.map(report => (
                <div key={report.id} className="w-3/4 grid grid-cols-7">
                    <div className="col-span-1 border border-main p-2">
                        {report.id}
                    </div>
                    <div className="col-span-2 border border-main p-2">
                        {report.desc}
                    </div>
                    <div className="col-span-2 border border-main p-2">
                        {report.target}
                    </div>
                    <div className="col-span-2 border border-main p-2 flex justify-evenly">
                        <Popup openTrigger={
                            <button>
                                Удалить
                            </button>
                        }>
                            <form action="" onSubmit={(e) => deleteReport(e, report.id)} className="flex flex-col gap-5 h-60 justify-center items-center">
                                <p className="">Вы уверены что хотите <span className="text-main uppercase">Удалить</span> жалобу <span className="text-main uppercase">#{report.id}</span></p>
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