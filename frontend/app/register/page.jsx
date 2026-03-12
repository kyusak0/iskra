'use client'

import { useAuth } from '../../context/authContext';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import logoImage from '../../public/next.svg'

import DotPattern from '../../components/ui/dotPattern';
import Alert from '../../components/alert/Alert';

export default function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        password_confirmation: ''
    });
    const [errors, setErrors] = useState({});
    const { register } = useAuth();
    const router = useRouter();

    const [parsing, setParsing] = useState(false);

    const [regDisabled, setRegDisabled] = useState(true)

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newValue = { ...formData, [name]: value };

        if (newValue.email.includes('@')
            && (newValue.email.includes('mail.') || newValue.email.includes('yandex.'))
            && (newValue.email.includes('.ru') || newValue.email.includes('.com'))
            && newValue.password.length > 8
            && (newValue.password == newValue.password_confirmation)) {
            setRegDisabled(false);
        } else {
            setRegDisabled(true);
        }

        setFormData(newValue);
    };

    const dotPatternRef = useRef(null);
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let W = (canvas.width = window.innerWidth);
        let H = (canvas.height = window.innerHeight);

        const onResize = () => {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", onResize);


        const fireflies = Array.from({ length: 200 }).map(() => ({
            x: Math.random() * W,
            y: Math.random() * H,
            r: 1.5 + Math.random() * 6,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            glow: Math.random(),
        }));

        let raf = 0;
        const animate = () => {
            ctx.clearRect(0, 0, W, H);
            fireflies.forEach((f) => {
                f.x += f.dx; f.y += f.dy;
                f.glow += (Math.random() - 0.5) * 0.02;
                if (f.x < 0 || f.x > W) f.dx *= -1;
                if (f.y < 0 || f.y > H) f.dy *= -1;
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,180,${0.5 + f.glow})`;
                ctx.fill();
            });
            raf = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(raf);
        };
    }, []);

    const [alert, setAlert] = useState();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setParsing(true)
        setErrors({});
        try {
            const result = await register(formData);

            if (!result.success) {

                if (typeof result.error === 'object') {
                    setAlert({ content: result.error, type: 'err' })
                } else {
                    setAlert({ content: result.error, type: 'err' })
                }

                setAlert({ content: 'На данный момент работа сервера приостановлена', type: 'err' })
                return;
            }
        } catch (err) {
            setAlert({ content: err.message, type: 'err' })
        } finally {
            setParsing(false)
        }
    };



    return (
        <div id="reg-page">
            <canvas ref={canvasRef} id="fireflies" className='bg-black fixed top-0 z-index[-1] w-full h-full' />
            <DotPattern initialRadius={140} activeRadius={220} />


            <div className="fixed z-index-2 flex justify-center items-center w-full h-full">
                <div className="grid grid-cols-6 shadow-xl bg-bg/15 backdrop-blur-xs p-5 rounded-md text-bg w-2/4" >
                    <div className="col-span-3 flex flex-col">
                        <h2 className='text-4xl mb-8 text-main'>Регистрация</h2>
                        <form onSubmit={handleSubmit}
                            className='w-3/4 flex flex-col gap-5'>

                            <input placeholder='Имя...'
                                className="w-full px-3 py-2 border-2 border-main rounded-md"
                                type="text" name="name" id="name"
                                onChange={handleChange}
                                required />

                            <input placeholder='Почта...'
                                className="w-full px-3 py-2 border-2 border-main rounded-md"
                                type="text" name="email" id="email"
                                onChange={handleChange}
                                required />

                            <input placeholder='Пароль...'
                                className="w-full px-3 py-2 border-2 border-main rounded-md"
                                type="text" name="password" id="password"
                                onChange={handleChange}
                                required />

                            <input placeholder='Потвердить пароль...'
                                className="w-full px-3 py-2 border-2 border-main rounded-md"
                                type="text" name="password_confirmation" id="password_confirmation"
                                onChange={handleChange}
                                required />

                            <div className='flex flex-col gap-5'>
                                <button
                                    className="px-3 py-2 bg-main hover:opacity-80 rounded-md uppercase font-bold disabled:bg-gray-300"
                                    type="submit" disabled={regDisabled}>
                                    {parsing ? 'Регистрация...' : 'Зарегистрироваться'}
                                </button>
                            </div>
                        </form>
                    </div>
                    <div className="col-span-3 flex flex-col justify-between items-center border-l-2 border-main">
                        <div className="">
                            <a href="/" className={`uppercase transition-all duration-300 w-max flex font-bold p-5 gap-2 items-center`}>
                                <img src="/logo.svg" alt="На главную" className="w-full h-10" />
                                <span className={`transition-all duration-300 text-bg`}>искра</span>
                            </a>
                        </div><div className="flex flex-col justify-between items-center">
                            <p>Уже есть аккаунт? </p>
                            <p><a href="/login" className='text-main'>Войти</a></p>
                        </div>
                    </div>
                </div>
            </div>
            <Alert id={Date.now()} content={alert?.content} type={alert?.type} />
        </div>
    );
}