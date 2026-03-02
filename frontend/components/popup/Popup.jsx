'use client'

import { ReactNode, useState } from "react"

export default function Popup({
    children, openTrigger, sidebar
}) {
    const [open, setOpen] = useState(false);
    const openPopup = () => setOpen(true);
    const closePopup = () => setOpen(false);

    return (
        <>
            <div className="" onClick={openPopup}>
                {openTrigger}
            </div>
            {open && (
                <div className="fixed w-full h-screen top-0 left-0 flex flex-col justify-center items-center z-3">
                    <div 
                    className="absolute bg-gray-900 opacity-60 w-full h-screen top-0" 
                    onClick={closePopup}></div>
                    <div id='content'
                        className={`absolute w-3/4`}>
                        <div className="w-full h-10 absolute top-2 flex items-top justify-end gap-5 pr-5">
                            <button
                                onClick={closePopup}
                                className="text-gray-500 hover:text-gray-700"
                                title="Закрыть"
                            >❌
                            </button>
                        </div>
                        <div className="w-full bg-white p-5 rounded-md">
                            {children}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}