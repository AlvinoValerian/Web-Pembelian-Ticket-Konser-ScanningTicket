"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import BrutalistInput from "@/components/BrutalistInput";
import { createClient } from "@/utils/supabase/client";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showTimeoutBanner, setShowTimeoutBanner] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setShowSuccessBanner(true);
    }
    if (searchParams.get("timeout") === "true" || searchParams.get("reason") === "timeout") {
      setShowTimeoutBanner(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Strict SQL Injection validation
    const sqlPattern = /('|--|#|\/\*|\*\/|\b(select|union|insert|update|delete|drop|alter|create|truncate|exec|grant|revoke)\b)/i;
    if (sqlPattern.test(email)) {
      setError("Email contains invalid characters or security threats.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Sign in via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || "Invalid email or password.");
      }

      // 2. Fetch User Profile role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (typeof window !== "undefined") {
        localStorage.setItem("vibecheck_last_activity", Date.now().toString());
      }

      setIsSuccess(true);

      setTimeout(() => {
        if (profileError || !profile) {
          router.push("/guest/dashboard");
          return;
        }

        // 3. Redirect depending on role
        if (profile.role === "ADMIN" || profile.role === "SUPER_ADMIN") {
          router.push("/admin/dashboard");
        } else {
          router.push("/guest/dashboard");
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during login.");
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="card-brutalist p-8 md:p-12 bg-brand-yellow w-full max-w-md shadow-[10px_10px_0px_0px_#1b1b1b] text-left space-y-4">
        <h3 className="text-xl font-black uppercase">🎉 LOGIN SUCCESSFUL!</h3>
        <p className="text-xs font-bold leading-relaxed text-brand-black/80 uppercase">
          Welcome back. Loading your dashboard...
        </p>
        {/* Brutalist loading bar animation */}
        <div className="w-full h-8 border-4 border-brand-black bg-white overflow-hidden relative">
          <div className="h-full bg-brand-blue border-r-4 border-brand-black animate-[pulse_1s_infinite] w-full flex items-center justify-center">
            <span className="text-[10px] font-black uppercase text-white tracking-widest">CONNECTING...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-brutalist p-8 md:p-12 bg-white w-full max-w-md shadow-[10px_10px_0px_0px_#1b1b1b]">
      <div className="text-left mb-8">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase mb-2">
          LOGIN
        </h2>
        <p className="text-xs md:text-sm font-bold text-brand-black/60 leading-relaxed">
          Enter your credentials to access your secure dashboard.
        </p>
      </div>

      {showSuccessBanner && (
        <div className="bg-brand-yellow border-3 border-brand-black p-4 text-xs font-black uppercase tracking-wider mb-6">
          🎉 Account Created! Please Sign In below.
        </div>
      )}

      {showTimeoutBanner && (
        <div className="bg-brand-yellow border-3 border-brand-black p-4 text-xs font-black uppercase tracking-wider mb-6">
          ⏰ Session expired due to inactivity. Please log in again.
        </div>
      )}

      {error && (
        <div className="bg-[#fee2e2] border-3 border-red-600 p-4 text-xs font-bold text-red-600 uppercase tracking-wide mb-6">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <BrutalistInput
          label="Email Address"
          type="email"
          placeholder="e.g. rockstar@vibecheck.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          }
        />

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black uppercase tracking-wider text-brand-black">PASSWORD</span>
            <a href="#" onClick={() => alert("Contact support to reset password.")} className="text-[10px] md:text-xs font-black text-brand-black underline hover:text-brand-blue uppercase">
              FORGOT?
            </a>
          </div>
          <div className="relative flex items-center w-full">
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full py-4 px-4 text-sm font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 bg-white focus:bg-brand-bg focus:border-brand-blue transition-colors"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="btn-brutalist-blue w-full py-4 text-sm font-black flex items-center justify-center gap-2 mt-8 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? "ACCESSING..." : "ACCESS"} <span>➔</span>
        </button>
      </form>

      <div className="border-t-2 border-brand-black my-8"></div>

      <div className="text-center text-xs font-bold uppercase tracking-wider text-brand-black/70">
        New to the pit?{" "}
        <Link href="/register" className="underline text-brand-blue hover:text-brand-black transition-colors">
          Register Here
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-black flex font-sans overflow-x-hidden selection:bg-brand-yellow selection:text-brand-black">
      <div className="grid grid-cols-1 lg:grid-cols-12 w-full">
        
        {/* Left Panel: Concert Poster Visual */}
        <div className="hidden lg:flex lg:col-span-6 bg-brand-black relative overflow-hidden items-center justify-center p-12 border-r-4 border-brand-black">
          <div className="absolute inset-0 z-0">
            <Image
              src="/login-promo.png"
              alt="Promo background"
              fill
              className="object-cover opacity-90 contrast-125"
              priority
            />
          </div>

          <div className="absolute top-8 left-8 z-10 bg-brand-black/80 border-2 border-brand-black px-3 py-1.5 shadow-brutalist-sm">
            <span className="text-white text-[10px] font-black uppercase tracking-widest">
              EST. 2024
            </span>
          </div>

          <div className="absolute top-16 left-8 z-10 bg-brand-yellow border-4 border-brand-black px-6 py-3.5 rotate-[-4deg] shadow-brutalist-md">
            <span className="text-brand-black text-3xl md:text-4xl font-black uppercase tracking-tight">
              VIBECHECK
            </span>
          </div>

          <div className="relative z-10 bg-brand-blue border-4 border-brand-black p-8 max-w-sm rotate-[3deg] shadow-[6px_6px_0px_0px_#1b1b1b] text-left">
            <h3 className="text-white text-2xl md:text-3xl font-black uppercase tracking-tight leading-none mb-2">
              SECURE YOUR SPOT.
            </h3>
            <div className="bg-brand-black text-brand-yellow font-black uppercase tracking-wider text-xs px-2.5 py-1 inline-block">
              NO EXCUSES.
            </div>
          </div>

          <div className="absolute bottom-6 left-6 z-10 text-white font-black text-4xl uppercase tracking-tighter opacity-80 pointer-events-none truncate max-w-full">
            5 / THE CONCRETE JUNCTION
          </div>
        </div>

        {/* Right Panel: Login Form Container */}
        <div className="lg:col-span-6 flex items-center justify-center px-6 md:px-12 py-12 relative w-full
          bg-[radial-gradient(#1b1b1b_1.5px,transparent_1.5px)] [background-size:16px_16px] bg-[#f2f2f2]">
          <Suspense fallback={
            <div className="card-brutalist p-8 bg-white w-full max-w-md shadow-[10px_10px_0px_0px_#1b1b1b] text-center font-black">
              LOADING FORM...
            </div>
          }>
            <LoginFormContent />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
