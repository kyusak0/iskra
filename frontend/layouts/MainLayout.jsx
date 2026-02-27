'use client'

import Alert from "../components/alert/Alert";
import Sidebar from "../components/sidebar/Sidebar";


export default function MainLayout({ children, alertMess }) {

  return (
    <>
      <div className="flex items-center justify-center">
        <Sidebar>
          {children}
        </Sidebar>

      </div>
      <Alert alert={alertMess} />
    </>
  );
}
