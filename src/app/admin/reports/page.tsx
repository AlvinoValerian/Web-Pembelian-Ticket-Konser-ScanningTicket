"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function SystemReports() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<"7D" | "30D">("7D");
  const [metrics, setMetrics] = useState({
    totalVisitors: 0,
    grossRevenue: 0,
    totalTickets: 0,
    checkedInTickets: 0,
  });
  const [genreRevenue, setGenreRevenue] = useState<{ name: string; amount: number; percentage: number }[]>([]);
  const [trafficData, setTrafficData] = useState<{
    "7D": { day: string; height: string; active: boolean; revenue: number }[];
    "30D": { day: string; height: string; active: boolean; revenue: number }[];
  }>({
    "7D": [],
    "30D": [],
  });
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ monthYear: string; amount: number }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch orders with relations
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          status,
          quantity,
          buyer_id,
          event_id,
          created_at,
          events:event_id (genre)
        `);

      if (ordersError) throw ordersError;

      // 2. Fetch tickets status
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, status");

      const safeOrders = orders || [];
      const safeTickets = tickets || [];

      const paidOrders = safeOrders.filter(o => o.status === "APPROVED" || o.status === "PAID");
      
      // Calculate metrics
      const totalVisitors = new Set(safeOrders.map(o => o.buyer_id)).size;
      const grossRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const totalTickets = paidOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
      const checkedInTickets = safeTickets.filter(t => t.status === "USED").length;

      setMetrics({
        totalVisitors,
        grossRevenue,
        totalTickets,
        checkedInTickets,
      });

      // Calculate genre breakdown
      const genres: Record<string, number> = {};
      paidOrders.forEach(o => {
        const genre = (o.events as any)?.genre || "Other";
        genres[genre] = (genres[genre] || 0) + (Number(o.total_amount) || 0);
      });
      const totalGenreAmount = Object.values(genres).reduce((sum, val) => sum + val, 0) || 1;
      const genreBreakdown = Object.entries(genres).map(([name, amount]) => ({
        name: name.toUpperCase(),
        amount,
        percentage: Math.round((amount / totalGenreAmount) * 100),
      })).sort((a, b) => b.amount - a.amount);
      setGenreRevenue(genreBreakdown);

      // Calculate monthly revenue breakdown
      const monthlyData: Record<string, number> = {};
      paidOrders.forEach(o => {
        const date = new Date(o.created_at);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData[key] = (monthlyData[key] || 0) + (Number(o.total_amount) || 0);
      });

      const monthlyList = Object.entries(monthlyData).map(([monthYear, amount]) => ({
        monthYear,
        amount
      })).sort((a, b) => {
        const dateA = new Date(a.monthYear);
        const dateB = new Date(b.monthYear);
        return dateB.getTime() - dateA.getTime();
      });
      setMonthlyRevenue(monthlyList);

      // Calculate traffic data
      // For 7D: group by day of week for the last 7 days
      const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          dateStr: d.toDateString(),
          dayName: daysOfWeek[d.getDay()],
          revenue: 0,
        };
      });

      safeOrders.forEach(o => {
        const oDate = new Date(o.created_at).toDateString();
        const found = last7Days.find(day => day.dateStr === oDate);
        if (found) {
          found.revenue += Number(o.total_amount) || 0;
        }
      });

      const max7DRevenue = Math.max(...last7Days.map(d => d.revenue)) || 1;
      const traffic7D = last7Days.map(d => ({
        day: d.dayName,
        height: `${Math.max(10, Math.round((d.revenue / max7DRevenue) * 100))}%`,
        active: d.revenue === max7DRevenue,
        revenue: d.revenue,
      }));

      // For 30D: split last 30 days into 4 weeks
      const last4Weeks = [
        { label: "WEEK 1", startDaysAgo: 30, endDaysAgo: 23, revenue: 0 },
        { label: "WEEK 2", startDaysAgo: 22, endDaysAgo: 15, revenue: 0 },
        { label: "WEEK 3", startDaysAgo: 14, endDaysAgo: 8, revenue: 0 },
        { label: "WEEK 4", startDaysAgo: 7, endDaysAgo: 0, revenue: 0 },
      ];

      const now = new Date();
      safeOrders.forEach(o => {
        const oDate = new Date(o.created_at);
        const diffTime = Math.abs(now.getTime() - oDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const foundWeek = last4Weeks.find(w => diffDays >= w.endDaysAgo && diffDays <= w.startDaysAgo);
        if (foundWeek) {
          foundWeek.revenue += Number(o.total_amount) || 0;
        }
      });

      const max30DRevenue = Math.max(...last4Weeks.map(w => w.revenue)) || 1;
      const traffic30D = last4Weeks.map(w => ({
        day: w.label,
        height: `${Math.max(10, Math.round((w.revenue / max30DRevenue) * 100))}%`,
        active: w.revenue === max30DRevenue,
        revenue: w.revenue,
      }));

      setTrafficData({
        "7D": traffic7D,
        "30D": traffic30D,
      });

    } catch (err) {
      console.error("Error fetching reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatIDR = (num: number) => {
    if (num >= 1_000_000_000) {
      return `Rp ${(num / 1_000_000_000).toFixed(1)}B`;
    }
    if (num >= 1_000_000) {
      return `Rp ${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `Rp ${(num / 1_000).toFixed(0)}K`;
    }
    return `Rp ${num}`;
  };

  const currentTraffic = trafficData[activeRange] || [];
  
  // Compute capacities check-in indicators
  const checkInRate = metrics.totalTickets > 0 
    ? Math.round((metrics.checkedInTickets / metrics.totalTickets) * 100)
    : 0;

  return (
    <div className="p-6 md:p-12 w-full text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">
            REPORTS
          </h1>
          <p className="text-xs md:text-sm font-bold text-brand-black/60">
            Live metrics and event performance data.
          </p>
        </div>
        <button 
          onClick={() => window.print()}
          className="bg-brand-yellow border-3 border-brand-black px-6 py-3 font-black text-xs uppercase tracking-wider shadow-brutalist-md hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-lg transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none cursor-pointer"
        >
          PRINT REPORT
        </button>
      </div>

      {/* Row 1: Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        
        {/* Card 1: Total Visitors */}
        <div className="card-brutalist p-6 shadow-brutalist-md flex flex-col justify-between h-44">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/55">
              TOTAL BUYERS
            </span>
            <span className="bg-brand-blue/20 border-2 border-brand-black w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">
              👤
            </span>
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tight leading-none mb-2">
              {loading ? "--" : metrics.totalVisitors}
            </h2>
            <p className="text-[10px] font-black text-brand-blue uppercase tracking-wide">
              👥 UNIQUE CUSTOMERS IN DATABASE
            </p>
          </div>
        </div>

        {/* Card 2: Gross Revenue */}
        <div className="bg-brand-yellow border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between h-44">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/60">
              GROSS REVENUE
            </span>
            <span className="bg-white border-2 border-brand-black w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">
              $
            </span>
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight leading-none mb-2 uppercase">
              {loading ? "Rp --" : formatIDR(metrics.grossRevenue)}
            </h2>
            <p className="text-[10px] font-black text-brand-black/70 uppercase tracking-wide">
              📈 PERSISTED APPROVED PAYMENTS
            </p>
          </div>
        </div>

        {/* Card 3: Check-in Status */}
        <div className="card-brutalist p-6 shadow-brutalist-md flex flex-col justify-between h-44">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/55">
              CHECK-IN STATUS
            </span>
            <span className="bg-brand-bg border-2 border-brand-black px-2 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_#1b1b1b]">
              LIVE STATS
            </span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-xs font-black uppercase tracking-wider">
              <span>{loading ? "--" : metrics.checkedInTickets} <span className="text-brand-black/60 font-bold">In Venue</span></span>
              <span>{loading ? "--" : (metrics.totalTickets - metrics.checkedInTickets)} <span className="text-brand-black/60 font-bold">Remaining</span></span>
            </div>
            
            {/* Custom progress bar */}
            <div className="w-full border-3 border-brand-black h-8 bg-[repeating-linear-gradient(45deg,#dadada,#dadada_10px,#eeeeee_10px,#eeeeee_20px)] overflow-hidden relative">
              <div 
                className="bg-brand-blue h-full border-r-3 border-brand-black flex items-center justify-center text-[9px] font-black text-white tracking-widest transition-all duration-500" 
                style={{ width: `${Math.max(15, checkInRate)}%` }}
              >
                {checkInRate}% REACHED
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Revenue Breakdown */}
        <div className="lg:col-span-5 card-brutalist p-6 shadow-[6px_6px_0px_0px_#1b1b1b] flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider mb-6 border-b-2 border-brand-black pb-2">
              REVENUE BY GENRE
            </h3>
            
            <div className="space-y-6">
              {loading ? (
                <p className="text-xs font-bold text-brand-black/40 uppercase">Loading breakdown...</p>
              ) : genreRevenue.length === 0 ? (
                <p className="text-xs font-bold text-brand-black/40 uppercase">No approved order revenue</p>
              ) : (
                genreRevenue.map((genre, idx) => (
                  <div key={genre.name}>
                    <div className="flex justify-between font-black text-xs uppercase tracking-wider mb-1.5">
                      <span className="flex items-center gap-2">
                        <span className={`inline-block w-3.5 h-3.5 border-2 border-brand-black ${
                          idx === 0 ? "bg-brand-blue" : idx === 1 ? "bg-brand-yellow" : "bg-brand-black/40"
                        }`}></span>
                        {genre.name}
                      </span>
                      <span>{formatIDR(genre.amount)}</span>
                    </div>
                    <div className="w-full border-3 border-brand-black h-4 bg-brand-bg overflow-hidden">
                      <div 
                        className={`h-full border-r-2 border-brand-black ${
                          idx === 0 ? "bg-brand-blue" : idx === 1 ? "bg-brand-yellow" : "bg-brand-black/40"
                        }`} 
                        style={{ width: `${genre.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Traffic Chart */}
        <div className="lg:col-span-7 card-brutalist p-6 shadow-[6px_6px_0px_0px_#1b1b1b] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-8 border-b-2 border-brand-black pb-2">
            <h3 className="text-lg font-black uppercase tracking-wider">
              REVENUE TRAFFIC
            </h3>
            
            {/* Range Toggles */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveRange("7D")}
                className={`px-3 py-1 font-black text-[10px] border-2 border-brand-black shadow-[2px_2px_0px_0px_#1b1b1b] transition-all cursor-pointer
                  ${activeRange === "7D" ? "bg-brand-black text-white" : "bg-white text-brand-black hover:bg-brand-bg"}`}
              >
                7D
              </button>
              <button
                onClick={() => setActiveRange("30D")}
                className={`px-3 py-1 font-black text-[10px] border-2 border-brand-black shadow-[2px_2px_0px_0px_#1b1b1b] transition-all cursor-pointer
                  ${activeRange === "30D" ? "bg-brand-black text-white" : "bg-white text-brand-black hover:bg-brand-bg"}`}
              >
                30D
              </button>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-64 flex items-end justify-between px-2 pt-6 border-b-3 border-brand-black gap-2 select-none">
            {loading ? (
              <span className="w-full text-center uppercase font-black text-brand-black/40 pb-20">
                Loading graph...
              </span>
            ) : currentTraffic.length === 0 ? (
              <span className="w-full text-center uppercase font-black text-brand-black/40 pb-20">
                No traffic data
              </span>
            ) : (
              currentTraffic.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center h-full justify-end" title={formatIDR(item.revenue)}>
                  {/* Bar */}
                  <div
                    className={`w-full border-t-3 border-l-3 border-r-3 border-brand-black shadow-[3px_3px_0px_0px_#1b1b1b] transition-all duration-300
                      ${item.active 
                        ? "bg-brand-yellow" 
                        : activeRange === "30D"
                        ? "bg-[#dbe1ff]"
                        : "bg-brand-blue/20"
                      }`}
                    style={{ height: item.height }}
                  ></div>
                  {/* Day label */}
                  <span className={`text-[9px] font-black uppercase mt-3 tracking-wider text-center truncate w-full
                    ${item.active ? "font-extrabold text-brand-black" : "text-brand-black/60"}`}
                  >
                    {item.day}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Monthly Revenue Breakdown */}
      <div className="grid grid-cols-1 gap-8 mt-12">
        <div className="card-brutalist p-6 shadow-[6px_6px_0px_0px_#1b1b1b]">
          <h3 className="text-lg font-black uppercase tracking-wider mb-6 border-b-2 border-brand-black pb-2">
            📅 MONTHLY REVENUE BREAKDOWN
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-4 border-brand-black bg-brand-bg font-black text-[10px] uppercase tracking-widest">
                  <th className="p-4">MONTH / YEAR</th>
                  <th className="p-4 text-right">TOTAL REVENUE</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-brand-black/10 font-bold text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={2} className="p-8 text-center uppercase font-black text-brand-black/40">
                      Loading monthly data...
                    </td>
                  </tr>
                ) : monthlyRevenue.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-8 text-center uppercase font-black text-brand-black/40">
                      No monthly revenue records found
                    </td>
                  </tr>
                ) : (
                  monthlyRevenue.map((item) => (
                    <tr key={item.monthYear} className="hover:bg-brand-bg/50">
                      <td className="p-4 font-black">{item.monthYear.toUpperCase()}</td>
                      <td className="p-4 text-right text-brand-blue font-black">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        }).format(item.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
