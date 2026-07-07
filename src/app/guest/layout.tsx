"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import SessionTimeoutListener from "@/components/SessionTimeoutListener";

export default function GuestLayout({
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
          .select("full_name, role, email, avatar_url, image")
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
            full_name: pData.full_name || user.email?.split("@")[0] || "Guest",
            role: pData.role || "GUEST",
            email: pData.email || user.email || "",
            avatar_url: pData.avatar_url || pData.image || null
          });
        } else {
          setProfile({
            full_name: user.email?.split("@")[0] || "Guest",
            role: "GUEST",
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
      path: "/guest/dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"></path>
        </svg>
      ),
    },
    {
      name: "Buy Tickets",
      path: "/guest/checkout",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
        </svg>
      ),
    },
    {
      name: "My Tickets",
      path: "/guest/tickets",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path>
        </svg>
      ),
    },
    {
      name: "Settings",
      path: "/guest/settings",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      ),
    },
    {
      name: "Support",
      path: "/guest/support",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
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
              Fan Portal
            </span>
          </div>

          {/* User Profile Bar */}
          <div className="p-4 border-b-4 border-brand-black flex items-center gap-3 bg-[#fdfdfd]">
            <div className="relative w-10 h-10 border-2 border-brand-black rounded-full overflow-hidden bg-brand-blue text-white flex items-center justify-center">
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
                    : "JD"
                  }
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-brand-black/50 leading-none uppercase">Welcome Back</p>
              <p className="text-xs font-black text-brand-black leading-tight mt-0.5">
                {profile?.full_name || "Guest User"}
              </p>
              <p className="text-[9px] font-bold text-brand-black/60 tracking-wider leading-none uppercase">
                MUSIC FAN #{profile?.email ? profile.email.length * 17 : "402"}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2 mt-4">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== "/guest/dashboard" && pathname.startsWith(item.path));
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
