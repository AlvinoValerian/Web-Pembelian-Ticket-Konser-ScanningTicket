"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import BrutalistInput from "@/components/BrutalistInput";

interface Event {
  id: string;
  title: string;
  genre: string;
  date_time: string;
  venue: string;
  description: string;
  image_src: string;
  status: string;
  registration_close_at: string;
}

interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  price: number;
  capacity: number;
}

interface Order {
  id: string;
  event_id: string;
  quantity: number;
  status: string;
}

const genreDefaults: Record<string, string> = {
  "Techno": "/neon-pulse.png",
  "Indie Rock": "/the-outliers.png",
  "Metal": "/iron-will.png",
  "Electronic": "/midnight-distortion.png",
  "Pop": "/hero-concert.png",
  "Hip Hop": "/hero-concert.png",
  "Electronic / Techno": "/neon-pulse.png"
};

export default function AdminEventsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");

  // Notifications
  const [successMessage, setSuccessMessage] = useState("");

  // Modal & Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    genre: "Techno",
    date_time: "",
    venue: "",
    description: "",
    image_src: "",
    status: "ACTIVE"
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Modals and Warning States
  const [isSoftDeleteModalOpen, setIsSoftDeleteModalOpen] = useState(false);
  const [isHardDeleteModalOpen, setIsHardDeleteModalOpen] = useState(false);
  const [isCantDeleteModalOpen, setIsCantDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [blockedAction, setBlockedAction] = useState<"soft" | "hard" | null>(null);

  // Preview Modal States
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);

  const fetchData = async () => {
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

      // 1. Fetch Events
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .order("date_time", { ascending: false });

      if (eventsError) throw eventsError;

      // 2. Fetch Ticket Tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from("ticket_tiers")
        .select("*");
      if (tiersError) throw tiersError;

      // 3. Fetch Orders (for calculating sales)
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, event_id, quantity, status");
      if (ordersError) throw ordersError;

      // Filter out soft-deleted events (prefixed with [DELETED] or marked as ARCHIVED)
      const activeEvents = (eventsData || []).filter((e: any) => !e.title.startsWith("[DELETED]") && e.status !== "ARCHIVED");
      setEvents(activeEvents);
      setTicketTiers(tiersData || []);
      setOrders(ordersData || []);
    } catch (err: any) {
      console.error("Error fetching admin events data:", err?.message || err);
      console.error("Full error details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format IDR Currency
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Format date display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "TBD DATE";
    try {
      const d = new Date(dateStr);
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const day = String(d.getDate()).padStart(2, "0");
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${month} ${day}, ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  // Get metrics for each event
  const getEventMetrics = (eventId: string) => {
    const eventTiers = ticketTiers.filter(t => t.event_id === eventId);
    const capacity = eventTiers.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0) || 0;
    
    // Approved / Paid orders
    const eventOrders = orders.filter(o => o.event_id === eventId && (o.status === "APPROVED" || o.status === "PAID"));
    const sold = eventOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);

    const minPrice = eventTiers.length > 0 ? Math.min(...eventTiers.map(t => t.price)) : 0;
    const maxPrice = eventTiers.length > 0 ? Math.max(...eventTiers.map(t => t.price)) : 0;
    
    const percentage = capacity > 0 ? Math.min(Math.round((sold / capacity) * 100), 100) : 0;

    return {
      capacity,
      sold,
      percentage,
      minPrice,
      maxPrice,
    };
  };

  // Hard Delete Action (Cascade deletion)
  const confirmHardDelete = async () => {
    if (!eventToDelete) return;
    
    // Safety check
    const eventDurationMs = 4 * 60 * 60 * 1000; // 4 hours duration
    const isCompleted = new Date(eventToDelete.date_time).getTime() + eventDurationMs < Date.now();
    if (!isCompleted) {
      alert("Peringatan: Event belum berakhir/selesai. Tidak dapat melakukan hard delete.");
      return;
    }

    try {
      // 1. Delete tickets first
      const { error: ticketsError } = await supabase
        .from("tickets")
        .delete()
        .eq("event_id", eventToDelete.id);

      if (ticketsError) throw ticketsError;

      // 2. Delete orders
      const { error: ordersError } = await supabase
        .from("orders")
        .delete()
        .eq("event_id", eventToDelete.id);

      if (ordersError) throw ordersError;

      // 3. Delete ticket tiers
      const { error: tiersError } = await supabase
        .from("ticket_tiers")
        .delete()
        .eq("event_id", eventToDelete.id);

      if (tiersError) throw tiersError;

      // 4. Delete event
      const { error: eventError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventToDelete.id);

      if (eventError) throw eventError;

      setIsHardDeleteModalOpen(false);
      setEventToDelete(null);
      setSuccessMessage("Event successfully hard deleted!");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to hard delete event.");
    }
  };

  // Soft Delete Action (Hiding event by prefixing title with [DELETED] and setting status to ARCHIVED)
  const confirmSoftDelete = async () => {
    if (!eventToDelete) return;

    // Safety check
    const isCompleted = new Date(eventToDelete.date_time).getTime() < Date.now();
    if (!isCompleted) {
      alert("Peringatan: Event belum berakhir/selesai. Tidak dapat melakukan soft delete.");
      return;
    }

    try {
      const { error } = await supabase
        .from("events")
        .update({ 
          title: `[DELETED] ${eventToDelete.title}`,
          status: "ARCHIVED"
        })
        .eq("id", eventToDelete.id);

      if (error) throw error;

      setIsSoftDeleteModalOpen(false);
      setEventToDelete(null);
      setSuccessMessage("Event successfully soft deleted (hidden)!");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to soft delete event.");
    }
  };

  // Open Edit Modal
  const openEditModal = (event: Event) => {
    let formattedDate = "";
    if (event.date_time) {
      const d = new Date(event.date_time);
      const offset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
      formattedDate = localISOTime;
    }

    setEditingEvent(event);
    setEditForm({
      title: event.title,
      genre: event.genre || "Techno",
      date_time: formattedDate,
      venue: event.venue || "",
      description: event.description || "",
      image_src: event.image_src || "",
      status: event.status || "ACTIVE"
    });
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  // Update Action Submit
  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    // Validation
    const errors: Record<string, string> = {};
    if (!editForm.title.trim()) errors.title = "Event Name is required";
    if (!editForm.date_time) errors.date_time = "Date & Time is required";
    if (!editForm.venue.trim()) errors.venue = "Venue / Location is required";

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setIsUpdating(true);
    setEditErrors({});

    try {
      // Check if image URL is empty, set default according to current category
      const defaultImage = genreDefaults[editForm.genre] || "/hero-concert.png";
      const finalImageSrc = editForm.image_src.trim() || defaultImage;

      const { error } = await supabase
        .from("events")
        .update({
          title: editForm.title,
          genre: editForm.genre,
          date_time: new Date(editForm.date_time).toISOString(),
          venue: editForm.venue,
          description: editForm.description,
          image_src: finalImageSrc,
          status: editForm.status,
          registration_close_at: new Date(editForm.date_time).toISOString()
        })
        .eq("id", editingEvent.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      setSuccessMessage("Event successfully updated!");
      fetchData();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err: any) {
      setEditErrors({ form: err.message || "Failed to update event. Please try again." });
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered Events
  const filteredEvents = events.filter((event) => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGenre = selectedGenre === "All" || event.genre === selectedGenre;

    return matchesSearch && matchesGenre;
  });

  // Extract all unique genres for filter dropdown
  const genres = ["All", ...Array.from(new Set(events.map(e => e.genre))).filter(Boolean)];

  return (
    <div className="p-6 md:p-12 w-full text-left">
      {/* Success Alert */}
      {successMessage && (
        <div className="fixed top-6 right-6 z-50 bg-brand-yellow border-4 border-brand-black shadow-[6px_6px_0px_0px_#1b1b1b] p-4 max-w-md animate-bounce">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="font-black text-sm uppercase tracking-wider text-brand-black">🎉 SUCCESS</p>
              <p className="font-bold text-xs mt-1 text-brand-black/80">
                {successMessage}
              </p>
            </div>
            <button 
              onClick={() => setSuccessMessage("")} 
              className="text-xs font-bold border-2 border-brand-black px-1.5 py-0.5 hover:bg-brand-black hover:text-white"
            >
              X
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">
            MANAGE EVENTS
          </h1>
          <p className="text-xs md:text-sm font-bold text-brand-black/60">
            Monitor, view capacity, and manage your live event catalog.
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={fetchData}
            disabled={loading}
            className="bg-white border-3 border-brand-black px-4 py-2.5 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            🔄 {loading ? "SYNCING..." : "SYNC"}
          </button>
          <Link 
            href="/admin/create-event"
            className="bg-brand-yellow text-brand-black border-3 border-brand-black px-4 py-2.5 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all flex items-center gap-2 cursor-pointer"
          >
            ⚡ CREATE EVENT
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10 items-end bg-white border-4 border-brand-black p-6 shadow-brutalist-sm">
        <div className="md:col-span-8">
          <BrutalistInput
            label="Search Events"
            placeholder="Search by event title, location, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            }
          />
        </div>
        <div className="md:col-span-4 flex flex-col text-left">
          <label className="text-xs font-black uppercase tracking-wider text-brand-black mb-1">
            Genre / Category
          </label>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full py-[15px] px-4 text-sm font-bold border-3 border-brand-black outline-none bg-white focus:bg-brand-bg focus:border-brand-blue appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 16px center', backgroundRepeat: 'no-repeat' }}
          >
            {genres.map((genre) => (
              <option key={genre} value={genre}>{genre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Listing */}
      {loading ? (
        <div className="text-center py-20 border-4 border-dashed border-brand-black/35 rounded-none bg-white">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-black border-t-transparent mb-4"></div>
          <p className="font-black uppercase tracking-widest text-brand-black/40 text-sm">Fetching catalog details...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-20 border-4 border-dashed border-brand-black/35 bg-white shadow-brutalist-sm">
          <p className="font-black text-2xl uppercase mb-2">No Events Found</p>
          <p className="font-bold text-xs text-brand-black/60 uppercase max-w-sm mx-auto mb-6">
            Try adjusting your search filters or register a new venue show right now.
          </p>
          <Link 
            href="/admin/create-event"
            className="inline-block bg-brand-blue text-white border-3 border-brand-black px-6 py-3 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all"
          >
            ⚡ Create First Event
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredEvents.map((event) => {
            const metrics = getEventMetrics(event.id);
            const status = event.status || "ACTIVE";
            const eventDurationMs = 4 * 60 * 60 * 1000; // 4 hours duration
            const isCompleted = new Date(event.date_time).getTime() + eventDurationMs < Date.now();

            return (
              <div 
                key={event.id}
                className="border-4 border-brand-black bg-white shadow-brutalist-md flex flex-col justify-between overflow-hidden relative"
              >
                {/* Image & Header tags */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-black border-b-4 border-brand-black">
                  <img
                    src={event.image_src || "/hero-concert.png"}
                    alt={event.title}
                    className="object-cover w-full h-full grayscale hover:grayscale-0 transition-all duration-300 contrast-125"
                  />
                  
                  {/* Genre Tag */}
                  <div className="absolute top-4 left-4 bg-brand-blue text-white border-2 border-brand-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#1b1b1b]">
                    {event.genre}
                  </div>

                  {/* Status Tag */}
                  <div className={`absolute top-4 right-4 border-2 border-brand-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#1b1b1b]
                    ${isCompleted 
                      ? "bg-brand-black text-white" 
                      : status === "ACTIVE" 
                      ? "bg-brand-yellow text-brand-black" 
                      : "bg-red-600 text-white"}`}
                  >
                    {isCompleted ? "FINISHED" : status}
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-brand-black/60">
                      <span>{formatDate(event.date_time)}</span>
                      <span className="truncate max-w-[50%]">📍 {event.venue}</span>
                    </div>

                    <h3 className="text-xl font-black uppercase tracking-tight leading-tight line-clamp-2">
                      {event.title}
                    </h3>

                    {event.description && (
                      <p className="text-xs font-semibold text-brand-black/75 line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>

                  {/* Capacity Progress Bar */}
                  <div className="space-y-2 pt-4 border-t-2 border-brand-black/10">
                    <div className="flex justify-between font-black text-[10px] uppercase tracking-wider">
                      <span>Tickets Sold</span>
                      <span className="text-brand-blue">{metrics.sold} / {metrics.capacity} ({metrics.percentage}%)</span>
                    </div>
                    <div className="w-full border-3 border-brand-black h-5 bg-brand-bg overflow-hidden relative">
                      <div 
                        className={`h-full border-r-3 border-brand-black bg-brand-blue`}
                        style={{ width: `${metrics.percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Price info & View Details button */}
                  <div className="flex items-center justify-between pt-4 border-t-2 border-brand-black/10">
                    <div>
                      <span className="text-[9px] font-bold text-brand-black/50 block leading-none uppercase">Tickets Range</span>
                      <span className="text-sm font-black text-brand-black">
                        {metrics.minPrice === metrics.maxPrice 
                          ? formatIDR(metrics.minPrice)
                          : `${formatIDR(metrics.minPrice)} - ${formatIDR(metrics.maxPrice)}`
                        }
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setPreviewEvent(event);
                        setIsPreviewModalOpen(true);
                      }}
                      className="bg-brand-yellow text-brand-black border-2 border-brand-black px-3.5 py-2 font-black text-[10px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#1b1b1b] transition-all cursor-pointer"
                    >
                      PREVIEW ➔
                    </button>
                  </div>

                  {/* Admin Edit, Soft & Hard Delete buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t-2 border-brand-black/15">
                    <button
                      onClick={() => openEditModal(event)}
                      className="bg-brand-blue text-white border-2 border-brand-black py-2 text-center font-black text-[9px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#1b1b1b] transition-all cursor-pointer"
                      title="Edit Event"
                    >
                      ✏️ EDIT
                    </button>
                    <button
                      onClick={() => {
                        setEventToDelete(event);
                        const isCompleted = new Date(event.date_time).getTime() < Date.now();
                        if (isCompleted) {
                          setIsSoftDeleteModalOpen(true);
                        } else {
                          setBlockedAction("soft");
                          setIsCantDeleteModalOpen(true);
                        }
                      }}
                      className="bg-brand-yellow text-brand-black border-2 border-brand-black py-2 text-center font-black text-[9px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#1b1b1b] transition-all cursor-pointer"
                      title="Soft Delete (Hide event, preserve revenue reports)"
                    >
                      🗑️ SOFT
                    </button>
                    <button
                      onClick={() => {
                        setEventToDelete(event);
                        const isCompleted = new Date(event.date_time).getTime() < Date.now();
                        if (isCompleted) {
                          setIsHardDeleteModalOpen(true);
                        } else {
                          setBlockedAction("hard");
                          setIsCantDeleteModalOpen(true);
                        }
                      }}
                      className="bg-red-600 text-white border-2 border-brand-black py-2 text-center font-black text-[9px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#1b1b1b] transition-all cursor-pointer"
                      title="Hard Delete (Permanently delete event and all tickets/orders)"
                    >
                      🚨 HARD
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-brand-black/85 z-[999] flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-white border-4 border-brand-black shadow-[8px_8px_0px_0px_#1b1b1b] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 text-left relative">
            
            {/* Close Button */}
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 bg-white text-brand-black border-2 border-brand-black w-8 h-8 flex items-center justify-center font-black text-sm hover:bg-brand-black hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-2xl font-black uppercase tracking-tight pb-2 border-b-3 border-brand-black">
              ✏️ Edit Event Details
            </h2>

            <form onSubmit={handleUpdateSubmit} className="space-y-6">
              
              {/* Event Name */}
              <BrutalistInput
                label="Event Name / Title"
                placeholder="e.g. MIDNIGHT PROTOCOL"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                error={editErrors.title}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category / Genre */}
                <div className="flex flex-col w-full text-left">
                  <label className="text-xs font-black uppercase tracking-wider text-brand-black mb-1">
                    Genre / Category
                  </label>
                  <select
                    value={editForm.genre}
                    onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                    className="w-full py-4 px-4 text-sm font-bold border-3 border-brand-black outline-none bg-white focus:bg-brand-bg focus:border-brand-blue appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 16px center', backgroundRepeat: 'no-repeat' }}
                  >
                    <option value="Techno">Techno</option>
                    <option value="Indie Rock">Indie Rock</option>
                    <option value="Metal">Metal</option>
                    <option value="Electronic">Electronic</option>
                    <option value="Pop">Pop</option>
                    <option value="Hip Hop">Hip Hop</option>
                  </select>
                </div>

                {/* Date & Time */}
                <div className="flex flex-col w-full text-left">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black uppercase tracking-wider text-brand-black">
                      Date & Time
                    </label>
                    {editErrors.date_time && (
                      <span className="text-[10px] md:text-xs font-bold text-red-600 uppercase tracking-wide">
                        ⚠️ Required
                      </span>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={editForm.date_time}
                    onChange={(e) => setEditForm({ ...editForm, date_time: e.target.value })}
                    className={`w-full py-3.5 px-4 text-sm font-bold border-3 border-brand-black outline-none transition-colors bg-white focus:bg-brand-bg focus:border-brand-blue
                      ${editErrors.date_time ? "border-red-600 bg-[#fee2e2]" : ""}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Venue */}
                <BrutalistInput
                  label="Venue / Location"
                  placeholder="e.g. The Bunker, Berlin"
                  value={editForm.venue}
                  onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                  error={editErrors.venue}
                />

                {/* Status */}
                <div className="flex flex-col w-full text-left">
                  <label className="text-xs font-black uppercase tracking-wider text-brand-black mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full py-4 px-4 text-sm font-bold border-3 border-brand-black outline-none bg-white focus:bg-brand-bg focus:border-brand-blue appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='black' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`, backgroundPosition: 'right 16px center', backgroundRepeat: 'no-repeat' }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CANCELED">CANCELED</option>
                  </select>
                </div>
              </div>

              {/* Image Source URL */}
              <BrutalistInput
                label="Event Banner Image URL (Optional)"
                placeholder="e.g. https://images.unsplash.com/... or /neon-pulse.png"
                value={editForm.image_src}
                onChange={(e) => setEditForm({ ...editForm, image_src: e.target.value })}
              />

              {/* Description */}
              <div className="flex flex-col w-full text-left">
                <label className="text-xs font-black uppercase tracking-wider text-brand-black mb-1">
                  Event Description
                </label>
                <textarea
                  placeholder="Give details about the line-up, special guests, or gate opening hours..."
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full py-4 px-4 text-sm font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 bg-white focus:bg-brand-bg focus:border-brand-blue resize-y"
                />
              </div>

              {editErrors.form && (
                <p className="bg-[#fee2e2] border-2 border-red-600 p-3 text-xs font-bold text-red-600 uppercase tracking-wide text-left">
                  ⚠️ {editErrors.form}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col md:flex-row gap-4 pt-4 border-t-3 border-brand-black">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-brand-blue text-white border-3 border-brand-black py-4 px-6 flex-1 font-black text-sm uppercase tracking-wider shadow-brutalist-md hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-lg transition-all active:translate-x-[2px] active:translate-y-[2px] cursor-pointer disabled:opacity-50 text-center"
                >
                  {isUpdating ? "SAVING CHANGES..." : "⚡ SAVE CHANGES"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="bg-white text-brand-black border-3 border-brand-black py-4 px-6 md:w-40 font-black text-sm uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
                >
                  CANCEL
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Modal */}
      {isSoftDeleteModalOpen && eventToDelete && (
        <div className="fixed inset-0 bg-brand-black/85 z-[999] flex items-center justify-center p-4 font-sans">
          <div className="bg-white border-4 border-brand-black shadow-[8px_8px_0px_0px_#1b1b1b] max-w-md w-full p-6 md:p-8 space-y-6 text-left relative">
            
            {/* Close Button */}
            <button
              onClick={() => setIsSoftDeleteModalOpen(false)}
              className="absolute top-4 right-4 bg-white text-brand-black border-2 border-brand-black w-8 h-8 flex items-center justify-center font-black text-sm hover:bg-brand-black hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-xl font-black uppercase tracking-tight text-brand-black pb-2 border-b-3 border-brand-black flex items-center gap-2">
              🗑️ SOFT DELETE EVENT
            </h2>

            <div className="space-y-4">
              <p className="text-sm font-bold uppercase text-brand-black">
                Apakah Anda yakin ingin menyembunyikan event <span className="text-brand-blue font-black">"{eventToDelete.title}"</span>?
              </p>
              
              <div className="bg-brand-yellow/10 border-3 border-brand-yellow p-4 shadow-[4px_4px_0px_0px_#facc15]">
                <p className="text-xs font-black text-brand-black uppercase mb-1">INFORMASI FITUR (REVENUE AMAN):</p>
                <p className="text-xs font-bold text-brand-black/80 uppercase leading-relaxed">
                  Fitur ini hanya menonaktifkan dan menyembunyikan event dari daftar publik dan daftar admin tanpa menghapus data transaksi pesanan (`orders`) dan tiket (`tickets`) untuk event ini. Laporan profit bulanan Anda di menu Reports akan tetap utuh.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4 border-t-3 border-brand-black">
              <button
                onClick={confirmSoftDelete}
                className="bg-brand-yellow text-brand-black border-3 border-brand-black py-3 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
              >
                🗑️ Ya, Sembunyikan Event
              </button>
              <button
                type="button"
                onClick={() => setIsSoftDeleteModalOpen(false)}
                className="bg-white text-brand-black border-3 border-brand-black py-3 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
              >
                Batal
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Hard Delete Modal */}
      {isHardDeleteModalOpen && eventToDelete && (
        <div className="fixed inset-0 bg-brand-black/85 z-[999] flex items-center justify-center p-4 font-sans">
          <div className="bg-white border-4 border-brand-black shadow-[8px_8px_0px_0px_#1b1b1b] max-w-md w-full p-6 md:p-8 space-y-6 text-left relative">
            
            {/* Close Button */}
            <button
              onClick={() => setIsHardDeleteModalOpen(false)}
              className="absolute top-4 right-4 bg-white text-brand-black border-2 border-brand-black w-8 h-8 flex items-center justify-center font-black text-sm hover:bg-brand-black hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-xl font-black uppercase tracking-tight text-red-600 pb-2 border-b-3 border-brand-black flex items-center gap-2">
              🚨 HARD DELETE EVENT (EVENT SELESAI)
            </h2>

            <div className="space-y-4">
              <p className="text-sm font-bold uppercase text-brand-black">
                Apakah Anda yakin ingin menghapus event <span className="text-brand-blue font-black">"{eventToDelete.title}"</span> secara permanen?
              </p>
              
              <div className="bg-[#fee2e2] border-3 border-red-600 p-4 shadow-[4px_4px_0px_0px_#dc2626]">
                <p className="text-xs font-black text-red-700 uppercase mb-1">PERINGATAN KERAS / HAPUS PERMANEN:</p>
                <p className="text-xs font-bold text-red-950 uppercase leading-relaxed">
                  Event ini sudah selesai, sehingga Anda diizinkan menghapusnya secara permanen. Namun, tindakan ini akan menghapus semua tiket, pesanan (orders), dan kategori tiket secara permanen. Pendapatan (revenue) dari event ini akan hilang dari menu Reports.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4 border-t-3 border-brand-black">
              <button
                onClick={confirmHardDelete}
                className="bg-red-600 text-white border-3 border-brand-black py-3 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer text-center animate-pulse"
              >
                🚨 Ya, Hapus Permanen
              </button>
              <button
                type="button"
                onClick={() => setIsHardDeleteModalOpen(false)}
                className="bg-white text-brand-black border-3 border-brand-black py-3 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
              >
                Batal
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Cannot Delete Modal */}
      {isCantDeleteModalOpen && eventToDelete && (
        <div className="fixed inset-0 bg-brand-black/85 z-[999] flex items-center justify-center p-4 font-sans">
          <div className="bg-white border-4 border-brand-black shadow-[8px_8px_0px_0px_#1b1b1b] max-w-md w-full p-6 md:p-8 space-y-6 text-left relative">
            
            {/* Close Button */}
            <button
              onClick={() => {
                setIsCantDeleteModalOpen(false);
                setBlockedAction(null);
              }}
              className="absolute top-4 right-4 bg-white text-brand-black border-2 border-brand-black w-8 h-8 flex items-center justify-center font-black text-sm hover:bg-brand-black hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-xl font-black uppercase tracking-tight text-red-600 pb-2 border-b-3 border-brand-black flex items-center gap-2">
              ⚠️ CANNOT {blockedAction === "soft" ? "SOFT" : "HARD"} DELETE
            </h2>

            <div className="space-y-4">
              <p className="text-sm font-bold uppercase text-brand-black">
                Event <span className="text-brand-blue font-black">"{eventToDelete.title}"</span> belum berakhir/selesai.
              </p>
              
              <div className="bg-[#fee2e2] border-3 border-red-600 p-4 shadow-[4px_4px_0px_0px_#dc2626]">
                <p className="text-xs font-black text-red-700 uppercase mb-1">TIDAK BISA DIHAPUS / DISEMBUNYIKAN SEKARANG:</p>
                <p className="text-xs font-bold text-red-950 uppercase leading-relaxed">
                  {blockedAction === "soft" ? (
                    "Anda tidak diperbolehkan melakukan Soft Delete (menyembunyikan event) pada event yang belum dimulai atau sedang berlangsung demi menghindari kekacauan pembelian tiket aktif dari pengunjung."
                  ) : (
                    "Anda tidak diperbolehkan melakukan Hard Delete pada event yang belum dimulai atau sedang berlangsung demi keamanan integritas data penjualan aktif. Harap tunggu hingga event selesai."
                  )}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4 border-t-3 border-brand-black">
              <button
                type="button"
                onClick={() => {
                  setIsCantDeleteModalOpen(false);
                  setBlockedAction(null);
                }}
                className="bg-white text-brand-black border-3 border-brand-black py-3 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
              >
                Tutup / Kembali
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Event Preview Modal */}
      {isPreviewModalOpen && previewEvent && (
        <div className="fixed inset-0 bg-brand-black/85 z-[999] flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="bg-white border-4 border-brand-black shadow-[8px_8px_0px_0px_#1b1b1b] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 text-left relative">
            
            {/* Close Button */}
            <button
              onClick={() => {
                setIsPreviewModalOpen(false);
                setPreviewEvent(null);
              }}
              className="absolute top-4 right-4 bg-white text-brand-black border-2 border-brand-black w-8 h-8 flex items-center justify-center font-black text-sm hover:bg-brand-black hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-2xl font-black uppercase tracking-tight pb-2 border-b-3 border-brand-black">
              🔍 Event Preview
            </h2>

            <div className="space-y-6">
              {/* Image Banner */}
              <div className="relative aspect-[16/9] w-full overflow-hidden border-4 border-brand-black shadow-brutalist-sm">
                <img
                  src={(previewEvent as any).image_src || "/hero-concert.png"}
                  alt={previewEvent.title}
                  className="object-cover w-full h-full"
                />
                <div className="absolute top-4 left-4 bg-brand-blue text-white border-2 border-brand-black px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_#1b1b1b]">
                  {previewEvent.genre}
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="space-y-2">
                <h3 className="text-3xl font-black uppercase tracking-tight text-brand-black leading-tight break-words">
                  {previewEvent.title}
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-black uppercase text-brand-black/60">
                  <p>📅 {new Date(previewEvent.date_time).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  <p>📍 {previewEvent.venue}</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2 border-t-2 border-brand-black/10 pt-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-brand-black">
                  Description
                </h4>
                <p className="text-xs font-bold text-brand-black/85 whitespace-pre-wrap leading-relaxed">
                  {previewEvent.description || "Tidak ada deskripsi."}
                </p>
              </div>

              {/* Facilities */}
              {(previewEvent as any).facilities && (previewEvent as any).facilities.trim() && (
                <div className="space-y-2 border-t-2 border-brand-black/10 pt-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-black">
                    Fasilitas Event
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(previewEvent as any).facilities.split(",").map((fac: string) => fac.trim()).filter(Boolean).map((fac: string, idx: number) => (
                      <span
                        key={idx}
                        className="bg-brand-bg text-brand-black border-2 border-brand-black px-2.5 py-1.5 font-bold text-[10px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b]"
                      >
                        {fac}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Terms and Conditions */}
              {(previewEvent as any).terms_conditions && (previewEvent as any).terms_conditions.trim() && (
                <div className="space-y-2 border-t-2 border-brand-black/10 pt-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-black">
                    Syarat & Ketentuan
                  </h4>
                  <p className="text-xs font-bold text-brand-black/75 whitespace-pre-wrap leading-relaxed bg-brand-bg p-4 border-2 border-brand-black">
                    {(previewEvent as any).terms_conditions}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-6 border-t-3 border-brand-black">
              <Link
                href={`/guest/checkout?event_id=${previewEvent.id}`}
                className="bg-brand-blue text-white border-3 border-brand-black py-3 px-6 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer text-center flex-1"
              >
                🎟️ Preview Checkout ➔
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  setPreviewEvent(null);
                }}
                className="bg-white text-brand-black border-3 border-brand-black py-3 px-6 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
