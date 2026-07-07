"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

interface DisplayTicket {
  id: string;
  code: string;
  event: string;
  stage: string;
  dateTime: string;
  venue: string;
  sector: string;
  category: string;
  status: string;
  categoryBg: string;
  orderNumber?: string;
}

export default function GuestTickets() {
  const supabase = createClient();
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTicketId, setDeleteTicketId] = useState<string | null>(null);
  const [hiddenTicketIds, setHiddenTicketIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("hidden_ticket_ids");
    if (stored) {
      try {
        setHiddenTicketIds(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleDeleteConfirm = () => {
    if (!deleteTicketId) return;
    const newHidden = [...hiddenTicketIds, deleteTicketId];
    setHiddenTicketIds(newHidden);
    localStorage.setItem("hidden_ticket_ids", JSON.stringify(newHidden));
    setDeleteTicketId(null);
  };

  useEffect(() => {
    const fetchUserTickets = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || null);

        // 1. Fetch orders placed directly by this user account (online orders)
        const { data: ordersByBuyer, error: error1 } = await supabase
          .from("orders")
          .select(`
            id,
            buyer_id,
            order_number,
            status,
            quantity,
            total_amount,
            created_at,
            events:event_id (
              id,
              title,
              venue,
              date_time,
              genre,
              image_src
            ),
            tickets (
              id,
              ticket_code,
              status,
              scanned_at,
              owner_email
            )
          `)
          .eq("buyer_id", user.id);

        if (error1) throw error1;

        // 2. Fetch orders where the tickets belong to this user's email (offline purchases)
        let ordersByEmail: any[] = [];
        if (user.email) {
          // Find all tickets belonging to this email
          const { data: ownedTickets, error: error2 } = await supabase
            .from("tickets")
            .select("order_id")
            .eq("owner_email", user.email);

          if (error2) throw error2;

          const ownedOrderIds = (ownedTickets || [])
            .map((t: any) => t.order_id)
            .filter(Boolean);

          // Only query if there are matching order IDs
          if (ownedOrderIds.length > 0) {
            const { data: emailOrders, error: error3 } = await supabase
              .from("orders")
              .select(`
                id,
                buyer_id,
                order_number,
                status,
                quantity,
                total_amount,
                created_at,
                events:event_id (
                  id,
                  title,
                  venue,
                  date_time,
                  genre,
                  image_src
                ),
                tickets (
                  id,
                  ticket_code,
                  status,
                  scanned_at,
                  owner_email
                )
              `)
              .in("id", ownedOrderIds);

            if (error3) throw error3;
            ordersByEmail = emailOrders || [];
          }
        }

        // 3. Combine both lists and remove duplicates (by order ID)
        const combinedOrdersMap = new Map<string, any>();
        (ordersByBuyer || []).forEach(o => combinedOrdersMap.set(o.id, o));
        ordersByEmail.forEach(o => combinedOrdersMap.set(o.id, o));

        // Sort by created_at descending
        const sortedOrders = Array.from(combinedOrdersMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setOrdersList(sortedOrders);
      } catch (err) {
        console.error("Error fetching tickets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTickets();
  }, [supabase]);

  const handleDownload = (ticket: DisplayTicket) => {
    // Create an in-memory canvas
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      alert("Failed to initialize download canvas.");
      return;
    }

    // 1. Draw ticket card background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 800, 400);

    // Thick black border
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 792, 392);

    // Draw ticket header background (Brutalist yellow banner at top)
    ctx.fillStyle = "#fed01b";
    ctx.fillRect(8, 8, 784, 50);

    // Header border bottom
    ctx.beginPath();
    ctx.moveTo(8, 58);
    ctx.lineTo(792, 58);
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Header Text
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "900 20px 'Inter', Arial, sans-serif";
    ctx.fillText("🎫 VIBECHECK ADMISSION TICKET", 30, 40);

    // Vertical dashed stub line
    ctx.beginPath();
    ctx.setLineDash([8, 8]);
    ctx.moveTo(560, 58);
    ctx.lineTo(560, 392);
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // --- BODY DETAILS (Left Side) ---
    // Category Badge
    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(30, 85, 140, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px 'Inter', Arial, sans-serif";
    ctx.fillText(ticket.category || "ADMISSION PASS", 45, 104);

    // Event Title
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "900 34px 'Inter', Arial, sans-serif";
    const title = ticket.event.toUpperCase();
    ctx.fillText(title.length > 22 ? title.substring(0, 22) + "..." : title, 30, 160);

    // Date & Time
    ctx.fillStyle = "#2563eb"; // Brand blue
    ctx.font = "bold 18px 'Inter', Arial, sans-serif";
    ctx.fillText(ticket.dateTime, 30, 205);

    // Venue Info
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "800 12px 'Inter', Arial, sans-serif";
    ctx.fillText("VENUE", 30, 250);
    ctx.font = "bold 16px 'Inter', Arial, sans-serif";
    ctx.fillText(ticket.venue, 30, 275);

    // Sector Info
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "800 12px 'Inter', Arial, sans-serif";
    ctx.fillText("SECTOR / GATE", 30, 320);
    ctx.font = "bold 16px 'Inter', Arial, sans-serif";
    ctx.fillText(ticket.sector, 30, 345);

    // --- STUB DETAILS (Right Side) ---
    // Ticket Code
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "800 10px 'Inter', Arial, sans-serif";
    ctx.fillText("TICKET CODE", 580, 95);
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(580, 105, 200, 30);
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 2;
    ctx.strokeRect(580, 105, 200, 30);
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "bold 12px 'Inter', Arial, sans-serif";
    ctx.fillText(ticket.code, 595, 125);

    // Order Number
    ctx.fillStyle = "#1b1b1b";
    ctx.font = "800 10px 'Inter', Arial, sans-serif";
    ctx.fillText("ORDER NUMBER", 580, 160);
    if (ticket.orderNumber) {
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(580, 170, 200, 30);
      ctx.strokeRect(580, 170, 200, 30);
      ctx.fillStyle = "#1b1b1b";
      ctx.font = "bold 12px 'Inter', Arial, sans-serif";
      ctx.fillText(ticket.orderNumber, 595, 190);
    }

    // Function to trigger anchor-based download
    const triggerDownload = () => {
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const link = document.createElement("a");
        link.download = `VIBECHECK-TICKET-${ticket.code}.jpg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Failed to generate download URL:", err);
        alert("Permission denied or security policy blocked client-side image generation.");
      }
    };

    // Draw barcode visual if QR code fails or isn't applicable
    const drawBarcodePlaceholder = () => {
      ctx.fillStyle = "#1b1b1b";
      ctx.font = "800 10px 'Inter', Arial, sans-serif";
      ctx.fillText("BARCODE SCAN", 580, 220);
      
      let startX = 580;
      const widths = [3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 3, 2, 4, 1, 3];
      ctx.fillStyle = "#1b1b1b";
      widths.forEach((w, i) => {
        if (i % 2 === 0) {
          ctx.fillRect(startX, 235, w, 90);
        }
        startX += w + 2;
      });
      ctx.strokeStyle = "#1b1b1b";
      ctx.lineWidth = 2;
      ctx.strokeRect(580, 235, startX - 580, 90);
    };

    // QR Code drawing with CORS handling
    const qrCodeUrl = ticket.code 
      ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.code)}`
      : "";

    if (qrCodeUrl) {
      const qrImg = new window.Image();
      qrImg.crossOrigin = "anonymous";
      qrImg.src = qrCodeUrl;
      qrImg.onload = () => {
        try {
          ctx.drawImage(qrImg, 620, 225, 120, 120);
          ctx.strokeStyle = "#1b1b1b";
          ctx.lineWidth = 3;
          ctx.strokeRect(620, 225, 120, 120);
          triggerDownload();
        } catch (err) {
          console.error("CORS tainted canvas while drawing QR code:", err);
          drawBarcodePlaceholder();
          triggerDownload();
        }
      };
      qrImg.onerror = () => {
        drawBarcodePlaceholder();
        triggerDownload();
      };
    } else {
      drawBarcodePlaceholder();
      triggerDownload();
    }
  };

  // Pure CSS Barcode helper
  const Barcode = () => (
    <div className="flex justify-between items-stretch h-14 w-full bg-white px-2 py-1.5 border border-brand-black">
      <div className="w-[3px] bg-brand-black"></div>
      <div className="w-[1px] bg-brand-black"></div>
      <div className="w-[4px] bg-brand-black"></div>
      <div className="w-[2px] bg-brand-black"></div>
      <div className="w-[1px] bg-brand-black"></div>
      <div className="w-[3px] bg-brand-black"></div>
      <div className="w-[2px] bg-brand-black"></div>
      <div className="w-[4px] bg-brand-black"></div>
      <div className="w-[1px] bg-brand-black"></div>
      <div className="w-[3px] bg-brand-black"></div>
      <div className="w-[2px] bg-brand-black"></div>
      <div className="w-[1px] bg-brand-black"></div>
      <div className="w-[4px] bg-brand-black"></div>
      <div className="w-[2px] bg-brand-black"></div>
      <div className="w-[1px] bg-brand-black"></div>
      <div className="w-[3px] bg-brand-black"></div>
      <div className="w-[1px] bg-brand-black"></div>
      <div className="w-[4px] bg-brand-black"></div>
    </div>
  );

  // Group active vs past tickets
  const validTickets: DisplayTicket[] = [];
  const pastTickets: DisplayTicket[] = [];

  ordersList.forEach((order) => {
    const event = order.events || {
      title: "Unknown concert",
      venue: "Main Stage Arena",
      date_time: order.created_at,
      genre: "Live Music"
    };

    const formattedDate = new Date(event.date_time).toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).toUpperCase();

    const eventTime = new Date(event.date_time);
    const currentTime = new Date();
    const diffInHours = (currentTime.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
    const isExpired = diffInHours > 8;
    const isAutoHidden = diffInHours > 240; // 10 days = 240 hours

    if (order.status === "PENDING" || order.status === "FLAGGED") {
      const ticketId = `order-${order.id}`;
      // Skip if manually hidden
      if (hiddenTicketIds.includes(ticketId)) return;

      if (isExpired) {
        // Skip if automatically hidden (10 days rule)
        if (isAutoHidden) return;

        pastTickets.push({
          id: ticketId,
          code: order.order_number,
          event: event.title,
          stage: "GATE ACCESS EXPIRED",
          dateTime: formattedDate,
          venue: event.venue,
          sector: "EVENT PASSED (EXPIRED)",
          category: "ADMISSION PASS",
          status: "EXPIRED",
          categoryBg: "bg-brand-black text-white",
          orderNumber: order.order_number
        });
      } else {
        validTickets.push({
          id: ticketId,
          code: order.order_number,
          event: event.title,
          stage: "GATE ACCESS AWAITING REVIEW",
          dateTime: formattedDate,
          venue: event.venue,
          sector: "PENDING CONFIRMATION",
          category: "ADMISSION PASS",
          status: "PENDING",
          categoryBg: "bg-brand-yellow text-brand-black",
          orderNumber: order.order_number
        });
      }
    } else if (order.status === "REJECTED") {
      const ticketId = `order-${order.id}`;
      // Skip if manually hidden or automatically hidden (10 days rule)
      if (hiddenTicketIds.includes(ticketId)) return;
      if (isAutoHidden) return;

      // Rejected orders go to past tickets list
      pastTickets.push({
        id: ticketId,
        code: order.order_number,
        event: event.title,
        stage: "GATE ACCESS REJECTED",
        dateTime: formattedDate,
        venue: event.venue,
        sector: "PAYMENT REJECTED BY ADMIN",
        category: "VOID TICKET",
        status: "REJECTED",
        categoryBg: "bg-brand-black text-white",
        orderNumber: order.order_number
      });
    } else if (order.status === "APPROVED" || order.status === "PAID") {
      let tickets = order.tickets || [];
      
      // If the guest is NOT the purchaser (buyer_id !== currentUserId), filter the tickets to only show the ones they own
      if (order.buyer_id !== currentUserId) {
        tickets = tickets.filter((t: any) => t.owner_email === currentUserEmail);
      }

      if (tickets.length > 0) {
        tickets.forEach((t: any) => {
          const ticketId = `ticket-${t.id}`;
          // Skip if manually hidden
          if (hiddenTicketIds.includes(ticketId)) return;

          let ticketStatus = "VALID";
          if (t.status === "USED" || t.status === "CHECKED_IN") {
            ticketStatus = "USED";
          } else if (isExpired) {
            ticketStatus = "EXPIRED";
          }

          const isPast = ticketStatus === "USED" || ticketStatus === "EXPIRED";

          // Skip if past and automatically hidden
          if (isPast && isAutoHidden) return;

          const displayT: DisplayTicket = {
            id: ticketId,
            code: t.ticket_code,
            event: event.title,
            stage: isExpired ? "GATE ACCESS EXPIRED" : "CONFIRMED ACCESS",
            dateTime: formattedDate,
            venue: event.venue,
            sector: isExpired ? "EVENT PASSED (EXPIRED)" : "SECTOR GENERAL",
            category: "ADMISSION TICKET",
            status: ticketStatus,
            categoryBg: ticketStatus === "VALID" ? "bg-brand-yellow text-brand-black" : "bg-brand-black text-white",
            orderNumber: order.order_number
          };

          if (isPast) {
            pastTickets.push(displayT);
          } else {
            validTickets.push(displayT);
          }
        });
      } else {
        // Fallback in case the tickets table hasn't inserted the row yet
        // If not the purchaser, they shouldn't see this fallback order.
        if (order.buyer_id !== currentUserId) return;
        const ticketId = `order-${order.id}`;
        // Skip if manually hidden
        if (hiddenTicketIds.includes(ticketId)) return;

        // Fallback in case the tickets table hasn't inserted the row yet
        const ticketStatus = isExpired ? "EXPIRED" : "VALID";
        const isPast = ticketStatus === "EXPIRED";

        if (isPast && isAutoHidden) return;

        const displayT: DisplayTicket = {
          id: ticketId,
          code: order.order_number,
          event: event.title,
          stage: isExpired ? "GATE ACCESS EXPIRED" : "CONFIRMED ACCESS",
          dateTime: formattedDate,
          venue: event.venue,
          sector: isExpired ? "EVENT PASSED (EXPIRED)" : "SECTOR GENERAL",
          category: "ADMISSION TICKET",
          status: ticketStatus,
          categoryBg: ticketStatus === "VALID" ? "bg-brand-yellow text-brand-black" : "bg-brand-black text-white",
          orderNumber: order.order_number
        };

        if (isPast) {
          pastTickets.push(displayT);
        } else {
          validTickets.push(displayT);
        }
      }
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex flex-col items-center justify-center">
        <div className="bg-brand-yellow border-4 border-brand-black p-8 shadow-brutalist-md uppercase font-black text-sm tracking-widest animate-pulse">
          ⏳ Loading your ticket vault...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 w-full text-left">
      
      {/* Header Badge */}
      <div className="mb-12">
        <div className="inline-block bg-brand-yellow border-4 border-brand-black px-6 py-2.5 rotate-[-2deg] shadow-brutalist-md">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-brand-black">
            YOUR TICKETS
          </h1>
        </div>
      </div>

      {/* Valid & Pending Tickets Grid */}
      <div className="space-y-6 mb-12">
        <h2 className="text-lg font-black uppercase tracking-wider border-b-2 border-brand-black pb-2 mb-4">
          ACTIVE & PENDING TICKETS
        </h2>

        {validTickets.length === 0 ? (
          <div className="bg-white border-4 border-brand-black p-8 text-center font-black uppercase text-xs shadow-brutalist-sm">
            📭 No active or pending tickets found. Go buy some gigs!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {validTickets.map((ticket) => (
              <div key={ticket.id} className="border-4 border-brand-black bg-white shadow-brutalist-md flex flex-col md:flex-row overflow-hidden relative">
                
                {/* Left Info Area */}
                <div className="flex-1 p-6 border-b-4 md:border-b-0 md:border-r-4 border-dashed border-brand-black flex flex-col justify-between">
                  <div>
                    <div className="flex gap-2 mb-4">
                      <span className={`${ticket.categoryBg} border-2 border-brand-black text-[10px] font-black uppercase tracking-wider px-2.5 py-1`}>
                        {ticket.category}
                      </span>
                      <span className={`border-2 border-brand-black text-[10px] font-black uppercase tracking-wider px-2.5 py-1
                        ${ticket.status === "PENDING" ? "bg-brand-black text-brand-yellow" : "bg-white text-brand-black"}`}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-2 break-words">
                      {ticket.event}
                    </h3>
                    <p className="text-xs font-bold text-brand-black/60 uppercase tracking-wide">
                      {ticket.stage} \ {ticket.dateTime}
                    </p>
                  </div>

                  <div className="border-t-2 border-brand-black/10 pt-4 mt-6">
                    <p className="text-[10px] font-bold text-brand-black/40 uppercase leading-none mb-1">
                      VENUE
                    </p>
                    <p className="text-xs font-black uppercase leading-tight">
                      {ticket.venue}
                    </p>
                    <p className="text-[10px] font-bold text-brand-black/60 uppercase mt-0.5">
                      {ticket.sector}
                    </p>
                  </div>
                </div>

                {/* Right Stub Area */}
                <div className="w-full md:w-48 p-6 bg-brand-bg md:bg-white flex flex-col justify-between items-center text-center">
                  <div className="w-full flex flex-col items-center">
                    <p className="text-[9px] font-bold text-brand-black/40 uppercase tracking-widest leading-none mb-1">
                      TICKET CODE
                    </p>
                    <div className="border-2 border-brand-black bg-brand-bg/50 px-2 py-1 font-black text-sm tracking-wider uppercase mb-3 truncate max-w-full w-full">
                      {ticket.status === "PENDING" ? "-" : ticket.code}
                    </div>
                    
                    {ticket.status === "PENDING" ? (
                      <div className="w-full border-4 border-dashed border-brand-black/10 py-6 px-2 text-center mt-3 bg-brand-bg">
                        <span className="text-[10px] font-black uppercase text-brand-black/40 tracking-wider">
                          🔒 LOCKED
                        </span>
                      </div>
                    ) : ticket.status !== "REJECTED" && ticket.orderNumber ? (
                      <div className="flex flex-col items-center w-full mt-2">
                        <p className="text-[9px] font-bold text-brand-black/40 uppercase tracking-widest leading-none mb-1">
                          QR CODE (SCAN ME)
                        </p>
                        <div className="border-4 border-brand-black bg-white p-2 mb-3 shadow-[4px_4px_0px_0px_#1b1b1b] relative aspect-square w-32 h-32 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(ticket.code)}`}
                            alt="Ticket QR Code"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        
                        <p className="text-[9px] font-bold text-brand-black/40 uppercase tracking-widest leading-none mb-1">
                          ORDER NUMBER
                        </p>
                        <div className="border-2 border-brand-black bg-brand-bg/50 px-2 py-1 font-black text-xs tracking-wider uppercase truncate max-w-full w-full">
                          {ticket.orderNumber}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full mt-2">
                        <p className="text-[9px] font-bold text-brand-black/40 uppercase tracking-widest leading-none mb-2">
                          BARCODE
                        </p>
                        <Barcode />
                      </div>
                    )}
                  </div>

                  {ticket.status === "PENDING" ? (
                    <button
                      disabled
                      className="bg-[#dadada] border-3 border-brand-black/30 text-brand-black/40 w-full py-2.5 text-xs font-black tracking-wider flex items-center justify-center gap-2 mt-6 cursor-not-allowed uppercase"
                    >
                      ⏳ AWAITING VERIFY
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDownload(ticket)}
                      className="btn-brutalist-blue w-full py-2.5 text-xs font-black tracking-wider flex items-center justify-center gap-2 mt-6 cursor-pointer"
                    >
                      📥 DOWNLOAD
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Used & Rejected Tickets Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-black uppercase tracking-wider border-b-2 border-brand-black pb-2 mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
          <span>PAST & EXPIRED TICKETS</span>
          <span className="text-[10px] text-brand-black/60 font-bold tracking-normal italic normal-case">
            * Tiket yang tidak digunakan akan hilang dalam 10 hari dari waktu event
          </span>
        </h2>

        {pastTickets.length === 0 ? (
          <div className="bg-white border-4 border-brand-black p-8 text-center font-black uppercase text-xs shadow-brutalist-sm">
            📭 No past tickets found in your history.
          </div>
        ) : (
          <div className="space-y-6">
            {pastTickets.map((ticket) => (
              <div key={ticket.id} className="border-4 border-brand-black bg-white shadow-brutalist-md flex flex-col md:flex-row overflow-hidden opacity-75 relative">
                
                {/* Left Info Area */}
                <div className="flex-1 p-6 border-b-4 md:border-b-0 md:border-r-4 border-dashed border-brand-black flex flex-col justify-between md:flex-row gap-6">
                  <div className="flex-1 flex flex-col justify-between text-left">
                    <div>
                      <div className="flex gap-2 mb-4">
                        <span className="bg-[#f9f9f9] border-2 border-brand-black text-[10px] font-black uppercase tracking-wider px-2.5 py-1">
                          {ticket.category}
                        </span>
                        <span className={`border-2 border-brand-black text-[10px] font-black uppercase tracking-wider px-2.5 py-1
                          ${ticket.status === "REJECTED" ? "bg-brand-black text-white" : "bg-red-600 text-white"}`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      
                      <h3 className="text-3xl font-black uppercase tracking-tight leading-none mb-2 break-words">
                        {ticket.event}
                      </h3>
                      <p className="text-xs font-bold text-brand-black/60 uppercase tracking-wide">
                        {ticket.stage} \ {ticket.dateTime}
                      </p>
                    </div>

                    <div className="border-t-2 border-brand-black/10 pt-4 mt-6">
                      <p className="text-[10px] font-bold text-brand-black/40 uppercase leading-none mb-1">
                        VENUE
                      </p>
                      <p className="text-xs font-black uppercase leading-tight">
                        {ticket.venue}
                      </p>
                      <p className="text-[10px] font-bold text-brand-black/60 uppercase mt-0.5">
                        {ticket.sector}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Stub Area */}
                <div className="w-full md:w-56 p-6 bg-[#f0f0f0] flex flex-col justify-between items-center text-center relative overflow-hidden">
                  
                  {/* Scanned Slanted Stamp overlay */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 border-4 border-brand-black text-white font-black text-lg tracking-widest uppercase px-6 py-2 rotate-[-12deg] shadow-brutalist-sm z-10 animate-pulse select-none pointer-events-none">
                    {ticket.status}
                  </div>

                  <div className="w-full opacity-30 select-none">
                    <p className="text-[9px] font-bold text-brand-black/40 uppercase tracking-widest leading-none mb-1">
                      TICKET CODE / ORDER ID
                    </p>
                    <div className="border-2 border-brand-black bg-brand-bg/50 px-2 py-1 font-black text-sm tracking-wider uppercase mb-4 line-through truncate max-w-full">
                      {ticket.code}
                    </div>
                    
                    <Barcode />
                  </div>

                  <div className="w-full flex flex-col gap-2 mt-6 z-20">
                    <button
                      disabled
                      className="bg-[#dadada] border-3 border-brand-black/30 text-brand-black/40 w-full py-2 text-xs font-black tracking-wider flex items-center justify-center gap-2 cursor-not-allowed uppercase"
                    >
                      🚫 UNAVAILABLE
                    </button>
                    <button
                      onClick={() => setDeleteTicketId(ticket.id)}
                      className="bg-red-500 hover:bg-red-600 text-white border-3 border-brand-black w-full py-2 text-xs font-black tracking-wider flex items-center justify-center gap-2 shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                    >
                      🗑️ DELETE
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTicketId && (
        <div className="fixed inset-0 bg-brand-black/85 z-[999] flex items-center justify-center p-4 font-sans">
          <div className="bg-white border-4 border-brand-black shadow-[8px_8px_0px_0px_#1b1b1b] max-w-md w-full p-6 md:p-8 space-y-6 text-left relative">
            
            {/* Close Button */}
            <button
              onClick={() => setDeleteTicketId(null)}
              className="absolute top-4 right-4 bg-white text-brand-black border-2 border-brand-black w-8 h-8 flex items-center justify-center font-black text-sm hover:bg-brand-black hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-xl font-black uppercase tracking-tight text-brand-black pb-2 border-b-3 border-brand-black flex items-center gap-2">
              🗑️ HAPUS DARI RIWAYAT
            </h2>

            <div className="space-y-4">
              <p className="text-sm font-bold uppercase text-brand-black">
                Apakah Anda yakin ingin menghapus tiket ini dari riwayat Anda?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4 border-t-3 border-brand-black">
              <button
                onClick={handleDeleteConfirm}
                className="bg-red-600 text-white border-3 border-brand-black py-3 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
              >
                🗑️ Ya, hapus dari riwayat
              </button>
              <button
                type="button"
                onClick={() => setDeleteTicketId(null)}
                className="bg-white text-brand-black border-3 border-brand-black py-3 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brutalist-md transition-all cursor-pointer text-center"
              >
                Batal
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
