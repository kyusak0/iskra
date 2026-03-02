'use client'

import MainLayout from "../../layouts/MainLayout";

export default function UnAuth() {

  return (
    <MainLayout>
      <div className="flex flex-col items-center gap-5 mt-30">
        <h1 className="text-4xl text-center">
          Добро пожаловать в соц сеть
          <span className="text-main size-2"> Искра </span>
        </h1>

        <p className="text-center">
          Похоже Вы не вошли в аккаунт
        </p>

        <a href="/login" className="w-max mt-5 text-bg px-3 py-2 bg-main uppercase font-bold rounded-md">Войти</a>
      </div>
    </MainLayout>
  );
}
