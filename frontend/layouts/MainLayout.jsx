'use client'

import Alert from "../components/alert/Alert";
import Sidebar from "../components/sidebar/Sidebar";


export default function MainLayout({ children, alertMess, alertType }) {

  return (
    <>
      <div className="flex items-center justify-center">
        <Sidebar>
          {children}
        </Sidebar>

      </div>
      <Alert id={Date.now()} content={alertMess} type={alertType} />
    </>
  );
}
