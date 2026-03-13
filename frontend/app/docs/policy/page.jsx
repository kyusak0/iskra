import MainLayout from "../../../layouts/MainLayout"

export default function Docs() {
    return (
        <MainLayout>
            <div className="max-h-[80vh] overflow-y-auto">
                <section className="block-hover border border-slate-200 rounded-2xl p-6 bg-white">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-8 bg-emerald-400 rounded-full"></div>
                        <h2 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                            <span className="text-2xl">🔐</span> Политика конфиденциальности
                        </h2>
                    </div>
                    <div className="text-slate-600 space-y-3 pl-2 text-[0.95rem]">
                        <p><strong>Какие данные собираются:</strong> имя, email, дата регистрации; метаданные загружаемых файлов (размер, формат); ip-адрес, тип браузера (для аналитики и безопасности). Фото и видео хранятся в зашифрованном виде.</p>
                        <p><strong>Как используем:</strong> для обеспечения работы (доставка контента, резервное копирование), улучшения интерфейса, технической поддержки и предотвращения мошенничества. Никакие личные данные не передаются третьим лицам, кроме случаев, предусмотренных законом РФ.</p>
                        <p><strong>Защита данных:</strong> используется TLS 1.3, двухфакторная аутентификация (опционально), хеширование паролей bcrypt. Вы можете запросить полное удаление аккаунта и всех данных через настройки или поддержку.</p>
                        <p className="text-sm italic bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">✱ Мы не продаём ваши данные. Ваш контент принадлежит только вам.</p>
                    </div>
                </section>

                <section className="block-hover border border-slate-200 rounded-2xl p-6 bg-white">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1 h-8 bg-violet-400 rounded-full"></div>
                        <h2 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                            <span className="text-2xl">📱</span> Двухфакторная аутентификация (2FA)
                        </h2>
                    </div>
                    <div className="text-slate-600 pl-2">
                        <p className="mb-3">Защитите свой аккаунт с помощью временного одноразового кода. Мы поддерживаем стандартные TOTP-приложения:</p>

                        <div className="flex flex-wrap gap-5 items-center my-4">
                            <div className="flex items-center gap-2 bg-slate-100 px-5 py-2.5 rounded-full shadow-sm">
                                <span className="text-xl">🔵</span> <span className="font-medium">Google Authenticator</span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-100 px-5 py-2.5 rounded-full shadow-sm">
                                <span className="text-xl">🟢</span> <span className="font-medium">Yandex ID</span>
                            </div>
                            <span className="text-sm text-slate-400">(или любое TOTP-совместимое приложение)</span>
                        </div>

                        <p className="font-medium text-indigo-700 mt-2">Как включить:</p>
                        <ol className="list-decimal list-inside space-y-1.5 mt-1 marker:text-indigo-500">
                            <li>Перейдите в <span className="bg-slate-100 px-2 py-0.5 rounded">Настройки → Безопасность → 2FA</span>.</li>
                            <li>Нажмите «Подключить аутентификатор» и отсканируйте QR-код в приложении Google Authenticator или Yandex ID.</li>
                            <li>Введите шестизначный код из приложения для подтверждения.</li>
                            <li>Сохраните резервные коды (они понадобятся при потере телефона).</li>
                        </ol>
                        <p className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 mt-4 text-sm">✅ После активации при каждом входе в аккаунт система будет запрашивать код из аутентификатора. Даже если злоумышленник узнает пароль, войти без второго фактора не получится.</p>
                        <p className="text-xs text-slate-400 mt-3">*Yandex ID доступен в RuStore, Google Authenticator — в Google Play и App Store.</p>
                    </div>
                </section>
            </div>
        </MainLayout>)
}