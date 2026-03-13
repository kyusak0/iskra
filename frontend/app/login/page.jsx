'use client'

import { useAuth } from '../../context/authContext';
import { useEffect, useRef, useState } from 'react';
import logoImage from '../../public/next.svg';
import DotPattern from '../../components/ui/dotPattern';
import Alert from '../../components/alert/Alert';
import Link from 'next/link';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [otpCode, setOtpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loginToken, setLoginToken] = useState('');

  const [parsing, setParsing] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginDisabled, setLoginDisabled] = useState(true);

  const { login, verify2FA } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newValue = { ...formData, [name]: value };

    if (
      newValue.email.includes('@') &&
      (newValue.email.includes('mail.') || newValue.email.includes('yandex.')) &&
      (newValue.email.includes('.ru') || newValue.email.includes('.com')) &&
      newValue.password.length > 8
    ) {
      setLoginDisabled(false);
    } else {
      setLoginDisabled(true);
    }

    setFormData(newValue);
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setOtpCode(value);
  };

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
        f.x += f.dx;
        f.y += f.dy;
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

  const [alert, setAlert] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setParsing(true);
    setErrors({});

    try {
      const result = await login(formData);

      if (!result.success) {
        if (typeof result.error === 'object') {
          setAlert({ content: result.error.toString(), type: 'err' })
        } else {
          console.logsetAlert(result.error)
        }

        // setAlert({ content: 'На данный момент работа сервера приостановлена', type: 'err' })
        return;
      }

      if (result.requires_2fa) {
        setRequires2FA(true);
        setLoginToken(result.login_token || '');
        return;
      }
    } catch (err) {
      setAlert({ content: err.message, type: 'err' })
    } finally {
      setParsing(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setOtpLoading(true);
    setErrors({});

    try {
      const result = await verify2FA({
        code: otpCode,
        loginToken,
      });

      if (!result.success) {
        if (typeof result.error === 'object') {
          setErrors(result.error);
        } else {
          setErrors({ general: result.error || 'Неверный код' });
        }
        return;
      }
    } catch (err) {
      setErrors({ general: err.message || 'Ошибка проверки 2FA' });
    } finally {
      setOtpLoading(false);
    }
  };

  const [alertMess, setAlertMess] = useState();

  return (
    <div id="auth-page" className='w-full'>
      <canvas ref={canvasRef} id="fireflies" className='bg-black fixed top-0 z-index[-1] w-full h-full' />


      <DotPattern initialRadius={140} activeRadius={220} />

      <div className="fixed flex justify-center items-center w-full h-full">
        <div className="grid grid-cols-6 shadow-xl bg-bg/15 backdrop-blur-xs lg:p-5 max-lg:p-2 rounded-md text-bg lg:w-2/4 max-lg:w-full max-lg:mx-10 " >
          <div className="col-span-3 flex flex-col max-lg:col-span-6 max-lg:items-center">
            <h2 className='text-4xl mb-8 text-main'>
              {requires2FA ? 'Подтверждение 2FA' : 'Войти'}
            </h2>

            {!requires2FA ? (
              <form onSubmit={handleSubmit} className='w-3/4 flex flex-col gap-5'>
                <input
                  placeholder='Почта...'
                  className="w-full px-3 py-2 border-2 border-main rounded-md"
                  type="text"
                  name="email"
                  id="email"
                  onChange={handleChange}
                  value={formData.email}
                  required
                />

                <input
                  placeholder='Пароль...'
                  className="w-full px-3 py-2 border-2 border-main rounded-md"
                  type="password"
                  name="password"
                  id="password"
                  onChange={handleChange}
                  value={formData.password}
                  required
                />

                {errors.general && (
                  <p className="text-red-400">{errors.general}</p>
                )}

                <div className='flex flex-col gap-5'>
                  <div className='flex'><a href="#">Забыли пароль?</a>
                  </div>

                  <button
                    className="px-3 py-2 bg-main hover:opacity-80 rounded-md uppercase font-bold disabled:bg-gray-300"
                    type="submit"
                    disabled={loginDisabled || parsing}
                  >
                    {parsing ? 'Вход...' : 'Войти'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerify2FA} className='w-3/4 flex flex-col gap-5'>
                <div className="p-3 rounded-md border border-main bg-black/20">
                  <p className="text-sm">
                    На аккаунте включена двухфакторная аутентификация.
                    Введи 6-значный код из Google Authenticator.
                  </p>
                </div>

                <input
                  placeholder='123456'
                  className="w-full px-3 py-3 border-2 border-main rounded-md text-center text-2xl tracking-[0.4em]"
                  type="text"
                  name="otp"
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={handleOtpChange}
                  value={otpCode}
                  required
                />

                {errors.general && (
                  <p className="text-red-400">{errors.general}</p>
                )}

                <div className='flex flex-col gap-3'>
                  <button
                    className="px-3 py-2 bg-main hover:opacity-80 rounded-md uppercase font-bold disabled:bg-gray-300"
                    type="submit"
                    disabled={otpCode.length !== 6 || otpLoading || !loginToken}
                  >
                    {otpLoading ? 'Проверка...' : 'Подтвердить'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRequires2FA(false);
                      setOtpCode('');
                      setLoginToken('');
                      setErrors({});
                    }}
                    className="px-3 py-2 border border-main rounded-md"
                  >
                    Назад
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="col-span-3 flex flex-col max-lg:col-span-6 justify-between items-center lg:border-l-2 border-main">

            <div className="">
              <a href="/" className={`uppercase transition-all duration-300 w-max flex font-bold p-5 gap-2 items-center`}>
                <img src="/logo.svg" alt="На главную" className="w-full h-10" />
                <span className={`transition-all duration-300 text-bg`}>искра</span>
              </a>
            </div>
            <div className="flex flex-col justify-between items-center">
              <p>Ещё нет аккаунта? </p>
              <p>
                <a href="/register" className='text-main'>Зарегистрироваться</a></p>
            </div>
          </div>

        </div >
      </div >
      <Alert id={Date.now()} content={alert?.content} type={alert?.type} />
    </div>
  );
}