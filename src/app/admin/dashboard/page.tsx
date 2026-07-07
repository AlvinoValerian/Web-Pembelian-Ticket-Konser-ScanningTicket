"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AdminDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");
  const [activeRange, setActiveRange] = useState<"7D" | "30D">("7D");

  // Overview Stats State
  const [stats, setStats] = useState({
    totalRevenue: 0,
    ticketsSold: 0,
    activeEventsCount: 0,
    pendingPayoutsCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [tonightCapacity, setTonightCapacity] = useState<any[]>([]);

  // Reports Specific State
  const [reportMetrics, setReportMetrics] = useState({
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
      // 1. Fetch orders with event details
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          total_amount,
          status,
          quantity,
          buyer_id,
          event_id,
          created_at,
          profiles:buyer_id (full_name),
          events:event_id (title, genre)
        `)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // 2. Fetch events
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("*");

      if (eventsError) throw eventsError;

      // 3. Fetch ticket tiers (for capacities)
      const { data: tiers } = await supabase
        .from("ticket_tiers")
        .select("*");

      // 4. Fetch tickets (for report check-in numbers)
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, status");

      const safeOrders = orders || [];
      const safeEvents = (events || []).filter((e: any) => !e.title.startsWith("[DELETED]") && e.status !== "ARCHIVED");
      const safeTiers = tiers || [];
      const safeTickets = tickets || [];

      // Run auto soft-delete of expired events (> 2 days past event date_time)
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const expiredEvents = safeEvents.filter(e => new Date(e.date_time) < new Date(twoDaysAgo));

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

      // Calculate stats
      const paidOrders = safeOrders.filter(o => o.status === "APPROVED" || o.status === "PAID");
      const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const ticketsSold = paidOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
      
      const activeEvents = safeEvents.filter(e => e.status === "ACTIVE");
      const activeEventsCount = activeEvents.length || safeEvents.length;
      const pendingPayoutsCount = safeOrders.filter(o => o.status === "PENDING").length;

      setStats({
        totalRevenue,
        ticketsSold,
        activeEventsCount,
        pendingPayoutsCount,
      });

      // Format recent orders for view feed
      const formattedRecent = safeOrders.slice(0, 10).map(o => ({
        id: o.order_number || `#ORD-${o.id.substring(0, 5).toUpperCase()}`,
        customer: (o.profiles as any)?.full_name || "Unknown Guest",
        event: (o.events as any)?.title || "Unknown Gig",
        amount: new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(o.total_amount),
        status: o.status || "PENDING",
      }));
      setRecentOrders(formattedRecent);

      // Tonight's capacity based on active events
      const capacityList = safeEvents.slice(0, 3).map(event => {
        const eventOrders = safeOrders.filter(o => o.event_id === event.id && (o.status === "APPROVED" || o.status === "PAID"));
        const sold = eventOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
        
        const eventTiers = safeTiers.filter(t => t.event_id === event.id);
        const capacity = eventTiers.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0) || 300;
        
        const percentage = Math.min(Math.round((sold / capacity) * 100), 100);
        return {
          name: event.title,
          percentage,
        };
      });
      setTonightCapacity(capacityList);

      // Calculate Reports Metrics
      const totalVisitors = new Set(safeOrders.map(o => o.buyer_id)).size;
      const checkedInTickets = safeTickets.filter(t => t.status === "USED").length;

      setReportMetrics({
        totalVisitors,
        grossRevenue: totalRevenue,
        totalTickets: ticketsSold,
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

      // Calculate traffic data (7D)
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

      // Calculate traffic data (30D)
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
      console.error("Error loading admin dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatIDRFull = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatIDRShort = (num: number) => {
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
  const checkInRate = reportMetrics.totalTickets > 0 
    ? Math.round((reportMetrics.checkedInTickets / reportMetrics.totalTickets) * 100)
    : 0;

  return (
    <div className="p-6 md:p-12 w-full text-left font-sans select-none">
      
      {/* Tab Navigation & Title */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 border-b-4 border-brand-black pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mb-2">
            {activeTab === "overview" ? "SYSTEM OVERVIEW" : "REPORTS"}
          </h1>
          <p className="text-xs md:text-sm font-bold text-brand-black/60 uppercase">
            {activeTab === "overview" 
              ? "Real-time system operations feed & active event capacities." 
              : "Live statistics, revenue growth metrics, and charts."}
          </p>
        </div>

        {/* Action Toggles & Refresh */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Tab buttons */}
          <div className="flex border-3 border-brand-black bg-white shadow-brutalist-sm rounded-sm overflow-hidden h-11">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 h-full font-black text-xs uppercase tracking-wider transition-colors cursor-pointer
                ${activeTab === "overview" ? "bg-brand-yellow text-brand-black" : "bg-white text-brand-black hover:bg-brand-bg"}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 h-full font-black text-xs border-l-3 border-brand-black uppercase tracking-wider transition-colors cursor-pointer
                ${activeTab === "reports" ? "bg-brand-yellow text-brand-black" : "bg-white text-brand-black hover:bg-brand-bg"}`}
            >
              Reports
            </button>
          </div>

          {/* Sync Button */}
          <button 
            onClick={fetchData}
            disabled={loading}
            className="bg-white border-3 border-brand-black h-11 px-4 py-2 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-55"
          >
            🔄 {loading ? "SYNCING..." : "SYNC"}
          </button>

          {/* Print button (only for Reports Tab) */}
          {activeTab === "reports" && (
            <button 
              onClick={() => window.print()}
              className="bg-brand-blue text-white border-3 border-brand-black h-11 px-4 py-2 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer"
            >
              📥 PRINT REPORT
            </button>
          )}
        </div>
      </div>

      {/* Overview tab content */}
      {activeTab === "overview" && (
        <div className="space-y-12">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
            {/* Card 1: Total Revenue */}
            <div className="bg-brand-blue text-white border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between h-44 lg:col-span-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                  TOTAL REVENUE
                </span>
                <h2 className="text-2xl md:text-3xl font-black mt-2 leading-none">
                  {loading ? "Rp --" : formatIDRFull(stats.totalRevenue)}
                </h2>
              </div>
              <div className="bg-brand-black/20 border border-white/20 p-2 text-xs font-black uppercase tracking-wider text-center">
                📈 LIVE REVENUE METRICS
              </div>
            </div>

            {/* Card 2: Tickets Sold */}
            <div className="bg-brand-yellow text-brand-black border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between h-44 lg:col-span-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/60">
                  TICKETS SOLD
                </span>
                <h2 className="text-3xl font-black mt-2 leading-none">
                  {loading ? "--" : stats.ticketsSold.toLocaleString()}
                </h2>
              </div>
              <div className="bg-brand-black text-brand-yellow p-1.5 text-[9px] font-black uppercase tracking-wider text-center">
                🎫 ACTIVE GUESTS
              </div>
            </div>

            {/* Card 3: Active Events */}
            <div className="bg-white text-brand-black border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between h-44 lg:col-span-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/60">
                    ACTIVE EVENTS
                  </span>
                  <h2 className="text-3xl font-black mt-2 leading-none">
                    {loading ? "--" : stats.activeEventsCount}
                  </h2>
                </div>
                <span className="text-xl">📅</span>
              </div>
              <div className="bg-brand-bg border-2 border-brand-black/10 p-1.5 text-[9px] font-black uppercase tracking-wider text-center text-brand-black/80">
                ⏳ LIVE GIGS
              </div>
            </div>

            {/* Card 4: Pending Payouts */}
            <div className="bg-[#fee2e2] text-brand-black border-4 border-brand-black p-6 shadow-brutalist-md flex flex-col justify-between h-44 lg:col-span-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/60">
                    PENDING
                  </span>
                  <h2 className="text-3xl font-black mt-2 leading-none">
                    {loading ? "--" : stats.pendingPayoutsCount}
                  </h2>
                </div>
                <span className="text-xl text-red-600">🚨</span>
              </div>
              <div className="bg-red-600 text-white p-1.5 text-[9px] font-black uppercase tracking-wider text-center">
                {stats.pendingPayoutsCount > 0 ? "⚠️ ACTION" : "✅ VERIFIED"}
              </div>
            </div>
          </div>

          {/* Main Grid: Orders Feed & Capacity Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Live Order Feed */}
            <div className="lg:col-span-8 card-brutalist overflow-hidden shadow-[6px_6px_0px_0px_#1b1b1b]">
              <div className="bg-brand-yellow border-b-4 border-brand-black p-4 flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-wider">
                  LIVE ORDER FEED
                </h3>
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-700"></span>
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-4 border-brand-black bg-brand-bg font-black text-[10px] uppercase tracking-widest">
                      <th className="p-4">ORDER ID</th>
                      <th className="p-4">CUSTOMER</th>
                      <th className="p-4">EVENT</th>
                      <th className="p-4">AMOUNT</th>
                      <th className="p-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-brand-black/10 font-bold text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center uppercase font-black text-brand-black/40">
                          Loading orders feed...
                        </td>
                      </tr>
                    ) : recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center uppercase font-black text-brand-black/40">
                          No orders found in database
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-brand-bg/50">
                          <td className="p-4 font-black">{order.id}</td>
                          <td className="p-4">{order.customer}</td>
                          <td className="p-4 text-brand-black/80">{order.event}</td>
                          <td className="p-4 font-black">{order.amount}</td>
                          <td className="p-4">
                            <span className={`inline-block border-2 border-brand-black px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b]
                              ${order.status === "APPROVED" || order.status === "PAID"
                                ? "bg-brand-blue text-white" 
                                : order.status === "REJECTED"
                                ? "bg-brand-black text-white"
                                : "bg-brand-yellow text-brand-black"
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Tonight's Capacity & Advertising */}
            <div className="lg:col-span-4 space-y-8">
              {/* Capacity gauge */}
              <div className="card-brutalist p-6 shadow-[6px_6px_0px_0px_#1b1b1b]">
                <h3 className="text-base font-black uppercase tracking-wider mb-6 border-b-2 border-brand-black pb-2">
                  EVENT CAPACITY
                </h3>
                <div className="space-y-6">
                  {loading ? (
                    <p className="text-xs font-bold text-brand-black/40 uppercase">Loading capacities...</p>
                  ) : tonightCapacity.length === 0 ? (
                    <p className="text-xs font-bold text-brand-black/40 uppercase">No events configured</p>
                  ) : (
                    tonightCapacity.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between font-black text-xs uppercase tracking-wider mb-2">
                          <span className="truncate max-w-[80%] inline-block">{item.name}</span>
                          <span className="text-brand-blue">{item.percentage}%</span>
                        </div>
                        <div className="w-full border-3 border-brand-black h-6 bg-brand-bg overflow-hidden relative">
                          <div 
                            className={`h-full border-r-3 border-brand-black ${
                              idx % 2 === 0 ? "bg-brand-blue" : "bg-brand-yellow"
                            }`} 
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ad Banner */}
              <div className="bg-brand-blue border-4 border-brand-black p-8 text-left shadow-[6px_6px_0px_0px_#1b1b1b] relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl font-black rotate-[20deg] select-none pointer-events-none">
                  🔥
                </div>
                <h3 className="text-3xl font-black uppercase text-white tracking-tighter leading-none mb-4 group-hover:scale-105 transition-transform duration-200">
                  BOOST
                  <br />
                  SALES
                </h3>
                <p className="text-xs font-bold text-white/80 mb-6 leading-relaxed">
                  Launch target flash promo codes or upgrade tickets now.
                </p>
                <button 
                  onClick={() => alert("Campaign Manager Launched.")}
                  className="bg-brand-yellow text-brand-black border-3 border-brand-black px-4 py-2 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all cursor-pointer"
                >
                  CREATE CAMPAIGN ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports tab content */}
      {activeTab === "reports" && (
        <div className="space-y-12">
          {/* Row 1: Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  {loading ? "--" : reportMetrics.totalVisitors}
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
                  {loading ? "Rp --" : formatIDRShort(reportMetrics.grossRevenue)}
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
                  <span>{loading ? "--" : reportMetrics.checkedInTickets} <span className="text-brand-black/60 font-bold">In Venue</span></span>
                  <span>{loading ? "--" : (reportMetrics.totalTickets - reportMetrics.checkedInTickets)} <span className="text-brand-black/60 font-bold">Remaining</span></span>
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
                          <span>{formatIDRShort(genre.amount)}</span>
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
                    <div key={index} className="flex-1 flex flex-col items-center h-full justify-end" title={formatIDRShort(item.revenue)}>
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
          <div className="grid grid-cols-1">
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
                            {formatIDRFull(item.amount)}
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
      )}

    </div>
  );
}
