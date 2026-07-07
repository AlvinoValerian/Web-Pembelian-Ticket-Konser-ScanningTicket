"use client";

import React, { useState, useEffect, useRef } from "react";
import BrutalistInput from "@/components/BrutalistInput";
import { createClient } from "@/utils/supabase/client";

interface PaymentConfig {
  qris_url: string;
  bca: string;
  bni: string;
  mandiri: string;
  bri: string;
}

export default function PaymentConfigPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qrisUrl, setQrisUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [bca, setBca] = useState("");
  const [bni, setBni] = useState("");
  const [mandiri, setMandiri] = useState("");
  const [bri, setBri] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch current payment config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Session expired. Please log in again.");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("payment_settings")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

        if (data) {
          setQrisUrl(data.qris_url || "");
          setBca(data.bca || "");
          setBni(data.bni || "");
          setMandiri(data.mandiri || "");
          setBri(data.bri || "");
        }
      } catch (err: any) {
        console.error("Error loading payment configuration:", err);
        setError("Failed to load payment settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [supabase]);

  const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedExtensions = ["png", "jpg", "jpeg"];
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        alert("Only image files (PNG, JPG, JPEG) are allowed for QRIS!");
        e.target.value = "";
        setFileName("");
        return;
      }

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setQrisUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!qrisUrl) {
      setError("QRIS Image is mandatory. Please upload a QRIS code.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user session found.");

      const payload = {
        id: 1,
        qris_url: qrisUrl,
        bca: bca.trim(),
        bni: bni.trim(),
        mandiri: mandiri.trim(),
        bri: bri.trim(),
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from("payment_settings")
        .upsert(payload);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      console.error("Error saving configuration:", err);
      setError(err.message || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 w-full text-left font-black uppercase text-xl">
        Loading payment configuration...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 w-full text-left max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-block bg-brand-yellow border-3 border-brand-black px-4 py-1.5 rotate-[-1.5deg] shadow-brutalist-sm mb-4">
          <span className="text-xs md:text-sm font-black uppercase tracking-wider">
            SYSTEM SETTINGS
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-none mb-2">
          PAYMENT METHODS
        </h1>
        <p className="text-xs md:text-sm font-bold text-brand-black/60 uppercase">
          Manage your store payment modes. Upload the QRIS code (mandatory) and provide optional bank transfer details.
        </p>
      </div>

      {success && (
        <div className="bg-brand-yellow border-3 border-brand-black p-4 text-xs font-black uppercase tracking-wider mb-6 shadow-brutalist-sm">
          🎉 Payment Configuration saved successfully! Settings updated.
        </div>
      )}

      {error && (
        <div className="bg-[#fee2e2] border-3 border-red-600 p-4 text-xs font-bold text-red-600 uppercase tracking-wide mb-6 shadow-brutalist-sm">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Inputs */}
        <div className="lg:col-span-7 space-y-6">
          {/* QRIS Upload */}
          <div className="flex flex-col text-left space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-brand-black">
              QRIS Image <span className="text-red-600 font-bold">*</span>
            </label>
            <div className="relative border-3 border-brand-black bg-white shadow-brutalist-sm p-4 flex flex-col sm:flex-row items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".png,.jpg,.jpeg"
                onChange={handleQrisUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-brand-yellow text-brand-black border-2 border-brand-black px-4 py-2.5 font-black text-xs uppercase tracking-wider shadow-brutalist-xs hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer shrink-0"
              >
                Choose QRIS File
              </button>
              <span className="text-xs font-bold text-brand-black/75 truncate flex-1 w-full text-center sm:text-left select-all">
                {fileName || "No file chosen"}
              </span>
              <span className="text-[10px] font-black uppercase text-brand-black/50 shrink-0">
                (PNG, JPG, JPEG)
              </span>
            </div>
          </div>

          <div className="border-t-2 border-brand-black/10 my-4"></div>
          <h3 className="text-sm font-black uppercase tracking-wider text-brand-blue mb-1">
            Indonesian Bank Transfers (Optional)
          </h3>
          <p className="text-[10px] font-bold text-brand-black/50 uppercase leading-none pb-2">
            Leave any fields blank to disable them from appearing on checkout.
          </p>

          {/* BCA */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 border-3 border-brand-black bg-[#00509d] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-brutalist-xs rounded-sm select-none">
              BCA
            </div>
            <BrutalistInput
              label="BCA Account Number"
              type="text"
              placeholder="e.g. 8410291932"
              value={bca}
              onChange={(e) => setBca(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          {/* BNI */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 border-3 border-brand-black bg-[#e05a00] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-brutalist-xs rounded-sm select-none">
              BNI
            </div>
            <BrutalistInput
              label="BNI Account Number"
              type="text"
              placeholder="e.g. 0239103920"
              value={bni}
              onChange={(e) => setBni(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          {/* Mandiri */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 border-3 border-brand-black bg-[#003d79] text-white flex flex-col items-center justify-center font-black text-[10px] shrink-0 shadow-brutalist-xs rounded-sm select-none">
              <span>MANDIRI</span>
              <span className="h-1 w-8 bg-brand-yellow mt-0.5"></span>
            </div>
            <BrutalistInput
              label="Mandiri Account Number"
              type="text"
              placeholder="e.g. 1370010020304"
              value={mandiri}
              onChange={(e) => setMandiri(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          {/* BRI */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 border-3 border-brand-black bg-[#00529b] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-brutalist-xs rounded-sm select-none">
              BRI
            </div>
            <BrutalistInput
              label="BRI Account Number"
              type="text"
              placeholder="e.g. 001201000300400"
              value={bri}
              onChange={(e) => setBri(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

        </div>

        {/* Right Side: QRIS Preview Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card-brutalist p-6 bg-white shadow-brutalist-md text-center border-4 border-brand-black">
            <div className="bg-brand-black text-brand-yellow font-black uppercase tracking-wider text-xs px-3 py-1 inline-block mb-4 border-2 border-brand-black rotate-[-2deg]">
              QRIS PREVIEW
            </div>
            {qrisUrl ? (
              <div className="space-y-4">
                <div className="relative border-4 border-brand-black aspect-[3/4] bg-white overflow-hidden shadow-brutalist-sm max-w-xs mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrisUrl}
                    alt="QRIS Code Preview"
                    className="object-contain w-full h-full p-2 bg-white"
                  />
                </div>
                 <button
                  type="button"
                  onClick={() => {
                    setQrisUrl("");
                    setFileName("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs font-black text-red-600 uppercase hover:underline cursor-pointer"
                >
                  ✕ Clear Image
                </button>
              </div>
            ) : (
              <div className="border-4 border-dashed border-brand-black p-12 bg-brand-bg/20 flex flex-col items-center justify-center aspect-[3/4] max-w-xs mx-auto">
                <svg className="w-12 h-12 text-brand-black/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                </svg>
                <span className="text-xs font-black text-brand-black/50 uppercase">
                  No QRIS Uploaded
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-brutalist-blue w-full py-4 text-sm font-black flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
          >
            {saving ? "SAVING CONFIGURATION..." : "SAVE PAYMENT SETTINGS"} <span>➔</span>
          </button>
        </div>
      </form>
    </div>
  );
}
