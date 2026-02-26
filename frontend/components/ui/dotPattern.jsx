"use client"
import React, { useEffect, useRef } from "react";

export default function DotPattern({
  initialRadius = 140,
  activeRadius = 220,
}) {
  const dotPatternRef = useRef(null);

  useEffect(() => {
    const el = dotPatternRef.current;
    if (!el) return;

    // стартовые координаты и радиус
    el.style.setProperty("--mx", `${window.innerWidth / 2}px`);
    el.style.setProperty("--my", `${window.innerHeight / 2}px`);
    el.style.setProperty("--mr", `${initialRadius}px`);

    // плавный переход радиуса через CSS
    el.style.transition = "mask-position 0.08s linear, -webkit-mask-position 0.08s linear, --mr 0.3s ease";

    // движение мышью
    const onMove = (e) => {
      el.style.setProperty("--mx", `${e.clientX}px`);
      el.style.setProperty("--my", `${e.clientY}px`);
    };

    // движение пальцем
    const onTouch = (e) => {
      if (e.touches && e.touches[0]) {
        el.style.setProperty("--mx", `${e.touches[0].clientX}px`);
        el.style.setProperty("--my", `${e.touches[0].clientY}px`);
      }
    };

    // нажатие — увеличиваем радиус
    const onPress = () => el.style.setProperty("--mr", `${activeRadius}px`);
    // отпускание — возвращаем радиус
    const onRelease = () => el.style.setProperty("--mr", `${initialRadius}px`);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onTouch, { passive: true });
    document.addEventListener("mousedown", onPress);
    document.addEventListener("mouseup", onRelease);
    document.addEventListener("touchstart", onPress);
    document.addEventListener("touchend", onRelease);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onTouch);
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("mouseup", onRelease);
      document.removeEventListener("touchstart", onPress);
      document.removeEventListener("touchend", onRelease);
    };
  }, [initialRadius, activeRadius]);

  return <div ref={dotPatternRef} className="dot-pattern" aria-hidden="true"></div>;
}
