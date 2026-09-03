"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { PostItNote } from "@/lib/types";
import { randomRotation, randomPostItColor, cn } from "@/lib/utils";
import { Plus, Trash2, X, Copy, Check } from "lucide-react";

const colorClasses: Record<string, string> = {
  yellow: "bg-postit-yellow",
  pink: "bg-postit-pink",
  blue: "bg-postit-blue",
  green: "bg-postit-green",
  orange: "bg-postit-orange",
};

async function notifyFamily(payload: {
  familyId: string;
  excludeUserId?: string;
  title: string;
  body: string;
  url: string;
}) {
  try {
    await fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("push notify", e);
  }
}

export default function FridgePage() {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<PostItNote[]>([]);
  const [newContent, setNewContent] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [familyInvite, setFamilyInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile?.familyId) return;

    const q = query(
      collection(db, "notes"),
      where("familyId", "==", profile.familyId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as PostItNote))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setNotes(data);
        setError("");
      },
      (err) => {
        console.error("Notes listener error:", err);
        setError("Errore lettura note: " + err.message);
      }
    );
    return () => unsub();
  }, [profile?.familyId]);

  useEffect(() => {
    if (!profile?.familyId) return;
    const unsub = onSnapshot(
      doc(db, "families", profile.familyId),
      (snap) => {
        if (snap.exists()) setFamilyInvite(snap.data().inviteCode || "");
      },
      (err) => console.error("Family listener error:", err)
    );
    return () => unsub();
  }, [profile?.familyId]);

  const addNote = async () => {
    if (!newContent.trim() || !profile?.familyId || !user) {
      setError("Manca famiglia o utente. Ricarica la pagina.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const content = newContent.trim();
      await addDoc(collection(db, "notes"), {
        familyId: profile.familyId,
        content,
        color: randomPostItColor(),
        authorId: user.uid,
        authorName: profile.displayName || user.displayName || "Anonimo",
        rotation: randomRotation(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await notifyFamily({
        familyId: profile.familyId,
        excludeUserId: user.uid,
        title: "Nuovo post-it 📝",
        body: content.slice(0, 120),
        url: "/dashboard",
      });

      setNewContent("");
      setShowForm(false);
    } catch (err: any) {
      console.error("Add note error:", err);
      setError("Errore salvataggio: " + (err.code || "") + " " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notes", id));
    } catch (err: any) {
      setError("Errore cancellazione: " + err.message);
    }
  };

  const copyCode = async () => {
    if (!familyInvite) return;
    try {
      await navigator.clipboard.writeText(familyInvite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-handwritten text-warm-wood">
            Il Frigo
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-amber-800/70">Codice invito</span>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-orange-100 text-sm font-mono font-bold tracking-widest text-warm-wood shadow-sm hover:border-orange-300 transition"
            >
              {familyInvite || "…"}
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 opacity-50" />
              )}
            </button>
          </div>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2 px-5 py-2.5"
        >
          <Plus className="w-5 h-5" /> Nuovo post-it
        </button>
      </div>

      {error && !showForm && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="fridge-bg rounded-[1.75rem] border border-slate-200/80 min-h-[58vh] p-5 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 opacity-60" />

        {notes.length === 0 && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
            <div className="text-5xl mb-3 opacity-40">🧊</div>
            <p className="font-handwritten text-2xl text-slate-400">
              Nessun post-it... attaccane uno!
            </p>
          </div>
        )}

        <div className="relative flex flex-wrap gap-5 sm:gap-6 content-start pt-2">
          {notes.map((note, i) => (
            <div
              key={note.id}
              className={cn(
                "postit w-40 h-40 sm:w-44 sm:h-44 p-4 rounded-sm shadow-postit flex flex-col relative group",
                colorClasses[note.color] || colorClasses.yellow
              )}
              style={{
                transform: `rotate(${note.rotation}deg)`,
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <span className="postit-tape" />
              <button
                onClick={() => removeNote(note.id)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition"
                aria-label="Elimina"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-900" />
              </button>
              <p className="font-handwritten text-lg leading-snug flex-1 overflow-hidden text-amber-950 pt-1">
                {note.content}
              </p>
              <p className="text-[10px] text-amber-900/50 mt-1 truncate font-medium">
                {note.authorName}
              </p>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:mx-4 flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl border border-orange-100"
            style={{ maxHeight: "min(92dvh, 920px)" }}
          >
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-orange-50">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-handwritten text-warm-wood leading-tight">
                  Nuovo post-it
                </h2>
                <p className="text-xs sm:text-sm text-amber-800/60">Scrivi e attaccalo sul frigo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-cream-100 hover:bg-cream-200 text-warm-wood"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {error && (
                <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
              )}
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="w-full p-4 rounded-2xl border border-orange-100 bg-cream-50 focus:ring-2 focus:ring-orange-300 outline-none resize-none font-handwritten text-lg"
                placeholder="Es. Ricordati di..."
              />
              <button
                type="button"
                onClick={addNote}
                disabled={!newContent.trim() || busy}
                className="mt-4 w-full py-3.5 btn-primary disabled:opacity-50 mb-2"
              >
                {busy ? "Salvataggio..." : "Attacca sul frigo 📎"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
