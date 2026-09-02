"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { collection, doc, setDoc, getDocs, query, where, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateInviteCode, uuid } from "@/lib/utils";
import { Family } from "@/lib/types";

export default function OnboardingPage() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    router.replace("/login");
    return null;
  }

  if (profile?.familyId) {
    router.replace("/dashboard");
    return null;
  }

  const createFamily = async () => {
    if (!familyName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = uuid();
      const code = generateInviteCode();
      const family: Family = {
        id,
        name: familyName.trim(),
        inviteCode: code,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "families", id), family);
      await updateDoc(doc(db, "users", user.uid), { familyId: id });
      await refreshProfile();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Errore creazione famiglia");
    } finally {
      setBusy(false);
    }
  };

  const joinFamily = async () => {
    if (!inviteCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      const q = query(collection(db, "families"), where("inviteCode", "==", inviteCode.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("Codice invito non valido");
        setBusy(false);
        return;
      }
      const familyDoc = snap.docs[0];
      const familyId = familyDoc.id;
      await updateDoc(doc(db, "families", familyId), {
        members: arrayUnion(user.uid),
      });
      await updateDoc(doc(db, "users", user.uid), { familyId });
      await refreshProfile();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Errore accesso famiglia");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-warm-soft flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur rounded-3xl shadow-xl p-8 border border-cream-200">
        <h1 className="text-3xl font-handwritten text-warm-wood text-center mb-2">
          Ciao {profile?.displayName || user.displayName}!
        </h1>
        <p className="text-center text-amber-800/70 mb-8">
          Unisciti a una famiglia o creane una nuova
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
        )}

        {mode === "choose" && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("create")}
              className="w-full p-6 rounded-2xl bg-gradient-to-r from-warm-orange to-amber-500 text-white text-left shadow-lg hover:scale-[1.02] transition"
            >
              <div className="text-xl font-medium">Crea una Famiglia</div>
              <div className="text-sm opacity-90 mt-1">Sarai l'admin e potrai invitare gli altri</div>
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full p-6 rounded-2xl bg-white border-2 border-cream-300 text-warm-wood text-left shadow-md hover:scale-[1.02] transition"
            >
              <div className="text-xl font-medium">Unisciti con codice</div>
              <div className="text-sm opacity-70 mt-1">Inserisci il codice invito ricevuto</div>
            </button>
            <button
              onClick={() => logout()}
              className="w-full text-sm text-amber-700 hover:underline mt-4"
            >
              Esci dall'account
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">Nome della Famiglia</label>
              <input
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none"
                placeholder="Es. Famiglia Rossi"
              />
            </div>
            <button
              onClick={createFamily}
              disabled={busy || !familyName.trim()}
              className="w-full py-3 rounded-xl bg-warm-orange text-white font-medium shadow-md hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? "Creazione..." : "Crea Famiglia"}
            </button>
            <button onClick={() => setMode("choose")} className="w-full text-sm text-amber-700 hover:underline">
              Indietro
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">Codice Invito</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none uppercase tracking-widest text-center text-lg"
                placeholder="ABCDEF"
                maxLength={6}
              />
            </div>
            <button
              onClick={joinFamily}
              disabled={busy || inviteCode.length < 4}
              className="w-full py-3 rounded-xl bg-warm-orange text-white font-medium shadow-md hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? "Accesso..." : "Unisciti"}
            </button>
            <button onClick={() => setMode("choose")} className="w-full text-sm text-amber-700 hover:underline">
              Indietro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
