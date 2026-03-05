'use client'

import { useEffect, useState } from "react";

export default function Alert({id, content, type }) {
    const [openedAlert, setOpenedAlert] = useState(false);
    const closeAlert = () => {
        setOpenedAlert(false);
        setTimeout(() => setCurrentAlert(''), 300);
    }

    let [num, setNum] = useState(10)

    const [currentAlert, setCurrentAlert] = useState('');

    useEffect(() => {
        if (content && content.textContent !== '') {
            setCurrentAlert(content);
            setOpenedAlert(true);
            setNum(10);

            const countdownTimer = setInterval(() => {
                setNum(prevNum => {
                    if (prevNum <= 1) {
                        clearInterval(countdownTimer);
                        return 0;
                    }
                    return prevNum - 1;
                });
            }, 1000);

            const closeTimer = setTimeout(() => {
                handleCloseAlert();
            }, 10000);

            return () => {
                clearInterval(countdownTimer);
                clearTimeout(closeTimer);
            };
        } else {
            setOpenedAlert(false);
        }
    }, [content, id]);

    const handleCloseAlert = () => {
        setOpenedAlert(false);
        setTimeout(() => {
            setCurrentAlert('');
            setNum(10);
        }, 300);
    };

    return (
        <div className={`${openedAlert ? 'fixed' : 'hidden'} border-2
        ${type == 'warn' ? 'border-yellow-500' : type == 'err' ? 'border-red-500' : 'border-main'}
        text-left top-20 right-10 w-1/5 bg-bg rounded-md p-2 `}>
            <div className="relative">
                <span className="text-xs text-left">автоматическое закрытие через <span className="text-xl text-main"> {num} </span> секунд</span>

                <button className="absolute top-0 right-0" onClick={closeAlert}>❌</button>
            </div>
            <div className="mt-5"></div>
            {currentAlert}
        </div>
    )
}