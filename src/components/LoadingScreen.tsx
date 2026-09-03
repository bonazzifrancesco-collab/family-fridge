"use client";

import { useEffect, useState } from "react";

export function LoadingScreen({ label }: { label?: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(function () {
      setSlow(true);
    }, 8000);
    return function () {
      clearTimeout(t);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFBF5",
        padding: "24px",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "360px" }}>
        <div
          style={{
            fontSize: "22px",
            color: "#92400E",
            fontFamily: "Georgia, serif",
            marginBottom: "12px",
          }}
        >
          {label || "Caricamento..."}
        </div>
        {slow && (
          <div
            style={{
              marginTop: "16px",
              padding: "16px",
              background: "#FEF3C7",
              borderRadius: "12px",
              color: "#78350F",
              fontSize: "15px",
              lineHeight: "1.45",
              textAlign: "left",
            }}
          >
            <strong>Il caricamento sta impiegando troppo.</strong>
            <br />
            <br />
            Su iPad molto vecchi (2ª/3ª generazione, iOS 9) questa app non può
            funzionare: il browser è troppo datato per Firebase e Next.js.
            <br />
            <br />
            Usa un iPhone/iPad più recente (iOS 14+), oppure un computer.
            <br />
            <br />
            <a href="/login" style={{ color: "#EA580C", fontWeight: 600 }}>
              Riprova da Accedi
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
