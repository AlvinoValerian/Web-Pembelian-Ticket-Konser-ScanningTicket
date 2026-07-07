"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface Category {
  id: string | null;
  name: string;
  price: number;
  capacity?: number;
  sold?: number;
  remaining?: number;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<any>(null);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([
    { id: null, name: "General Admission", price: 450000 },
    { id: null, name: "VIP Pass", price: 1200000 }
  ]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [proofFile, setProofFile] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [paymentSettings, setPaymentSettings] = useState<{
    qris_url: string;
    bca?: string;
    bni?: string;
    mandiri?: string;
    bri?: string;
  } | null>(null);
  const [activeQrisTab, setActiveQrisTab] = useState(false);
  const [copiedBank, setCopiedBank] = useState<string | null>(null);

  // Fetch payment settings from dedicated table
  useEffect(() => {
    const fetchPaymentSettings = async () => {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      if (!error && data) {
        setPaymentSettings(data);
      }
    };
    fetchPaymentSettings();
  }, [supabase]);

  const handleCopy = (num: string, bank: string) => {
    navigator.clipboard.writeText(num);
    setCopiedBank(bank);
    setTimeout(() => setCopiedBank(null), 2000);
  };

  // Prefill profile and load all active events
  useEffect(() => {
    const loadCheckoutData = async () => {
      setLoading(true);
      try {
        // 1. prefills user details
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, phone")
            .eq("id", user.id)
            .single();
          if (profile) {
            const names = profile.full_name ? profile.full_name.split(" ") : [""];
            setFirstName(names[0] || "");
            setLastName(names.slice(1).join(" ") || "");
            setEmail(profile.email || user.email || "");
            setPhone(profile.phone || "");
          } else {
            setEmail(user.email || "");
          }
        }

        // Run auto soft-delete of expired events (> 2 days past event date_time)
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const { data: expiredEvents } = await supabase
          .from("events")
          .select("id, title")
          .lt("date_time", twoDaysAgo)
          .neq("status", "ARCHIVED")
          .not("title", "like", "[DELETED]%");

        if (expiredEvents && expiredEvents.length > 0) {
          for (const ev of expiredEvents) {
            await supabase
              .from("events")
              .update({
                title: `[DELETED] ${ev.title}`,
                status: "ARCHIVED"
              })
              .eq("id", ev.id);
          }
        }

        // 2. Fetch all active events
        const { data: eventsData } = await supabase
          .from("events")
          .select("*")
          .order("date_time", { ascending: true });
        
        const now = new Date();
        const activeEvents = (eventsData || [])
          .filter((e: any) => !e.title.startsWith("[DELETED]") && e.status !== "ARCHIVED")
          .sort((a: any, b: any) => {
            const aExpired = new Date(a.date_time) < now;
            const bExpired = new Date(b.date_time) < now;
            if (aExpired && !bExpired) return 1;
            if (!aExpired && bExpired) return -1;
            return new Date(a.date_time).getTime() - new Date(b.date_time).getTime();
          });
        setEventsList(activeEvents);

        // 3. Set selected event ID
        const eventId = searchParams.get("event_id");
        let initialEventId = "";
        if (eventId && activeEvents.some((e: any) => e.id === eventId)) {
          initialEventId = eventId;
        } else {
          const nonExpired = activeEvents.filter((e: any) => new Date(e.date_time) >= now);
          if (nonExpired.length > 0) {
            initialEventId = nonExpired[0].id;
          } else if (activeEvents.length > 0) {
            initialEventId = activeEvents[0].id;
          }
        }
        setSelectedEventId(initialEventId);
      } catch (err: any) {
        console.error("Error loading checkout data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCheckoutData();
  }, [supabase, searchParams]);

  // Load ticket tiers whenever selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) return;

    const loadEventTiers = async () => {
      const event = eventsList.find((e: any) => e.id === selectedEventId);
      if (event) {
        setEventData(event);
      } else {
        const { data } = await supabase
          .from("events")
          .select("*")
          .eq("id", selectedEventId)
          .maybeSingle();
        if (data) setEventData(data);
      }

      // Load tickets count to check remaining capacity
      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("tier_id")
        .eq("event_id", selectedEventId);

      const soldCounts: Record<string, number> = {};
      (ticketsData || []).forEach((t: any) => {
        soldCounts[t.tier_id] = (soldCounts[t.tier_id] || 0) + 1;
      });

      // Load ticket tiers from DB
      let { data: tiers } = await supabase
        .from("ticket_tiers")
        .select("*")
        .eq("event_id", selectedEventId);

      if (!tiers || tiers.length === 0) {
        // Self-healing default tiers if none exist
        const targetEvent = event || eventData;
        if (targetEvent) {
          const defaultTiers = [
            {
              event_id: selectedEventId,
              name: "General Admission",
              price: 450000,
              capacity: 500,
              sale_start: new Date().toISOString(),
              sale_end: new Date(targetEvent.date_time || new Date()).toISOString()
            },
            {
              event_id: selectedEventId,
              name: "VIP Pass",
              price: 1200000,
              capacity: 100,
              sale_start: new Date().toISOString(),
              sale_end: new Date(targetEvent.date_time || new Date()).toISOString()
            }
          ];

          const { data: insertedTiers, error: insertTiersErr } = await supabase
            .from("ticket_tiers")
            .insert(defaultTiers)
            .select();

          if (!insertTiersErr && insertedTiers) {
            tiers = insertedTiers;
          }
        }
      }

      if (tiers && tiers.length > 0) {
        setCategories(tiers.map((t: any) => {
          const cap = Number(t.capacity) || 0;
          const sold = soldCounts[t.id] || 0;
          const rem = Math.max(0, cap - sold);
          return {
            id: t.id,
            name: t.name,
            price: Number(t.price),
            capacity: cap,
            sold: sold,
            remaining: rem
          };
        }));
      } else {
        setCategories([
          { id: null, name: "General Admission", price: 450000, capacity: 500, sold: 0, remaining: 500 },
          { id: null, name: "VIP Pass", price: 1200000, capacity: 100, sold: 0, remaining: 100 }
        ]);
      }
      setSelectedCategoryIndex(0);
      setQuantity(1);
    };

    loadEventTiers();
  }, [selectedEventId, eventsList, supabase]);

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const selectedCategory = categories[selectedCategoryIndex] || { name: "General Admission", price: 450000, remaining: 500 };
  const ticketPrice = selectedCategory.price;
  const subtotal = ticketPrice * quantity;
  const processingFee = 10000; // Rp 10.000 processing fee
  const total = subtotal + processingFee;

  const remainingTickets = selectedCategory.remaining !== undefined ? selectedCategory.remaining : 500;

  const handleIncrement = () => setQuantity(prev => prev < remainingTickets ? prev + 1 : prev);
  const handleDecrement = () => setQuantity(prev => prev > 1 ? prev - 1 : 1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Strict file format validation (PNG, JPG, JPEG)
      const allowedExtensions = ["png", "jpg", "jpeg"];
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        alert("Hanya file gambar dengan ekstensi PNG, JPG, atau JPEG yang diperbolehkan!");
        e.target.value = "";
        setProofFile(null);
        setProofPreview(null);
        return;
      }

      setProofFile(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProofPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData) {
      alert("No active event selected for checkout.");
      return;
    }

    // Strict SQL Injection validation
    const sqlPattern = /('|--|#|\/\*|\*\/|\b(select|union|insert|update|delete|drop|alter|create|truncate|exec|grant|revoke)\b)/i;
    if (sqlPattern.test(firstName) || sqlPattern.test(lastName) || sqlPattern.test(email)) {
      alert("Data input Anda terdeteksi mengandung pola keamanan yang tidak valid (SQL Injection).");
      return;
    }

    const isEventPassed = new Date(eventData.date_time) < new Date();
    if (isEventPassed) {
      alert("Maaf, event ini sudah selesai / kedaluwarsa. Anda tidak dapat membeli tiket untuk event ini.");
      return;
    }

    if (remainingTickets <= 0) {
      alert("Maaf, kategori tiket yang Anda pilih sudah HABIS (SOLD OUT).");
      return;
    }
    if (quantity > remainingTickets) {
      alert(`Maaf, Anda tidak dapat membeli lebih dari jumlah tiket yang tersedia (${remainingTickets} tiket tersisa).`);
      return;
    }
    if (!proofFile) {
      alert("WARNING: Please upload a payment proof or bank transfer confirmation first!");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmOrderSubmit = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please login first to submit your order.");
        router.push("/login");
        return;
      }

      const selectedCategory = categories[selectedCategoryIndex];
      const tierId = selectedCategory?.id;

      if (!tierId) {
        throw new Error("Unable to retrieve ticket tier ID. Please try again.");
      }

      const ticketsToInsert = [];
      const createdOrders = [];
      const fullName = `${firstName} ${lastName}`.trim() || "Guest Buyer";
      const singleTicketPrice = selectedCategory.price;

      // Loop to insert a separate order for each quantity, so they get unique ORD- numbers
      for (let i = 0; i < quantity; i++) {
        const curOrderNum = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: curOrderNum,
            buyer_id: user.id,
            event_id: eventData.id,
            total_amount: singleTicketPrice,
            status: "PENDING",
            quantity: 1,
            receipt_url: proofPreview || proofFile,
            payment_method: "BANK_TRANSFER"
          })
          .select("id")
          .single();

        if (orderError) {
          throw new Error(orderError.message);
        }

        ticketsToInsert.push({
          order_id: orderData.id,
          event_id: eventData.id,
          tier_id: tierId,
          ticket_code: curOrderNum, // Identical to order_number, making it completely unique and scannable
          owner_name: fullName,
          owner_email: email || null,
          owner_phone: phone || null,
          status: "ACTIVE", // Match Postgres enum: ACTIVE, CHECKED_IN, CANCELLED, REFUNDED
          scan_count: 0
        });

        createdOrders.push(curOrderNum);
      }

      const { error: ticketsError } = await supabase
        .from("tickets")
        .insert(ticketsToInsert);

      if (ticketsError) {
        // Rollback created orders if ticket generation failed
        for (const t of ticketsToInsert) {
          await supabase.from("orders").delete().eq("id", t.order_id);
        }
        throw new Error(`Failed to generate tickets: ${ticketsError.message}`);
      }

      const mainOrderNum = createdOrders.join(", ");

      alert(`SUCCESS: Thank you, ${firstName}! Your order(s) ${mainOrderNum} was submitted. Reviewing payment proof...`);
      
      // Reload and clear purchase data on successful submit
      window.location.reload();
    } catch (err: any) {
      alert(`Failed to submit order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex flex-col items-center justify-center">
        <div className="bg-brand-yellow border-4 border-brand-black p-8 shadow-brutalist-md uppercase font-black text-sm tracking-widest animate-pulse">
          ⏳ Loading event details...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] text-brand-black flex flex-col font-sans overflow-x-hidden pb-12 selection:bg-brand-yellow selection:text-brand-black">
      
      {/* Main split content grid */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 w-full">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Input Forms */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Buyer Info Card */}
            <div className="card-brutalist p-6 md:p-8 shadow-[6px_6px_0px_0px_#1b1b1b]">
              <h2 className="text-2xl font-black uppercase tracking-tight mb-6 border-b-2 border-brand-black pb-2 text-left">
                BUYER INFO
              </h2>

              <div className="space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                      FIRST NAME
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Jimi"
                      className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40"
                      required
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                      LAST NAME
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Hendrix"
                      className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jimi@electricladyland.com"
                    className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40"
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
                    placeholder="e.g. 081234567890"
                    className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Ticket Selection Card */}
            <div className="card-brutalist p-6 md:p-8 shadow-[6px_6px_0px_0px_#1b1b1b]">
              <h2 className="text-2xl font-black uppercase tracking-tight mb-6 border-b-2 border-brand-black pb-2 text-left">
                TICKET SELECTION
              </h2>

              {/* Event Selector Dropdown */}
              <div className="flex flex-col mb-6 text-left">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                  SELECT EVENT / GIG
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="border-3 border-brand-black p-3.5 text-xs md:text-sm font-black uppercase tracking-wider bg-brand-yellow text-brand-black outline-none cursor-pointer shadow-[3px_3px_0px_0px_#1b1b1b] appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 16px center', backgroundRepeat: 'no-repeat' }}
                >
                  {eventsList.map((evt) => {
                    const isEventPassed = new Date(evt.date_time) < new Date();
                    return (
                      <option 
                        key={evt.id} 
                        value={evt.id} 
                        disabled={isEventPassed}
                        className={`bg-white ${isEventPassed ? "text-gray-400 font-normal" : "text-brand-black font-black"}`}
                      >
                        {evt.title} ({evt.venue}){isEventPassed ? " - [SUDAH SELESAI / EXPIRED]" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-end text-left">
                {/* Category Dropdown */}
                <div className="sm:col-span-8 flex flex-col">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                    CATEGORY
                  </label>
                  <select
                    value={selectedCategoryIndex}
                    onChange={(e) => setSelectedCategoryIndex(Number(e.target.value))}
                    className="border-3 border-brand-black p-3.5 pr-12 text-xs md:text-sm font-black uppercase tracking-wider bg-white outline-none appearance-none cursor-pointer shadow-[2px_2px_0px_0px_#1b1b1b]"
                    style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 16px center', backgroundRepeat: 'no-repeat' }}
                  >
                    {categories.map((cat, index) => {
                      const isSoldOut = cat.remaining !== undefined ? cat.remaining <= 0 : false;
                      return (
                        <option key={cat.name} value={index} className="bg-white text-brand-black">
                          {cat.name} - {formatIDR(cat.price)}{isSoldOut ? " - [SOLD OUT / HABIS]" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {selectedCategory.remaining !== undefined && (
                    <div className="mt-2.5 text-[10px] font-black uppercase tracking-wider">
                      {selectedCategory.remaining <= 0 ? (
                        <span className="text-red-600 bg-red-50 border-2 border-red-600 px-3 py-1.5 inline-block shadow-[2px_2px_0px_0px_#dc2626]">
                          🚫 SOLD OUT / TIKET HABIS
                        </span>
                      ) : (
                        <span className="text-brand-blue bg-blue-50 border-2 border-brand-blue px-3 py-1.5 inline-block shadow-[2px_2px_0px_0px_#2563eb]">
                          🎫 TERSISA: {selectedCategory.remaining} TIKET
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity Counter */}
                <div className="sm:col-span-4 flex flex-col">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                    QUANTITY
                  </label>
                  <div className="flex border-3 border-brand-black shadow-[2px_2px_0px_0px_#1b1b1b] bg-white h-12 overflow-hidden">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      className="w-12 h-full font-black text-lg border-r-3 border-brand-black hover:bg-brand-bg transition-colors"
                    >
                      -
                    </button>
                    <span className="flex-1 flex items-center justify-center font-black text-sm select-none">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      className="w-12 h-full font-black text-lg border-l-3 border-brand-black hover:bg-brand-bg transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Payment Proof Upload Card */}
            <div className="card-brutalist p-6 md:p-8 shadow-[6px_6px_0px_0px_#1b1b1b]">
              <h2 className="text-2xl font-black uppercase tracking-tight mb-4 border-b-2 border-brand-black pb-2 text-left">
                PAYMENT PROOF
              </h2>
              <p className="text-xs font-bold text-brand-black/60 mb-6 text-left uppercase tracking-wide">
                Upload your bank transfer receipt or payment confirmation.
              </p>

              {/* Dotted drag and drop zone */}
              <div className="border-4 border-dashed border-brand-black p-8 bg-[#fafafa] flex flex-col items-center justify-center text-center relative hover:bg-brand-bg/25 transition-colors">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                />
                
                {proofPreview ? (
                  <div className="w-full flex flex-col items-center gap-4 z-10">
                    <div className="relative border-4 border-brand-black w-full max-w-[280px] aspect-[4/3] bg-white overflow-hidden shadow-brutalist-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={proofPreview}
                        alt="Payment Receipt Preview"
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-brand-blue bg-[#dbe1ff] border-2 border-brand-black px-3 py-1 shadow-brutalist-sm max-w-xs truncate">
                        📄 {proofFile}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setProofFile(null);
                          setProofPreview(null);
                        }}
                        className="text-[10px] font-black text-red-600 uppercase hover:underline cursor-pointer z-30 pointer-events-auto"
                      >
                        ✕ REMOVE & REUPLOAD
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <svg className="w-10 h-10 text-brand-black/65 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                    </svg>

                    <p className="text-sm font-black uppercase tracking-wider mb-2">
                      DRAG & DROP HERE
                    </p>
                    <span className="bg-brand-black text-white px-4 py-2 font-black text-[10px] uppercase tracking-widest shadow-[3px_3px_0px_0px_#fed01b]">
                      OR BROWSE FILES
                    </span>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Ticket Poster & Order Summary */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Show Banner Poster Card */}
            <div className="card-brutalist overflow-hidden shadow-[6px_6px_0px_0px_#1b1b1b] text-left">
              <div className="relative aspect-[16/10] w-full bg-brand-black border-b-4 border-brand-black">
                {/* Live Show tag */}
                <div className="absolute bottom-4 left-4 bg-brand-yellow border-2 border-brand-black px-3 py-1 font-bold text-xs uppercase tracking-wider z-10 shadow-[2px_2px_0px_0px_#1b1b1b]">
                  LIVE SHOW
                </div>
                {eventData?.image_src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={eventData.image_src}
                    alt={eventData.title || "Event Poster"}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <Image
                    src="/midnight-distortion.png"
                    alt="Midnight Distortion Event Poster"
                    fill
                    className="object-cover"
                  />
                )}
              </div>

              <div className="p-6 bg-[#dbe1ff] space-y-4">
                <h3 className="text-2xl font-black uppercase tracking-tight leading-none text-brand-black break-words">
                  {eventData?.title || "MIDNIGHT DISTORTION TOUR"}
                </h3>
                
                <div className="space-y-2 text-xs font-bold uppercase tracking-wider text-brand-black/80">
                  <p className="flex items-center gap-2">
                    📅 {eventData?.date_time ? new Date(eventData.date_time).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    }) : "OCTOBER 31, 2024 • 9:00 PM"}
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    📍 {eventData?.venue || "THE CONCRETE WAREHOUSE"}
                  </p>
                  <p className="flex items-center gap-2">
                    🌐 GENRE: {eventData?.genre || "ELECTRONIC"}
                  </p>
                </div>
                
                {/* Dots indicator */}
                <div className="flex gap-2 pt-2 justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-black"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-black/20"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-black/20"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-black/20"></span>
                </div>
              </div>
            </div>

            {/* Order Summary Card */}
            <div className="card-brutalist p-6 md:p-8 shadow-[6px_6px_0px_0px_#1b1b1b] text-left space-y-6">
              <h3 className="text-xl font-black uppercase tracking-tight mb-4 border-b-2 border-brand-black pb-2">
                ORDER SUMMARY
              </h3>

              <div className="space-y-4 text-xs font-bold uppercase tracking-wider border-b-2 border-brand-black/10 pb-4">
                <div className="flex justify-between">
                  <span>{quantity}x {selectedCategory.name}</span>
                  <span className="font-black text-brand-black">{formatIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Fee</span>
                  <span className="font-black text-brand-black">{formatIDR(processingFee)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-lg font-black uppercase tracking-tight">
                <span>TOTAL</span>
                <span className="text-brand-blue">{formatIDR(total)}</span>
              </div>

              {/* Payment Methods Section */}
              {paymentSettings && (
                <div className="border-t-3 border-brand-black pt-4 mt-4 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-black/75">
                    💳 PAYMENT METHODS (METODE PEMBAYARAN):
                  </h4>
                  
                  {/* QRIS Accordion Option */}
                  <div className="border-3 border-brand-black shadow-brutalist-xs bg-white overflow-hidden">
                    <div 
                      onClick={() => setActiveQrisTab(!activeQrisTab)}
                      className="flex justify-between items-center p-3 hover:bg-brand-bg/50 transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-brand-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
                        </svg>
                        <span className="text-xs font-black uppercase tracking-tight">QRIS (Scan to Pay)</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Small Download button */}
                        <a 
                          href={paymentSettings.qris_url}
                          download="vibecheck-qris.png"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-brand-yellow hover:bg-brand-black hover:text-brand-yellow text-brand-black border-2 border-brand-black px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-brutalist-xs transition-colors rounded-sm cursor-pointer"
                        >
                          Download QR
                        </a>
                        <svg 
                          className={`w-4 h-4 text-brand-black transition-transform duration-300 ${activeQrisTab ? 'rotate-180' : 'rotate-0'}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </div>
                    </div>

                    {/* Accordion Expansion Container with smooth transition styling */}
                    <div 
                      className={`transition-all duration-300 ease-in-out overflow-hidden border-brand-black ${
                        activeQrisTab ? "max-h-72 border-t-3 p-4 bg-brand-bg/15" : "max-h-0 border-t-0 p-0"
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="relative border-3 border-brand-black aspect-square bg-white overflow-hidden shadow-brutalist-xs max-w-[160px] w-full p-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={paymentSettings.qris_url}
                            alt="QRIS Payment QR Code"
                            className="object-contain w-full h-full bg-white"
                          />
                        </div>
                        <span className="text-[10px] font-black uppercase text-brand-black/60 tracking-wider">
                          Scan and pay with any e-wallet / banking app
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Accounts */}
                  <div className="space-y-2">
                    {/* BCA */}
                    {paymentSettings.bca && (
                      <div className="flex items-center justify-between bg-white border-3 border-brand-black p-2.5 shadow-brutalist-xs">
                        <div className="flex items-center gap-2">
                          <div className="bg-[#00509d] text-white px-2 py-1 text-[9px] font-black border-2 border-brand-black rounded-sm uppercase select-none tracking-widest shadow-brutalist-xs">
                            BCA
                          </div>
                          <span className="text-xs font-black uppercase text-brand-black tracking-wider select-all">
                            {paymentSettings.bca}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentSettings.bca!, "BCA")}
                          className="bg-brand-bg hover:bg-brand-blue hover:text-white border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          {copiedBank === "BCA" ? "COPIED!" : "COPY"}
                        </button>
                      </div>
                    )}

                    {/* BNI */}
                    {paymentSettings.bni && (
                      <div className="flex items-center justify-between bg-white border-3 border-brand-black p-2.5 shadow-brutalist-xs">
                        <div className="flex items-center gap-2">
                          <div className="bg-[#e05a00] text-white px-2 py-1 text-[9px] font-black border-2 border-brand-black rounded-sm uppercase select-none tracking-widest shadow-brutalist-xs">
                            BNI
                          </div>
                          <span className="text-xs font-black uppercase text-brand-black tracking-wider select-all">
                            {paymentSettings.bni}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentSettings.bni!, "BNI")}
                          className="bg-brand-bg hover:bg-brand-blue hover:text-white border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          {copiedBank === "BNI" ? "COPIED!" : "COPY"}
                        </button>
                      </div>
                    )}

                    {/* Mandiri */}
                    {paymentSettings.mandiri && (
                      <div className="flex items-center justify-between bg-white border-3 border-brand-black p-2.5 shadow-brutalist-xs">
                        <div className="flex items-center gap-2">
                          <div className="bg-[#003d79] text-white px-1.5 py-0.5 text-[8px] font-black border-2 border-brand-black rounded-sm uppercase select-none tracking-widest shadow-brutalist-xs flex flex-col items-center">
                            <span>MANDIRI</span>
                            <span className="h-[2px] w-6 bg-brand-yellow"></span>
                          </div>
                          <span className="text-xs font-black uppercase text-brand-black tracking-wider select-all">
                            {paymentSettings.mandiri}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentSettings.mandiri!, "MANDIRI")}
                          className="bg-brand-bg hover:bg-brand-blue hover:text-white border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          {copiedBank === "MANDIRI" ? "COPIED!" : "COPY"}
                        </button>
                      </div>
                    )}

                    {/* BRI */}
                    {paymentSettings.bri && (
                      <div className="flex items-center justify-between bg-white border-3 border-brand-black p-2.5 shadow-brutalist-xs">
                        <div className="flex items-center gap-2">
                          <div className="bg-[#00529b] text-white px-2 py-1 text-[9px] font-black border-2 border-brand-black rounded-sm uppercase select-none tracking-widest shadow-brutalist-xs">
                            BRI
                          </div>
                          <span className="text-xs font-black uppercase text-brand-black tracking-wider select-all">
                            {paymentSettings.bri}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(paymentSettings.bri!, "BRI")}
                          className="bg-brand-bg hover:bg-brand-blue hover:text-white border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          {copiedBank === "BRI" ? "COPIED!" : "COPY"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(() => {
                const isEventPassed = eventData ? new Date(eventData.date_time) < new Date() : false;
                return (
                  <button
                    type="submit"
                    disabled={isSubmitting || remainingTickets <= 0 || isEventPassed}
                    className={`w-full py-4 text-sm font-black tracking-wider flex items-center justify-center gap-2 cursor-pointer text-center disabled:opacity-55 transition-all
                      ${(remainingTickets <= 0 || isEventPassed)
                        ? "bg-brand-black text-white/50 border-3 border-brand-black cursor-not-allowed shadow-none translate-x-[4px] translate-y-[4px]" 
                        : "btn-brutalist-blue"
                      }`}
                  >
                    {isEventPassed 
                      ? "SUDAH SELESAI / EXPIRED" 
                      : remainingTickets <= 0 
                        ? "SOLD OUT" 
                        : isSubmitting 
                          ? "SUBMITTING..." 
                          : "SUBMIT ORDER"
                    }
                  </button>
                );
              })()}
            </div>

          </div>

        </form>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-brand-black/60 flex items-center justify-center p-6 z-50">
          <div className="card-brutalist p-6 md:p-8 bg-white max-w-md w-full space-y-6 shadow-[10px_10px_0px_0px_#1b1b1b]">
            <div className="bg-brand-yellow border-4 border-brand-black p-4 rotate-[-1deg] text-center font-black uppercase text-sm tracking-wider shadow-brutalist-sm">
              ⚠️ CONFIRM TICKET PURCHASE
            </div>
            
            <p className="text-xs font-bold text-brand-black leading-relaxed text-left uppercase">
              Are you sure you want to submit this order of <span className="font-black text-brand-blue">{quantity}x {selectedCategory.name}</span> for <span className="font-black text-brand-blue">{eventData?.title}</span>? 
              <br/><br/>
              Total to pay: <span className="font-black text-brand-blue">{formatIDR(total)}</span>
            </p>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleConfirmOrderSubmit}
                disabled={isSubmitting}
                className="btn-brutalist-blue flex-1 py-3 text-xs tracking-wider font-black uppercase cursor-pointer"
              >
                {isSubmitting ? "SUBMITTING..." : "YES, SUBMIT"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="bg-white border-3 border-brand-black py-3 px-6 text-xs tracking-wider font-black uppercase shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer flex-1"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center font-black uppercase text-brand-black bg-[#f2f2f2]">
        <div className="bg-brand-yellow border-4 border-brand-black p-8 shadow-brutalist-md">
          Loading Checkout Form...
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
