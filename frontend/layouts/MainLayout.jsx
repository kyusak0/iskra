'use client'

import Alert from "../components/alert/Alert";
import Sidebar from "../components/sidebar/Sidebar";


export default function MainLayout({ children, alertMess, alertType }) {

  return (
    <>
      <Sidebar>
        {children}
      </Sidebar>

      <Alert id={Date.now()} content={alertMess} type={alertType} />
    </>
  );
}
