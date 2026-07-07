"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// Inactivity threshold: 30 minutes (1800 seconds)
// Warning threshold: 30 seconds
const TIMEOUT_IN_SECONDS = 30 * 60;
const WARNING_IN_SECONDS = 30;

const STORAGE_KEY = "vibecheck_last_activity";

export default function SessionTimeoutListener() {
  const router = useRouter();
  const supabase = createClient();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_IN_SECONDS);
  
  const lastUpdateRef = useRef<number>(0);
  const routerRef = useRef(router);
  const supabaseRef = useRef(supabase);

  // Keep refs updated with latest values
  useEffect(() => {
    routerRef.current = router;
    supabaseRef.current = supabase;
  }, [router, supabase]);

  // Helper to handle logout
  const executeLogout = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowWarning(false);
    try {
      await supabaseRef.current.auth.signOut();
    } catch (err) {
      console.error("Error signing out:", err);
    }
    routerRef.current.push("/login?timeout=true");
  };

  const handleStayLoggedIn = () => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, now.toString());
    lastUpdateRef.current = now;
    setShowWarning(false);
  };

  useEffect(() => {
    // Initialize activity timestamp if not exists
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    const updateActivity = () => {
      const now = Date.now();
      // Throttle writing to localStorage to once every 2 seconds
      if (now - lastUpdateRef.current > 2000) {
        localStorage.setItem(STORAGE_KEY, now.toString());
        lastUpdateRef.current = now;
        setShowWarning((prev) => (prev ? false : prev));
      }
    };

    // Add event listeners for user interactions
    const activities = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activities.forEach((activity) => {
      window.addEventListener(activity, updateActivity);
    });

    // Interval to check inactivity every second
    const interval = setInterval(async () => {
      const lastActivityStr = localStorage.getItem(STORAGE_KEY);
      if (!lastActivityStr) return;

      const lastActivity = parseInt(lastActivityStr, 10);
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastActivity) / 1000);

      const warningThreshold = TIMEOUT_IN_SECONDS - WARNING_IN_SECONDS;

      if (elapsedSeconds >= TIMEOUT_IN_SECONDS) {
        clearInterval(interval);
        await executeLogout();
      } else if (elapsedSeconds >= warningThreshold) {
        setShowWarning(true);
        setSecondsRemaining(TIMEOUT_IN_SECONDS - elapsedSeconds);
      } else {
        setShowWarning((prev) => (prev ? false : prev));
      }
    }, 1000);

    // Cleanup listeners and interval
    return () => {
      activities.forEach((activity) => {
        window.removeEventListener(activity, updateActivity);
      });
      clearInterval(interval);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 bg-brand-black/90 z-[99999] flex items-center justify-center font-sans p-4">
      <div 
        className="card-brutalist p-8 bg-brand-yellow border-4 border-brand-black text-left max-w-md w-full space-y-6 shadow-[8px_8px_0px_0px_#1b1b1b]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="timeout-title"
        aria-describedby="timeout-desc"
      >
        <div className="space-y-2">
          <div className="bg-brand-black text-brand-yellow inline-block px-3 py-1 font-black uppercase text-xs tracking-wider border-2 border-brand-black">
            🚨 INACTIVE SESSION
          </div>
          <h3 id="timeout-title" className="text-2xl md:text-3xl font-black uppercase text-brand-black leading-none pt-2">
            ARE YOU STILL THERE?
          </h3>
          <p id="timeout-desc" className="text-xs font-bold text-brand-black/80 uppercase leading-relaxed">
            You have been inactive. For your security, you will be logged out automatically in:
          </p>
        </div>

        {/* Countdown Visual */}
        <div className="w-full border-4 border-brand-black bg-white overflow-hidden relative p-4 flex flex-col items-center justify-center">
          <div className="text-4xl font-black text-brand-blue animate-pulse">
            {secondsRemaining}s
          </div>
          <div className="w-full bg-brand-bg h-3 border-2 border-brand-black mt-3 relative overflow-hidden">
            <div 
              className="h-full bg-brand-blue transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsRemaining / WARNING_IN_SECONDS) * 100}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <button
            onClick={handleStayLoggedIn}
            className="btn-brutalist-blue w-full py-3.5 text-xs font-black uppercase tracking-wider text-center cursor-pointer"
          >
            STAY LOGGED IN ➔
          </button>
          <button
            onClick={executeLogout}
            className="bg-red-600 text-white border-3 border-brand-black px-4 py-3.5 font-black text-xs uppercase tracking-wider shadow-[4px_4px_0px_0px_#1b1b1b] cursor-pointer transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#1b1b1b] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[0px_0px_0px_0px_#1b1b1b] text-center"
          >
            LOG OUT NOW
          </button>
        </div>
      </div>
    </div>
  );
}
