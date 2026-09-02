"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { PostItNote } from "@/lib/types";
import { randomRotation, randomPostItColor, cn } from "@/lib/utils";
import { Plus, Trash2, X } from "lucide-react";

const colorClasses: Record<string, string> = {
  yellow: "bg-postit-yellow",
  pink: "bg-postit-pink",
  blue: "bg-postit-blue",
  green: "bg-postit-green",
  orange: "bg-postit-orange",
};

export default function FridgePage() {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<PostItNote[]>([]);
  const [newContent, setNewContent] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [familyInvite, setFamilyInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile?.familyId) return;

    // Solo where → non richiede indice composito. Ordiniamo lato client.
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
        setError(`Errore lettura note: ${err.message}`);
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
      await addDoc(collection(db, "notes"), {
        familyId: profile.familyId,
        content: newContent.trim(),
        color: randomPostItColor(),
        authorId: user.uid,
        authorName: profile.displayName || user.displayName || "Anonimo",
        rotation: randomRotation(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setNewContent("");
      setShowForm(false);
    } catch (err: any) {
      console.error("Add note error:", err);
      setError(`Errore salvataggio: ${err.code || ""} ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notes", id));
    } catch (err: any) {
      console.error("Delete note error:", err);
      setError(`Errore cancellazione: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-handwritten text-warm-wood">Il Frigo</h1>
          <p className="text-sm text-amber-800/70">
            Codice invito famiglia:{" "}
            <span className="font-mono font-bold tracking-widest">
              {familyInvite || "…"}
            </span>
          </p>
          {profile?.familyId && (
            <p className="text-xs text-amber-700/50 mt-0.5">
              familyId: {profile.familyId.slice(0, 8)}…
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-warm-orange text-white shadow-md hover:bg-orange-600 transition"
        >
          <Plus className="w-5 h-5" /> Nuovo post-it
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="fridge-bg rounded-3xl border-4 border-slate-200 shadow-inner min-h-[60vh] p-6 relative overflow-hidden">
        {notes.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-amber-800/40 font-handwritten text-2xl">
            Nessun post-it ancora... aggiungine uno!
          </div>
        )}

        <div className="flex flex-wrap gap-6 content-start">
          {notes.map((note) => (
            <div
              key={note.id}
              className={cn(
                "postit w-44 h-44 p-4 rounded-sm shadow-postit flex flex-col relative group",
                colorClasses[note.color] || colorClasses.yellow
              )}
              style={{ transform: `rotate(${note.rotation}deg)` }}
            >
              <button
                onClick={() => removeNote(note.id)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded-full bg-black/10 hover:bg-black/20 transition"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-900" />
              </button>
              <p className="font-handwritten text-lg leading-snug flex-1 overflow-hidden text-amber-950">
                {note.content}
              </p>
              <p className="text-[10px] text-amber-900/60 mt-1 truncate">
                {note.authorName}
              </p>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-cream-100"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-handwritten text-warm-wood mb-4">Nuovo post-it</h2>
            {error && (
              <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none resize-none font-handwritten text-lg"
              placeholder="Scrivi qui il tuo appunto..."
              autoFocus
            />
            <button
              onClick={addNote}
              disabled={!newContent.trim() || busy}
              className="mt-4 w-full py-3 rounded-xl bg-warm-orange text-white font-medium disabled:opacity-50"
            >
              {busy ? "Salvataggio..." : "Attacca sul frigo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
