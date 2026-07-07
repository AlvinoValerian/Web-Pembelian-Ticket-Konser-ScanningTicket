"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface Category {
  id: string | null;
  name: string;
  price: number;
  capacity?: number;
  sold?: number;
  remaining?: number;
}

export default function OfflinePurchasePage() {
  const router = useRouter();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);

  // Load all active events
  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
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

        if (activeEvents.length > 0) {
          const nonExpired = activeEvents.filter((e: any) => new Date(e.date_time) >= now);
          if (nonExpired.length > 0) {
            setSelectedEventId(nonExpired[0].id);
          } else {
            setSelectedEventId(activeEvents[0].id);
          }
        }
      } catch (err: any) {
        console.error("Error loading events for offline purchase:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [supabase]);

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
        // Fallback default tiers
        const defaultTiers = [
          {
            id: "default-ga",
            name: "General Admission",
            price: 450000,
            capacity: 500
          },
          {
            id: "default-vip",
            name: "VIP Pass",
            price: 1200000,
            capacity: 100
          }
        ];
        
        const mappedCategories = defaultTiers.map(t => {
          const sold = soldCounts[t.id] || 0;
          return {
            id: t.id,
            name: t.name,
            price: t.price,
            capacity: t.capacity,
            sold,
            remaining: Math.max(0, t.capacity - sold)
          };
        });
        setCategories(mappedCategories);
        setSelectedCategoryIndex(0);
      } else {
        const mappedCategories = tiers.map(t => {
          const sold = soldCounts[t.id] || 0;
          const capacityVal = t.capacity || 200;
          return {
            id: t.id,
            name: t.name,
            price: t.price,
            capacity: capacityVal,
            sold,
            remaining: Math.max(0, capacityVal - sold)
          };
        });
        setCategories(mappedCategories);
        setSelectedCategoryIndex(0);
      }
    };

    loadEventTiers();
  }, [selectedEventId, eventsList, supabase]);

  const selectedCategory = categories[selectedCategoryIndex] || { id: null, name: "General Admission", price: 450000, remaining: 100 };
  const subtotal = selectedCategory.price * quantity;
  const processingFee = 0; // Bypassed fee for offline direct cash purchases
  const total = subtotal + processingFee;
  const remainingTickets = selectedCategory.remaining !== undefined ? selectedCategory.remaining : 100;

  const handleIncrement = () => {
    if (quantity < remainingTickets) {
      setQuantity(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(num);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData) {
      alert("No active event selected for purchase.");
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
    
    // Email Validation (simple check)
    if (sendEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Harap masukkan alamat email yang valid untuk mengirimkan e-ticket!");
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleConfirmOrderSubmit = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Sesi admin berakhir. Harap login kembali.");
        router.push("/login");
        return;
      }

      const tierId = selectedCategory?.id;
      if (!tierId) {
        throw new Error("Gagal mengambil ID tier tiket. Silakan coba lagi.");
      }

      const ticketsToInsert = [];
      const createdOrders = [];
      const fullName = `${firstName} ${lastName}`.trim() || "Offline Buyer";
      const singleTicketPrice = selectedCategory.price;

      // Loop to insert a separate order for each quantity, so they get unique ORD- numbers
      for (let i = 0; i < quantity; i++) {
        const curOrderNum = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: curOrderNum,
            buyer_id: user.id, // Current Admin ID to satisfy FK constraint
            event_id: eventData.id,
            total_amount: singleTicketPrice,
            status: "APPROVED", // Paid directly offline
            quantity: 1,
            receipt_url: "OFFLINE_PURCHASE",
            payment_method: "CASH"
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
          owner_email: email,
          owner_phone: phone || null,
          status: "ACTIVE",
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

      // Send the email via our Next.js API Route using Resend if enabled
      if (sendEmail) {
        const formattedDate = new Date(eventData.date_time).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        try {
          const mailResponse = await fetch("/api/send-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email,
              fullName,
              orderNum: mainOrderNum,
              eventTitle: eventData.title,
              eventVenue: eventData.venue,
              eventDate: formattedDate,
              quantity,
              ticketTier: selectedCategory.name,
              tickets: ticketsToInsert
            })
          });

          if (!mailResponse.ok) {
            const mailErrData = await mailResponse.json();
            console.warn("Mail dispatch error:", mailErrData.error || mailResponse.statusText);
            alert(`PERINGATAN: Tiket terdaftar di database, namun gagal mengirim email: ${mailErrData.error || mailResponse.statusText}`);
          }
        } catch (mailErr: any) {
          console.warn("Mail dispatch exception:", mailErr);
          alert(`PERINGATAN: Tiket terdaftar, namun terjadi masalah koneksi saat mengirim email: ${mailErr.message}`);
        }
      }

      alert(
        `PEMBELIAN OFFLINE BERHASIL!\n\nOrder Code: ${mainOrderNum}\nNama Pembeli: ${fullName}\nEmail Pembeli: ${email || "-"}\nTotal Bayar: ${formatIDR(total)}\n\nTiket berhasil terdaftar ${sendEmail ? "dan sistem telah mengirimkan e-ticket konfirmasi ke alamat email tersebut." : "(pengiriman email dinonaktifkan)."}`
      );
      
      // Reset form fields
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setQuantity(1);
      
      // Reload event tiers to update remaining capacities
      setSelectedEventId("");
      setTimeout(() => setSelectedEventId(eventData.id), 10);
    } catch (err: any) {
      alert(`Gagal mengirim pembelian offline: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 w-full text-left">
        <div className="bg-brand-yellow border-4 border-brand-black p-8 shadow-brutalist-md uppercase font-black text-sm tracking-widest animate-pulse max-w-sm mx-auto text-center">
          ⏳ LOADING OFFLINE FORM...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 w-full text-left font-sans select-none pb-24">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-4 border-brand-black pb-6 mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-brand-black">
            OFFLINE TICKET PURCHASE
          </h1>
          <p className="text-xs font-bold text-brand-black/60 mt-1 uppercase tracking-wider">
            Register direct walk-in cash ticket sales instantly
          </p>
        </div>
      </div>

      {/* Form Content Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Input Forms */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Buyer Info Card */}
          <div className="card-brutalist p-6 md:p-8 bg-white shadow-[6px_6px_0px_0px_#1b1b1b]">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 border-b-2 border-brand-black pb-2">
              CUSTOMER DETAILS
            </h2>

            <div className="space-y-4">
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
                    className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40 focus:border-brand-blue"
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
                    className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40 focus:border-brand-blue"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                  EMAIL ADDRESS {sendEmail ? "(REQUIRED FOR DELIVERY)" : "(OPTIONAL)"}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. customer@example.com"
                  className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40 focus:border-brand-blue"
                  required={sendEmail}
                />
              </div>

              {/* Send Email Toggle Option */}
              <div className="flex items-center gap-3 bg-brand-bg/50 border-3 border-brand-black p-4 shadow-brutalist-sm select-none">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-5 h-5 accent-brand-blue border-2 border-brand-black cursor-pointer"
                />
                <label htmlFor="sendEmail" className="text-xs font-black uppercase tracking-wider cursor-pointer">
                  📧 Kirim E-Ticket via Email setelah pendaftaran
                </label>
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
                  className="border-2 border-brand-black p-3 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40 focus:border-brand-blue"
                />
              </div>
            </div>
          </div>

          {/* Ticket Selection Card */}
          <div className="card-brutalist p-6 md:p-8 bg-white shadow-[6px_6px_0px_0px_#1b1b1b]">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 border-b-2 border-brand-black pb-2">
              TICKET SELECTION
            </h2>

            {/* Event Selector Dropdown */}
            <div className="flex flex-col mb-6">
              <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                SELECT EVENT / GIG
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="border-3 border-brand-black p-3.5 pr-12 text-xs md:text-sm font-black uppercase tracking-wider bg-brand-yellow text-brand-black outline-none appearance-none cursor-pointer shadow-[3px_3px_0px_0px_#1b1b1b]"
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

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-end">
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
                    className="w-12 h-full font-black text-lg border-r-3 border-brand-black hover:bg-brand-bg transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <span className="flex-1 flex items-center justify-center font-black text-sm select-none">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    className="w-12 h-full font-black text-lg border-l-3 border-brand-black hover:bg-brand-bg transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Event Info & Summary */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Poster Banner */}
          <div className="card-brutalist overflow-hidden bg-white shadow-[6px_6px_0px_0px_#1b1b1b]">
            <div className="relative aspect-[16/10] w-full bg-brand-black border-b-4 border-brand-black">
              <div className="absolute bottom-4 left-4 bg-brand-yellow border-2 border-brand-black px-3 py-1 font-bold text-xs uppercase tracking-wider z-10 shadow-[2px_2px_0px_0px_#1b1b1b]">
                OFFLINE ORDER
              </div>
              {eventData?.image_src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={eventData.image_src}
                  alt={eventData.title || "Event Poster"}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-brand-black flex items-center justify-center">
                  <span className="text-white/30 text-xs font-black uppercase tracking-widest">NO IMAGE</span>
                </div>
              )}
            </div>

            <div className="p-6 bg-[#dbe1ff] space-y-4">
              <h3 className="text-2xl font-black uppercase tracking-tight leading-none text-brand-black break-words">
                {eventData?.title || "NO EVENT SELECTED"}
              </h3>
              
              <div className="space-y-2 text-xs font-bold uppercase tracking-wider text-brand-black/80">
                <p className="flex items-center gap-2">
                  📅 {eventData?.date_time ? new Date(eventData.date_time).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }) : "--"}
                </p>
                <p className="flex items-center gap-2 truncate">
                  📍 {eventData?.venue || "--"}
                </p>
                <p className="flex items-center gap-2">
                  🌐 GENRE: {eventData?.genre || "--"}
                </p>
              </div>
            </div>
          </div>

          {/* Order Summary Box */}
          <div className="card-brutalist p-6 md:p-8 bg-white shadow-[6px_6px_0px_0px_#1b1b1b] space-y-6">
            <h3 className="text-lg font-black uppercase tracking-tight mb-4 border-b-2 border-brand-black pb-2">
              PURCHASE SUMMARY
            </h3>

            <div className="space-y-4 text-xs font-bold uppercase tracking-wider border-b-2 border-brand-black/10 pb-4">
              <div className="flex justify-between">
                <span>{quantity}x {selectedCategory.name}</span>
                <span className="font-black text-brand-black">{formatIDR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Direct Admin Discount</span>
                <span className="font-black text-brand-black">Rp 0</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-lg font-black uppercase tracking-tight">
              <span>TOTAL (CASH/CASHLESS)</span>
              <span className="text-brand-blue">{formatIDR(total)}</span>
            </div>

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
                        ? "REGISTERING..." 
                        : "REGISTER OFFLINE SALE"
                  }
                </button>
              );
            })()}
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-brand-black/60 flex items-center justify-center p-6 z-50">
          <div className="card-brutalist p-6 md:p-8 bg-white max-w-md w-full space-y-6 shadow-[10px_10px_0px_0px_#1b1b1b]">
            <div className="bg-brand-yellow border-4 border-brand-black p-4 rotate-[-1deg] text-center font-black uppercase text-sm tracking-wider shadow-brutalist-sm">
              ⚠️ CONFIRM OFFLINE PURCHASE
            </div>
            
            <p className="text-xs font-bold text-brand-black leading-relaxed text-left uppercase">
              Are you sure you want to register this offline direct sale?
              <br/><br/>
              Detail: <span className="font-black text-brand-blue">{quantity}x {selectedCategory.name}</span>
              <br/>
              Event: <span className="font-black text-brand-blue">{eventData?.title}</span>
              <br/>
              {sendEmail ? (
                <>
                  Send E-Ticket To: <span className="font-black text-brand-blue">{email}</span>
                </>
              ) : (
                <span className="text-red-600 font-black">E-Ticket delivery disabled</span>
              )}
              <br/><br/>
              Total Paid: <span className="font-black text-brand-blue">{formatIDR(total)}</span>
            </p>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleConfirmOrderSubmit}
                disabled={isSubmitting}
                className="btn-brutalist-blue flex-1 py-3 text-xs tracking-wider font-black uppercase cursor-pointer"
              >
                {isSubmitting ? "PROCESSING..." : "CONFIRM & SEND"}
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
