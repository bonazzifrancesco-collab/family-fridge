"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { Deadline } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Bell, X } from "lucide-react";

export default function ScadenzePage() {
  const { user, profile } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remindDays, setRemindDays] = useState("1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile?.familyId) return;

    const q = query(
      collection(db, "deadlines"),
      where("familyId", "==", profile.familyId)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Deadline))
          .sort((a, b) => (a.dueDate || 0) - (b.dueDate || 0));
        setDeadlines(data);
        setError("");
      },
      (err) => {
        console.error("Deadlines listener error:", err);
        setError("Errore lettura scadenze: " + err.message);
      }
    );
    return () => unsub();
  }, [profile?.familyId]);

  const addDeadline = async () => {
    if (!title.trim() || !dueDate || !profile?.familyId || !user) {
      setError("Compila titolo e data, oppure ricarica (manca famiglia).");
      return;
    }
    const days = parseInt(remindDays, 10);
    if (isNaN(days) || days < 0) {
      setError("Inserisci un numero di giorni valido (0 o più).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const due = new Date(dueDate).getTime();
      // Firestore non accetta undefined: includi description solo se valorizzata
      const payload: Record<string, unknown> = {
        familyId: profile.familyId,
        title: title.trim(),
        dueDate: due,
        remindDays: days,
        reminded: false,
        authorId: user.uid,
        authorName: profile.displayName || "Anonimo",
        createdAt: Date.now(),
      };
      const desc = description.trim();
      if (desc) {
        payload.description = desc;
      }
      await addDoc(collection(db, "deadlines"), payload);
      setTitle("");
      setDescription("");
      setDueDate("");
      setRemindDays("1");
      setShowForm(false);
    } catch (err: any) {
      console.error("Add deadline error:", err);
      setError("Errore salvataggio: " + (err.code || "") + " " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "deadlines", id));
    } catch (err: any) {
      console.error("Delete deadline error:", err);
      setError("Errore cancellazione: " + err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6" style={{ flexWrap: "wrap", gap: "12px" }}>
        <h1 className="text-3xl font-handwritten text-warm-wood">Scadenze</h1>
        <button
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-warm-orange text-white shadow-md"
          style={{ minHeight: "44px" }}
        >
          <Plus className="w-5 h-5" /> Nuova scadenza
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {deadlines.length === 0 && !error && (
          <p className="text-center text-amber-800/50 font-handwritten text-xl py-12">
            Nessuna scadenza. Aggiungine una!
          </p>
        )}
        {deadlines.map((d) => {
          const isPast = d.dueDate < Date.now();
          const days =
            d.remindDays != null
              ? d.remindDays
              : (d as any).remindBefore
              ? Math.round((d as any).remindBefore / 1440)
              : 1;
          return (
            <div
              key={d.id}
              className={
                "bg-white rounded-2xl p-5 shadow-sm border flex items-start " +
                (isPast ? "border-red-200 opacity-75" : "border-cream-200")
              }
              style={{ gap: "16px" }}
            >
              <div className="p-2 rounded-full bg-cream-100" style={{ flexShrink: 0 }}>
                <Bell className={"w-5 h-5 " + (isPast ? "text-red-500" : "text-warm-orange")} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="font-medium text-amber-950">{d.title}</h3>
                {d.description && (
                  <p className="text-sm text-amber-800/70 mt-0.5">{d.description}</p>
                )}
                <p className="text-sm mt-2 text-amber-900">
                  {format(d.dueDate, "EEEE d MMMM yyyy, HH:mm", { locale: it })}
                  {" · "}
                  <span className={isPast ? "text-red-600" : "text-amber-700"}>
                    {formatDistanceToNow(d.dueDate, { addSuffix: true, locale: it })}
                  </span>
                </p>
                <p className="text-xs text-amber-700/60 mt-1">
                  Promemoria: {days} {days === 1 ? "giorno" : "giorni"} prima · di {d.authorName}
                </p>
              </div>
              <button
                onClick={() => remove(d.id)}
                className="p-3 rounded-full hover:bg-red-50 text-red-400"
                style={{ minWidth: "44px", minHeight: "44px" }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-cream-100"
              style={{ minWidth: "44px", minHeight: "44px" }}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-handwritten text-warm-wood mb-4">Nuova scadenza</h2>
            {error && (
              <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}
            <div className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titolo"
                className="w-full px-4 py-3 rounded-xl border border-cream-300 outline-none"
                style={{ fontSize: "16px" }}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrizione (opzionale)"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 outline-none resize-none"
                style={{ fontSize: "16px" }}
              />
              <label className="block text-sm text-amber-900">Data e ora scadenza</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 outline-none"
                style={{ fontSize: "16px" }}
              />
              <label className="block text-sm text-amber-900">
                Promemoria email: quanti giorni prima?
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={remindDays}
                onChange={(e) => setRemindDays(e.target.value)}
                placeholder="Es. 3"
                className="w-full px-4 py-3 rounded-xl border border-cream-300 outline-none"
                style={{ fontSize: "16px" }}
              />
              <p className="text-xs text-amber-700/70">
                Esempio: 3 = ricevi la mail 3 giorni prima della scadenza. 0 = il giorno stesso.
              </p>
              <button
                onClick={addDeadline}
                disabled={!title.trim() || !dueDate || busy}
                className="w-full py-3 rounded-xl bg-warm-orange text-white font-medium disabled:opacity-50"
                style={{ minHeight: "48px", fontSize: "16px" }}
              >
                {busy ? "Salvataggio..." : "Salva scadenza"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
