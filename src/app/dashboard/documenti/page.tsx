"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { DocCategory, DocItem } from "@/lib/types";
import {
  Folder,
  FolderPlus,
  Trash2,
  ChevronRight,
  X,
  Pencil,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
} from "lucide-react";

async function deleteOnNas(path: string) {
  if (!path) return;
  try {
    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Errore cancellazione NAS");
  } catch (e) {
    console.error("NAS delete", e);
    throw e;
  }
}

function fileIcon(mime?: string) {
  if (mime && mime.startsWith("image/")) {
    return <ImageIcon className="w-9 h-9 text-violet-500" />;
  }
  if (mime === "application/pdf") {
    return <FileText className="w-9 h-9 text-rose-500" />;
  }
  return <File className="w-9 h-9 text-sky-500" />;
}

export default function DocumentiPage() {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [currentParent, setCurrentParent] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<DocCategory | null>(null);
  const [newName, setNewName] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<
    { id: string | null; name: string }[]
  >([{ id: null, name: "Root" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile?.familyId) return;
    const q = query(
      collection(db, "categories"),
      where("familyId", "==", profile.familyId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setCategories(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocCategory))
      );
    });
    return () => unsub();
  }, [profile?.familyId]);

  useEffect(() => {
    if (!profile?.familyId) return;
    const q = query(
      collection(db, "documents"),
      where("familyId", "==", profile.familyId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocItem)));
    });
    return () => unsub();
  }, [profile?.familyId]);

  const visibleCats = categories.filter((c) =>
    currentParent ? c.parentId === currentParent : !c.parentId
  );
  const visibleDocs = docs.filter((d) =>
    currentParent ? d.categoryId === currentParent : !d.categoryId
  );

  const currentPath = currentParent
    ? categories.find((c) => c.id === currentParent)?.path || ""
    : "";

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
    setBusy(true);
    setError("");
    try {
      const path = currentParent
        ? (categories.find((c) => c.id === currentParent)?.path || "") +
          "/" +
          newName.trim()
        : newName.trim();

      const payload: Record<string, unknown> = {
        familyId: profile.familyId,
        name: newName.trim(),
        path,
        createdAt: Date.now(),
      };
      if (currentParent) payload.parentId = currentParent;

      await addDoc(collection(db, "categories"), payload);
      setNewName("");
      setShowForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editCat || !newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateDoc(doc(db, "categories", editCat.id), {
        name: newName.trim(),
      });
      setEditCat(null);
      setNewName("");
      setBreadcrumbs((prev) =>
        prev.map((b) =>
          b.id === editCat.id ? { ...b, name: newName.trim() } : b
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const collectDescendantIds = (rootId: string): string[] => {
    const ids: string[] = [rootId];
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of categories) {
        if (c.parentId && ids.includes(c.parentId) && !ids.includes(c.id)) {
          ids.push(c.id);
          changed = true;
        }
      }
    }
    return ids;
  };

  const removeCategory = async (id: string) => {
    if (
      !confirm(
        "Eliminare questa cartella, tutte le sottocartelle e i file (anche sul NAS)?"
      )
    )
      return;

    setBusy(true);
    setError("");
    try {
      const cat = categories.find((c) => c.id === id);
      const descendantIds = collectDescendantIds(id);

      const docsToRemove = docs.filter(
        (d) => d.categoryId && descendantIds.includes(d.categoryId)
      );
      for (const d of docsToRemove) {
        if (d.path) {
          try {
            await deleteOnNas(d.path);
          } catch (e) {
            console.warn("NAS file delete failed", d.path, e);
          }
        }
        await deleteDoc(doc(db, "documents", d.id));
      }

      if (cat && profile?.familyId) {
        try {
          if (docsToRemove.length > 0 && docsToRemove[0].path) {
            const sample = docsToRemove[0].path;
            const lastSlash = sample.lastIndexOf("/");
            if (lastSlash > 0) {
              await deleteOnNas(sample.substring(0, lastSlash));
            }
          } else if (cat.path) {
            await fetch("/api/delete-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                familyId: profile.familyId,
                relativePath: cat.path,
              }),
            });
          }
        } catch (e) {
          console.warn("NAS folder delete", e);
        }
      }

      for (const cid of descendantIds.reverse()) {
        await deleteDoc(doc(db, "categories", cid));
      }

      if (currentParent === id || descendantIds.includes(currentParent || "")) {
        goToBreadcrumb(0);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (id: string) => {
    if (!confirm("Eliminare questo documento dall'app e dal NAS?")) return;
    setError("");
    try {
      const d = docs.find((x) => x.id === id);
      if (d?.path) await deleteOnNas(d.path);
      await deleteDoc(doc(db, "documents", id));
    } catch (err: any) {
      setError(err.message);
    }
  };
};

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.familyId || !user) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("path", currentPath);
      form.append("familyId", profile.familyId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload fallito");

      const docPayload: Record<string, unknown> = {
        familyId: profile.familyId,
        name: data.name,
        path: data.path,
        size: data.size,
        mime: data.mime,
        uploadedBy: user.uid,
        createdAt: Date.now(),
      };
      docPayload.categoryId = currentParent ? currentParent : null;

      await addDoc(collection(db, "documents"), docPayload);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-handwritten text-warm-wood">
            Documenti
          </h1>
          <p className="text-sm text-amber-800/60 mt-0.5">
            Archivio famiglia sul NAS
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setEditCat(null);
              setNewName("");
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-orange-100 text-warm-wood shadow-sm hover:shadow-md transition"
          >
            <FolderPlus className="w-5 h-5" /> Nuova cartella
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || busy}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            {uploading ? "Caricamento..." : "Carica file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            accept="*/*"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center flex-wrap gap-1 text-sm mb-4 px-1">
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && (
              <ChevronRight className="w-3.5 h-3.5 mx-0.5 text-amber-600/40" />
            )}
            <button
              onClick={() => goToBreadcrumb(i)}
              className={
                "px-2.5 py-1 rounded-lg transition " +
                (i === breadcrumbs.length - 1
                  ? "font-semibold text-warm-wood bg-orange-50"
                  : "text-amber-800/70 hover:bg-orange-50/60")
              }
            >
              {bc.name}
            </button>
          </span>
        ))}
      </div>

      <div className="bg-white/80 rounded-3xl border border-orange-100 shadow-sm p-4 sm:p-5 min-h-[-[42vh]">
        {visibleCats.length === 0 && visibleDocs.length === 0 ? (
          <div className="text-center py-14">
            <div className="text-5xl mb-3 opacity-40">📂</div>
            <p className="font-handwritten text-2xl text-amber-800/40">
              Vuoto. Crea una cartella o carica un file.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {visibleCats.map((cat) => (
              <div
                key={cat.id}
                className="group relative p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-orange-100/80 cursor-pointer flex flex-col items-center gap-2 hover:shadow-md hover:border-orange-200 transition"
                onClick={() => openCategory(cat)}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
                  <Folder className="w-8 h-8 text-warm-amber" />
                </div>
                <span className="text-sm font-semibold text-amber-950 text-center truncate w-full">
                  {cat.name}
                </span>
                <div
                  className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditCat(cat);
                      setNewName(cat.name);
                      setShowForm(false);
                    }}
                    className="p-1.5 rounded-full bg-white shadow text-amber-700 hover:bg-amber-50"
                    title="Rinomina"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    disabled={busy}
                    className="p-1.5 rounded-full bg-white shadow text-red-400 hover:bg-red-50"
                    title="Elimina"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {visibleDocs.map((d) => (
              <div
                key={d.id}
                className="group relative p-4 rounded-2xl bg-white border border-orange-100/80 flex flex-col items-center gap-2 hover:shadow-md transition"
              >
                <div className="w-14 h-14 rounded-2xl bg-cream-50 flex items-center justify-center">
                  {fileIcon(d.mime)}
                </div>
                <span className="text-sm font-medium text-amber-950 text-center truncate w-full">
                  {d.name}
                </span>
                {d.size != null && (
                  <span className="text-[11px] text-amber-700/50 font-medium">
                    {(d.size / 1024).toFixed(0)} KB
                  </span>
                )}
                <button
                  onClick={() => removeDoc(d.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white shadow text-red-400 hover:bg-red-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-amber-700/50 px-1">
        I file restano sul tuo NAS. Cancellandoli qui spariscono anche da Nextcloud.
      </p>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative animate-fade-up border border-orange-100">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-cream-100"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-handwritten text-warm-wood mb-4">
              Nuova {currentParent ? "sottocategoria" : "categoria"}
            </h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome cartella"
              className="w-full px-4 py-3 rounded-xl border border-orange-100 bg-cream-50 outline-none focus:ring-2 focus:ring-orange-300"
              autoFocus
            />
            <button
              onClick={createCategory}
              disabled={!newName.trim() || busy}
              className="mt-4 w-full py-3.5 btn-primary disabled:opacity-50"
            >
              {busy ? "..." : "Crea"}
            </button>
          </div>
        </div>
      )}

      {editCat && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative animate-fade-up border border-orange-100">
            <button
              onClick={() => setEditCat(null)}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-cream-100"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-handwritten text-warm-wood mb-4">Rinomina</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-orange-100 bg-cream-50 outline-none focus:ring-2 focus:ring-orange-300"
              autoFocus
            />
            <button
              onClick={saveEdit}
              disabled={!newName.trim() || busy}
              className="mt-4 w-full py-3.5 btn-primary disabled:opacity-50"
            >
              {busy ? "..." : "Salva"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
