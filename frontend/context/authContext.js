// 'use client';

// import { createContext, useContext, useState, useEffect } from 'react';
// import axios from '../lib/axios';
// import { useRouter } from 'next/navigation';

// const AuthContext = createContext({});

// export const useAuth = () => useContext(AuthContext);

// export const AuthProvider = ({ children }) => {
//     const [user, setUser] = useState(null);
//     const [loading, setLoading] = useState(true);
//     const router = useRouter();

//     useEffect(() => {
//         checkUser();
//     }, []);

//     const checkUser = async () => {
//         try {
//             const token = localStorage.getItem('token');
//             if (token) {
//                 const response = await axios.get('/user');
//                 setUser(response.data);
//             }
//         } catch (error) {
//             localStorage.removeItem('token');
//             setUser(null);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const register = async (userData) => {
//         try {
//             const response = await axios.post('/register', userData);
//             const { token, user } = response.data;
//             localStorage.setItem('token', token);
//             setUser(user);
//             router.push('/dashboard');
//             return { success: true };
//         } catch (error) {
//             return {
//                 success: false,
//                 error: error.response?.data?.errors || error.response?.data?.message || 'Registration failed'
//             };
//         }
//     };

//     const login = async (credentials) => {
//         try {
//             const response = await axios.post('/login', credentials);
//             const { token, user } = response.data;
//             localStorage.setItem('token', token);
//             setUser(user);
//             router.push('/dashboard');
//             return { success: true };
//         } catch (error) {
//             return {
//                 success: false,
//                 error: error.response?.data?.errors || error.response?.data?.message || 'Login failed'
//             };
//         }
//     };

//     const logout = async () => {
//         try {
//             await axios.post('/logout');
//         } catch (error) {
//             console.error('Logout error:', error);
//         } finally {
//             localStorage.removeItem('token');
//             setUser(null);
//             router.push('/login');
//         }
//     };

//     const post = async (link, data) => {
//         try {
//             const response = await axios.post(link, data, {
//                 headers: {
//                     'Content-Type': 'multipart/form-data'
//                 }
//             });
//             return response.data;
//         } catch (error) {
//             return {
//                 success: false,
//                 error: error.response?.data?.errors || error.response?.data?.message || 'failed of ' + link
//             };
//         }
//     }

//     const get = async (link) => {
//         try {
//             const response = await axios.get(link);
//             return response.data;
//         } catch (error) {
//             return {
//                 success: false,
//                 error: error.response?.data?.errors || error.response?.data?.message || 'failed of ' + link
//             };
//         }
//     }

//     const value = {
//         user,
//         loading,
//         register,
//         login,
//         logout,
//         checkUser,
//         post,
//         get,
//     };

//     return (
//         <AuthContext.Provider value={value}>
//             {children}
//         </AuthContext.Provider>
//     );
// };



// ==================================   ЧАТ ДЖБТ КОД \/ =======================
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axios from '../lib/axios';
import { notFound, useRouter } from 'next/navigation';
import Alert from '../components/alert/Alert';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        try {
            const token = localStorage.getItem('token');

            if (token) {
                const response = await axios.get('/user');
                setUser(response.data);
            } else {
                setUser(null);
            }
        } catch (error) {
            localStorage.removeItem('token');
            setUser(null);
            setAlert({
                content: error.response?.data?.message || 'Ошибка проверки пользователя',
                type: 'err'
            });
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData) => {
        try {
            const response = await axios.post('/register', userData);
            const { token, user } = response.data;

            localStorage.setItem('token', token);
            setUser(user);
            router.push(`/users/${response.data.user.id}`);

            setAlert({
                content: 'Регистрация успешно завершена',
                type: 'success'
            });

            return { success: true };
        } catch (error) {
            const errorMessage = error.response?.data?.errors ||
                error.response?.data?.message ||
                'Ошибка регистрации';

            setAlert({
                content: errorMessage,
                type: 'err'
            });

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const login = async (credentials) => {
        try {
            const response = await axios.post('/login', credentials);
            const data = response.data;

            // Если сервер требует 2FA — пока НЕ логиним окончательно
            if (data.requires_2fa) {
                setAlert({
                    content: 'Требуется подтверждение 2FA',
                    type: 'success'
                });

                return {
                    success: true,
                    requires_2fa: true,
                    login_token: data.login_token,
                };
            }

            // Обычный вход без 2FA
            if (data.token && data.user) {
                localStorage.setItem('token', data.token);
                setUser(data.user);
                router.push(`/users/${data.user.id}`);

                setAlert({
                    content: 'Вход выполнен успешно',
                    type: 'success'
                });

                return {
                    success: true,
                    requires_2fa: false
                };
            }

            const errorMessage = 'Некорректные данные';
            setAlert({
                content: errorMessage,
                type: 'err'
            });

            return {
                success: false,
                error: errorMessage
            };
        } catch (error) {
            const errorMessage = error.response?.data?.errors ||
                error.response?.data?.message ||
                'Ошибка входа';

            setAlert({
                content: errorMessage,
                type: 'err'
            });

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const verify2FA = async ({ code, loginToken }) => {
        try {
            const response = await axios.post(
                '/2fa/verify-login',
                { code },
                {
                    headers: {
                        Authorization: `Bearer ${loginToken}`,
                    },
                }
            );

            const data = response.data;

            if (data.token && data.user) {
                localStorage.setItem('token', data.token);
                setUser(data.user);
                router.push('/');

                setAlert({
                    content: '2FA подтвержден успешно',
                    type: 'success'
                });

                return { success: true };
            }

            const errorMessage = 'Некорректный ответ сервера после проверки 2FA';
            setAlert({
                content: errorMessage,
                type: 'err'
            });

            return {
                success: false,
                error: errorMessage
            };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Неверный код 2FA';

            setAlert({
                content: errorMessage,
                type: 'err'
            });

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const logout = async () => {
        try {
            await axios.post('/logout');
            setAlert({
                content: 'Выход выполнен успешно',
                type: 'success'
            });
        } catch (error) {
            console.error('Logout error:', error);
            setAlert({
                content: 'Ошибка при выходе из системы',
                type: 'err'
            });
        } finally {
            localStorage.removeItem('token');
            setUser(null);
            router.push('/login');
        }
    };

    const post = async (link, data) => {
        try {
            const response = await axios.post(link, data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                setAlert({
                    content: 'Операция выполнена успешно',
                    type: ''
                });
            } else {
                setAlert({
                    content: response.data.message || 'Операция не удалась'+link,
                    type: 'err'
                });
            }

            return response.data;
        } catch (error) {
            const errorMessage = error.response?.data?.errors ||
                error.response?.data?.message ||
                `Ошибка при выполнении запроса к ${link}`;

            setAlert({
                content: errorMessage,
                type: 'err'
            });

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const get = async (link) => {
        try {
            const response = await axios.get(link);
            return response.data;
        } catch (error) {
            const errorMessage = error.response?.data?.errors ||
                error.response?.data?.message ||
                `Ошибка при выполнении запроса к ${link}`;

            setAlert({
                content: errorMessage,
                type: 'err'
            });

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const value = {
        user,
        loading,
        register,
        login,
        verify2FA,
        logout,
        checkUser,
        post,
        get,
    };

    const [alert, setAlert] = useState()

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main"></div>
            </div>
        );
    }

    if(user?.is_blocked == 'true'){
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-3xl text-main">Ваш аккаунт был заблокирован</div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
            <Alert id={Date.now()} content={alert?.content} type={alert?.type} />
        </AuthContext.Provider>
    );
};