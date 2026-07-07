"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const router = useRouter();
  const [activeShow, setActiveShow] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [topConcert, setTopConcert] = useState<any>(null);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [soldCounts, setSoldCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadEventsData = async () => {
      const supabase = createClient();
      
      // 1. Fetch active events
      const { data: eventsData } = await supabase
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
        .neq("status", "ARCHIVED");

      if (!eventsData || eventsData.length === 0) return;

      // 2. Fetch all tickets
      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("tier_id");

      // Calculate sold counts for each tier
      const tierCounts: Record<string, number> = {};
      (ticketsData || []).forEach((t: any) => {
        tierCounts[t.tier_id] = (tierCounts[t.tier_id] || 0) + 1;
      });
      setSoldCounts(tierCounts);

      const now = new Date();
      // Map sold counts and flags to events
      const eventsWithSales = eventsData.map((ev: any) => {
        let sold = 0;
        let totalCapacity = 0;
        (ev.ticket_tiers || []).forEach((tier: any) => {
          sold += (tierCounts[tier.id] || 0);
          totalCapacity += Number(tier.capacity) || 0;
        });
        if (totalCapacity === 0) totalCapacity = 600; // default/fallback

        const isExpired = new Date(ev.date_time) < now;
        const isSoldOut = sold >= totalCapacity;
        const isUnavailable = isExpired || isSoldOut;

        return { 
          ...ev, 
          soldCount: sold,
          isExpired,
          isSoldOut,
          isUnavailable
        };
      });

      // Filter out deleted and archived events
      const activeEvents = eventsWithSales.filter(
        e => !e.title.startsWith("[DELETED]") && e.status !== "ARCHIVED"
      );

      // Sort: Active events chronologically first, then unavailable (expired/sold out) events at the end
      activeEvents.sort((a, b) => {
        if (a.isUnavailable && !b.isUnavailable) return 1;
        if (!a.isUnavailable && b.isUnavailable) return -1;
        return new Date(a.date_time).getTime() - new Date(b.date_time).getTime();
      });

      setEvents(activeEvents);

      // Find top concert (most tickets sold among active/valid shows)
      const validShows = activeEvents.filter(e => !e.isUnavailable);
      if (validShows.length > 0) {
        let top = validShows[0];
        validShows.forEach((e: any) => {
          if (e.soldCount > top.soldCount) {
            top = e;
          }
        });
        setTopConcert(top);
      } else if (activeEvents.length > 0) {
        setTopConcert(activeEvents[0]);
      }
    };

    loadEventsData();
  }, []);

  const getEventCapacityAndSold = (evt: any) => {
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

    if (totalCapacity === 0) totalCapacity = 600; // fallback
    if (minPrice === Infinity) minPrice = 0;
    if (maxPrice === 0) maxPrice = 0;

    const remaining = Math.max(totalCapacity - totalSold, 0);
    const isSoldOut = remaining === 0;

    return { minPrice, maxPrice, isSoldOut, remaining };
  };

  const formatIDR = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const buyTicket = (eventId: string) => {
    router.push(`/guest/checkout?event_id=${eventId}`);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-black flex flex-col font-sans relative overflow-x-hidden selection:bg-brand-yellow selection:text-brand-black pb-0">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-brand-yellow border-4 border-brand-black shadow-[6px_6px_0px_0px_#1b1b1b] p-4 max-w-sm animate-bounce">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="font-black text-sm uppercase tracking-wider text-brand-black">🎫 TICKET RESERVED</p>
              <p className="font-bold text-xs mt-1 text-brand-black/80">{toastMessage}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)} 
              className="text-xs font-bold border-2 border-brand-black px-1.5 py-0.5 hover:bg-brand-black hover:text-white"
            >
              X
            </button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="border-b-4 border-brand-black bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <Link href="/" className="text-2xl md:text-3xl font-black tracking-tighter hover:skew-x-3 transition-transform">
            VIBECHECK
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8 h-full font-bold text-sm uppercase tracking-wider">
            <a href="#concert" className="h-full flex items-center border-b-4 border-transparent hover:border-brand-blue px-1 pt-1 transition-all">
              Concert
            </a>
            <a href="#events" className="h-full flex items-center border-b-4 border-transparent hover:border-brand-black px-1 pt-1 transition-all">
              Event
            </a>
            <a href="#footer" className="h-full flex items-center border-b-4 border-transparent hover:border-brand-yellow px-1 pt-1 transition-all">
              Contact
            </a>
          </nav>

          <div className="flex items-center space-x-6 font-bold text-sm uppercase tracking-wider">
            <Link 
              href="/register" 
              className="bg-brand-yellow text-brand-black border-3 border-brand-black shadow-[4px_4px_0px_0px_#1b1b1b] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#1b1b1b] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#1b1b1b] px-5 py-2.5 text-xs md:text-sm inline-block text-center font-black"
            >
              Register
            </Link>
            <Link href="/login" className="btn-brutalist-blue px-5 py-2.5 text-xs md:text-sm inline-block text-center">
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="concert" className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Content */}
          <div className="lg:col-span-5 flex flex-col items-start text-left">
            {topConcert ? (
              <>
                <div className="bg-brand-blue text-white border-2 border-brand-black px-3 py-1 font-black text-xs uppercase tracking-wider mb-4 shadow-[2px_2px_0px_0px_#1b1b1b]">
                  🔥 MOST POPULAR SHOW
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95] text-brand-black mb-6 uppercase">
                  {topConcert.title}
                </h1>
                <p className="text-sm font-bold text-brand-black/60 uppercase mb-2">
                  📍 {topConcert.venue} • {topConcert.genre}
                </p>
                <p className="text-base font-medium text-brand-black/70 mb-8 max-w-md leading-relaxed line-clamp-3">
                  {topConcert.description}
                </p>
                <button 
                  onClick={() => {
                    setActiveEvent(topConcert);
                    setIsModalOpen(true);
                  }}
                  className="btn-brutalist-yellow px-8 py-5 text-base md:text-lg flex items-center gap-3 cursor-pointer group font-black"
                >
                  VIEW DETAIL CONCERT ➔
                </button>
              </>
            ) : (
              <>
                <h1 className="text-5xl md:text-6xl lg:text-[72px] font-black tracking-tighter leading-[0.95] text-brand-black mb-6">
                  LOUD.
                  <br />
                  LIVE.
                  <br />
                  <span className="text-brand-blue">LEGENDARY.</span>
                </h1>
                <p className="text-base md:text-lg font-medium text-brand-black/70 mb-8 max-w-md leading-relaxed">
                  Skip the fees. Feel the bass. Secure your spot at the most exclusive underground and arena shows in the city. No BS, just tickets.
                </p>
                <a 
                  href="#events"
                  className="btn-brutalist-yellow px-8 py-5 text-base md:text-lg flex items-center gap-3 cursor-pointer group"
                >
                  EXPLORE EVENTS 
                  <span className="group-hover:translate-x-2 transition-transform">➔</span>
                </a>
              </>
            )}
          </div>

          {/* Hero Image Container */}
          <div className="lg:col-span-7 relative flex justify-center lg:justify-end">
            <div className="relative border-4 border-brand-black bg-white shadow-[12px_12px_0px_0px_#1b1b1b] overflow-hidden group max-w-2xl w-full">
              <div className="aspect-[16/10] relative w-full overflow-hidden bg-brand-black">
                <Image 
                  src={topConcert?.image_src || "/hero-concert.png"} 
                  alt="Featured Concert" 
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500 grayscale contrast-125"
                  priority
                />
              </div>
              
              {/* Hot Concert Badge */}
              <div className="absolute bottom-6 right-6 bg-brand-yellow text-brand-black border-3 border-brand-black px-4 py-2 rotate-[-4deg] shadow-[3px_3px_0px_0px_#1b1b1b] z-10">
                <span className="text-brand-black text-xs md:text-sm font-black uppercase tracking-widest animate-pulse">
                  {topConcert 
                    ? "🔥 MOST POPULAR" 
                    : "SELLING FAST"
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ticket Tier Overview Cards */}
      <section className="border-t-4 border-b-4 border-brand-black bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* General Card */}
            <div className="bg-brand-blue text-white border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-brutalist-lg transition-all duration-200">
              <div>
                <h3 className="text-xl font-black uppercase tracking-wider mb-2">GENERAL</h3>
                <p className="text-sm font-medium text-white/80">
                  Get in the pit. Experience the raw energy.
                </p>
              </div>
            </div>

            {/* VIP Card */}
            <div className="bg-brand-yellow text-brand-black border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-brutalist-lg transition-all duration-200">
              <div>
                <h3 className="text-xl font-black uppercase tracking-wider mb-2">VIP</h3>
                <p className="text-sm font-medium text-brand-black/80">
                  Elevated views. Private bars. Zero lines.
                </p>
              </div>
            </div>

            {/* Backstage Card */}
            <div className="bg-[#ec4899] text-white border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-brutalist-lg transition-all duration-200">
              <div>
                <h3 className="text-xl font-black uppercase tracking-wider text-brand-yellow mb-2">BACKSTAGE</h3>
                <p className="text-sm font-medium text-white/80">
                  Meet the legends. All-access passes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Shows Section */}
      <section id="events" className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24 w-full">
        <div className="flex flex-col items-start mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase relative inline-block">
            UPCOMING SHOWS & EVENTS
            <span className="absolute bottom-[-10px] left-0 right-0 h-1.5 bg-brand-black"></span>
            <span className="absolute bottom-[-16px] left-0 right-0 h-[3px] bg-brand-black"></span>
          </h2>
        </div>

        {/* Shows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {events.length > 0 ? (
            events.slice(0, 6).map((ev: any) => {
              // Find minimum ticket price
              const prices = (ev.ticket_tiers || []).map((t: any) => Number(t.price) || 0);
              const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

              // Format date_time
              const formattedDate = new Date(ev.date_time).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              });

              return (
                <div 
                  key={ev.id} 
                  onClick={() => {
                    setActiveEvent(ev);
                    setIsModalOpen(true);
                  }}
                  className="card-brutalist flex flex-col overflow-hidden cursor-pointer group hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-brutalist-lg transition-all duration-200"
                >
                  <div className="relative h-56 w-full bg-brand-black overflow-hidden border-b-4 border-brand-black">
                    {/* Expiry/Sold Out Big Label Overlay */}
                    {ev.isUnavailable && (
                      <div className="absolute inset-0 bg-brand-black/75 z-20 flex items-center justify-center p-4">
                        <span className="bg-red-600 text-white border-4 border-brand-black px-6 py-3 font-black text-xl md:text-2xl uppercase tracking-wider shadow-[4px_4px_0px_0px_#1b1b1b] rotate-[-6deg] text-center w-full max-w-[180px]">
                          {ev.isSoldOut ? "SOLD OUT" : "EXPIRED"}
                        </span>
                      </div>
                    )}
                    {/* Category Tag */}
                    <div className="absolute top-4 left-4 bg-brand-yellow border-2 border-brand-black px-3 py-1 font-bold text-xs uppercase tracking-wider z-10 shadow-[2px_2px_0px_0px_#1b1b1b]">
                      {ev.genre}
                    </div>
                    {ev.image_src ? (
                      <Image 
                        src={ev.image_src} 
                        alt={ev.title} 
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-brand-blue flex items-center justify-center text-white font-black text-xl">
                        {ev.title}
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <h3 className="text-xl font-black tracking-tight uppercase line-clamp-1">{ev.title}</h3>
                        <span className="text-sm font-black text-brand-blue shrink-0">
                          {minPrice > 0 ? `Rp ${minPrice.toLocaleString()}` : "FREE"}
                        </span>
                      </div>
                      
                      {/* Venue & Time */}
                      <p className="text-xs font-bold text-brand-black/60 uppercase mb-4 line-clamp-1">
                        📍 {ev.venue}
                      </p>
                      
                      <div className="flex items-center text-xs font-bold text-brand-black/60 uppercase mb-2 gap-2">
                        <svg className="w-4 h-4 text-brand-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full border-4 border-dashed border-brand-black/20 p-12 text-center text-brand-black/40 font-bold uppercase">
              No shows loaded. Check back later!
            </div>
          )}
        </div>
      </section>

      {/* Yellow Feature Banner */}
      <section className="bg-brand-yellow border-t-4 border-b-4 border-brand-black py-16 md:py-20 w-full">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center max-w-sm mx-auto">
              <div className="bg-white border-4 border-brand-black shadow-[4px_4px_0px_0px_#1b1b1b] p-6 mb-6 rotate-[-2deg] hover:rotate-0 transition-transform">
                <svg className="w-8 h-8 text-brand-black" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <h4 className="text-xl font-black uppercase tracking-wider mb-3">INSTANT DELIVERY</h4>
              <p className="text-sm font-bold text-brand-black/80 leading-relaxed">
                Tickets beam straight to your phone. No waiting, no lost mail.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-center text-center max-w-sm mx-auto">
              <div className="bg-white border-4 border-brand-black shadow-[4px_4px_0px_0px_#1b1b1b] p-6 mb-6 rotate-[3deg] hover:rotate-0 transition-transform">
                <svg className="w-8 h-8 text-brand-black" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"></path>
                </svg>
              </div>
              <h4 className="text-xl font-black uppercase tracking-wider mb-3">SECURE PAYMENT</h4>
              <p className="text-sm font-bold text-brand-black/80 leading-relaxed">
                Iron-clad encryption. Your data is safer than the VIP section.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center max-w-sm mx-auto">
              <div className="bg-white border-4 border-brand-black shadow-[4px_4px_0px_0px_#1b1b1b] p-6 mb-6 rotate-[-1deg] hover:rotate-0 transition-transform">
                <svg className="w-8 h-8 text-brand-black" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12v5c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-3v8h3c1.66 0 3-1.34 3-3v-5c0-5.52-4.48-10-10-10z"></path>
                </svg>
              </div>
              <h4 className="text-xl font-black uppercase tracking-wider mb-3">24/7 SUPPORT</h4>
              <p className="text-sm font-bold text-brand-black/80 leading-relaxed">
                Real humans, ready to help you anytime, anywhere.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="bg-brand-black text-white border-t-4 border-brand-black w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-16 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-xl md:text-2xl font-black tracking-tighter hover:skew-x-3 transition-transform">
            VIBECHECK
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 font-bold text-xs md:text-sm uppercase tracking-wider text-white/70">
            <a href="#" className="hover:text-brand-yellow transition-colors">Terms</a>
            <a href="#" className="hover:text-brand-yellow transition-colors">Privacy</a>
            <a href="#" className="hover:text-brand-yellow transition-colors">Press</a>
            <a href="#" className="hover:text-brand-yellow transition-colors">Contact</a>
          </div>

          <div className="text-xs font-bold text-white/50 tracking-wider text-center md:text-right uppercase">
            © 2024 VIBECHECK NEO-BRUTAL... NO REFUNDS. ONLY ROCK.
          </div>
        </div>
      </footer>

      {/* Event Detail Modal (Identical to Guest Dashboard) */}
      {isModalOpen && activeEvent && (() => {
        const isPassed = new Date(activeEvent.date_time) < new Date();
        const { minPrice, maxPrice, isSoldOut, remaining } = getEventCapacityAndSold(activeEvent);
        const facilitiesList = activeEvent.facilities 
          ? activeEvent.facilities.split(",").map((f: any) => f.trim()).filter(Boolean)
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
                    <p>📅 {new Date(activeEvent.date_time).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
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
                      {facilitiesList.map((fac: string, idx: number) => (
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

              {/* Action Button inside Modal */}
              <div className="pt-4 border-t-3 border-brand-black flex gap-4">
                <button
                  disabled={isPassed || isSoldOut}
                  onClick={() => buyTicket(activeEvent.id)}
                  className="flex-1 bg-brand-yellow text-brand-black border-3 border-brand-black py-4 font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#1b1b1b] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#1b1b1b] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#1b1b1b] disabled:opacity-50 text-center cursor-pointer"
                >
                  🎟️ BUY TICKET NOW ➔
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
