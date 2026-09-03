"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DashboardNav } from "@/components/DashboardNav";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login");
      else if (!profile || !profile.familyId) router.replace("/onboarding");
    }
  }, [user, profile, loading, router]);

  if (loading || !user || !profile || !profile.familyId) {
    return <LoadingScreen label="Caricamento frigo..." />;
  }

  return (
    <div className="min-h-screen bg-mesh">
      <DashboardNav />
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
