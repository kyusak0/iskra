'use client'

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function TwoFactorQr({ otpAuthUrl }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!otpAuthUrl) return;

    QRCode.toDataURL(otpAuthUrl)
      .then(setSrc)
      .catch(console.error);
  }, [otpAuthUrl]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt="2FA QR Code"
      className="w-56 h-56 rounded-md border"
    />
  );
}