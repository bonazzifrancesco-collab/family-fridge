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
  getDocs,
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

export default function DocumentiPage() {
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [currentParent, setCurrentParent] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState<DocCategory | null>(null);
  const [newName, setNewName] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Root" },
  ]);
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
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DocCategory)));
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

  const currentPath =
    currentParent
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
      if (currentParent) {
        payload.parentId = currentParent;
      }

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
        prev.map((b) => (b.id === editCat.id ? { ...b, name: newName.trim() } : b))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /** Raccoglie tutti i discendenti (sottocategorie) di una categoria */
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

      // 1) Cancella file collegati (Firestore + NAS)
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

      // 2) Cancella cartella sul NAS (path della categoria radice eliminata)
      //    Costruisci path completo come in upload: BASE/familyId/categoryPath
      if (cat && profile?.familyId) {
        const base = process.env.NEXT_PUBLIC_NEXTCLOUD_HINT || "";
        // path relativo categoria → il server delete usa path assoluto WebDAV salvato nei file;
        // per la cartella usiamo lo stesso schema di upload
        try {
          // Prova a cancellare la directory sul NAS usando il path relativo + familyId
          // L'API delete richiede path completo: lo ricostruiamo lato server meglio.
          // Qui inviamo un path "logico" se i file hanno path completo sotto quella cartella.
          if (docsToRemove.length > 0 && docsToRemove[0].path) {
            // Risali alla directory della categoria dal path del primo file
            const sample = docsToRemove[0].path;
            const lastSlash = sample.lastIndexOf("/");
            if (lastSlash > 0) {
              const dirPath = sample.substring(0, lastSlash);
              // Se siamo nella root della categoria eliminata, dirPath dovrebbe essere la cartella
              await deleteOnNas(dirPath);
            }
          } else if (cat.path) {
            // Nessun file: prova path standard
            const guessed =
              (process.env.NEXT_PUBLIC_NEXTCLOUD_BASE_HINT || "") +
              "/" +
              profile.familyId +
              "/" +
              cat.path;
            // Meglio: endpoint che ricostruisce da familyId + relative path
            await fetch("/api/delete-folder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                familyId: profile.familyId,
                relativePath: cat.path,
              }),
            }).then(async (r) => {
              if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                console.warn("delete-folder", j);
              }
            });
          }
        } catch (e) {
          console.warn("NAS folder delete", e);
        }
      }

      // 3) Cancella categorie da Firestore (figli prima, poi root)
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
      if (d?.path) {
        await deleteOnNas(d.path);
      }
      await deleteDoc(doc(db, "documents", id));
    } catch (err: any) {
      setError(err.message);
    }
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
    <div>
      <div
        className="flex items-center justify-between mb-6"
        style={{ flexWrap: "wrap", gap: "12px" }}
      >
        <h1 className="text-3xl font-handwritten text-warm-wood">Documenti</h1>
        <div className="flex" style={{ gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setEditCat(null);
              setNewName("");
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-white border border-cream-300 text-warm-wood shadow-sm"
            style={{ minHeight: "44px" }}
          >
            <FolderPlus className="w-5 h-5" /> Nuova cartella
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || busy}
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-warm-orange text-white shadow-md disabled:opacity-50"
            style={{ minHeight: "44px" }}
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

      <div
        className="flex items-center text-sm text-amber-800 mb-4"
        style={{ flexWrap: "wrap", gap: "4px" }}
      >
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <ChevronRight className="w-4 h-4 mx-1 opacity-50" />}
            <button
              onClick={() => goToBreadcrumb(i)}
              className={
                "px-2 py-1 rounded " +
                (i === breadcrumbs.length - 1
                  ? "font-medium text-warm-wood"
                  : "hover:underline")
              }
              style={{ minHeight: "36px" }}
            >
              {bc.name}
            </button>
          </span>
        ))}
      </div>

      <div
        className="bg-white rounded-2xl border border-cream-200 shadow-sm p-4"
        style={{ minHeight: "40vh" }}
      >
        {visibleCats.length === 0 && visibleDocs.length === 0 ? (
          <p className="text-center text-amber-800/50 font-handwritten text-xl py-12">
            Vuoto. Crea una cartella o carica un file.
          </p>
        ) : (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
            style={{ gap: "16px" }}
          >
            {visibleCats.map((cat) => (
              <div
                key={cat.id}
                className="group relative p-4 rounded-xl bg-cream-50 border border-cream-200 cursor-pointer flex flex-col items-center"
                style={{ gap: "8px" }}
                onClick={() => openCategory(cat)}
              >
                <Folder className="w-10 h-10 text-warm-amber" />
                <span className="text-sm font-medium text-amber-950 text-center truncate w-full">
                  {cat.name}
                </span>
                <div
                  className="absolute top-2 right-2 flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  style={{ gap: "4px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setEditCat(cat);
                      setNewName(cat.name);
                      setShowForm(false);
                    }}
                    className="p-2 rounded-full bg-white shadow text-amber-700"
                    style={{ minWidth: "36px", minHeight: "36px" }}
                    title="Rinomina"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    disabled={busy}
                    className="p-2 rounded-full bg-white shadow text-red-400"
                    style={{ minWidth: "36px", minHeight: "36px" }}
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
                className="group relative p-4 rounded-xl bg-white border border-cream-200 flex flex-col items-center"
                style={{ gap: "8px" }}
              >
                <FileText className="w-10 h-10 text-sky-600" />
                <span className="text-sm font-medium text-amber-950 text-center truncate w-full">
                  {d.name}
                </span>
                {d.size != null && (
                  <span className="text-xs text-amber-700/60">
                    {(d.size / 1024).toFixed(0)} KB
                  </span>
                )}
                <button
                  onClick={() => removeDoc(d.id)}
                  className="absolute top-2 right-2 p-2 rounded-full bg-white shadow text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  style={{ minWidth: "36px", minHeight: "36px" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-amber-700/60">
        Cancellando file o cartelle vengono eliminati anche dal NAS Nextcloud.
      </p>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 p-2 rounded-full"
              style={{ minWidth: "44px", minHeight: "44px" }}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-handwritten text-warm-wood mb-4">
              Nuova {currentParent ? "sottocategoria" : "categoria"}
            </h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome cartella"
              className="w-full px-4 py-3 rounded-xl border border-cream-300 outline-none"
              style={{ fontSize: "16px" }}
              autoFocus
            />
            <button
              onClick={createCategory}
              disabled={!newName.trim() || busy}
              className="mt-4 w-full py-3 rounded-xl bg-warm-orange text-white font-medium disabled:opacity-50"
              style={{ minHeight: "48px" }}
            >
              {busy ? "..." : "Crea"}
            </button>
          </div>
        </div>
      )}

      {editCat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setEditCat(null)}
              className="absolute top-3 right-3 p-2 rounded-full"
              style={{ minWidth: "44px", minHeight: "44px" }}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-handwritten text-warm-wood mb-4">Rinomina</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-cream-300 outline-none"
              style={{ fontSize: "16px" }}
              autoFocus
            />
            <button
              onClick={saveEdit}
              disabled={!newName.trim() || busy}
              className="mt-4 w-full py-3 rounded-xl bg-warm-orange text-white font-medium disabled:opacity-50"
              style={{ minHeight: "48px" }}
            >
              {busy ? "..." : "Salva"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
