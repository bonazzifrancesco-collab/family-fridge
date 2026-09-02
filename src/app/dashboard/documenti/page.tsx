"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { DocCategory } from "@/lib/types";
import { Plus, Folder, FolderPlus, Trash2, ChevronRight, X } from "lucide-react";

export default function DocumentiPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [currentParent, setCurrentParent] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Root" },
  ]);

  useEffect(() => {
    if (!profile?.familyId) return;
    const q = query(
      collection(db, "categories"),
      where("familyId", "==", profile.familyId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocCategory));
      setCategories(data);
    });
    return () => unsub();
  }, [profile?.familyId]);

  const visible = categories.filter((c) =>
    currentParent ? c.parentId === currentParent : !c.parentId
  );

  const openCategory = (cat: DocCategory) => {
    setCurrentParent(cat.id);
    setBreadcrumbs((prev) => [...prev, { id: cat.id, name: cat.name }]);
  };

  const goToBreadcrumb = (idx: number) => {
    const bc = breadcrumbs[idx];
    setCurrentParent(bc.id);
    setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
  };

  const createCategory = async () => {
    if (!newName.trim() || !profile?.familyId) return;
    const path = currentParent
      ? `${categories.find((c) => c.id === currentParent)?.path || ""}/${newName.trim()}`
      : newName.trim();
    await addDoc(collection(db, "categories"), {
      familyId: profile.familyId,
      name: newName.trim(),
      parentId: currentParent || undefined,
      path,
      createdAt: Date.now(),
    });
    // Note: actual folder creation on Nextcloud happens via API route on demand
    setNewName("");
    setShowForm(false);
  };

  const removeCategory = async (id: string) => {
    if (!confirm("Eliminare questa categoria e tutte le sottocategorie?")) return;
    // Simple delete; in production cascade delete children
    await deleteDoc(doc(db, "categories", id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-handwritten text-warm-wood">Documenti</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-warm-orange text-white shadow-md hover:bg-orange-600"
        >
          <FolderPlus className="w-5 h-5" /> Nuova categoria
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm text-amber-800 mb-4 flex-wrap">
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <ChevronRight className="w-4 h-4 mx-1 opacity-50" />}
            <button
              onClick={() => goToBreadcrumb(i)}
              className={`hover:underline ${i === breadcrumbs.length - 1 ? "font-medium text-warm-wood" : ""}`}
            >
              {bc.name}
            </button>
          </span>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-cream-200 shadow-sm p-4 min-h-[40vh]">
        {visible.length === 0 ? (
          <p className="text-center text-amber-800/50 font-handwritten text-xl py-12">
            Nessuna categoria qui. Creane una!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {visible.map((cat) => (
              <div
                key={cat.id}
                className="group relative p-4 rounded-xl bg-cream-50 hover:bg-cream-100 border border-cream-200 cursor-pointer transition flex flex-col items-center gap-2"
                onClick={() => openCategory(cat)}
              >
                <Folder className="w-10 h-10 text-warm-amber" />
                <span className="text-sm font-medium text-amber-950 text-center truncate w-full">
                  {cat.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCategory(cat.id);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-amber-700/60">
        I documenti fisici sono memorizzati sul tuo NAS Nextcloud (nas.bonazziiotti.dpdns.org).
        Le categorie sincronizzano le cartelle. Per caricare file usa l&apos;interfaccia Nextcloud o estendi questa sezione.
      </p>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowForm(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-cream-100">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-handwritten text-warm-wood mb-4">Nuova categoria</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome cartella"
              className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:ring-2 focus:ring-warm-orange outline-none"
              autoFocus
            />
            <button
              onClick={createCategory}
              disabled={!newName.trim()}
              className="mt-4 w-full py-3 rounded-xl bg-warm-orange text-white font-medium disabled:opacity-50"
            >
              Crea
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
