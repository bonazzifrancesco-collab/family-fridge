export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  familyId?: string;
  createdAt: number;
};

export type Family = {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  members: string[];
  createdAt: number;
};

export type PostItNote = {
  id: string;
  familyId: string;
  content: string;
  color: "yellow" | "pink" | "blue" | "green" | "orange";
  authorId: string;
  authorName: string;
  rotation: number;
  createdAt: number;
  updatedAt: number;
};

export type Deadline = {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  dueDate: number;
  /** Giorni prima della scadenza per il promemoria email */
  remindDays: number;
  reminded: boolean;
  authorId: string;
  authorName: string;
  createdAt: number;
};

export type DocCategory = {
  id: string;
  familyId: string;
  name: string;
  parentId?: string;
  path: string;
  createdAt: number;
};

export type DocItem = {
  id: string;
  familyId: string;
  categoryId: string | null;
  name: string;
  path: string;
  size?: number;
  mime?: string;
  uploadedBy: string;
  createdAt: number;
};
