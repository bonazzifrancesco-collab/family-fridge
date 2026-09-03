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
    <div className="min-h-screen bg-gradient-to-br from-cream-50 via-cream-100 to-warm-soft flex flex-col">
      <header className="p-6 flex justify-between items-center">
        <h1 className="text-3xl font-handwritten text-warm-wood">Family Fridge</h1>
        <div className="space-x-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-full bg-white/80 text-warm-wood shadow-sm"
          >
            Accedi
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-full bg-warm-orange text-white shadow-md"
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
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-3 rounded-2xl bg-warm-orange text-white text-lg font-medium shadow-lg"
            >
              Crea la tua Famiglia
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 rounded-2xl bg-white text-warm-wood text-lg font-medium shadow-md"
            >
              Ho già un account
            </Link>
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-sm text-amber-800/60">
        Fatto con amore per le famiglie
      </footer>
    </div>
  );
}
