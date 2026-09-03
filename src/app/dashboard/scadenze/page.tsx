"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { Deadline } from "@/lib/types";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { it } from "date-fns/locale";
import { Plus, Trash2, Bell, X, CalendarClock, AlertCircle } from "lucide-react";

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
      if (desc) payload.description = desc;

      await addDoc(collection(db, "deadlines"), payload);

      await notifyFamily({
        familyId: profile.familyId,
        excludeUserId: user.uid,
        title: "Nuova scadenza",
        body: title.trim(),
        url: "/dashboard/scadenze",
      });

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
      setError("Errore cancellazione: " + err.message);
    }
  };

  const upcoming = deadlines.filter((d) => d.dueDate >= Date.now());
  const past = deadlines.filter((d) => d.dueDate < Date.now());

  const badgeFor = (due: number) => {
    const date = new Date(due);
    if (due < Date.now()) return { label: "Scaduta", cls: "bg-red-100 text-red-700" };
    if (isToday(date)) return { label: "Oggi", cls: "bg-orange-100 text-orange-700" };
    if (isTomorrow(date)) return { label: "Domani", cls: "bg-amber-100 text-amber-800" };
    return {
      label: formatDistanceToNow(due, { addSuffix: true, locale: it }),
      cls: "bg-cream-100 text-amber-800",
    };
  };

  const Card = ({ d }: { d: Deadline }) => {
    const isPast = d.dueDate < Date.now();
    const days =
      d.remindDays != null
        ? d.remindDays
        : (d as any).remindBefore
        ? Math.round((d as any).remindBefore / 1440)
        : 1;
    const badge = badgeFor(d.dueDate);

    return (
      <div
        className={
          "group relative bg-white/90 rounded-2xl p-5 border shadow-sm transition hover:shadow-md " +
          (isPast ? "border-red-100 opacity-80" : "border-orange-100")
        }
      >
        <div className="flex items-start gap-4">
          <div
            className={
              "w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 " +
              (isPast ? "bg-red-50" : "bg-gradient-to-br from-orange-100 to-amber-100")
            }
          >
            {isPast ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
              <CalendarClock className="w-5 h-5 text-warm-orange" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-amber-950 text-base">{d.title}</h3>
              <span className={"text-[11px] font-semibold px-2 py-0.5 rounded-full " + badge.cls}>
                {badge.label}
              </span>
            </div>
            {d.description && (
              <p className="text-sm text-amber-800/70 mt-0.5 leading-relaxed">{d.description}</p>
            )}
            <p className="text-sm mt-2 text-amber-900 font-medium">
              {format(d.dueDate, "EEEE d MMMM yyyy · HH:mm", { locale: it })}
            </p>
            <p className="text-xs text-amber-700/55 mt-1.5 flex items-center gap-1.5">
              <Bell className="w-3 h-3" />
              Promemoria {days} {days === 1 ? "giorno" : "giorni"} prima
              <span className="opacity-40">·</span>
              {d.authorName}
            </p>
          </div>
          <button
            onClick={() => remove(d.id)}
            className="p-2.5 rounded-full text-red-300 hover:text-red-500 hover:bg-red-50 transition opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
            title="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-handwritten text-warm-wood">Scadenze</h1>
          <p className="text-sm text-amber-800/60 mt-0.5">
            {upcoming.length} in arrivo{past.length > 0 ? ` · ${past.length} passate` : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2 px-5 py-2.5"
        >
          <Plus className="w-5 h-5" /> Nuova scadenza
        </button>
      </div>

      {error && !showForm && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {deadlines.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3 opacity-40">📅</div>
          <p className="font-handwritten text-2xl text-amber-800/40">
            Nessuna scadenza. Aggiungine una!
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-700/50 px-1">
            In arrivo
          </h2>
          {upcoming.map((d) => (
            <Card key={d.id} d={d} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-400/70 px-1">
            Passate
          </h2>
          {past.map((d) => (
            <Card key={d.id} d={d} />
          ))}
        </div>
      )}

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
                <h2 className="text-xl sm:text-2xl font-handwritten text-warm-wood leading-tight truncate">
                  Nuova scadenza
                </h2>
                <p className="text-xs sm:text-sm text-amber-800/60">Promemoria email + push</p>
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

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
              {error && (
                <div className="p-2 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
              )}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titolo"
                className="w-full px-4 py-3 rounded-xl border border-orange-100 bg-cream-50 outline-none focus:ring-2 focus:ring-orange-300"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrizione (opzionale)"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-orange-100 bg-cream-50 outline-none resize-none focus:ring-2 focus:ring-orange-300"
              />
              <label className="block text-sm font-medium text-amber-900">Data e ora</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-orange-100 bg-cream-50 outline-none focus:ring-2 focus:ring-orange-300"
              />
              <label className="block text-sm font-medium text-amber-900">
                Promemoria: giorni prima
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={remindDays}
                onChange={(e) => setRemindDays(e.target.value)}
                placeholder="Es. 3"
                className="w-full px-4 py-3 rounded-xl border border-orange-100 bg-cream-50 outline-none focus:ring-2 focus:ring-orange-300"
              />
              <p className="text-xs text-amber-700/60">
                3 = 3 giorni prima · 0 = il giorno stesso
              </p>
              <button
                type="button"
                onClick={addDeadline}
                disabled={!title.trim() || !dueDate || busy}
                className="w-full py-3.5 btn-primary disabled:opacity-50 mb-2"
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
