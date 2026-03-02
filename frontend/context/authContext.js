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
import { useRouter } from 'next/navigation';

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
            router.push('/dashboard');

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error:
                    error.response?.data?.errors ||
                    error.response?.data?.message ||
                    'Registration failed'
            };
        }
    };

    const login = async (credentials) => {
        try {
            const response = await axios.post('/login', credentials);
            const data = response.data;

            // Если сервер требует 2FA — пока НЕ логиним окончательно
            if (data.requires_2fa) {
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
                router.push('/dashboard');

                return {
                    success: true,
                    requires_2fa: false
                };
            }

            return {
                success: false,
                error: 'Некорректный ответ сервера'
            };
        } catch (error) {
            return {
                success: false,
                error:
                    error.response?.data?.errors ||
                    error.response?.data?.message ||
                    'Login failed'
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
            return { success: true };
          }
      
          return {
            success: false,
            error: 'Некорректный ответ сервера после проверки 2FA'
          };
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.message || 'Неверный код 2FA'
          };
        }
      };

    const logout = async () => {
        try {
            await axios.post('/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('token');
            setUser(null);
            router.push('/login');
        }
    };

    // Для JSON-запросов (логин, 2FA, обычные формы)
    const post = async (link, data) => {
                try {
                    const response = await axios.post(link, data, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    });
                    return response.data;
                } catch (error) {
                    return {
                        success: false,
                        error: error.response?.data?.errors || error.response?.data?.message || 'failed of ' + link
                    };
                }
            }
        

    const get = async (link) => {
        try {
            const response = await axios.get(link);
            return response.data;
        } catch (error) {
            return {
                success: false,
                error:
                    error.response?.data?.errors ||
                    error.response?.data?.message ||
                    'failed of ' + link
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

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};