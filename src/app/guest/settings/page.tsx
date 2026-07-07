"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

export default function GuestSettingsPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sqlInstructions, setSqlInstructions] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email || "");
          
          let profileData: any = null;
          let loadError: any = null;
          
          try {
            const { data, error } = await supabase
              .from("profiles")
              .select("full_name, phone, avatar_url, image")
              .eq("id", user.id)
              .single();
              
            if (error) {
              loadError = error;
            } else {
              profileData = data;
            }
          } catch (e) {
            loadError = e;
          }

          // If schema is missing the new columns, query only basic fields and suggest migration
          if (loadError && (loadError.code === "42703" || loadError.message?.includes("column"))) {
            setSqlInstructions(
              "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS image text;\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;"
            );
            
            const { data: basicData, error: basicError } = await supabase
              .from("profiles")
              .select("full_name, phone")
              .eq("id", user.id)
              .single();
              
            if (!basicError && basicData) {
              profileData = basicData;
            } else if (basicError && basicError.code !== "PGRST116") {
              throw basicError;
            }
          } else if (loadError && loadError.code !== "PGRST116") {
            throw loadError;
          }

          if (profileData) {
            setFullName(profileData.full_name || "");
            setPhone(profileData.phone || "");
            setAvatarUrl(profileData.avatar_url || profileData.image || null);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load profile details.");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [supabase]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Strict file format validation (PNG, JPG, JPEG)
      const allowedExtensions = ["png", "jpg", "jpeg"];
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        alert("Hanya file gambar dengan ekstensi PNG, JPG, atau JPEG yang diperbolehkan!");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    // Strict SQL Injection validation
    const sqlPattern = /('|--|#|\/\*|\*\/|\b(select|union|insert|update|delete|drop|alter|create|truncate|exec|grant|revoke)\b)/i;
    if (sqlPattern.test(fullName) || sqlPattern.test(phone)) {
      setError("Inputs contain invalid characters or security threats.");
      setIsSaving(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Check if table schema accepts avatar_url and image
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone || null,
          avatar_url: avatarUrl,
          image: avatarUrl
        })
        .eq("id", user.id);

      if (updateError) {
        console.warn("Retrying profile update without avatar_url/image due to database constraint:", updateError.message);
        if (updateError.code === "42703" || updateError.message?.includes("column")) {
          setSqlInstructions(
            "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS image text;\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;"
          );
        }
        
        const { error: retryError } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            phone: phone || null
          })
          .eq("id", user.id);

        if (retryError) throw retryError;

        // Also save avatar to user metadata as backup
        await supabase.auth.updateUser({
          data: { 
            avatar_url: avatarUrl,
            image: avatarUrl
          }
        });
      }

      setSuccess("Profile updated successfully! Refreshing dashboard...");
      
      // Refresh layout profile
      window.location.reload();
    } catch (err: any) {
      console.error("Save error details:", err);
      if (err.message?.toLowerCase().includes("row-level security") || err.message?.toLowerCase().includes("violates") || err.message?.toLowerCase().includes("permission")) {
        setSqlInstructions(
          "CREATE POLICY \"Users can update their own profile\" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);"
        );
      }
      setError(err.message || "An error occurred while saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] p-10 flex items-center justify-center font-sans">
        <div className="card-brutalist p-8 bg-white border-4 border-brand-black max-w-sm w-full text-center shadow-[6px_6px_0px_0px_#1b1b1b]">
          <p className="font-black uppercase tracking-wider text-brand-black">LOADING PROFILE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] p-6 md:p-12 font-sans text-brand-black">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-black uppercase tracking-tight mb-8 text-left">
          PROFILE SETTINGS
        </h1>

        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Avatar Settings Box */}
          <div className="card-brutalist p-6 md:p-8 bg-white shadow-[6px_6px_0px_0px_#1b1b1b] flex flex-col md:flex-row gap-8 items-center text-left">
            <div className="relative w-28 h-28 border-4 border-brand-black rounded-full overflow-hidden bg-brand-blue text-white flex items-center justify-center shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile Avatar"
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="font-black text-2xl uppercase">
                  {fullName ? fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "JD"}
                </span>
              )}
            </div>

            <div className="space-y-4 w-full">
              <div>
                <h3 className="font-black uppercase text-sm mb-1">Profile Photo</h3>
                <p className="text-[10px] font-bold text-brand-black/60 uppercase tracking-wide">
                  Upload an image to personalize your dashboard profile avatar.
                </p>
              </div>

              <div className="relative inline-block">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handlePhotoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <span className="btn-brutalist-yellow text-xs py-2 px-4 inline-block font-black cursor-pointer shadow-[3px_3px_0px_0px_#1b1b1b]">
                  CHOOSE PHOTO
                </span>
              </div>
            </div>
          </div>

          {/* Profile Details Form */}
          <div className="card-brutalist p-6 md:p-8 bg-white shadow-[6px_6px_0px_0px_#1b1b1b] space-y-6 text-left">
            <h2 className="text-xl font-black uppercase tracking-tight border-b-2 border-brand-black pb-2">
              DETAILS
            </h2>

            {sqlInstructions && (
              <div className="bg-[#faf5ff] border-3 border-brand-black p-4 text-xs font-mono select-all overflow-x-auto shadow-brutalist-sm mb-4">
                <p className="text-brand-black/40 font-bold uppercase mb-2 select-none">// Copy dan Jalankan SQL ini di Dashboard Supabase SQL Editor:</p>
                <div className="text-brand-blue font-black whitespace-pre-wrap">
                  {sqlInstructions}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-[#fee2e2] border-3 border-red-600 p-4 text-xs font-bold text-red-600 uppercase tracking-wide">
                ⚠️ {error}
              </div>
            )}

            {success && (
              <div className="bg-brand-yellow border-3 border-brand-black p-4 text-xs font-black uppercase tracking-wide">
                🎉 {success}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                  EMAIL ADDRESS (READ-ONLY)
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="border-2 border-brand-black p-3.5 text-sm font-bold bg-[#eaeaea] text-brand-black/60 outline-none cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                  USERNAME
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border-2 border-brand-black p-3.5 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none"
                  required
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                  PHONE NUMBER
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 08123456789"
                  className="border-2 border-brand-black p-3.5 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn-brutalist-blue w-full py-4 text-sm font-black flex items-center justify-center gap-2 mt-8 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? "SAVING..." : "SAVE CHANGES"} <span>➔</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
