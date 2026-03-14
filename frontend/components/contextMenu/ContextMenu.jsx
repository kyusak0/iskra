import { useState, MouseEvent, useEffect } from "react";

export default function ContextMenu({
    children,
    openTrigger,
    closing,
}) {
    const [context, setContext] = useState({
        visible: false,
        x: 0,
        y: 0,
    });

    const openContextMenu = (event) => {
        event.preventDefault();
        setContext({
            visible: true,
            x: event.clientX - 150,
            y: event.clientY,
        });
    };

    useEffect(()=>{
        if(closing){
            setContext(prev => ({ ...prev, visible: !closing }));
        }
        
    }, [closing])

    const closeContextMenu = () => {
        setContext(prev => ({ ...prev, visible: false }));
    };

    return (
        <>

            <div className="max-lg:hidden"
                onContextMenu={openContextMenu}
            >
                {openTrigger}
            </div>

            <div className="lg:hidden"
                onClick={openContextMenu}
            >
                {openTrigger}
            </div>

            {context.visible && (
                <div
                    className="fixed w-full h-screen top-0 left-0  z-3"
                >
                    <div
                        className="absolute w-full h-screen"
                        onClick={closeContextMenu}
                    >
                    </div>
                    <div
                        className="absolute bg-white border-2 rounded-md border-main"
                        style={{
                            left: `${context.x}px`,
                            top: `${context.y}px`,
                        }}
                    >
                        <div className="p-[10px]">
                            {children}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}