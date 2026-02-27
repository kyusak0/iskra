'use client'

import MainLayout from "../layouts/MainLayout";

export default function notFound() {

  return (
    <MainLayout>
      <div className="flex flex-col gap-10 mt-30">
      <h1 className="text-4xl text-center">
        Добро пожаловать в соц сеть
        <span className="text-main size-2"> Искра </span>
      </h1>

      <p className="text-center">
        Похоже Вы ввели неправильный адрес, или данная секция находится в разработке
      </p>

      </div>
    </MainLayout>
  );
}
