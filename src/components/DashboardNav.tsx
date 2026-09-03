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
    <nav className="sticky top-0 z-50 border-b border-orange-100/80 bg-white/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="font-handwritten text-2xl text-warm-wood flex items-center gap-2 hover:opacity-80 transition"
          >
            <span className="text-xl">🏠</span>
            <span className="hidden sm:inline">Family Fridge</span>
          </Link>
          <div className="hidden sm:flex gap-1 p-1 rounded-full bg-cream-100/80">
            {links.map((l) => {
              const Icon = l.icon;
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                    active
                      ? "nav-pill-active"
                      : "text-amber-900/70 hover:bg-white hover:text-warm-wood"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-100/80">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white text-xs font-bold flex items-center justify-center">
              {(profile?.displayName || "?")[0].toUpperCase()}
            </div>
            <span className="text-sm text-amber-900 font-medium max-w-[120px] truncate">
              {profile?.displayName}
            </span>
          </div>
          <button
            onClick={() => logout()}
            className="p-2.5 rounded-full hover:bg-cream-100 text-amber-800/70 hover:text-warm-wood transition"
            title="Esci"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden flex justify-around border-t border-orange-50 py-2 px-2 bg-white/90">
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[11px] px-3 py-1 rounded-xl transition",
                active ? "text-warm-orange font-semibold" : "text-amber-800/60"
              )}
            >
              <span
                className={cn(
                  "p-1.5 rounded-xl transition",
                  active ? "bg-orange-50" : ""
                )}
              >
                <Icon className="w-5 h-5" />
              </span>
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
