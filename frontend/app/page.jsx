'use client'

import MainLayout from "../layouts/MainLayout";

import Popup from "../components/popup/Popup";
import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import Link from "next/link";
import ContextMenu from "../components/contextMenu/ContextMenu";

const BASE_URL = 'http://localhost:8001/storage/';

export default function Home() {
  const [creatingData, setCreatingData] = useState({
    title: '',
    source_id: null,
    author_id: 0,
    desc: '',
    type: ''
  });

  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    getPost();
  }, [])

  const { user, loading, post, get } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    let type;
    if ([name] == 'type') {
      type = e.target.id
      setCreatingData({ ...creatingData, type: type })
    } else {
      setCreatingData({ ...creatingData, [name]: value })
    }
  }

  const [file, setFile] = useState(null);

  const createPost = async (e) => {
    e.preventDefault();

    try {
      const formData = {
        file: file,
        author_id: user.id
      }

      const loadFile = await post('/load-file', formData);

      console.log(loadFile)


      const newData = { ...creatingData, author_id: user.id, source_id: loadFile.data.id }

      const result = await post('/create-post', newData);

      setPosts([...posts,
      {
        id: result.data.id,
        title: result.data.title,
        desc: result.data.desc,
        author_id: result.data.author_id,
        author_name: result.data.author_name,
        type: result.data.type,
        source: loadFile?.data.name,
        created_at: new Date(result.data.created_at).toLocaleString()
      }
      ]);
    }

    catch (err) {
      console.log(err.message)
    }
  }

  const [alert, setAlert] = useState();

  const getPost = async () => {

    const res = await get('/get-posts')
    setPosts([])

    if (res.success) {
      res.data.forEach(element => {
        const newRecord = {
          id: element.id,
          title: element.title,
          desc: element.desc,
          user: element.user,
          author_id: element.author_id,
          author_name: element.user.name,

          avatar: element.user.avatar,

          source: element.source?.name,
          source_type: element.source?.type,
          type: element.type,
          comments: element?.messages?.length || 0,
          created_at: new Date(element.created_at).toLocaleDateString()
        }

        setPosts(prev => [...prev, newRecord]);
      });
    } else {
      setAlert({ content: 'На данный момент работа сервера приостановлена', type: 'err' })
    }


  }

  const [comments, setComments] = useState([])

  const getComments = async (postId) => {

    const res = await post("get-messages/post/" + postId);
    setComments([]);
    res.data.forEach(element => {
      console.log(element)
      const newRecord = {
        id: element.id,
        content: element.content,
        answer_id: element.answer_id,
        created_at: new Date(element.created_at).toLocaleDateString(),
        user_id: element.user.id,
        user_name: element.user.name,

        source: element.source?.name,

        answer_content: element?.message?.content,
        answer_id: element?.message?.id,
      }
      setComments(comments => [...comments, newRecord])
    })
  }

  const handleSend = async (e, postId) => {
    e.preventDefault();

    try {
      let loadFile = null
      if (file) {
        const formData = {
          file: file,
          author_id: user.id
        }

        loadFile = await post('/load-file', formData);
      }

      console.log(loadFile)


      const newData = {
        author_id: user.id,
        post_id: postId,
        content: content,
        answer_id: answer?.id,
        source_id: loadFile?.data.id
      };



      const res = await post("/send-message/post", newData);
      console.log(res)

      setComments([...comments, {
        id: res.data.id,
        content: res.data.content,
        answer_id: res.data.answer_id,
        created_at: new Date(res.data.created_at).toLocaleDateString(),
        source: loadFile?.data.name,
        user_id: res.data.author_id,
        user_name: res.data?.user?.name || 'loading...',
      }]);

      setContent('');
      setAnswer(null);
      setFile(null);

    } catch (err) {
      console.log(err.message)
    }

  };

  const [closeContext, setCloseContext] = useState(null);

  const [selectedMess, setSelectedMess] = useState(0)

  useEffect(() => {
    if (closeContext) {
      setCloseContext(false)
    }

  }, [closeContext]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        if (window.location.hash) {
          history.replaceState(null, null, window.location.pathname + window.location.search);
          setSelectedMess(0)
        }
      }, 2000)
      const str = window.location.hash
      setSelectedMess(str.split('#')[1])
    }
  }, []);

  const downloadFile = async (filePath) => {
    const fullUrl = BASE_URL + filePath;
    const fileName = filePath.split('/').pop(); // Получаем имя файла из пути

    try {
      const response = await fetch(fullUrl, {
        mode: 'cors', // Важно для кросс-доменных запросов
        credentials: 'include' // Если нужны куки
      });

      if (!response.ok) throw new Error('Ошибка загрузки');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Не удалось скачать файл');
    }
  };

  const [answer, setAnswer] = useState()

  return (
    <MainLayout alertMess={alert?.content} alertType={alert?.type}>
      <div className="w-full flex flex-col max-lg:flex-col-reverse">
        <div className="w-full flex justify-evenly gap-5 lg:mt-10 max-lg:pt-5 lg:pb-5 lg:border-b-2 lg:border-main">
          <form action="" className="flex max-lg:hidden">
            <input type="search" name="searchPost"
              id="searchPost" placeholder="Искать пост..."
              className="px-3 py-2 border-2 border-main max-lg:rounded-md rounded-l-md" />
            <button className="px-3 py-2 bg-main hover:opacity-80 rounded-r-md max-lg:rounded-md text-white font-bold uppercase">Искать</button>
          </form>
          <form action="" className="flex flex-col gap-2 lg:hidden">
            <input type="search" name="searchPost"
              id="searchPost" placeholder="Искать пост..."
              className="px-3 py-2 border-2 border-main max-lg:rounded-md rounded-l-md" />
          </form>
          <Popup
            id="create-post"
            openTrigger={<>
              <button
                className="w-full px-3 py-2 bg-main lg:hidden hover:opacity-80 rounded-md text-white font-bold uppercase"
                title="Создать пост"
              >+</button>
              <button
                className="w-full px-3 py-2 bg-main max-lg:hidden hover:opacity-80 rounded-md text-white font-bold uppercase"
                title="Создать пост"
              >Создать пост</button>
            </>

            }>
            {user ? (
              <form className="w-full flex flex-col gap-5" onSubmit={createPost}>
                <h3 className="text-xl font-bold">
                  Создать пост
                </h3>
                <input type="file" name="source" id="source" className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0])
                    }
                  }}
                />
                <div className="flex gap-5">
                  <label htmlFor="source"
                    className="underline text-main"
                  >Прикрепить файл к посту</label>
                  {file?.name}
                </div>
                <input type="text"
                  name="title"
                  className="px-3 py-2 border-2 border-main rounded-md"
                  onChange={handleChange}
                  placeholder="Название..."
                  value={creatingData.title} />
                <textarea
                  name="desc"
                  className="px-3 py-2 border-2 border-main rounded-md resize-none"
                  onChange={handleChange}
                  placeholder="Описание..."
                  value={creatingData.desc} />
                <div className="w-full">
                  <h3>
                    Тип публикации
                  </h3>
                  <div className="flex gap-5 mt-5 px-5 items-start rounded-t-md border-2 border-main w-full">
                    <input className="ml-7 mt-7 p-5" type="radio" name="type" id="public"
                      onChange={handleChange} />
                    <label htmlFor="public" className="flex-1 py-5">
                      Публичный
                      <p className="text-xs">
                        Публикация видна всем пользователям.
                      </p>
                    </label>
                  </div>
                  <div className="flex gap-5 px-5 items-start  border-2 border-main w-full">
                    <input className="ml-7 mt-7 p-5" type="radio" name="type" id="private"
                      onChange={handleChange} />
                    <label htmlFor="private" className="flex-1 py-5">
                      Приватный
                      <p className="text-xs">
                        Публикация видна только Вам.
                      </p>
                    </label>
                  </div>
                  <div className="flex gap-5 px-5 items-start rounded-b-md border-2 border-main w-full">
                    <input className="ml-7 mt-7 p-5" type="radio" name="type" id="friends_only"
                      onChange={handleChange} />
                    <label htmlFor="friends_only" className="flex-1 py-5">
                      Для друзей
                      <p className="text-xs">
                        Публикация видна Вам и Вашим друзьям.
                      </p>
                    </label>
                  </div>
                </div>
                <button className="px-3 py-2 bg-main hover:opacity-80 rounded-md text-bg uppercase font-bold">Создать</button>
              </form>
            ) : (
              <div className="flex flex-col justify-center text-center"><p>
                Кажется вы не вошли в аккаунт. Вы не можете создать пост.</p>
                <a href="/login" className="text-main">Войти</a>
              </div>
            )}
          </Popup>
        </div>

        <div className="flex h-[70vh] overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-col gap-10">
          {/* <h1 className="text-4xl text-center">
        Добро пожаловать в соц сеть
        <span className="text-main size-2"> Искра </span>
      </h1> */}

          {posts.map((post) => (
            <div className={`p-5 shadow-xl rounded-md w-full z-index-[2] 
          ${post.type == 'public' ? ''
                : (post.type == 'private'
                  && user?.id == post.author_id)
                  ? ''
                  : post.type == 'friends_only' ? '' : 'hidden'}`} key={post.id}>
              <div className="flex items-center justify-between">
                <Link
                  href={`users/${post.author_id}`}
                  className="flex gap-5 items-center"
                >
                  <img src={`${BASE_URL + post.user?.avatar}`} alt="avaatr" className="rounded-full w-10 h-10"
                  />
                  {post.author_name}
                </Link>

                <p>
                  {post.created_at}
                </p>

                <ContextMenu
                  id="more"
                  openTrigger={
                    <button className="border-2 border-main rounded-md py-1 px-2">...</button>
                  }>
                  <div className="flex flex-col gap-5">
                    <div className="">
                      <label htmlFor="">
                        Пожаловаться
                      </label>
                      <input type="text"
                        className="border-2 border-main rounded-md w-full"
                        placeholder="Причина..." />
                    </div>
                    <button
                      className="border-2 border-main rounded-md w-full">
                      Сохранить
                    </button>
                    <button
                      className="border-2 border-main rounded-md w-full">
                      Поделиться
                    </button>
                  </div>
                </ContextMenu>
              </div>
              <div className="flex flex-col gap-2 mt-5">
                {(post.source && post.source_type.includes('image/')) ? (
                  <img src={`${BASE_URL}${post.source}`} alt="" className="m-auto h-50 z-index-[-1]" />
                ) : post.source ? (
                  // <button onClick={() => downloadFile(post.source)}>
                  //   Скачать прикрепленный файл
                  // </button>
                  null
                ) : (<span className="text-center italic">нет фото или видео</span>)}
                <p className="lg:text-3xl max-lg:text-xl">
                  {post.title}
                </p>
                <p>
                  {post.desc}
                </p>
              </div>
              <Popup
                id="comment"
                openTrigger={
                  <button
                    onClick={() => getComments(post.id)}
                    className="w-full border-t-2 border-main py-2 px-3 mt-5 hover:bg-gray-200 rounded-b-md text-left">Комментарии ({post.comments})</button>
                }>
                <div className="w-full flex flex-col">
                  <h3 className="text-xl">
                    Комментарии
                  </h3>
                  <div
                    className="h-100 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {comments.map((message) => (
                      <div className={`w-full mb-5 ${selectedMess == message.id ? 'shadow-lg shadow-main/50' : ''}`}

                        key={message.id} id={`${message.id}`}>
                        <div className="flex flex-col items-start">
                          <a
                            href={`users/${message.user_id}`}
                            className="grid grid-cols-3 grid-rows-2 "
                          ><img alt="avaatr" className="rounded-full w-10 h-10 col-span-1 row-span-2 mr-5" />
                            <p className="col-span-2 row-span-1">
                              {message.user_name}
                            </p>
                            <p className="text-xs col-span-2 row-span-1">
                              {message.created_at}
                            </p>
                          </a>
                          <ContextMenu
                            closing={closeContext}
                            openTrigger={
                              <>

                                {message.answer_content ? (
                                  <div className='w-full'>
                                    <a
                                      href={`#${message.answer_id}`}
                                      onClick={() => {
                                        setCloseContext(true);
                                      }}
                                      className={`w-full block border-l-2 rounded-l-md p-2 mb-2 ${message.author_id === user?.id
                                        ? 'bg-main/20 border-main'
                                        : 'bg-gray-200 border-gray-500'
                                        }`}
                                    >
                                      {message.answer_content}
                                    </a>


                                  </div>
                                ) : (null)}

                                {message.source ? (
                                  <img src={`${BASE_URL}${message.source}`} alt="" className="m-auto w-full h-80" />
                                ) : (null)}
                                <p>
                                  {message.content}
                                </p>
                              </>
                            }>
                            <div className="flex flex-col gap-5">
                              <div className="">
                                <label htmlFor="">
                                  Пожаловаться
                                </label>
                                <input type="text"
                                  className="border-2 border-main rounded-md w-full"
                                  placeholder="Причина..." />
                                <button className='w-full text-left border-b-2 border-main'
                                  onClick={() => {
                                    setCloseContext(true)
                                    setAnswer({
                                      id: message.id,
                                      content: message.content,
                                    })
                                  }}>Ответить</button>
                                <button
                                  className='w-full text-left border-b-2 border-main'
                                  onClick={() => deleteMess(message)}
                                >Удалить</button>
                                <button className='w-full text-left border-b-2 border-main'
                                  onClick={() => {
                                    navigator.clipboard.writeText(message.content);
                                    setCloseContext(true)
                                  }}
                                >Копировать текст</button>
                                <button className='w-full text-left border-b-2 border-main'>Закрепить</button>

                                <Popup
                                  openTrigger={
                                    <button className='w-full text-left border-b-2 border-main'>Переслать</button>
                                  }>
                                  123
                                </Popup>
                              </div>
                            </div>
                          </ContextMenu>
                        </div>

                      </div>
                    ))}
                  </div>

                  <form onSubmit={(e) => handleSend(e, post.id)}
                    className='w-full flex flex-col gap-2 mt-10'>
                    {user ? (
                      <>
                        {answer ? (
                          <div className="flex justify-between">
                            <a href={`#${answer?.id}`}>{answer?.content}</a>
                            <button onClick={() => { setAnswer(null) }}>❌</button>
                          </div>
                        ) : (null)}

                        {file ? (
                          <div className="flex justify-between">
                            {file?.name}
                            <button onClick={() => { setFile(null) }}>❌</button>
                          </div>
                        ) : (null)}

                        <div className="flex w-full justify-start gap-10 items-center">
                          <input
                            type="text"
                            value={content}
                            name="content"
                            onChange={(e) => setContent(e.target.value)}
                            className='w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:border-main'
                            placeholder="Комментировать..."
                          />

                          <input type="file" name="source_com" id="source_com" className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setFile(e.target.files[0])
                              }
                            }}
                          />
                          <label htmlFor="source_com" className="text-4xl rotate-45">📎</label>

                          <button
                            type="submit"
                            className='text-xl p-3 bg-main text-white rounded-md disabled:bg-gray-400 min-w-20'
                            disabled={!(content.trim() || file)}
                          >
                            ➤
                          </button></div>
                      </>
                    ) : (
                      <p className="text-xl text-center">
                        Для того чтобы оставить Комментарий, нужно войти в аккаунт
                        <br />
                        <a href="/login" className="text-main">
                          Войти
                        </a>
                      </p>

                    )}
                  </form>

                </div>
              </Popup>
            </div>
          ))
          }
        </div>
      </div>
    </MainLayout >
  );
}
