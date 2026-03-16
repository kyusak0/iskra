'use client'

import MainLayout from "../layouts/MainLayout";

import Popup from "../components/popup/Popup";
import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import Link from "next/link";
import ContextMenu from "../components/contextMenu/ContextMenu";

const BASE_URL = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:8001/storage/';

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
    getPost(true);
    getTags();
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

  const generateChatUrl = (title) => {
    const translit = (text) => {
      const ru = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
        'я': 'ya'
      };

      return text.toLowerCase().split('').map(char => ru[char] || char).join('');
    };

    let url = translit(title)
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);

    return `${url}-${timestamp}-${random}`;
  };

  const report = async (e, data, type) => {
    e.preventDefault()
    const reportData = {
      desc: e.target.report_desc.value,
      target: `${data.url}`
    }
    const res = await post('/create-report', reportData)
  }

  const createPost = async (e) => {
    e.preventDefault();

    try {
      let loadFile = null;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        loadFile = await post('/load-file', formData);
      }

      const url = generateChatUrl(creatingData.title)


      const newData = {
        ...creatingData, author_id: user.id, source_id: loadFile?.data.id,
        tags: selectedTags,
        url: url
      }

      const result = await post('/create-post', newData);

      setPosts([...posts,
      {
        id: result.data.id,
        title: result.data.title,
        desc: result.data.desc,
        user: result.data.user,
        author_id: result.data.author_id,
        author_name: result.data.user?.name,
        avatar: result.data.user?.avatar,
        tags: result.data.tags || [],
        type: result.data.type,
        source: result.data.source?.name || loadFile?.data?.name,
        source_type: result.data.source?.type || loadFile?.data?.type,
        comments: 0,
        url: result.data.url,
        created_at: new Date(result.data.created_at).toLocaleString()
      }
      ]);
    }

    catch (err) {
      console.log(err.message)
    }
  }

  const [alert, setAlert] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(0);

  const getPost = async (reset = false) => {
    let curPage = reset ? 1 : currentPage;

    if (!reset && posts.length > 0) {
      setCurrentPage(currentPage + 1);
      curPage++;
    }

    const res = await get(`/get-posts?page=${curPage}`);

    if (reset) {
      setPosts([]);
    }

    setLastPage(res.data.last_page);

    if (res.success) {
      const newPosts = res.data.data.map(element => ({
        id: element.id,
        title: element.title,
        desc: element.desc,
        user: element.user,
        url: element.url,
        author_id: element.author_id,
        author_name: element.user.name,
        avatar: element.user.avatar,
        tags: element.tags,
        source: element.source?.name,
        source_type: element.source?.type,
        type: element.type,
        comments: element?.messages?.length || 0,
        created_at: new Date(element.created_at).toLocaleDateString()
      }));

      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);

      // Store original posts for filtering
      setOriginalPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
    } else {
      setAlert({ content: 'На данный момент работа сервера приостановлена', type: 'err' });
    }
  }

  const search = async (e) => {
    e.preventDefault();
    const searchTerm = e.target?.searchPost?.value;
    console.log(searchTerm);

    if (searchTerm) {


      const filtered = originalPosts.filter(el =>
        el.title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setPosts(filtered);
    } else {
      // Reset to original posts and refresh if needed
      setCurrentPage(1);
      await getPost(true);
    }
  }

  const selectTag = async (e) => {
    e.preventDefault();
    const tagId = e.target?.value;
    console.log(tagId);

    if (tagId && tagId != 0) {


      const filtered = originalPosts.filter(video =>
        video.tags?.some(tag => tag.id == tagId)
      );
      setPosts(filtered);
    } else {
      // Reset to original posts
      setCurrentPage(1);
      await getPost(true);
    }
  }

  // Add state for original posts
  const [originalPosts, setOriginalPosts] = useState([]);

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
        const formData = new FormData();
        formData.append('file', file);

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



      const res = await post(`/send-message/post/${postId}`, newData);
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

  const [tags, setTags] = useState([]);

  const getTags = async () => {
    const res = await get('/get-tags');
    setTags([])

    res.data.map(el => (
      setTags(prev => [...prev, {
        id: el.id,
        name: el.name
      }]
      )
    ))
  }


  const [selectedTags, setSelectedTags] = useState([]);

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };



  return (
    <MainLayout alertMess={alert?.content} alertType={alert?.type}>
      <div className="w-full flex flex-col max-lg:flex-col-reverse">
        <div className="w-full flex justify-evenly gap-5 lg:mt-10 max-lg:pt-5 lg:pb-5 lg:border-b-2 lg:border-main">
          <select name="" id=""
            onChange={selectTag}
            className="px-3 py-2 border-2 border-main max-lg:rounded-md rounded-md" >
            <option value='0'>
              Все теги
            </option>
            {tags.map(tag => (
              <option value={`${tag.id}`} key={`${tag.id}`}>
                {tag.name}
              </option>
            ))}
          </select>
          <form action="" className="flex max-lg:hidden" onSubmit={search}>
            <input type="search" name="searchPost"
              id="searchPost" placeholder="Искать пост..."
              className="px-3 py-2 border-2 border-main max-lg:rounded-md rounded-l-md" />
            <button className="px-3 py-2 bg-main hover:opacity-80 rounded-r-md max-lg:rounded-md text-white font-bold uppercase">Искать</button>
          </form>
          <form action="" className="flex flex-col gap-2 lg:hidden" onSubmit={search}>
            <input type="search" name="searchPost"
              id="searchPost" placeholder="Искать пост..."
              className="border-2 max-lg:rounded-md rounded-l-md btn" />
          </form>
          <Popup
            id="create-post"
            openTrigger={<>
              <button
                className="w-full btn lg:hidden rounded-md"
                title="Создать пост"
              >+</button>
              <button
                className="w-full max-lg:hidden rounded-md btn"
                title="Создать пост"
              >Создать пост</button>
            </>

            }>
            {user ? (
              <form className="w-full flex flex-col gap-5 h-[80vh] overflow-auto" onSubmit={createPost}>
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
                  className="px-3 py-2 border-2 border-main rounded-md resize-none min-h-20"
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

                <div>
                  <input
                    type="hidden"
                    name="tags"
                    value={JSON.stringify(selectedTags)}
                  />

                  {selectedTags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedTags.map(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        return (
                          <span key={tagId} className="bg-main text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                            {tag?.name}
                            <button
                              type="button"
                              onClick={() => toggleTag(tagId)}
                              className="hover:text-red-300"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-4 py-2 rounded-full border-2 text-sm transition-colors ${selectedTags.includes(tag.id)
                          ? 'bg-main text-white border-main'
                          : 'border-main'
                          }`}
                      >
                        {tag.name}
                      </button>
                    ))}
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
                  {post.user?.avatar ? (
                            <img src={`${BASE_URL + post.user.avatar}`} alt=""  className="w-10 h-10 rounded-full bg-main"/>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-main text-2xl font-bold text-white flex items-center justify-center">
                                {post.user?.name ? post.user.name[0] : '?'}
                            </div>
                        )}
                  {post.user.name}
                </Link>

                <p>
                  {post.created_at}
                </p>

                <a href={`/posts/${post.url}`}
                  className="w-max btn bg-main rounded-md">Перейти</a>

                {/* <ContextMenu
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
                </ContextMenu> */}
              </div>
              <div className="flex flex-col gap-2 mt-5">
                {(post.source && post.source_type.includes('image/')) ? (
                  <Popup
                    openTrigger={<img src={`${BASE_URL}${post.source}` || 'no-media.png'} alt="" className="m-auto h-50 z-index-[-1] drop-shadow-xl" />
                    }>
                    <img src={`${BASE_URL}${post.source}` || 'no-media.png'} alt="" className="m-auto mt-5 z-index-[-1] drop-shadow-xl hover:scale-[1.2] duration-300" />

                  </Popup>
                ) : (post.source && post.source_type.includes('video/')) ? (
                  <video src={`${BASE_URL}${post.source}`} alt="" controls className="m-auto w-max h-[45vh] aspect-ratio-[1/1] z-index-[-1] drop-shadow-xl" />
                ) : post.source ? (
                  // <button onClick={() => downloadFile(post.source)}>
                  //   Скачать прикрепленный файл
                  // </button>
                  null
                ) : (<span className="text-center italic">нет фото или видео</span>)}

                <ul className="flex gap-2 flex-wrap">
                  {post.tags?.map(tag => (
                    <li key={tag.id}
                      className="bg-main/20 px-2 py-1 rounded-full text-xs ">
                      {tag.name}
                    </li>
                  ))}

                </ul>
                <p className="lg:text-3xl max-lg:text-xl">
                  {post.title}
                </p>
                <p className="truncate">
                  {post.desc}
                </p>
              </div>
            </div>
          ))
          }

          <button
            onClick={getPost}
            className={`btn rounded-md ${currentPage == lastPage ? 'hidden' : ''}`}>
            Показать еще
          </button>
        </div>
      </div>
    </MainLayout >
  );
}
