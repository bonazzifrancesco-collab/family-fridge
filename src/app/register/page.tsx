"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage() {
  const { register, loginWithGoogle, user, profile, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    if (profile?.familyId) router.replace("/dashboard");
    else router.replace("/onboarding");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(email, password, name);
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message || "Errore di registrazione");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Errore Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-warm-soft flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur rounded-3xl shadow-xl p-8 border border-cream-200">
        <h1 className="text-3xl font-handwritten text-warm-wood text-center mb-2">Crea account</h1>
        <p className="text-center text-amber-800/70 mb-6">Inizia la tua avventura familiare</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-amber-900 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange focus:border-transparent outline-none transition"
              placeholder="Il tuo nome"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-900 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange focus:border-transparent outline-none transition"
              placeholder="tua@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-900 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange focus:border-transparent outline-none transition"
              placeholder="Minimo 6 caratteri"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-warm-orange text-white font-medium shadow-md hover:bg-orange-600 disabled:opacity-50 transition"
          >
            {busy ? "Creazione..." : "Registrati"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-cream-300" />
          <span className="text-sm text-amber-700">oppure</span>
          <div className="flex-1 h-px bg-cream-300" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-white border border-cream-300 text-amber-900 font-medium shadow-sm hover:bg-cream-50 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continua con Google
        </button>

        <p className="mt-6 text-center text-sm text-amber-800/70">
          Hai già un account?{" "}
          <Link href="/login" className="text-warm-orange font-medium hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
