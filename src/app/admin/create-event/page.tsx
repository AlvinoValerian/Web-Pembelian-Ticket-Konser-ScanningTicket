"use client";

import React, { useState } from "react";
import Link from "next/link";
import BrutalistInput from "@/components/BrutalistInput";
import { createClient } from "@/utils/supabase/client";

interface TicketTier {
  name: string;
  price: number;
  capacity: number;
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

export default function CreateEventPage() {
  const supabase = createClient();

  // Form State
  const [eventName, setEventName] = useState("");
  const [category, setCategory] = useState("Techno");
  const [dateTime, setDateTime] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [termsConditions, setTermsConditions] = useState("");
  const [facilitiesInput, setFacilitiesInput] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { name: "General Admission", price: 450000, capacity: 500 },
    { name: "VIP", price: 1200000, capacity: 100 },
  ]);

  const predefinedFacilities = [
    { name: "Food Court", icon: "🍔" },
    { name: "Pusat Informasi", icon: "ℹ️" },
    { name: "Area Anak", icon: "👶" },
    { name: "Medis", icon: "🏥" },
    { name: "Merchandise", icon: "👕" },
    { name: "Musholla", icon: "🕌" },
    { name: "Area Parkir", icon: "🅿️" },
    { name: "Photo Booth", icon: "📸" },
    { name: "Area Merokok", icon: "🚬" },
    { name: "Toilet", icon: "🚾" }
  ];

  const handleAddFacilityLabel = (facility: string) => {
    if (!facilitiesInput.trim()) {
      setFacilitiesInput(facility);
    } else {
      const current = facilitiesInput.split(",").map(f => f.trim());
      if (!current.includes(facility)) {
        setFacilitiesInput(facilitiesInput.trim() + ", " + facility);
      }
    }
  };

  // Status & Validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handlers for Ticket Tiers
  const handleAddTier = () => {
    setTicketTiers([...ticketTiers, { name: "New Tier", price: 150000, capacity: 100 }]);
  };

  const handleRemoveTier = (index: number) => {
    if (ticketTiers.length > 1) {
      setTicketTiers(ticketTiers.filter((_, i) => i !== index));
    }
  };

  const handleUpdateTier = (index: number, key: keyof TicketTier, value: string | number) => {
    const updated = [...ticketTiers];
    updated[index] = {
      ...updated[index],
      [key]: value,
    };
    setTicketTiers(updated);
  };

  // Form Validation & Submission
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!eventName.trim()) newErrors.eventName = "Event Name is required";
    if (!dateTime) newErrors.dateTime = "Date and Time is required";
    if (!venue.trim()) newErrors.venue = "Venue / Location is required";
    if (ticketTiers.some(t => !t.name.trim())) newErrors.tiers = "All tiers must have a name";
    if (ticketTiers.some(t => t.price <= 0)) newErrors.tiers = "Ticket prices must be greater than 0";
    if (ticketTiers.some(t => t.capacity <= 0)) newErrors.tiers = "Capacity must be greater than 0";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const defaultImage = genreDefaults[category] || "/hero-concert.png";
      const finalImageSrc = imageSrc.trim() || defaultImage;

      // 1. Insert Event details
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .insert({
          title: eventName,
          genre: category,
          date_time: new Date(dateTime).toISOString(),
          venue: venue,
          description: description,
          image_src: finalImageSrc,
          registration_close_at: new Date(dateTime).toISOString(), // defaults to event time
          terms_conditions: termsConditions || null,
          facilities: facilitiesInput || null,
        })
        .select()
        .single();

      if (eventError || !eventData) {
        throw new Error(eventError?.message || "Failed to create event entry.");
      }

      // 2. Insert Ticket Tiers referencing the created event ID
      const tiersToInsert = ticketTiers.map((tier) => ({
        event_id: eventData.id,
        name: tier.name,
        price: tier.price,
        capacity: tier.capacity,
        sale_start: new Date().toISOString(), // starts immediately
        sale_end: new Date(dateTime).toISOString(), // ends at event start time
      }));

      const { error: tiersError } = await supabase
        .from("ticket_tiers")
        .insert(tiersToInsert);

      if (tiersError) {
        // Rollback event if tiers insertion fails
        await supabase.from("events").delete().eq("id", eventData.id);
        throw new Error(tiersError.message || "Failed to create ticket tiers.");
      }

      // Reset form on success
      setIsSuccess(true);
      setEventName("");
      setCategory("Techno");
      setDateTime("");
      setVenue("");
      setDescription("");
      setImageSrc("");
      setTicketTiers([
        { name: "General Admission", price: 450000, capacity: 500 },
        { name: "VIP", price: 1200000, capacity: 100 },
      ]);

      // Clear success notification after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err: any) {
      setErrors({ form: err.message || "Something went wrong. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format IDR Currency
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Find lowest ticket price for catalog card preview
  const lowestPrice = ticketTiers.length > 0 
    ? Math.min(...ticketTiers.map(t => t.price)) 
    : 0;

  // Format date display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "OCT 14, 23:00";
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

  return (
    <div className="p-6 md:p-12 w-full text-left">
      {/* Success Alert */}
      {isSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-brand-yellow border-4 border-brand-black shadow-[6px_6px_0px_0px_#1b1b1b] p-4 max-w-md animate-bounce">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="font-black text-sm uppercase tracking-wider text-brand-black">🎉 EVENT CREATED</p>
              <p className="font-bold text-xs mt-1 text-brand-black/80">
                Your new event has been successfully configured and activated!
              </p>
              <div className="mt-3">
                <Link
                  href="/admin/events"
                  className="inline-block bg-brand-blue text-white border-2 border-brand-black px-3 py-1.5 font-black text-[10px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_#1b1b1b] transition-all"
                >
                  VIEW ALL EVENTS ➔
                </Link>
              </div>
            </div>
            <button 
              onClick={() => setIsSuccess(false)} 
              className="text-xs font-bold border-2 border-brand-black px-1.5 py-0.5 hover:bg-brand-black hover:text-white"
            >
              X
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col justify-start items-start gap-2 mb-12">
        <h1 className="text-4xl font-black uppercase tracking-tight leading-none">
          CREATE NEW EVENT
        </h1>
        <p className="text-xs md:text-sm font-bold text-brand-black/60">
          Set up new concerts, festivals, or private gig tickets.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Form */}
        <form onSubmit={handleSubmit} className="xl:col-span-7 space-y-8 bg-white border-4 border-brand-black p-6 md:p-8 shadow-brutalist-md">
          <h2 className="text-xl font-black uppercase tracking-tight border-b-3 border-brand-black pb-2">
            Event details
          </h2>

          <div className="space-y-6">
            {/* Event Name */}
            <BrutalistInput
              label="Event Name / Title"
              placeholder="e.g. NEON NIGHTS FESTIVAL"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              error={errors.eventName}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category */}
              <div className="flex flex-col w-full text-left">
                <label className="text-xs font-black uppercase tracking-wider text-brand-black mb-1">
                  Genre / Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
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
                  {errors.dateTime && (
                    <span className="text-[10px] md:text-xs font-bold text-red-600 uppercase tracking-wide">
                      ⚠️ Required
                    </span>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className={`w-full py-3.5 px-4 text-sm font-bold border-3 border-brand-black outline-none transition-colors bg-white focus:bg-brand-bg focus:border-brand-blue
                    ${errors.dateTime ? "border-red-600 bg-[#fee2e2]" : ""}`}
                />
              </div>
            </div>

            {/* Venue */}
            <BrutalistInput
              label="Venue / Location"
              placeholder="e.g. The Bunker, Berlin or GBK Stadium, Jakarta"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              error={errors.venue}
            />

            {/* Image Banner URL */}
            <BrutalistInput
              label="Event Banner Image URL (Optional)"
              placeholder="e.g. https://images.unsplash.com/... or /neon-pulse.png"
              value={imageSrc}
              onChange={(e) => setImageSrc(e.target.value)}
            />

            {/* Description */}
            <div className="flex flex-col w-full text-left">
              <label className="text-xs font-black uppercase tracking-wider text-brand-black mb-1">
                Event Description
              </label>
              <textarea
                placeholder="Give details about the line-up, special guests, or gate opening hours..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full py-4 px-4 text-sm font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 bg-white focus:bg-brand-bg focus:border-brand-blue resize-y"
              />
            </div>

            {/* Syarat & Ketentuan */}
            <div className="flex flex-col w-full text-left">
              <label className="text-xs font-black uppercase tracking-wider text-brand-black mb-1">
                Syarat & Ketentuan
              </label>
              <textarea
                placeholder="Tuliskan syarat dan ketentuan untuk memasuki event ini..."
                rows={3}
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                className="w-full py-4 px-4 text-sm font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 bg-white focus:bg-brand-bg focus:border-brand-blue resize-y"
              />
            </div>

            {/* Fasilitas Event */}
            <div className="flex flex-col w-full text-left space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-brand-black">
                Fasilitas Event (Pisahkan dengan koma)
              </label>
              <input
                type="text"
                placeholder="e.g. Musholla, Toilet, Food Court (atau klik tag di bawah)"
                value={facilitiesInput}
                onChange={(e) => setFacilitiesInput(e.target.value)}
                className="w-full py-3.5 px-4 text-sm font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 bg-white focus:bg-brand-bg focus:border-brand-blue"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                {predefinedFacilities.map((fac) => (
                  <button
                    key={fac.name}
                    type="button"
                    onClick={() => handleAddFacilityLabel(`${fac.icon} ${fac.name}`)}
                    className="bg-white hover:bg-brand-bg border-2 border-brand-black px-2.5 py-1.5 font-bold text-[10px] uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_#1b1b1b] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{fac.icon}</span>
                    <span>{fac.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket Tiers Configuration */}
          <div className="space-y-6 pt-6 border-t-3 border-brand-black">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-tight">
                Ticket tiers
              </h2>
              <button
                type="button"
                onClick={handleAddTier}
                className="bg-white border-3 border-brand-black px-3 py-1.5 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all active:translate-x-[2px] active:translate-y-[2px]"
              >
                + Add Tier
              </button>
            </div>

            {errors.tiers && (
              <p className="bg-[#fee2e2] border-2 border-red-600 p-3 text-xs font-bold text-red-600 uppercase tracking-wide">
                ⚠️ {errors.tiers}
              </p>
            )}

            <div className="space-y-4">
              {ticketTiers.map((tier, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-4 p-4 border-2 border-brand-black bg-brand-bg/50 relative">
                  {/* Delete Button */}
                  {ticketTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(index)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white border-2 border-brand-black w-6 h-6 flex items-center justify-center font-black text-xs hover:bg-red-800 transition-colors"
                      title="Remove Tier"
                    >
                      ×
                    </button>
                  )}

                  {/* Tier Name */}
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 block mb-1">
                      Tier Name
                    </label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => handleUpdateTier(index, "name", e.target.value)}
                      placeholder="e.g. VIP Backstage"
                      className="w-full py-2 px-3 text-xs font-bold border-2 border-brand-black outline-none bg-white focus:bg-brand-bg"
                    />
                  </div>

                  {/* Ticket Price */}
                  <div className="w-full md:w-44">
                    <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 block mb-1">
                      Price (IDR)
                    </label>
                    <input
                      type="number"
                      value={tier.price || ""}
                      onChange={(e) => handleUpdateTier(index, "price", parseInt(e.target.value) || 0)}
                      placeholder="e.g. 500000"
                      className="w-full py-2 px-3 text-xs font-bold border-2 border-brand-black outline-none bg-white focus:bg-brand-bg"
                    />
                  </div>

                  {/* Quantity / Capacity */}
                  <div className="w-full md:w-32">
                    <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 block mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      value={tier.capacity || ""}
                      onChange={(e) => handleUpdateTier(index, "capacity", parseInt(e.target.value) || 0)}
                      placeholder="e.g. 200"
                      className="w-full py-2 px-3 text-xs font-bold border-2 border-brand-black outline-none bg-white focus:bg-brand-bg"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errors.form && (
            <p className="bg-[#fee2e2] border-2 border-red-600 p-3 text-xs font-bold text-red-600 uppercase tracking-wide">
              ⚠️ {errors.form}
            </p>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-brutalist-blue w-full py-4 text-sm font-black tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>CREATING EVENT...</span>
            ) : (
              <>
                <span>⚡</span> CREATE & ACTIVATE EVENT
              </>
            )}
          </button>
        </form>

        {/* Right Column: Live Preview */}
        <div className="xl:col-span-5 space-y-6 sticky top-24">
          <div className="bg-brand-yellow border-4 border-brand-black p-4 text-center font-black uppercase tracking-widest text-xs shadow-brutalist-sm">
            👀 LIVE EVENT PREVIEW
          </div>

          {/* Simulated Catalog Gig Card */}
          <div className="border-4 border-brand-black bg-white shadow-brutalist-md overflow-hidden relative w-full text-left group">
            {/* Event Genre Tag */}
            <div className="absolute top-4 left-4 bg-brand-blue text-white border-2 border-brand-black px-3 py-1 text-[10px] font-black uppercase tracking-widest z-10 shadow-[2px_2px_0px_0px_#1b1b1b]">
              {category}
            </div>

            {/* Event Image Placeholder/Visual */}
            <div className="aspect-[16/10] relative w-full overflow-hidden bg-brand-black border-b-4 border-brand-black flex items-center justify-center">
              <img
                src={imageSrc.trim() || genreDefaults[category] || "/hero-concert.png"}
                alt={eventName || "Event Preview"}
                className="object-cover w-full h-full grayscale contrast-125"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/30 via-transparent to-brand-yellow/30 pointer-events-none" />
              <span className="font-black text-white/10 text-7xl select-none uppercase tracking-widest absolute">
                {category || "MUSIC"}
              </span>
            </div>

            {/* Event Info Details */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-brand-black/60">
                  <span>{formatDate(dateTime)}</span>
                  <span>📍 {venue || "TBD VENUE"}</span>
                </div>
                
                <h3 className="text-2xl font-black uppercase tracking-tight leading-none group-hover:text-brand-blue transition-colors break-words">
                  {eventName || "YOUR EVENT TITLE"}
                </h3>
              </div>

              {description && (
                <p className="text-xs font-medium text-brand-black/70 line-clamp-2 leading-relaxed">
                  {description}
                </p>
              )}

              {/* Price and Action Section */}
              <div className="flex items-center justify-between pt-4 border-t-2 border-brand-black/10">
                <div>
                  <span className="text-[9px] font-bold text-brand-black/50 block leading-none uppercase">Tickets from</span>
                  <span className="text-lg font-black text-brand-blue">{formatIDR(lowestPrice)}</span>
                </div>
                <div className="bg-brand-yellow text-brand-black border-2 border-brand-black px-4 py-2 font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b]">
                  GET TICKETS ➔
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Tier Cards Preview */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/50 block">
              CONFIGURED TICKET TIERS ({ticketTiers.length})
            </span>
            <div className="grid grid-cols-1 gap-3">
              {ticketTiers.map((tier, idx) => (
                <div key={idx} className="border-3 border-brand-black bg-white p-4 shadow-brutalist-sm flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-brand-black">
                      {tier.name || `Tier ${idx + 1}`}
                    </h4>
                    <span className="text-[10px] font-bold text-brand-black/60 uppercase">
                      Capacity: {tier.capacity} tickets
                    </span>
                  </div>
                  <span className="text-sm font-black text-brand-blue">
                    {formatIDR(tier.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
