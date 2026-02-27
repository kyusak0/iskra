"use client"


type LoggoutButtonProps ={
    onLoggout: () => void
}

export default function LogoutButton({onLoggout} : LoggoutButtonProps) {
    

    return <button onClick={onLoggout}>Выйти</button>;
}