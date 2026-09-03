"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LoadingScreen } from "@/components/LoadingScreen";
import Link from "next/link";

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && profile && profile.familyId) {
        router.replace("/dashboard");
      } else if (user) {
        router.replace("/onboarding");
      }
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return <LoadingScreen label="Caricamento..." />;
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col overflow-hidden">
      <header className="relative z-10 p-5 sm:p-6 flex justify-between items-center max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <h1 className="text-2xl sm:text-3xl font-handwritten text-warm-wood tracking-tight">
            Family Fridge
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="px-4 py-2.5 rounded-full glass text-warm-wood text-sm font-medium shadow-sm hover:bg-white transition"
          >
            Accedi
          </Link>
          <Link
            href="/register"
            className="btn-primary px-5 py-2.5 text-sm"
          >
            Registrati
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16 relative">
        {/* Decorative blobs */}
        <div
          className="absolute top-10 left-[-40px] w-64 h-64 rounded-full opacity-40 blur-3xl pointer-events-none"
          style={{ background: "#FDBA74" }}
        />
        <div
          className="absolute bottom-20 right-[-60px] w-72 h-72 rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: "#FDE68A" }}
        />

        <div className="relative z-10 max-w-2xl text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-orange-100 text-amber-800 text-xs font-medium mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Il frigo digitale di famiglia
          </div>

          <h2 className="text-4xl sm:text-5xl md:text-6xl font-handwritten text-warm-wood mb-5 leading-[1.15]">
            Appunti, scadenze
            <br />
            <span className="text-warm-orange">e documenti</span> in un posto solo
          </h2>

          <p className="text-base sm:text-lg text-amber-900/75 mb-10 max-w-lg mx-auto leading-relaxed">
            Post-it sul frigo, promemoria via email e archivio sul tuo NAS.
            Semplice, caldo, condiviso.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/register" className="btn-primary px-8 py-3.5 text-base">
              Crea la tua Famiglia
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-full bg-white text-warm-wood text-base font-medium shadow-md border border-orange-100 hover:shadow-lg transition"
            >
              Ho già un account
            </Link>
          </div>
        </div>

        {/* Floating post-its */}
        <div className="relative z-10 mt-14 sm:mt-20 w-full max-w-md h-44 animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <div
            className="absolute left-2 sm:left-6 top-0 w-32 h-32 bg-postit-yellow rounded-sm shadow-postit flex items-center justify-center font-handwritten text-amber-900 text-sm p-3 animate-float"
            style={{ transform: "rotate(-7deg)" }}
          >
            <span className="postit-tape" />
            Compra il latte 🥛
          </div>
          <div
            className="absolute left-1/2 -translate-x-1/2 top-8 w-32 h-32 bg-postit-pink rounded-sm shadow-postit flex items-center justify-center font-handwritten text-rose-900 text-sm p-3 animate-float"
            style={{ transform: "rotate(5deg)", animationDelay: "0.8s" }}
          >
            <span className="postit-tape" />
            Compleanno Nonna 🎂
          </div>
          <div
            className="absolute right-2 sm:right-6 top-2 w-32 h-32 bg-postit-blue rounded-sm shadow-postit flex items-center justify-center font-handwritten text-sky-900 text-sm p-3 animate-float"
            style={{ transform: "rotate(-3deg)", animationDelay: "1.4s" }}
          >
            <span className="postit-tape" />
            Bollette 💡
          </div>
        </div>

        {/* Feature chips */}
        <div className="relative z-10 mt-8 flex flex-wrap justify-center gap-2 max-w-lg">
          {["📝 Post-it live", "⏰ Promemoria email", "📁 Nextcloud", "👨‍👩‍👧‍👦 Famiglia"].map(
            (t) => (
              <span
                key={t}
                className="px-3 py-1.5 rounded-full bg-white/80 text-amber-900/80 text-xs font-medium border border-orange-100 shadow-sm"
              >
                {t}
              </span>
            )
          )}
        </div>
      </main>

      <footer className="p-4 text-center text-sm text-amber-800/50">
        Fatto con 🧡 per le famiglie
      </footer>
    </div>
  );
}
