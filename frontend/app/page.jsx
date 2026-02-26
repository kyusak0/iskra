'use client'

import MainLayout from "../layouts/MainLayout";

import Popup from "../components/popup/Popup";
import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import Link from "next/link";
import ContextMenu from "../components/contextMenu/ContextMenu";

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

  const createPost = async (e) => {
    e.preventDefault();

    const newData = { ...creatingData, author_id: user.id }

    const result = await post('/create-post', newData);

    setPosts([...posts,
    {
      id: result.data.id,
      title: result.data.title,
      desc: result.data.desc,
      author_id: result.data.author_id,
      author_name: result.data.author_name,
      source_id: result.data.source_id,
      type: result.data.type,
      created_at: new Date(result.data.created_at).toLocaleString()
    }
    ]);
  }

  const getPost = async () => {

    const res = await get('get-posts')
    setPosts([])

    res.data.forEach(element => {
      const newRecord = {
        id: element.id,
        title: element.title,
        desc: element.desc,
        author_id: element.author_id,
        author_name: element.user.name,
        source_id: element.source?.name,
        type: element.type,
        comments: element?.messages?.length || 0,
        created_at: new Date(element.created_at).toLocaleDateString()
      }

      setPosts(prev => [...prev, newRecord]);
    });
  }

  const [comments, setComments] = useState([])

  const getComments = async (postId) => {
    
    const res = await post("get-messages/post/" + postId);
    setComments([])
    
    res.data.forEach(element => {
      console.log(element)
      const newRecord = {
        id: element.id,
        content: element.content,
        answer_id: element.answer_id,
        created_at: new Date(element.created_at).toLocaleDateString(),
        user_id: element.user.id,
        user_name: element.user.name,

        answer_content: element?.message?.content,
        answer_id: element?.message?.id,
      }
      setComments(comments => [...comments, newRecord])
    })

  }


  const handleSend = async (e, postId) => {
    e.preventDefault();

    try {
      const newData = {
        author_id: user.id,
        post_id: postId,
        content: content,
        answer_id: answer.id,
      };

      const res = await post("/send-message/post", newData);
      console.log(res)

      setComments([...comments, {
        id: res.data.id,
        content: res.data.content,
        answer_id: res.data.answer_id,
        created_at: new Date(res.data.created_at).toLocaleDateString(),
        user_id: res.data.author_id,
        user_name: res.data?.user?.name || 'loading...',
      }]);

      setContent('');
      setAnswer(null);

    } catch (err) {
      console.log(err.message)
    }

  };

  const [closeContext, setCloseContext] = useState(null)

  useEffect(() => {
    if (closeContext) {
      setCloseContext(false)
    }

  }, [closeContext]);

  const [answer, setAnswer] = useState()
  return (
    <MainLayout>
      <h1 className="text-4xl text-center">
        Добро пожаловать в соц сеть
        <span className="text-main size-2"> Искра </span>
      </h1>

      <div className="flex justify-evenly mt-10 pb-5 border-b-2 border-main">
        <form action="" className="flex">
          <input type="search" name="searchPost"
            id="searchPost" placeholder="Искать пост..."
            className="px-3 py-2 border-2 border-main rounded-l-md" />
          <button className="px-3 py-2 bg-main hover:opacity-80 rounded-r-md">Искать</button>
        </form>
        <Popup
          id="create-post"
          openTrigger={
            <button className="px-3 py-2 bg-main hover:opacity-80 rounded-md">Создать пост</button>
          }>
          {user ? (

            <form className="w-3/4 flex flex-col gap-5" onSubmit={createPost}>
              <h3 className="text-xl">
                Создать пост
              </h3>
              <input type="text"
                name="title"
                className="px-3 py-2 border-2 border-main rounded-md"
                onChange={handleChange}
                placeholder="Название..."
                value={creatingData.title} />
              <textarea
                name="desc"
                className="px-3 py-2 border-2 border-main rounded-md"
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
              <button className="px-3 py-2 bg-main hover:opacity-80 rounded-md">Создать</button>
            </form>
          ) : (
            <div className="flex flex-col justify-center text-center"><p>
              Кажется вы не вошли в аккаунт. Вы не можете создать пост.</p>
              <a href="/login" className="text-main">Войти</a>
            </div>
          )}
        </Popup>
      </div>

      <div className="flex flex-col gap-10">
        {posts.map((post) => (
          <div className={`p-5 shadow-xl rounded-md w-full 
          ${post.type == 'public' ? ''
              : (post.type == 'private'
                && user?.id == post.author_id)
                ? ''
                : post.type == 'friends_only' ? '' : 'hidden'}`} key={post.id}>
            <div className="flex items-center justify-between">
              <Link
                href={`users/${post.author_id}`}
                className="flex gap-5 items-center"
              ><img alt="avaatr" className="rounded-full w-10 h-10" /> {post.author_name}</Link>

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
            <div className="flex flex-col gap-5 mt-5">
              {post.source ? (
                <img alt="" />
              ) : (
                <span className="text-center italic">нет фото или видео</span>
              )}
              <p className="text-3xl">
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
              <div className="max-h-150 h-[60%] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full flex flex-col justify-around">
                <h3 className="text-xl fixed top-20">
                  Комментарии
                </h3>
                {comments.map((message) => (
                  <div className="w-full mb-5" key={message.id} id={`mess${message.id}`}>
                    <div className="flex flex-col items-start">
                      <Link
                        href={`users/${message.user_id}`}
                        className="grid grid-cols-3 grid-rows-2 "
                      ><img alt="avaatr" className="rounded-full w-10 h-10 col-span-1 row-span-2 mr-5" />
                        <p className="col-span-2 row-span-1">
                          {message.user_name}
                        </p>
                        <p className="text-xs col-span-2 row-span-1">
                          {message.created_at}
                        </p></Link>


                      {message.answer_content ? (
                        <a
                          href={`#mess${message.answer_id}`}
                          className={`w-full rounded-xs p-1 ${message.author_id === user?.id
                            ? 'bg-main/20 border-l-2 border-gray-500'
                            : 'bg-gray-200 border-l-2 border-gray-500'
                            }`}>
                          {message.answer_content}
                        </a>
                      ) : (null)}


                      <ContextMenu
                        id="more"
                        openTrigger={
                          <p>
                            {message.content}
                          </p>
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


                <form onSubmit={(e) => handleSend(e, post.id)} className='w-full flex flex-col gap-2 mt-10 fixed top-120'>
                  {answer ? (
                    <div className="flex justify-between">
                      <a href={`#mess${answer?.id}`}>{answer?.content}</a>
                      <button onClick={() => { setAnswer(null) }}>❌</button>
                    </div>
                  ) : (null)}
                  <div className="flex w-2/4 justify-start">
                    <input
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className='p-3 border border-gray-300 rounded-md flex-1 focus:outline-none focus:border-main'
                      placeholder="Комментировать..."
                    />
                    <button
                      type="submit"
                      className='text-xl p-3 bg-main text-white rounded-md disabled:bg-gray-400 min-w-20'
                      disabled={!content.trim()}
                    >
                      ➤
                    </button></div>
                </form>

              </div>
            </Popup>
          </div>
        ))
        }
      </div >
    </MainLayout >
  );
}
