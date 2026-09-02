"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { cn } from "@/lib/utils";
import { StickyNote, CalendarClock, FolderOpen, LogOut, Home } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Frigo", icon: StickyNote },
  { href: "/dashboard/scadenze", label: "Scadenze", icon: CalendarClock },
  { href: "/dashboard/documenti", label: "Documenti", icon: FolderOpen },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { profile, logout } = useAuth();

  return (
    <nav className="bg-white/80 backdrop-blur border-b border-cream-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-handwritten text-2xl text-warm-wood flex items-center gap-2">
            <Home className="w-5 h-5" /> Family Fridge
          </Link>
          <div className="hidden sm:flex gap-1">
            {links.map((l) => {
              const Icon = l.icon;
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition",
                    active
                      ? "bg-warm-orange text-white shadow"
                      : "text-amber-900/80 hover:bg-cream-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-amber-800 hidden sm:inline">
            {profile?.displayName}
          </span>
          <button
            onClick={() => logout()}
            className="p-2 rounded-full hover:bg-cream-100 text-amber-800 transition"
            title="Esci"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* Mobile nav */}
      <div className="sm:hidden flex justify-around border-t border-cream-100 py-2">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-xs",
                active ? "text-warm-orange" : "text-amber-800/70"
              )}
            >
              <Icon className="w-5 h-5" />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
