"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

interface PaymentOrder {
  id: string; // Order Number formatted
  dbId: string; // Real DB UUID
  buyer: string;
  event: string;
  amount: string;
  status: "PENDING" | "FLAGGED" | "APPROVED" | "REJECTED" | "PAID";
  dateUploaded: string;
  receiptSrc: string;
}

export default function PaymentConfirmations() {
  const supabase = createClient();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filtering and pagination state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          total_amount,
          status,
          payment_method,
          receipt_url,
          receipt_uploaded_at,
          created_at,
          profiles:buyer_id (full_name, email),
          events:event_id (title)
        `)
        .order("created_at", { ascending: false }); // Sorts by newest first automatically

      if (error) throw error;

      const formatted = (data || []).map((o: any) => ({
        id: o.order_number || `#ORD-${o.id.substring(0, 5).toUpperCase()}`,
        dbId: o.id,
        buyer: o.profiles?.full_name || o.profiles?.email || "Unknown Buyer",
        event: o.events?.title || "Unknown Event",
        amount: new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(o.total_amount),
        status: o.status as "PENDING" | "FLAGGED" | "APPROVED" | "REJECTED" | "PAID",
        dateUploaded: new Date(o.receipt_uploaded_at || o.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        receiptSrc: o.receipt_url || "/receipt-proof.png",
      }));

      setOrders(formatted);
      if (formatted.length > 0) {
        setSelectedOrderId(formatted[0].id);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || orders[0];

  const updateOrderStatus = async (id: string, newStatus: "APPROVED" | "REJECTED") => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", order.dbId);

      if (error) throw error;

      // If rejected, also cancel all associated tickets
      if (newStatus === "REJECTED") {
        await supabase
          .from("tickets")
          .update({ status: "CANCELLED" })
          .eq("order_id", order.dbId);
      }

      // Update state locally
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      alert(`ORDER STATUS UPDATED: Set status of ${id} to ${newStatus}`);
    } catch (err: any) {
      console.error("Error updating order status:", err);
      alert(`FAILED TO UPDATE STATUS: ${err.message}`);
    }
  };

  // Filter orders by search query and active status tab
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.buyer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "PENDING") {
      matchesStatus = o.status === "PENDING" || o.status === "FLAGGED";
    } else if (statusFilter === "APPROVED") {
      matchesStatus = o.status === "APPROVED" || o.status === "PAID";
    } else if (statusFilter === "REJECTED") {
      matchesStatus = o.status === "REJECTED";
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate paginated slice
  const totalPages = Math.ceil(filteredOrders.length / 10);
  
  useEffect(() => {
    // Reset page index if active filters shrink total pages below current index
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [filteredOrders.length, totalPages, currentPage]);

  const paginatedOrders = filteredOrders.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <div className="p-6 md:p-12 w-full text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">
            PAYMENT CONFIRMATIONS
          </h1>
          <p className="text-xs md:text-sm font-bold text-brand-black/60">
            Review and approve manual ticket payments.
          </p>
        </div>
        
        {/* Search */}
        <div className="relative flex items-center w-full md:w-80">
          <span className="absolute left-4 text-brand-black/60">🔍</span>
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full py-3.5 pl-11 pr-4 text-xs font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 bg-white focus:bg-brand-bg focus:border-brand-blue"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-3 mb-8">
        {[
          { key: "ALL", label: "📂 ALL CONFIRMATIONS" },
          { key: "PENDING", label: "⏳ PENDING VERIFICATION" },
          { key: "APPROVED", label: "✅ APPROVED PAYMENTS" },
          { key: "REJECTED", label: "❌ REJECTED" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatusFilter(tab.key);
              setCurrentPage(1);
            }}
            className={`border-3 border-brand-black px-4 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer
              ${statusFilter === tab.key ? "bg-brand-yellow text-brand-black" : "bg-white text-brand-black"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left: Orders Table */}
        <div className="xl:col-span-8 space-y-6">
          <div className="card-brutalist overflow-hidden shadow-[6px_6px_0px_0px_#1b1b1b]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-4 border-brand-black bg-brand-bg font-black text-[10px] uppercase tracking-widest">
                  <th className="p-4">ORDER ID</th>
                  <th className="p-4">BUYER</th>
                  <th className="p-4">EVENT</th>
                  <th className="p-4">AMOUNT</th>
                  <th className="p-4 text-center">STATUS</th>
                  <th className="p-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-brand-black/10 font-bold text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center uppercase font-black text-brand-black/40">
                      Loading payment records...
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center uppercase font-black text-brand-black/40">
                      No matching confirmations found
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-brand-bg/50 cursor-pointer transition-colors
                        ${selectedOrderId === order.id ? "bg-brand-yellow/10" : ""}`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <td className="p-4 font-black">{order.id}</td>
                      <td className="p-4">{order.buyer}</td>
                      <td className="p-4 text-brand-black/80">{order.event}</td>
                      <td className="p-4 font-black">{order.amount}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-block border-2 border-brand-black px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b]
                          ${(order.status === "APPROVED" || order.status === "PAID") && "bg-[#dbe1ff] text-brand-blue"}
                          ${order.status === "PENDING" && "bg-brand-yellow text-brand-black"}
                          ${order.status === "FLAGGED" && "bg-red-600 text-white"}
                          ${order.status === "REJECTED" && "bg-brand-black text-white"}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {order.status === "APPROVED" || order.status === "PAID" || order.status === "REJECTED" ? (
                          <span className="text-brand-black/40 text-xs">Complete</span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderId(order.id);
                            }}
                            className="text-brand-blue underline font-black hover:text-brand-black transition-colors"
                          >
                            Review Proof
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-brand-black/60">
              SHOWING {filteredOrders.length > 0 ? (currentPage - 1) * 10 + 1 : 0}-
              {Math.min(currentPage * 10, filteredOrders.length)} OF {filteredOrders.length} MATCHING (TOTAL: {orders.length})
            </span>
            <div className="flex gap-3">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-white text-brand-black border-3 border-brand-black px-4 py-2 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer disabled:opacity-40"
              >
                ◀ PREV
              </button>
              <span className="flex items-center text-xs font-black uppercase bg-brand-yellow border-3 border-brand-black px-3.5 py-1 shadow-brutalist-sm select-none">
                PAGE {currentPage} / {totalPages || 1}
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="bg-white text-brand-black border-3 border-brand-black px-4 py-2 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer disabled:opacity-40"
              >
                NEXT ▶
              </button>
              <button 
                onClick={fetchOrders}
                disabled={loading}
                className="bg-brand-black text-white border-3 border-brand-black px-4 py-2 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer disabled:opacity-55"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Right: Proof Review Card Panel */}
        <div className="xl:col-span-4">
          {selectedOrder ? (
            <div className="card-brutalist p-6 shadow-[6px_6px_0px_0px_#1b1b1b] space-y-6">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-1 border-b-2 border-brand-black pb-2">
                  PROOF REVIEW
                </h3>
                <p className="text-[10px] font-black uppercase tracking-wider text-brand-black/55 mt-3">
                  SELECTED ORDER
                </p>
                <p className="text-sm font-black uppercase tracking-tight mt-1">
                  {selectedOrder.id} - {selectedOrder.buyer}
                </p>
              </div>

              <div className="space-y-2 border-l-4 border-brand-blue pl-4 text-xs font-bold leading-relaxed">
                <p>
                  Amount Claimed: <span className="font-black text-brand-blue">{selectedOrder.amount}</span>
                </p>
                <p>
                  Date Uploaded: <span className="font-black">{selectedOrder.dateUploaded}</span>
                </p>
              </div>

              {/* Proof Image Wrapper */}
              <div className="relative border-4 border-brand-black aspect-[4/5] w-full overflow-hidden bg-brand-bg shadow-brutalist-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedOrder.receiptSrc.startsWith("http") || selectedOrder.receiptSrc.startsWith("/") || selectedOrder.receiptSrc.startsWith("data:")
                    ? selectedOrder.receiptSrc 
                    : "/receipt-proof.png"}
                  alt="Payment proof invoice"
                  className="object-contain w-full h-full"
                />
              </div>

              {/* Approve / Reject Controls */}
              {selectedOrder.status !== "APPROVED" && selectedOrder.status !== "PAID" && selectedOrder.status !== "REJECTED" ? (
                <div className="space-y-4">
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, "APPROVED")}
                    className="btn-brutalist-blue w-full py-4 text-xs tracking-wider font-black flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                    APPROVE PAYMENT
                  </button>
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, "REJECTED")}
                    className="bg-red-600 text-white border-4 border-brand-black w-full py-4 text-xs tracking-wider font-black flex items-center justify-center gap-2 shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    REJECT & NOTIFY
                  </button>
                </div>
              ) : (
                <div className="bg-brand-bg border-3 border-brand-black p-4 text-center font-black uppercase text-xs">
                  ✅ PAYMENT STATUS RESOLVED ({selectedOrder.status})
                </div>
              )}
            </div>
          ) : (
            <div className="card-brutalist p-6 text-center font-black uppercase text-xs">
              No order selected
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
