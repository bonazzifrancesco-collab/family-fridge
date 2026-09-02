"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && profile?.familyId) {
        router.replace("/dashboard");
      } else if (user) {
        router.replace("/onboarding");
      }
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="text-warm-wood text-xl font-handwritten">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-cream-100 to-warm-soft flex flex-col">
      <header className="p-6 flex justify-between items-center">
        <h1 className="text-3xl font-handwritten text-warm-wood">Family Fridge</h1>
        <div className="space-x-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-full bg-white/80 text-warm-wood shadow-sm hover:bg-white transition"
          >
            Accedi
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-full bg-warm-orange text-white shadow-md hover:bg-orange-600 transition"
          >
            Registrati
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-2xl">
          <h2 className="text-5xl md:text-6xl font-handwritten text-warm-wood mb-4 leading-tight">
            Il frigorifero digitale<br />della tua famiglia
          </h2>
          <p className="text-lg text-amber-900/80 mb-8">
            Appunti come post-it, scadenze con promemoria via email e archivio documenti condiviso.
            Tutto in un ambiente caldo e familiare.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-3 rounded-2xl bg-warm-orange text-white text-lg font-medium shadow-lg hover:scale-105 transition"
            >
              Crea la tua Famiglia
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 rounded-2xl bg-white text-warm-wood text-lg font-medium shadow-md hover:scale-105 transition"
            >
              Ho già un account
            </Link>
          </div>
        </div>

        {/* Decorative post-its */}
        <div className="mt-16 relative w-full max-w-lg h-40">
          <div className="absolute left-4 top-0 w-28 h-28 bg-postit-yellow rounded-sm shadow-postit rotate-[-6deg] flex items-center justify-center font-handwritten text-amber-900 text-sm p-2">
            Compra il latte!
          </div>
          <div className="absolute left-32 top-6 w-28 h-28 bg-postit-pink rounded-sm shadow-postit rotate-[4deg] flex items-center justify-center font-handwritten text-rose-900 text-sm p-2">
            Compleanno Nonna
          </div>
          <div className="absolute right-8 top-2 w-28 h-28 bg-postit-blue rounded-sm shadow-postit rotate-[-3deg] flex items-center justify-center font-handwritten text-sky-900 text-sm p-2">
            Bollette da pagare
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-sm text-amber-800/60">
        Fatto con ❤️ per le famiglie
      </footer>
    </div>
  );
}
