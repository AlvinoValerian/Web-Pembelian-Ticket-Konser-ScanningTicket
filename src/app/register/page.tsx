"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BrutalistInput from "@/components/BrutalistInput";
import { createClient } from "@/utils/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  // Empty state by default
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const confirmPasswordError = confirmPassword && !passwordsMatch ? "Passwords do not match" : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Strict SQL Injection validation
    const sqlPattern = /('|--|#|\/\*|\*\/|\b(select|union|insert|update|delete|drop|alter|create|truncate|exec|grant|revoke)\b)/i;
    if (sqlPattern.test(email) || sqlPattern.test(fullName) || sqlPattern.test(phone)) {
      setError("Inputs contain invalid characters or security threats.");
      return;
    }

    if (!passwordsMatch) {
      setError("Please ensure passwords match.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Sign up user via Supabase Auth (passing metadata to options.data for DB triggers)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone || null,
          }
        }
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || "Registration failed. Try a different email.");
      }

      // 2. Try to upsert user profile in profiles table
      try {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: authData.user.id,
            full_name: fullName,
            email: email,
            phone: phone || null,
            role: "GUEST", // Always GUEST from public registration
          }, { onConflict: "id" });

        // If there's a profile error, throw it unless it's a Row-Level Security policy error
        // (since a trigger might have already successfully created the profile using the metadata options)
        if (profileError && !profileError.message.toLowerCase().includes("row-level security")) {
          throw new Error(profileError.message || "Failed to create user profile.");
        }
      } catch (profileErr) {
        console.warn("Profile upsert handled by DB trigger:", profileErr);
      }

      setIsSuccess(true);
      
      // Perform immediate full page reload of the current register page
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-brand-black flex font-sans overflow-x-hidden selection:bg-brand-yellow selection:text-brand-black">
      <div className="grid grid-cols-1 lg:grid-cols-12 w-full">
        
        {/* Left Panel: Register Form */}
        <div className="lg:col-span-5 flex flex-col justify-center px-6 md:px-16 py-12 bg-white max-w-xl mx-auto w-full lg:max-w-none">
          <div className="mb-8">
            <Link href="/" className="text-3xl font-black tracking-tighter hover:skew-x-2 transition-transform inline-block mb-4">
              VIBECHECK
            </Link>
            
            {/* Tilted Yellow Badge */}
            <div>
              <div className="inline-block bg-brand-yellow border-3 border-brand-black px-4 py-1.5 rotate-[-2deg] shadow-brutalist-sm">
                <span className="text-xs md:text-sm font-black uppercase tracking-wider">
                  GET ON THE LIST
                </span>
              </div>
            </div>
          </div>

          {isSuccess ? (
            <div className="bg-brand-yellow border-4 border-brand-black p-6 shadow-brutalist-md text-left space-y-4">
              <h3 className="text-xl font-black uppercase">🎉 ACCOUNT CREATED!</h3>
              <p className="text-xs font-bold leading-relaxed text-brand-black/80">
                Registration successful. Preparing dashboard and logging you in...
              </p>
              {/* Brutalist loading bar animation */}
              <div className="w-full h-8 border-4 border-brand-black bg-white overflow-hidden relative">
                <div className="h-full bg-brand-blue border-r-4 border-brand-black animate-[pulse_1s_infinite] w-full flex items-center justify-center">
                  <span className="text-[10px] font-black uppercase text-white tracking-widest">LOADING...</span>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-[#fee2e2] border-3 border-red-600 p-4 text-xs font-bold text-red-600 uppercase tracking-wide">
                  ⚠️ {error}
                </div>
              )}

              <BrutalistInput
                label="Full Name"
                type="text"
                placeholder="e.g. Jimi Hendrix"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <BrutalistInput
                label="Email Address"
                type="email"
                placeholder="e.g. rockstar@vibecheck.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <BrutalistInput
                label="Phone Number (Optional)"
                type="tel"
                placeholder="e.g. 08123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
              />

              <BrutalistInput
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <BrutalistInput
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPasswordError}
                required
              />

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="btn-brutalist-blue w-full py-4 text-sm font-black flex items-center justify-center gap-2 mt-8 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "CREATING..." : "CREATE ACCOUNT"} <span>➔</span>
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-xs font-bold uppercase tracking-wider text-brand-black/70">
            Already have an account?{" "}
            <Link href="/login" className="underline text-brand-blue hover:text-brand-black transition-colors">
              Login Here
            </Link>
          </div>
        </div>

        {/* Right Panel: Promo Visual */}
        <div className="hidden lg:flex lg:col-span-7 bg-[#1b1b1b] relative overflow-hidden items-end p-12 border-l-4 border-brand-black">
          {/* Background Illustration */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/register-promo.png"
              alt="Promo background"
              fill
              className="object-cover opacity-60 grayscale scale-105 contrast-125 brightness-75"
              priority
            />
          </div>

          {/* Golden Badge Icon in Top Right */}
          <div className="absolute top-8 right-8 z-10 bg-brand-yellow border-4 border-brand-black p-4 rotate-[6deg] shadow-brutalist-md">
            <svg className="w-12 h-12 text-brand-black" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12v5c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-3v8h3c1.66 0 3-1.34 3-3v-5c0-5.52-4.48-10-10-10z"></path>
            </svg>
          </div>

          {/* Marketing Card */}
          <div className="card-brutalist p-8 bg-white z-10 w-full max-w-xl text-left shadow-[8px_8px_0px_0px_#1b1b1b]">
            <h2 className="text-3xl font-black tracking-tight uppercase mb-4 leading-none">
              NO REFUNDS.
              <br />
              ONLY ROCK.
            </h2>
            
            {/* Blue indicator line block */}
            <div className="border-l-4 border-brand-blue pl-4 mb-6">
              <p className="text-sm font-bold text-brand-black/80 leading-relaxed">
                Join the VIBECHECK community to score exclusive presales, manage your tickets, and never miss a drop.
              </p>
            </div>

            {/* Badges */}
            <div className="flex gap-4">
              <span className="bg-[#f9f9f9] border-2 border-brand-black font-bold uppercase tracking-wider text-xs px-3.5 py-1.5 shadow-[2px_2px_0px_0px_#1b1b1b]">
                LIVE MUSIC
              </span>
              <span className="bg-brand-yellow border-2 border-brand-black font-bold uppercase tracking-wider text-xs px-3.5 py-1.5 shadow-[2px_2px_0px_0px_#1b1b1b]">
                EARLY ACCESS
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
