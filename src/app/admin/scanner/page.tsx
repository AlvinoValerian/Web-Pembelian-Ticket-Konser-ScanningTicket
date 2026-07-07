"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function AttendanceScanner() {
  const supabase = createClient();
  
  // Scanner states
  const [scanState, setScanState] = useState<"FAILED" | "SUCCESS" | "IDLE">("IDLE");
  const [ticketInput, setTicketInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checkedInInfo, setCheckedInInfo] = useState<string>("");
  
  // Camera & File states
  const [html5Qrcode, setHtml5Qrcode] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [flashActive, setFlashActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScannedTimeRef = useRef<number>(0);

  // Scanned Ticket Info State
  const [ticketDetails, setTicketDetails] = useState<{
    code: string;
    buyerName: string;
    category: string;
    quantity: string;
    eventName: string;
    dbId?: string; // ticket UUID or order UUID
    type: "TICKET" | "ORDER";
  } | null>(null);

  const [scannerAdminId, setScannerAdminId] = useState<string | null>(null);

  // Helper to dynamically get admin ID with fallback to satisfy NOT NULL constraints
  const getAdminId = async (): Promise<string | null> => {
    if (scannerAdminId) return scannerAdminId;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setScannerAdminId(user.id);
        return user.id;
      }
      
      // Fallback: Query first profile ID from profiles table
      const { data: profiles } = await supabase.from("profiles").select("id").limit(1);
      if (profiles && profiles.length > 0) {
        const fallbackId = profiles[0].id;
        setScannerAdminId(fallbackId);
        return fallbackId;
      }
    } catch (e) {
      console.error("Error fetching admin session:", e);
    }
    return null;
  };

  // Fetch admin session details on mount
  useEffect(() => {
    const fetchSession = async () => {
      await getAdminId();
    };
    fetchSession();
  }, [supabase]);

  // Initialize html5-qrcode instance on client mount
  useEffect(() => {
    const { Html5Qrcode } = require("html5-qrcode");
    const instance = new Html5Qrcode("reader");
    setHtml5Qrcode(instance);

    return () => {
      // 1. Try stopping the html5-qrcode scanner cleanly
      if (instance && instance.isScanning) {
        instance.stop().catch((e: any) => console.log("html5Qrcode clean stop bypassed:", e));
      }

      // 2. Stop all active webcam video tracks in the document to turn off camera lights instantly
      try {
        const videos = document.querySelectorAll("video");
        videos.forEach((video) => {
          const stream = video.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach((track) => {
              track.stop();
              console.log("Webcam track stopped on unmount:", track.label);
            });
          }
        });
      } catch (err) {
        console.error("Error stopping video tracks on unmount:", err);
      }
    };
  }, []);

  // Live Camera Scan Flow
  const startCamera = async () => {
    if (!html5Qrcode) return;
    
    try {
      setIsCameraActive(true);
      setScanState("IDLE");
      setErrorMessage("");

      await html5Qrcode.start(
        { facingMode: facingMode },
        {
          fps: 10,
        },
        (decodedText: string) => {
          const now = Date.now();
          if (now - lastScannedTimeRef.current < 2000) {
            // Cooldown: Ignore scans within 2 seconds
            return;
          }
          lastScannedTimeRef.current = now;

          // On Success
          setTicketInput(decodedText);
          triggerSearch(decodedText);
        },
        (errorMsg: string) => {
          // Constant frame scans failures are ignored
        }
      );
    } catch (err) {
      console.error("Camera start failed:", err);
      setIsCameraActive(false);
      alert("Could not access camera. Please check permissions or device configurations.");
    }
  };

  const stopCamera = async () => {
    if (html5Qrcode && html5Qrcode.isScanning) {
      try {
        await html5Qrcode.stop();
      } catch (err) {
        console.error("Failed to stop camera stream:", err);
      }
    }
    setIsCameraActive(false);
    setFlashActive(false);
  };

  const toggleCameraFlip = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);

    if (html5Qrcode && html5Qrcode.isScanning) {
      await html5Qrcode.stop();
      try {
        await html5Qrcode.start(
          { facingMode: nextMode },
          {
            fps: 10,
          },
          (decodedText: string) => {
            setTicketInput(decodedText);
            triggerSearch(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera switch failed:", err);
        setIsCameraActive(false);
      }
    }
  };

  const toggleFlash = async () => {
    if (!html5Qrcode || !html5Qrcode.isScanning) return;
    try {
      const nextFlashState = !flashActive;
      const track = html5Qrcode.getRunningTrack();
      if (track) {
        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          await track.applyConstraints({
            advanced: [{ torch: nextFlashState }]
          });
          setFlashActive(nextFlashState);
        } else {
          alert("Flash/Torch is not supported on this camera device.");
        }
      }
    } catch (err) {
      console.error("Flash toggle failed:", err);
    }
  };

  // Capture current camera video frame, crop to yellow box size, and scan the image
  const captureFrame = async () => {
    const video = document.querySelector("#reader video") as HTMLVideoElement;
    const readerContainer = document.getElementById("reader") as HTMLDivElement;
    if (!video || !readerContainer) return;

    try {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const containerWidth = readerContainer.offsetWidth || 400;
      const containerHeight = readerContainer.offsetHeight || 400;

      // 1. Calculate scaling factors for object-fit: cover
      const containerRatio = containerWidth / containerHeight;
      const videoRatio = videoWidth / videoHeight;
      
      let scale = 1;
      let videoLeftOffset = 0;
      let videoTopOffset = 0;

      if (videoRatio > containerRatio) {
        // Video is wider than aspect-square container
        scale = videoHeight / containerHeight;
        videoLeftOffset = (videoWidth - containerWidth * scale) / 2;
      } else {
        // Video is taller than aspect-square container
        scale = videoWidth / containerWidth;
        videoTopOffset = (videoHeight - containerHeight * scale) / 2;
      }

      // 2. Scan viewfinder box position details relative to container
      const boxLeft = (containerWidth - scanBoxSize) / 2;
      const boxTop = (containerHeight - scanBoxSize) / 2;

      // 3. Map to actual crop bounds on source video feed
      const cropX = videoLeftOffset + boxLeft * scale;
      const cropY = videoTopOffset + boxTop * scale;
      const cropWidth = scanBoxSize * scale;
      const cropHeight = scanBoxSize * scale;

      // 4. Render cropped canvas area
      const canvas = document.createElement("canvas");
      canvas.width = scanBoxSize;
      canvas.height = scanBoxSize;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Draw only the cropped bounding box portion of the video feed
        ctx.drawImage(
          video, 
          cropX, cropY, cropWidth, cropHeight,
          0, 0, scanBoxSize, scanBoxSize
        );
        
        // Save image preview data url
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImagePreview(dataUrl);

        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            
            // Process decoding on captured photo
            setSearching(true);
            setErrorMessage("");
            try {
              const decodedText = await html5Qrcode.scanFile(file);
              setTicketInput(decodedText);
              triggerSearch(decodedText);
            } catch (scanErr) {
              setErrorMessage("Could not detect any barcode in the captured frame. Try again.");
              setScanState("FAILED");
              setTicketDetails(null);
            } finally {
              setSearching(false);
            }
          }
        }, "image/jpeg");
      }
    } catch (err) {
      console.error("Frame capture failed:", err);
    }
  };

  // Upload Photo File Scan Flow
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!html5Qrcode || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Strict file format validation (PNG, JPG, JPEG)
    const allowedExtensions = ["png", "jpg", "jpeg"];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      alert("Hanya file gambar dengan ekstensi PNG, JPG, atau JPEG yang diperbolehkan!");
      e.target.value = "";
      return;
    }

    // If scanning with camera, turn it off first
    if (isCameraActive) {
      await stopCamera();
    }

    // Set image preview from file
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImagePreview(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);

    setSearching(true);
    setErrorMessage("");
    setScanState("IDLE");

    try {
      const decodedText = await html5Qrcode.scanFile(file);
      setTicketInput(decodedText);
      triggerSearch(decodedText);
    } catch (err: any) {
      console.error("File scanning error:", err);
      setErrorMessage("No valid ticket code or barcode detected in this image.");
      setScanState("FAILED");
      setTicketDetails(null);
    } finally {
      setSearching(false);
      // Reset input value to allow scan same file again
      e.target.value = "";
    }
  };

  const triggerSearch = async (code: string) => {
    if (!code || !code.trim()) return;
    setSearching(true);
    setErrorMessage("");
    setScanState("IDLE");
    
    try {
      const adminId = await getAdminId();
      const trimmedCode = code.trim();

      // 1. Try checking the tickets table first
      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_code,
          status,
          scanned_at,
          owner_name,
          orders:order_id (
            id,
            order_number,
            quantity,
            profiles:buyer_id (full_name),
            events:event_id (title, date_time)
          ),
          ticket_tiers:ticket_tier_id (name)
        `)
        .eq("ticket_code", trimmedCode)
        .maybeSingle();

      if (ticketData) {
        const orderData = ticketData.orders as any;
        const buyerName = ticketData.owner_name || orderData?.profiles?.full_name || "Unknown Guest";
        const eventName = orderData?.events?.title || "Unknown Event";
        const category = (ticketData.ticket_tiers as any)?.name || "General Admission";
        
        setTicketDetails({
          code: ticketData.ticket_code,
          buyerName,
          category,
          quantity: `1 of ${orderData?.quantity || 1}`,
          eventName,
          dbId: ticketData.id,
          type: "TICKET",
        });

        // Expiration check
        const eventDateTimeStr = orderData?.events?.date_time;
        let isExpired = false;
        if (eventDateTimeStr) {
          const eventTime = new Date(eventDateTimeStr);
          const currentTime = new Date();
          const diffInHours = (currentTime.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
          if (diffInHours > 8) {
            isExpired = true;
          }
        }

        if (isExpired) {
          setErrorMessage("Ticket is expired (exceeded 8 hours from event start time)");
          setScanState("FAILED");
        } else if (ticketData.status === "CHECKED_IN" || ticketData.status === "USED" || ticketData.scanned_at) {
          const scanTime = ticketData.scanned_at 
            ? new Date(ticketData.scanned_at).toLocaleTimeString() 
            : "earlier";
          setErrorMessage(`Ticket scanned at ${scanTime}`);
          setScanState("FAILED");
        } else {
          // Auto check-in
          const nowStr = new Date().toISOString();
          const { error: updateError } = await supabase
            .from("tickets")
            .update({
              status: "CHECKED_IN",
              scanned_at: nowStr,
            })
            .eq("id", ticketData.id);

          if (updateError) throw updateError;

          // Log in ticket_scans table
          const { error: scanLogError } = await supabase
            .from("ticket_scans")
            .insert({
              ticket_id: ticketData.id,
              scanned_by: adminId || null,
              result: "SUCCESS"
            });

          if (scanLogError) {
            console.error("Failed to insert ticket_scans log:", scanLogError);
          }

          setScanState("SUCCESS");
          setCheckedInInfo(`Checked in successfully at ${new Date().toLocaleTimeString()}`);
        }
        setSearching(false);
        return;
      }

      // 2. If ticket code doesn't match, check if it's an order_number (e.g. ORD-00001) in orders table
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          quantity,
          status,
          profiles:buyer_id (full_name),
          events:event_id (title, date_time),
          tickets (
            id,
            owner_name,
            status,
            scanned_at
          )
        `)
        .eq("order_number", trimmedCode)
        .maybeSingle();

      if (orderData) {
        const ticketsList = orderData.tickets as any[];
        const buyerName = (ticketsList && ticketsList.length > 0)
          ? ticketsList[0].owner_name 
          : ((orderData.profiles as any)?.full_name || "Unknown Guest");

        // Expiration check
        const eventDateTimeStr = (orderData.events as any)?.date_time;
        let isExpired = false;
        if (eventDateTimeStr) {
          const eventTime = new Date(eventDateTimeStr);
          const currentTime = new Date();
          const diffInHours = (currentTime.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
          if (diffInHours > 8) {
            isExpired = true;
          }
        }

        if (isExpired) {
          setErrorMessage("Order tickets are expired (exceeded 8 hours from event start time)");
          setScanState("FAILED");
          setTicketDetails({
            code: orderData.order_number,
            buyerName,
            category: "EXPIRED TICKET",
            quantity: `${orderData.quantity} ticket(s)`,
            eventName: (orderData.events as any)?.title || "Unknown Event",
            dbId: orderData.id,
            type: "ORDER",
          });

          setSearching(false);
          return;
        }

        if (orderData.status !== "APPROVED" && orderData.status !== "PAID") {
          setErrorMessage(`Order status is ${orderData.status || "PENDING"} (Payment not approved)`);
          setScanState("FAILED");
          setTicketDetails({
            code: orderData.order_number,
            buyerName,
            category: "PENDING VERIFICATION",
            quantity: `${orderData.quantity} ticket(s)`,
            eventName: (orderData.events as any)?.title || "Unknown Event",
            dbId: orderData.id,
            type: "ORDER",
          });

          setSearching(false);
          return;
        }

        setTicketDetails({
          code: orderData.order_number,
          buyerName,
          category: "ADMISSION PASS",
          quantity: `${orderData.quantity} ticket(s)`,
          eventName: (orderData.events as any)?.title || "Unknown Event",
          dbId: orderData.id,
          type: "ORDER",
        });

        // Check if any ticket under this order is already scanned (checked_in or used)
        const alreadyScannedTicket = (ticketsList || []).find(
          (t: any) => t.status === "CHECKED_IN" || t.status === "USED" || t.scanned_at
        );

        if (alreadyScannedTicket) {
          const scanTime = alreadyScannedTicket.scanned_at 
            ? new Date(alreadyScannedTicket.scanned_at).toLocaleTimeString() 
            : "earlier";
          setErrorMessage(`Order already scanned at ${scanTime}`);
          setScanState("FAILED");
        } else {
          // Auto check-in
          const nowStr = new Date().toISOString();
          const { error: updateError } = await supabase
            .from("tickets")
            .update({
              status: "CHECKED_IN",
              scanned_at: nowStr,
            })
            .eq("order_id", orderData.id);

          if (updateError) throw updateError;

          // Log in ticket_scans table for all tickets associated with this order
          const scansToInsert = (orderData.tickets || []).map((t: any) => ({
            ticket_id: t.id,
            scanned_by: adminId || null,
            result: "SUCCESS"
          }));

          if (scansToInsert.length > 0) {
            const { error: scanLogError } = await supabase
              .from("ticket_scans")
              .insert(scansToInsert);

            if (scanLogError) {
              console.error("Failed to insert ticket_scans logs for order:", scanLogError);
            }
          }

          setScanState("SUCCESS");
          setCheckedInInfo(`Checked in successfully at ${new Date().toLocaleTimeString()}`);
        }
        setSearching(false);
        return;
      }

      // If neither is found
      setErrorMessage("No ticket or order found with this code");
      setScanState("FAILED");
      setTicketDetails(null);

    } catch (err: any) {
      console.error("Error looking up ticket:", err);
      setErrorMessage("Error connecting to database");
      setScanState("FAILED");
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerSearch(ticketInput);
  };

  const handleCheckIn = async () => {
    if (!ticketDetails) return;

    try {
      const adminId = await getAdminId();
      const nowStr = new Date().toISOString();

      if (ticketDetails.type === "TICKET" && ticketDetails.dbId) {
        // Update ticket in database
        const { error } = await supabase
          .from("tickets")
          .update({
            status: "CHECKED_IN",
            scanned_at: nowStr,
          })
          .eq("id", ticketDetails.dbId);

        if (error) throw error;

        // Log in ticket_scans table
        const { error: scanLogError } = await supabase
          .from("ticket_scans")
          .insert({
            ticket_id: ticketDetails.dbId,
            scanned_by: adminId || null,
            result: "SUCCESS"
          });

        if (scanLogError) {
          console.error("Failed to insert ticket_scans log:", scanLogError);
        }
      } else if (ticketDetails.type === "ORDER" && ticketDetails.dbId) {
        // Update all tickets associated with this order to CHECKED_IN
        const { error } = await supabase
          .from("tickets")
          .update({
            status: "CHECKED_IN",
            scanned_at: nowStr,
          })
          .eq("order_id", ticketDetails.dbId);

        if (error) throw error;

        // Log in ticket_scans table for all tickets in this order
        const { data: ticketsData } = await supabase
          .from("tickets")
          .select("id")
          .eq("order_id", ticketDetails.dbId);

        const scansToInsert = (ticketsData || []).map((t: any) => ({
          ticket_id: t.id,
          scanned_by: adminId || null,
          result: "SUCCESS"
        }));

        if (scansToInsert.length > 0) {
          const { error: scanLogError } = await supabase
            .from("ticket_scans")
            .insert(scansToInsert);

          if (scanLogError) {
            console.error("Failed to insert ticket_scans logs for order:", scanLogError);
          }
        }
      }

      setScanState("SUCCESS");
      setCheckedInInfo(`Checked in successfully at ${new Date().toLocaleTimeString()}`);
      alert(`CHECK-IN SUCCESS: Access granted for ${ticketDetails.code}!`);
    } catch (err: any) {
      console.error("Check in error:", err);
      alert(`Check in failed: ${err.message}`);
    }
  };

  const [scanBoxSize, setScanBoxSize] = useState(220);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startSizeRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startSizeRef.current = scanBoxSize;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.clientX - startXRef.current;
      // Symmetric resizing since the box is centered
      let newSize = startSizeRef.current + deltaX * 2;
      newSize = Math.max(120, Math.min(320, newSize));
      setScanBoxSize(newSize);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    isResizingRef.current = true;
    startXRef.current = e.touches[0].clientX;
    startSizeRef.current = scanBoxSize;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.touches[0].clientX - startXRef.current;
      let newSize = startSizeRef.current + deltaX * 2;
      newSize = Math.max(120, Math.min(320, newSize));
      setScanBoxSize(newSize);
    };

    const handleTouchEnd = () => {
      isResizingRef.current = false;
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
  };

  const handleReset = () => {
    setScanState("IDLE");
    setTicketInput("");
    setTicketDetails(null);
    setErrorMessage("");
    setCheckedInInfo("");
    setImagePreview(null);
  };

  return (
    <div className="p-6 md:p-12 w-full text-left">
      <style>{`
        @keyframes scanAnim {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        #reader canvas {
          display: none !important;
        }
        #reader svg {
          display: none !important;
        }
        #reader__scan_region {
          border: none !important;
          box-shadow: none !important;
        }
        #reader__scan_region > * {
          border: none !important;
        }
        #reader {
          border: none !important;
          background: transparent !important;
        }
        #reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-4 border-brand-black pb-6 mb-10 gap-4">
        <div>
          <h1 className="text-sm font-black uppercase tracking-widest text-brand-black/50 leading-none">
            ATTENDANCE SCANNER
          </h1>
          <p className="text-xs font-bold text-brand-black/70 mt-1 uppercase tracking-wider">
            Terminal: GATE A - MAIN ENTRANCE
          </p>
        </div>
        <Link href="/admin/dashboard" className="bg-white border-3 border-brand-black px-4 py-2.5 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md transition-all">
          ✕ EXIT SCANNER
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Panel: Camera Scanner & Upload Controls */}
        <div className="lg:col-span-6 card-brutalist p-6 md:p-8 bg-white text-center shadow-[6px_6px_0px_0px_#1b1b1b] space-y-6">
          
          {/* Display QR Camera Stream, Image Preview, or Inactive Placeholder */}
          <div className="border-4 border-brand-black w-full max-w-md mx-auto aspect-square bg-brand-bg relative overflow-hidden flex flex-col items-center justify-center p-3 shadow-brutalist-sm">
            
            {/* The html5-qrcode reader binding container - ALWAYS in DOM to prevent html5-qrcode unmount/crash errors */}
            <div 
              id="reader" 
              className={`w-full h-full transition-opacity duration-300 ${isCameraActive && !imagePreview ? "opacity-100 block" : "opacity-0 absolute pointer-events-none hidden"}`}
            ></div>

            {/* Custom Viewfinder Box Overlay with Animated Scan Line */}
            {isCameraActive && !imagePreview && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div 
                  className="border-4 border-dashed border-brand-yellow relative flex items-center justify-center transition-all duration-150"
                  style={{ width: `${scanBoxSize}px`, height: `${scanBoxSize}px` }}
                >
                  {/* Brutalist Corner Borders */}
                  <div className="absolute top-[-4px] left-[-4px] w-6 h-6 border-t-4 border-l-4 border-brand-yellow"></div>
                  <div className="absolute top-[-4px] right-[-4px] w-6 h-6 border-t-4 border-r-4 border-brand-yellow"></div>
                  <div className="absolute bottom-[-4px] left-[-4px] w-6 h-6 border-b-4 border-l-4 border-brand-yellow"></div>
                  <div className="absolute bottom-[-4px] right-[-4px] w-6 h-6 border-b-4 border-r-4 border-brand-yellow"></div>
                  
                  {/* Animated Scan Line */}
                  <div className="absolute left-0 w-full h-1 bg-brand-yellow/80 shadow-[0_0_10px_#facc15] animate-[scanAnim_2s_infinite]"></div>

                  {/* Interactive Neo-Brutalist Resize Handle */}
                  <div 
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    title="Drag to resize scanner box"
                    className="absolute bottom-[-8px] right-[-8px] w-6 h-6 bg-brand-yellow border-3 border-brand-black cursor-se-resize pointer-events-auto flex items-center justify-center shadow-[2px_2px_0px_0px_#1b1b1b]"
                  >
                    <span className="text-[10px] font-black text-brand-black select-none leading-none">⤗</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Photo Preview Overlay */}
            {imagePreview && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Scanned Preview"
                  className="object-contain w-full h-full"
                />
                <div className="absolute top-3 right-3 bg-brand-yellow border-2 border-brand-black px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#1b1b1b] z-30">
                  📷 PHOTO PREVIEW
                </div>
              </div>
            )}
            
            {/* Inactive Camera Placeholder Overlay */}
            {!isCameraActive && !imagePreview && (
              <div className="text-center p-6 space-y-4 z-10">
                <span className="text-5xl block select-none">📸</span>
                <h3 className="font-black text-base uppercase tracking-wider text-brand-black">
                  CAMERA SCANNER INACTIVE
                </h3>
                <p className="text-xs font-bold text-brand-black/50 uppercase leading-relaxed max-w-xs mx-auto">
                  Start the webcam or upload a ticket screenshot / photo to validate admission codes.
                </p>
              </div>
            )}
          </div>

          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileScan}
            accept=".png,.jpg,.jpeg" 
            className="hidden" 
          />

          {/* Dynamic Action Buttons */}
          <div className="space-y-4 max-w-md mx-auto">
            {isCameraActive ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={captureFrame}
                    className="bg-brand-blue text-white border-3 border-brand-black py-3.5 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all active:translate-x-[2px] active:translate-y-[2px]"
                  >
                    📸 CAPTURE FRAME
                  </button>
                  <button
                    onClick={stopCamera}
                    className="bg-brand-black text-white border-3 border-brand-black py-3.5 px-4 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all active:translate-x-[2px] active:translate-y-[2px]"
                  >
                    ✕ STOP CAMERA
                  </button>
                  <button
                    onClick={toggleCameraFlip}
                    className="bg-white text-brand-black border-3 border-brand-black py-3 px-2 font-black text-[10px] uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all"
                  >
                    🔄 FLIP CAMERA
                  </button>
                  <button
                    onClick={toggleFlash}
                    className={`border-3 border-brand-black py-3 px-2 font-black text-[10px] uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all
                      ${flashActive ? "bg-brand-yellow text-brand-black" : "bg-white text-brand-black"}`}
                  >
                    🔦 FLASH {flashActive ? "ON" : "OFF"}
                  </button>
                </div>

                {/* Resizable scan box slider */}
                {!imagePreview && (
                  <div className="bg-brand-bg border-3 border-brand-black p-4 text-left space-y-2 shadow-brutalist-sm">
                    <label className="text-[10px] font-black uppercase tracking-wider text-brand-black flex justify-between">
                      <span>📏 SCAN VIEWBOX SIZE</span>
                      <span>{scanBoxSize}px</span>
                    </label>
                    <input
                      type="range"
                      min="120"
                      max="320"
                      value={scanBoxSize}
                      onChange={(e) => setScanBoxSize(Number(e.target.value))}
                      className="w-full h-3 bg-white border-3 border-brand-black appearance-none cursor-pointer outline-none accent-brand-yellow"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={startCamera}
                  className="bg-brand-yellow text-brand-black border-3 border-brand-black py-4 px-6 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all active:translate-x-[2px] active:translate-y-[2px] flex-1 flex items-center justify-center gap-2"
                >
                  <span>🎥</span> START CAMERA SCAN
                </button>
                <button
                  onClick={triggerFileUpload}
                  className="bg-white text-brand-black border-3 border-brand-black py-4 px-6 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all active:translate-x-[2px] active:translate-y-[2px] flex-1 flex items-center justify-center gap-2"
                >
                  <span>📁</span> UPLOAD PHOTO
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Feedback & Info Box */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Search/Scan Input */}
          <div className="card-brutalist p-6 bg-white shadow-[6px_6px_0px_0px_#1b1b1b] space-y-4">
            <label className="text-xs font-black uppercase tracking-wider text-brand-black block">
              ENTER TICKET CODE OR ORDER NUMBER
            </label>
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                type="text"
                placeholder="e.g. ORD-00001 or VBCK-8492-XT"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                className="flex-1 py-3 px-4 text-xs font-bold border-3 border-brand-black outline-none placeholder:text-brand-black/40 bg-white focus:bg-brand-bg focus:border-brand-blue"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-brand-yellow text-brand-black border-3 border-brand-black px-5 py-3 font-black text-xs uppercase tracking-wider shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all active:translate-x-[2px] active:translate-y-[2px]"
              >
                {searching ? "FINDING..." : "SEARCH"}
              </button>
            </form>
          </div>

          {/* Status Banners */}
          {scanState === "FAILED" && (
            <div className="bg-[#fee2e2] border-4 border-red-600 p-6 flex gap-4 items-start shadow-[4px_4px_0px_0px_#1b1b1b]">
              <span className="text-3xl animate-bounce">⚠️</span>
              <div>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">
                  VALIDATION FAILED
                </p>
                <h4 className="text-lg font-black uppercase tracking-tight text-red-700 mt-1">
                  ACCESS DENIED
                </h4>
                <p className="text-xs font-bold text-red-600/80 mt-1 uppercase tracking-wider">
                  Reason: {errorMessage || "Invalid ticket code"}
                </p>
              </div>
            </div>
          )}

          {scanState === "SUCCESS" && (
            <div className="bg-[#dcfce7] border-4 border-green-600 p-6 flex gap-4 items-start shadow-[4px_4px_0px_0px_#1b1b1b]">
              <span className="text-3xl animate-pulse">✅</span>
              <div>
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none">
                  VALIDATION SUCCESS
                </p>
                <h4 className="text-lg font-black uppercase tracking-tight text-green-700 mt-1">
                  ACCESS GRANTED
                </h4>
                <p className="text-xs font-bold text-green-600/80 mt-1 uppercase tracking-wider">
                  {checkedInInfo || "Checked in successfully"}
                </p>
              </div>
            </div>
          )}

          {scanState === "IDLE" && !ticketDetails && (
            <div className="bg-brand-bg border-4 border-brand-black p-6 flex gap-4 items-center shadow-[4px_4px_0px_0px_#1b1b1b]">
              <span className="text-3xl animate-pulse">📷</span>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wide">
                  WAITING FOR SCAN OR MANUAL CODE
                </h4>
                <p className="text-xs font-bold text-brand-black/60 uppercase">
                  Search order codes or start the camera scanner tools.
                </p>
              </div>
            </div>
          )}

          {/* Ticket Info Card */}
          {ticketDetails && (
            <div className="card-brutalist overflow-hidden shadow-[6px_6px_0px_0px_#1b1b1b] text-left">
              <div className="bg-brand-yellow border-b-4 border-brand-black p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-black/60">
                  TICKET CODE / ORDER ID
                </span>
                <h4 className="text-lg font-black uppercase tracking-tight text-brand-black">
                  {ticketDetails.code}
                </h4>
              </div>

              <div className="p-6 space-y-6">
                {/* Buyer Details */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-black/50 leading-none mb-1">
                    BUYER NAME
                  </p>
                  <p className="text-base font-black uppercase text-brand-black">
                    {ticketDetails.buyerName}
                  </p>
                </div>

                {/* Grid category and quantity */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-brand-black/50 leading-none mb-2">
                      CATEGORY
                    </p>
                    <span className="bg-brand-black text-white px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] border border-brand-black shadow-[2px_2px_0px_0px_#1b1b1b] truncate max-w-full inline-block">
                      {ticketDetails.category}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-black/50 leading-none mb-1">
                      QUANTITY
                    </p>
                    <p className="text-sm font-black uppercase">
                      {ticketDetails.quantity}
                    </p>
                  </div>
                </div>

                {/* Event Name */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-black/50 leading-none mb-1">
                    EVENT NAME
                  </p>
                  <p className="text-sm font-black uppercase text-brand-black">
                    {ticketDetails.eventName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="bg-white border-3 border-brand-black px-6 py-4 text-xs font-black uppercase tracking-wider flex-1 shadow-brutalist-sm hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutalist-md cursor-pointer transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none text-center"
            >
              RESET SCANNER
            </button>
            <button
              onClick={handleCheckIn}
              disabled={scanState === "SUCCESS" || scanState === "FAILED" || !ticketDetails}
              className="btn-brutalist-blue flex-1 py-4 text-xs font-black tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-center"
            >
              CHECK IN
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
