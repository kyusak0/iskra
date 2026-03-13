import MainLayout from "../../layouts/MainLayout"

export default function Docs() {
    return (
        <MainLayout>
            <div className="flex gap-5 items-center justify-evenly h-[80vh] w-full flex-wrap">
                <a href="/docs/terms" className="btn rounded-md">Инструкция по работе с платформой</a>
                <a href="/docs/consent" className="btn rounded-md">Условия пользования</a>
                <a href="/docs/policy" className="btn rounded-md">ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ</a>
            </div>
        </MainLayout>
    )
}