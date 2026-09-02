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
  members: string[]; // uids
  createdAt: number;
};

export type PostItNote = {
  id: string;
  familyId: string;
  content: string;
  color: "yellow" | "pink" | "blue" | "green" | "orange";
  authorId: string;
  authorName: string;
  rotation: number; // degrees for visual tilt
  createdAt: number;
  updatedAt: number;
};

export type Deadline = {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  dueDate: number; // timestamp
  remindBefore: number; // minutes before due
  reminded: boolean;
  authorId: string;
  authorName: string;
  createdAt: number;
};

export type DocCategory = {
  id: string;
  familyId: string;
  name: string;
  parentId?: string; // for subcategories
  path: string; // relative path on Nextcloud
  createdAt: number;
};

export type DocItem = {
  id: string;
  familyId: string;
  categoryId: string;
  name: string;
  path: string; // full path on Nextcloud
  size?: number;
  mime?: string;
  uploadedBy: string;
  createdAt: number;
};
