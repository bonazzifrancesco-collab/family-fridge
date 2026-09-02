import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v4 as uuidv4 } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function randomRotation(): number {
  return Math.floor(Math.random() * 11) - 5; // -5 to +5 degrees
}

export function randomPostItColor(): "yellow" | "pink" | "blue" | "green" | "orange" {
  const colors = ["yellow", "pink", "blue", "green", "orange"] as const;
  return colors[Math.floor(Math.random() * colors.length)];
}

export { uuidv4 as uuid };
