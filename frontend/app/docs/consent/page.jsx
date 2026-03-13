import MainLayout from "../../../layouts/MainLayout"

export default function Docs() {
    return (
        <MainLayout>
        <section className="block-hover border border-slate-200 rounded-2xl p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-amber-400 rounded-full"></div>
                <h2 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                    <span className="text-2xl">⚖️</span> Условия пользования (оферта)
                </h2>
            </div>
            <div className="text-slate-600 space-y-3 pl-2 text-[0.95rem]">
                <p><strong>1. Принятие условий.</strong> Используя сервис, вы подтверждаете, что ознакомлены и согласны с настоящим соглашением, а также с политикой конфиденциальности. Если вы не согласны — воздержитесь от использования.</p>
                <p><strong>2. Контент и ответственность.</strong> Вы сохраняете все права на загруженные видео, фото и сообщения. Запрещено размещать материалы, нарушающие законодательство РФ, экстремистские, порнографические, пропагандирующие насилие. Администрация вправе удалять незаконный контент без предупреждения.</p>
                <p><strong>3. Ограничения.</strong> Нельзя использовать сервис для спама, фишинга, распространения вредоносных программ. Аккаунты, замеченные в деструктивных действиях, блокируются.</p>
                <p><strong>4. Изменение условий.</strong> Мы можем обновлять правила, уведомляя пользователей за 10 дней через email или всплывающее уведомление на сайте.</p>
            </div>
        </section>
    </MainLayout>)
}