"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import SessionTimeoutListener from "@/components/SessionTimeoutListener";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<{ full_name: string; role: string; email: string; avatar_url?: string | null } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let profileData = null;
        
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, role, email, avatar_url")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          profileData = data;
        } else if (error && (error.code === "42703" || error.message?.includes("column"))) {
          const { data: basicData, error: basicError } = await supabase
            .from("profiles")
            .select("full_name, role, email")
            .eq("id", user.id)
            .single();
          if (!basicError && basicData) {
            profileData = basicData;
          }
        }

        if (profileData) {
          const pData = profileData as any;
          setProfile({
            full_name: pData.full_name || user.email?.split("@")[0] || "Admin",
            role: pData.role || "ADMIN",
            email: pData.email || user.email || "",
            avatar_url: pData.avatar_url || null
          });
        } else {
          setProfile({
            full_name: user.email?.split("@")[0] || "Admin",
            role: "ADMIN",
            email: user.email || ""
          });
        }
      }
    };
    fetchProfile();
  }, [supabase]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoggingOut(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("vibecheck_last_activity");
    }
    await supabase.auth.signOut();
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  const menuItems = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"></path>
        </svg>
      ),
    },
    {
      name: "Create Event",
      path: "/admin/create-event",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
        </svg>
      ),
    },
    {
      name: "Events",
      path: "/admin/events",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
      ),
    },
    {
      name: "Orders & Payments",
      path: "/admin/payments",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      ),
    },
    {
      name: "Offline Purchase",
      path: "/admin/offline-purchase",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
      ),
    },
    {
      name: "Scanner",
      path: "/admin/scanner",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
        </svg>
      ),
    },

    {
      name: "Payment Config",
      path: "/admin/payment-config",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-black flex font-sans overflow-x-hidden">
      <SessionTimeoutListener />
      
      {isLoggingOut && (
        <div className="fixed inset-0 bg-brand-black/95 z-[9999] flex items-center justify-center font-sans">
          <div className="card-brutalist p-8 bg-brand-yellow border-4 border-brand-black text-left max-w-sm w-full space-y-4 shadow-[8px_8px_0px_0px_#1b1b1b]">
            <h3 className="text-xl font-black uppercase text-brand-black">👋 LOGGING OUT...</h3>
            <p className="text-xs font-bold text-brand-black/80 uppercase">Clearing your session securely. Rock on!</p>
            <div className="w-full h-8 border-4 border-brand-black bg-white overflow-hidden relative">
              <div className="h-full bg-brand-blue border-r-4 border-brand-black animate-[pulse_1.5s_infinite] w-full flex items-center justify-center">
                <span className="text-[10px] font-black uppercase text-white tracking-widest">EXITING...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 border-r-4 border-brand-black bg-white flex flex-col justify-between h-screen sticky top-0 shrink-0">
        <div>
          {/* Logo & Portal Info */}
          <div className="p-6 border-b-4 border-brand-black bg-brand-yellow/10">
            <Link href="/" className="text-2xl font-black tracking-tighter hover:skew-x-2 transition-transform block">
              VIBECHECK
            </Link>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/60">
              Admin Portal
            </span>
          </div>

          {/* User Profile Bar (as seen in Image 1) */}
          <div className="p-4 border-b-4 border-brand-black flex items-center gap-3 bg-[#fdfdfd]">
            <div className="relative w-10 h-10 border-2 border-brand-black rounded-full overflow-hidden bg-brand-yellow flex items-center justify-center">
              {profile?.avatar_url ? (
                <Image 
                  src={profile.avatar_url} 
                  alt="Profile Photo" 
                  fill 
                  className="object-cover"
                />
              ) : (
                <span className="font-black text-sm uppercase">
                  {profile?.full_name 
                    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
                    : "SU"
                  }
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-brand-black/50 leading-none uppercase">Welcome Back</p>
              <p className="text-xs font-black text-brand-black leading-tight mt-0.5">
                {profile?.full_name || "Admin User"}
              </p>
              <p className="text-[9px] font-bold text-brand-black/60 tracking-wider leading-none uppercase">
                {profile?.role || "SUPER ADMIN"}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2 mt-4">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== "/admin/dashboard" && pathname.startsWith(item.path));
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3.5 border-3 font-bold text-xs uppercase tracking-wider transition-all
                    ${isActive 
                      ? "bg-brand-yellow border-brand-black shadow-brutalist-sm translate-x-[-2px] translate-y-[-2px]" 
                      : "border-transparent hover:border-brand-black hover:bg-brand-bg"
                    }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Elements */}
        <div className="p-4 border-t-4 border-brand-black bg-white">
          <button 
            onClick={handleLogout}
            className="w-full bg-red-600 text-white border-3 border-brand-black px-4 py-3.5 font-black text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_#1b1b1b] flex items-center justify-center gap-2 cursor-pointer transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#1b1b1b] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#1b1b1b] text-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto max-h-screen">
        {children}
      </main>

    </div>
  );
}
