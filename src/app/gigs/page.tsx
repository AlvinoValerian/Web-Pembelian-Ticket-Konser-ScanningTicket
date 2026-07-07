"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Gig {
  id: string;
  title: string;
  price: number;
  category: string;
  imageSrc: string;
  venue: string;
  dateTime: string;
  status: string;
  statusColor: string;
  cardStyle: "default" | "yellow" | "dark";
  tagColor: string;
  btnStyle: "blue" | "white" | "red" | "disabled";
}

export default function UpcomingGigs() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const gigs: Gig[] = [
    {
      id: "1",
      title: "MIDNIGHT PROTOCOL",
      price: 45,
      category: "Techno",
      imageSrc: "/neon-pulse.png",
      venue: "The Bunker, Berlin",
      dateTime: "OCT 14, 23:00",
      status: "ONLY 12 LEFT!",
      statusColor: "text-red-600",
      cardStyle: "default",
      tagColor: "bg-brand-blue text-white",
      btnStyle: "blue"
    },
    {
      id: "2",
      title: "STATIC NOISE",
      price: 30,
      category: "Indie Rock",
      imageSrc: "/the-outliers.png",
      venue: "The Garage, London",
      dateTime: "OCT 21, 20:00",
      status: "PLENTY AVAILABLE",
      statusColor: "text-brand-black",
      cardStyle: "yellow",
      tagColor: "bg-white text-brand-black",
      btnStyle: "white"
    },
    {
      id: "3",
      title: "DOOM BRINGER",
      price: 55,
      category: "Metal",
      imageSrc: "/hero-concert.png",
      venue: "Hellfire Club, NY",
      dateTime: "OCT 31, 22:00",
      status: "SELLING FAST",
      statusColor: "text-brand-yellow",
      cardStyle: "dark",
      tagColor: "bg-red-600 text-white",
      btnStyle: "red"
    },
    {
      id: "4",
      title: "NEON NIGHTS",
      price: 25,
      category: "Electronic",
      imageSrc: "/neon-nights.png",
      venue: "Arcade Hall, LA",
      dateTime: "NOV 05, 21:00",
      status: "SOLD OUT",
      statusColor: "text-red-600",
      cardStyle: "default",
      tagColor: "bg-brand-blue text-white",
      btnStyle: "disabled"
    }
  ];

  const handleCategoryToggle = (category: string) => {
    setActiveCategory(prev => prev === category ? null : category);
  };

  const filteredGigs = gigs.filter(gig => {
    const matchesSearch = gig.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          gig.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          gig.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory ? gig.category === activeCategory : true;
    
    return matchesSearch && matchesCategory;
  });

  const categories = ["Techno", "Indie Rock", "Metal", "Electronic", "Hip Hop"];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-black flex flex-col font-sans relative overflow-x-hidden selection:bg-brand-yellow selection:text-brand-black">
      
      {/* Navbar */}
      <header className="border-b-4 border-brand-black bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <Link href="/" className="text-2xl md:text-3xl font-black tracking-tighter hover:skew-x-3 transition-transform">
            VIBECHECK
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8 h-full font-bold text-sm uppercase tracking-wider">
            <Link href="/gigs" className="h-full flex items-center border-b-4 border-brand-blue text-brand-blue px-1 pt-1">
              Concerts
            </Link>
            <Link href="#" className="h-full flex items-center border-b-4 border-transparent hover:border-brand-black px-1 pt-1 transition-all">
              Venues
            </Link>
            <Link href="#" className="h-full flex items-center border-b-4 border-transparent hover:border-brand-black px-1 pt-1 transition-all">
              Schedule
            </Link>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 w-full flex-1">
        
        {/* Title & Filter bar section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-16">
          <div className="text-left">
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-4">
              UPCOMING GIGS
            </h1>
            <p className="text-sm font-bold text-brand-black/60 uppercase tracking-wider">
              Find the noise. Buy the ticket. Take the ride.
            </p>
          </div>

          {/* Search and Tag filter block */}
          <div className="w-full lg:w-auto space-y-4">
            {/* Search Input */}
            <div className="relative flex items-center w-full lg:w-96 border-3 border-brand-black shadow-brutalist-sm bg-white">
              <input
                type="text"
                placeholder="Search bands, venues, vibes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-4 pr-12 text-xs font-black outline-none placeholder:text-brand-black/40"
              />
              <span className="absolute right-4 text-sm">🔍</span>
            </div>

            {/* Quick tag filters */}
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
              {categories.map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryToggle(cat)}
                    className={`px-3 py-1.5 border-2 border-brand-black shadow-[2px_2px_0px_0px_#1b1b1b] cursor-pointer transition-all
                      ${isActive ? "bg-brand-yellow text-brand-black" : "bg-white text-brand-black hover:bg-brand-bg"}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gigs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredGigs.map(gig => {
            
            // Custom Card style sets
            let cardBg = "bg-white";
            let textColor = "text-brand-black";
            let subTextColor = "text-brand-black/60";
            let borderStyle = "border-brand-black";
            
            if (gig.cardStyle === "yellow") {
              cardBg = "bg-brand-yellow";
            } else if (gig.cardStyle === "dark") {
              cardBg = "bg-brand-black";
              textColor = "text-white";
              subTextColor = "text-white/60";
            }

            return (
              <div 
                key={gig.id} 
                className={`card-brutalist overflow-hidden flex flex-col justify-between ${cardBg} ${borderStyle} shadow-[8px_8px_0px_0px_#1b1b1b] group`}
              >
                {/* Image & tag header */}
                <div className="relative h-56 w-full bg-brand-black border-b-4 border-brand-black overflow-hidden">
                  <div className={`absolute top-4 left-4 ${gig.tagColor} border-2 border-brand-black px-3 py-1 font-bold text-xs uppercase tracking-wider z-10 shadow-[2px_2px_0px_0px_#1b1b1b]`}>
                    {gig.category}
                  </div>
                  <Image
                    src={gig.imageSrc}
                    alt={gig.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Details */}
                <div className="p-6 flex-1 flex flex-col justify-between text-left">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className={`text-2xl font-black tracking-tight uppercase leading-none ${textColor}`}>
                        {gig.title}
                      </h3>
                      <span className={`text-2xl font-black ${gig.cardStyle === "dark" ? "text-red-500" : "text-brand-blue"}`}>
                        ${gig.price}
                      </span>
                    </div>

                    <div className={`space-y-1 text-xs font-bold uppercase tracking-wider ${subTextColor} mb-6`}>
                      <p className="flex items-center gap-2">📍 {gig.venue}</p>
                      <p className="flex items-center gap-2">📅 {gig.dateTime}</p>
                    </div>
                  </div>

                  {/* Actions & Status row */}
                  <div className="flex items-center justify-between gap-4 border-t-2 border-brand-black/10 pt-4">
                    <span className={`text-xs font-black uppercase tracking-wider ${gig.statusColor}`}>
                      {gig.status}
                    </span>

                    {gig.btnStyle === "blue" && (
                      <button 
                        onClick={() => router.push("/guest/checkout")}
                        className="btn-brutalist-blue px-6 py-2.5 text-xs font-black cursor-pointer"
                      >
                        BUY TICKET
                      </button>
                    )}

                    {gig.btnStyle === "white" && (
                      <button 
                        onClick={() => router.push("/guest/checkout")}
                        className="bg-white text-brand-black border-3 border-brand-black px-6 py-2.5 text-xs font-black shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer"
                      >
                        BUY TICKET
                      </button>
                    )}

                    {gig.btnStyle === "red" && (
                      <button 
                        onClick={() => router.push("/guest/checkout")}
                        className="bg-red-600 text-white border-3 border-brand-black px-6 py-2.5 text-xs font-black shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer"
                      >
                        BUY TICKET
                      </button>
                    )}

                    {gig.btnStyle === "disabled" && (
                      <button 
                        disabled
                        className="bg-[#dadada] text-brand-black/40 border-3 border-brand-black/20 px-6 py-2.5 text-xs font-black cursor-not-allowed"
                      >
                        WAITLIST
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-brand-black text-white border-t-4 border-brand-black w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
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
            © 2024 VIBECHECK NEO-BRUTAL. NO REFUNDS. ONLY ROCK.
          </div>
        </div>
      </footer>

    </div>
  );
}
