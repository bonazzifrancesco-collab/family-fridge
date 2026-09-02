"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { Deadline } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Bell, X } from "lucide-react";

const remindOptions = [
  { label: "1 ora prima", value: 60 },
  { label: "3 ore prima", value: 180 },
  { label: "1 giorno prima", value: 1440 },
  { label: "2 giorni prima", value: 2880 },
  { label: "1 settimana prima", value: 10080 },
];

export default function ScadenzePage() {
  const { user, profile } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [remindBefore, setRemindBefore] = useState(1440);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile?.familyId) return;

    // Solo where → niente indice composito richiesto
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
        setError(`Errore lettura scadenze: ${err.message}`);
      }
    );
    return () => unsub();
  }, [profile?.familyId]);

  const addDeadline = async () => {
    if (!title.trim() || !dueDate || !profile?.familyId || !user) {
      setError("Compila titolo e data, oppure ricarica (manca famiglia).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const due = new Date(dueDate).getTime();
      await addDoc(collection(db, "deadlines"), {
        familyId: profile.familyId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: due,
        remindBefore,
        reminded: false,
        authorId: user.uid,
        authorName: profile.displayName || "Anonimo",
        createdAt: Date.now(),
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      setShowForm(false);
    } catch (err: any) {
      console.error("Add deadline error:", err);
      setError(`Errore salvataggio: ${err.code || ""} ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteDoc(doc(db, "deadlines", id));
    } catch (err: any) {
      console.error("Delete deadline error:", err);
      setError(`Errore cancellazione: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-handwritten text-warm-wood">Scadenze</h1>
        <button
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-warm-orange text-white shadow-md hover:bg-orange-600"
        >
          <Plus className="w-5 h-5" /> Nuova scadenza
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm whitespace-pre-wrap">
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
          return (
            <div
              key={d.id}
              className={`bg-white rounded-2xl p-5 shadow-sm border flex items-start gap-4 ${
                isPast ? "border-red-200 opacity-75" : "border-cream-200"
              }`}
            >
              <div className="p-2 rounded-full bg-cream-100">
                <Bell className={`w-5 h-5 ${isPast ? "text-red-500" : "text-warm-orange"}`} />
              </div>
              <div className="flex-1 min-w-0">
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
                  Promemoria:{" "}
                  {remindOptions.find((o) => o.value === d.remindBefore)?.label ||
                    `${d.remindBefore} min`}{" "}
                  · di {d.authorName}
                </p>
              </div>
              <button
                onClick={() => remove(d.id)}
                className="p-2 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600"
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
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-cream-100"
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
                className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrizione (opzionale)"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none resize-none"
              />
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none"
              />
              <select
                value={remindBefore}
                onChange={(e) => setRemindBefore(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none"
              >
                {remindOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={addDeadline}
                disabled={!title.trim() || !dueDate || busy}
                className="w-full py-3 rounded-xl bg-warm-orange text-white font-medium disabled:opacity-50"
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
