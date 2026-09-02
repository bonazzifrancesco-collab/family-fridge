"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login");
      else if (!profile?.familyId) router.replace("/onboarding");
    }
  }, [user, profile, loading, router]);

  if (loading || !user || !profile?.familyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="text-warm-wood text-xl font-handwritten">Caricamento frigo...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <DashboardNav />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
