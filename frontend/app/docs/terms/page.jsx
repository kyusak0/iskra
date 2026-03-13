import MainLayout from "../../../layouts/MainLayout"

export default function Docs() {
    return (
        <MainLayout>
            <section className="block-hover border border-slate-200 rounded-2xl p-6 bg-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-8 bg-indigo-400 rounded-full"></div>
                    <h2 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                        <span className="text-2xl">📘</span> Инструкция по работе с платформой
                    </h2>
                </div>
                <div className="prose prose-slate max-w-none text-slate-600 space-y-4 pl-2">
                    <p><span className="font-medium text-indigo-600">Загрузка видео:</span> нажмите «+» в правом верхнем углу, выберите файл (до 100MB). Поддерживаются MP4, MOV, WebM. После загрузки видео обрабатывается автоматически — вы сможете добавить описание, обложку и настроить доступ.</p>
                    <p><span className="font-medium text-indigo-600">Хранение фото:</span> перейдите в раздел «Альбомы» или используйте медиатеку. Фотографии можно сортировать по датам, создавать альбомы и отмечать любимые снимки. Для удобного просмотра доступна сетка, слайд-шоу и скачивание оригиналов.</p>
                    <p><span className="font-medium text-indigo-600">Обмен сообщениями:</span> вкладка «Мессенджер» позволяет создавать личные и групповые чаты. Поддерживаются текстовые сообщения, пересылка видео/фото (до 100 МБ), реакции, эмодзи. Все сообщения защищены сквозным шифрованием (E2EE) при активной настройке безопасности.</p>
                    <p><span className="font-medium text-indigo-600">Настройки приватности:</span> вы можете скрывать отдельные альбомы, блокировать пользователей и управлять видимостью загруженного контента через «Конфиденциальность» в профиле.</p>
                </div>
            </section>
        </MainLayout>
    )
}