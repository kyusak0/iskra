'use client'

import { useParams } from "next/navigation"
import MainLayout from "../../../layouts/MainLayout";
import { useAuth } from "../../../context/authContext";
import { useEffect, useState } from "react";

export default function ProfilePage() {
    const params = useParams();
    console.log(params);

    const [userData, setUserData] = useState(null);

    const {user, get} = useAuth()
    
    useEffect(()=>{
        getUserInfo(params.uid);
    },[]);

    const getUserInfo = async(userId) => {
        const res = await get('/user-info/' + userId);
        console.log(res)
    }

    return (
        <MainLayout>
            {userData?.name}
        </MainLayout>
    )
}