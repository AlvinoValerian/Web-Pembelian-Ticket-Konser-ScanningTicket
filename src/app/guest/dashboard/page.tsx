"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface Event {
  id: string;
  title: string;
  genre: string;
  date_time: string;
  venue: string;
  description: string;
  image_src: string;
  status: string;
  terms_conditions: string;
  facilities: string;
  ticket_tiers?: any[];
}

export default function GuestDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [soldCounts, setSoldCounts] = useState<Record<string, number>>({});
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // 1. Run auto soft-delete of expired events (> 2 days past event date_time)
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

      // 2. Fetch all events with their tiers
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select(`
          id,
          title,
          genre,
          date_time,
          venue,
          description,
          image_src,
          status,
          terms_conditions,
          facilities,
          ticket_tiers (
            id,
            name,
            price,
            capacity
          )
        `)
        .order("date_time", { ascending: true });

      if (eventsError) throw eventsError;

      // 3. Fetch sold tickets counts
      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("tier_id");

      const counts: Record<string, number> = {};
      (ticketsData || []).forEach((t: any) => {
        counts[t.tier_id] = (counts[t.tier_id] || 0) + 1;
      });
      setSoldCounts(counts);

      const now = new Date();
      const eventsWithFlags = (eventsData || []).map((e: any) => {
        let sold = 0;
        let totalCapacity = 0;
        (e.ticket_tiers || []).forEach((tier: any) => {
          sold += (counts[tier.id] || 0);
          totalCapacity += Number(tier.capacity) || 0;
        });
        if (totalCapacity === 0) totalCapacity = 600;

        const isExpired = new Date(e.date_time) < now;
        const isSoldOut = sold >= totalCapacity;
        const isUnavailable = isExpired || isSoldOut;

        return {
          ...e,
          isExpired,
          isSoldOut,
          isUnavailable
        };
      });

      // Filter active (non-archived & non-deleted) events
      const activeEvents = eventsWithFlags.filter(
        (e: any) => !e.title.startsWith("[DELETED]") && e.status !== "ARCHIVED"
      );

      // Sort: Active first (by date_time), then unavailable at the end
      activeEvents.sort((a, b) => {
        if (a.isUnavailable && !b.isUnavailable) return 1;
        if (!a.isUnavailable && b.isUnavailable) return -1;
        return new Date(a.date_time).getTime() - new Date(b.date_time).getTime();
      });

      setEvents(activeEvents);
    } catch (err: any) {
      console.error("Error loading events in guest dashboard:", err);
      if (err?.code === "42703") {
        setErrorMessage("Kolom baru 'terms_conditions' dan 'facilities' belum terpasang di database Supabase Anda. Silakan jalankan perintah SQL migration di dashboard Supabase SQL Editor.");
      } else {
        setErrorMessage(err?.message || "Gagal memuat data event.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Compute genres list for tabs
  const genres = ["All", ...Array.from(new Set(events.map((e) => e.genre).filter(Boolean)))];

  // Filter events based on genre
  const filteredEvents = events.filter((e) => {
    if (selectedGenre === "All") return true;
    return e.genre === selectedGenre;
  });

  const getEventCapacityAndSold = (evt: Event) => {
    let totalCapacity = 0;
    let totalSold = 0;
    let minPrice = Infinity;
    let maxPrice = 0;

    (evt.ticket_tiers || []).forEach((tier: any) => {
      totalCapacity += Number(tier.capacity) || 0;
      totalSold += soldCounts[tier.id] || 0;
      const price = Number(tier.price) || 0;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    });

    if (totalCapacity === 0) totalCapacity = 600; // fallback default
    if (minPrice === Infinity) minPrice = 450000;
    if (maxPrice === 0) maxPrice = 1200000;

    const remaining = Math.max(0, totalCapacity - totalSold);
    const isSoldOut = remaining <= 0;

    return {
      totalCapacity,
      totalSold,
      minPrice,
      maxPrice,
      isSoldOut,
      remaining
    };
  };

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="p-6 md:p-12 w-full text-left font-sans">
      <div className="max-w-6xl space-y-12">
        
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-[#fee2e2] border-4 border-red-600 p-6 shadow-[6px_6px_0px_0px_#1b1b1b] space-y-4">
            <div className="flex gap-4 items-start">
              <span className="text-3xl animate-bounce">⚠️</span>
              <div>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">
                  DATABASE ERROR
                </p>
                <h4 className="text-lg font-black uppercase tracking-tight text-red-700 mt-1">
                  SKEMA DATABASE BELUM LENGKAP
                </h4>
                <p className="text-xs font-bold text-red-950 mt-1 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>
            
            <div className="bg-white border-2 border-brand-black p-4 text-xs font-mono select-all overflow-x-auto shadow-brutalist-sm">
              <p className="text-brand-black/40 font-bold uppercase mb-2 select-none">// Copy dan Jalankan SQL ini di Dashboard Supabase SQL Editor:</p>
              <p className="text-brand-blue font-black">alter table public.events add column if not exists terms_conditions text;</p>
              <p className="text-brand-blue font-black">alter table public.events add column if not exists facilities text;</p>
            </div>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="bg-brand-blue border-4 border-brand-black p-8 text-white shadow-brutalist-md relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-none mb-3">
              YOUR PERSONAL PIT.
            </h1>
            <p className="text-sm font-bold text-white/80 max-w-lg mb-6 leading-relaxed">
              Welcome to VibeCheck. View your secure event tickets, track pending manual orders, or browse upcoming metal and techno showcases in the city.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                href="/guest/tickets"
                className="bg-brand-yellow text-brand-black border-3 border-brand-black px-6 py-2.5 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md active:translate-x-[2px] active:translate-y-[2px] transition-all inline-block"
              >
                VIEW MY TICKETS ➔
              </Link>
            </div>
          </div>
        </div>

        {/* Browse & Filter Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-brand-black pb-4 gap-4">
            <h2 className="text-3xl font-black uppercase tracking-tight text-brand-black">
              ⚡ UPCOMING SHOWS & GIGS
            </h2>
            
            {/* Genre Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`border-3 border-brand-black px-4 py-2 font-black text-xs uppercase tracking-wider transition-all shadow-[2px_2px_0px_0px_#1b1b1b] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-sm cursor-pointer
                    ${selectedGenre === genre 
                      ? "bg-brand-yellow text-brand-black shadow-none translate-x-[1px] translate-y-[1px]" 
                      : "bg-white text-brand-black hover:bg-brand-bg"
                    }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 font-black uppercase tracking-wider text-brand-black/60">
              Loading Gig Calendar...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-16 border-4 border-dashed border-brand-black/35 bg-white shadow-brutalist-sm">
              <p className="font-black text-xl uppercase mb-1">No Shows Found</p>
              <p className="font-bold text-xs text-brand-black/60 uppercase">
                Try switching the genre filter tab.
              </p>
            </div>
          ) : (
            /* Events Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEvents.map((event) => {
                const isPassed = new Date(event.date_time) < new Date();
                const { minPrice, maxPrice, isSoldOut } = getEventCapacityAndSold(event);

                return (
                  <div
                    key={event.id}
                    onClick={() => {
                      setActiveEvent(event);
                      setIsModalOpen(true);
                    }}
                    className="border-4 border-brand-black bg-white shadow-brutalist-md flex flex-col justify-between overflow-hidden relative cursor-pointer hover:shadow-brutalist-lg hover:translate-x-[-3px] hover:translate-y-[-3px] active:translate-x-[1px] active:translate-y-[1px] transition-all group"
                  >
                    {/* Poster Banner */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-brand-black border-b-4 border-brand-black">
                      {/* Expiry/Sold Out Big Label Overlay */}
                      {(isPassed || isSoldOut) && (
                        <div className="absolute inset-0 bg-brand-black/75 z-20 flex items-center justify-center p-4">
                          <span className="bg-red-600 text-white border-4 border-brand-black px-6 py-3 font-black text-xl md:text-2xl uppercase tracking-wider shadow-[4px_4px_0px_0px_#1b1b1b] rotate-[-6deg] text-center w-full max-w-[180px]">
                            {isSoldOut ? "SOLD OUT" : "EXPIRED"}
                          </span>
                        </div>
                      )}
                      <img
                        src={event.image_src || "/hero-concert.png"}
                        alt={event.title}
                        className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-300 contrast-125"
                      />
                      
                      {/* Genre Label */}
                      <span className="absolute top-4 left-4 bg-brand-blue text-white border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#1b1b1b]">
                        {event.genre}
                      </span>

                      {/* Status Badges */}
                      <span className={`absolute top-4 right-4 border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#1b1b1b]
                        ${isPassed 
                          ? "bg-brand-black text-white" 
                          : isSoldOut 
                          ? "bg-red-600 text-white" 
                          : "bg-brand-yellow text-brand-black"}`}
                      >
                        {isPassed ? "FINISHED" : isSoldOut ? "SOLD OUT" : "ACTIVE"}
                      </span>
                    </div>

                    {/* Metadata Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-brand-black/50">
                          <span>
                            {new Date(event.date_time).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                          <span className="truncate max-w-[50%]">📍 {event.venue}</span>
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight leading-tight line-clamp-2">
                          {event.title}
                        </h3>
                      </div>

                      {/* Price tag range */}
                      <div className="border-t-2 border-brand-black/10 pt-3 flex justify-between items-center">
                        <div>
                          <span className="text-[8px] font-bold text-brand-black/40 block uppercase">Admission Range</span>
                          <span className="text-xs font-black text-brand-black">
                            {minPrice === maxPrice 
                              ? formatIDR(minPrice)
                              : `${formatIDR(minPrice)} - ${formatIDR(maxPrice)}`
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Guest Event Details Modal */}
      {isModalOpen && activeEvent && (() => {
        const isPassed = new Date(activeEvent.date_time) < new Date();
        const { minPrice, maxPrice, isSoldOut, remaining } = getEventCapacityAndSold(activeEvent);
        const facilitiesList = activeEvent.facilities 
          ? activeEvent.facilities.split(",").map((f) => f.trim()).filter(Boolean)
          : [];

        return (
          <div className="fixed inset-0 bg-brand-black/85 z-[999] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border-4 border-brand-black shadow-[8px_8px_0px_0px_#1b1b1b] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 relative text-left font-sans">
              
              {/* Close Button */}
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setActiveEvent(null);
                }}
                className="absolute top-4 right-4 bg-white text-brand-black border-2 border-brand-black w-8 h-8 flex items-center justify-center font-black text-sm hover:bg-brand-black hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>

              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight pb-2 border-b-3 border-brand-black">
                🎟️ SHOW INFORMATION
              </h2>

              <div className="space-y-6">
                {/* Poster Banner */}
                <div className="relative aspect-[16/9] w-full overflow-hidden border-4 border-brand-black shadow-brutalist-sm bg-brand-black">
                  <img
                    src={activeEvent.image_src || "/hero-concert.png"}
                    alt={activeEvent.title}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute top-4 left-4 bg-brand-blue text-white border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#1b1b1b]">
                    {activeEvent.genre}
                  </div>
                </div>

                {/* Title & Location details */}
                <div className="space-y-2">
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-brand-black leading-tight break-words">
                    {activeEvent.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-black uppercase text-brand-black/60">
                    <p>📅 {new Date(activeEvent.date_time).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}</p>
                    <p>📍 {activeEvent.venue}</p>
                  </div>
                </div>

                {/* Admission Info */}
                <div className="bg-brand-bg p-4 border-3 border-brand-black shadow-brutalist-sm grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[8px] font-bold text-brand-black/50 block uppercase">Price range</span>
                    <span className="text-sm font-black text-brand-black">
                      {minPrice === maxPrice 
                        ? formatIDR(minPrice)
                        : `${formatIDR(minPrice)} - ${formatIDR(maxPrice)}`
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-brand-black/50 block uppercase">Tickets Available</span>
                    <span className="text-sm font-black text-brand-black">
                      {isPassed 
                        ? "PASSED / CLOSED" 
                        : isSoldOut 
                        ? "SOLD OUT / HABIS" 
                        : `${remaining} TICKETS LEFT`}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2 border-t-2 border-brand-black/10 pt-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-black">
                    Event Description
                  </h4>
                  <p className="text-xs font-bold text-brand-black/75 whitespace-pre-wrap leading-relaxed">
                    {activeEvent.description || "Tidak ada deskripsi rinci untuk event ini."}
                  </p>
                </div>

                {/* Facilities */}
                {facilitiesList.length > 0 && (
                  <div className="space-y-2 border-t-2 border-brand-black/10 pt-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-brand-black">
                      Fasilitas Event
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {facilitiesList.map((fac, idx) => (
                        <span
                          key={idx}
                          className="bg-white text-brand-black border-2 border-brand-black px-2.5 py-1.5 font-bold text-[9px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] inline-flex items-center gap-1"
                        >
                          {fac}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Terms and Conditions */}
                {activeEvent.terms_conditions && activeEvent.terms_conditions.trim() && (
                  <div className="space-y-2 border-t-2 border-brand-black/10 pt-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-brand-black">
                      Syarat & Ketentuan
                    </h4>
                    <p className="text-xs font-bold text-brand-black/70 whitespace-pre-wrap leading-relaxed bg-[#fbfbfb] p-4 border-2 border-brand-black">
                      {activeEvent.terms_conditions}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="flex gap-4 pt-6 border-t-3 border-brand-black">
                <Link
                  href={`/guest/checkout?event_id=${activeEvent.id}`}
                  onClick={() => {
                    setIsModalOpen(false);
                    setActiveEvent(null);
                  }}
                  className={`py-4 font-black text-xs uppercase tracking-wider flex-1 text-center border-3 border-brand-black shadow-brutalist-sm transition-all inline-block
                    ${(isPassed || isSoldOut)
                      ? "bg-brand-black text-white/40 cursor-not-allowed shadow-none translate-x-[2px] translate-y-[2px]"
                      : "bg-brand-yellow text-brand-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md active:translate-x-[2px] active:translate-y-[2px]"
                    }`}
                  style={{ pointerEvents: (isPassed || isSoldOut) ? "none" : "auto" }}
                >
                  {isPassed 
                    ? "SUDAH SELESAI" 
                    : isSoldOut 
                    ? "SOLD OUT" 
                    : "🎟️ BUY TICKET NOW ➔"
                  }
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setActiveEvent(null);
                  }}
                  className="bg-white text-brand-black border-3 border-brand-black px-6 py-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
