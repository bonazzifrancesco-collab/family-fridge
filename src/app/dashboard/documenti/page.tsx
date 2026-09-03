"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  queryquery,
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
      );");}]
}