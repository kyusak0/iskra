'use client'

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MainLayout from "../../../../layouts/MainLayout";
import { useAuth } from "../../../../context/authContext";
import TwoFactorQr from "../../../../components/ui/TwoFactorQr"

export default function TwoFactorSetupPage() {
  const params = useParams();
  const router = useRouter();
  const { user, post } = useAuth();

  const [otpAuthUrl, setOtpAuthUrl] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isOwner = user && String(user.id) === String(params.uid);

  useEffect(() => {
    if (!user) return;

    if (!isOwner) {
      router.push("/404");
      return;
    }

    init2FA();
  }, [user]);

  const init2FA = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await post("/2fa/setup", {});

      if (res?.otpauth_url) {
        setOtpAuthUrl(res.otpauth_url);
      } else {
        setError("Не удалось получить QR-код.");
      }
    } catch (e) {
      setError(e?.message || "Ошибка инициализации 2FA");
    } finally {
      setLoading(false);
    }
  };

  const confirm2FA = async () => {
    try {
      setConfirmLoading(true);
      setError("");
      setSuccess("");

      const res = await post("/2fa/confirm", { code });

      if (res?.message) {
        setSuccess("2FA успешно включена");

        setTimeout(() => {
          router.push(`/profile/${params.uid}`);
        }, 1000);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Неверный код");
    } finally {
      setConfirmLoading(false);
    }
  };

  if (!isOwner) return null;

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto py-10 flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-center">Настройка 2FA</h1>

        <p className="text-center text-gray-600">
          Отсканируй QR-код в Google Authenticator, затем введи 6-значный код.
        </p>

        {loading ? (
          <p className="text-center">Загрузка QR-кода...</p>
        ) : otpAuthUrl ? (
          <div className="flex justify-center">
            <TwoFactorQr otpAuthUrl={otpAuthUrl} />
          </div>
        ) : null}

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="Введите 6-значный код"
          className="border-2 border-main rounded-md px-4 py-3 text-center text-xl tracking-[0.3em]"
        />

        <button
          onClick={confirm2FA}
          disabled={code.length !== 6 || confirmLoading}
          className="px-4 py-3 bg-main text-white font-bold rounded-md disabled:opacity-50"
        >
          {confirmLoading ? "Проверка..." : "Подтвердить 2FA"}
        </button>

        {error && <p className="text-red-500 text-center">{error}</p>}
        {success && <p className="text-green-600 text-center">{success}</p>}
      </div>
    </MainLayout>
  );
}