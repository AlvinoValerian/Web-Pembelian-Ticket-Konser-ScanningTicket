"use client";

import React, { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

export default function GuestSupportPage() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Ticket Issue");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // FAQ Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "How long does payment verification take?",
      answer: "Payment verifications are processed manually by our admin team. It usually takes between 15 to 30 minutes. You will receive an update in your dashboard under 'My Tickets' once verified."
    },
    {
      question: "Can I get a refund if I can't attend?",
      answer: "As our policy states: NO REFUNDS. However, tickets are fully transferable. You can send the PDF ticket to a friend or relative to use at the entrance."
    },
    {
      question: "How do I scan my ticket at the venue?",
      answer: "Simply open your dashboard on your mobile device, navigate to 'My Tickets', and present the barcode/QR code to the scanner at the gate."
    },
    {
      question: "My payment proof upload failed, what should I do?",
      answer: "Make sure the file format is an image (.jpg, .png) and under 5MB. If it still fails, submit a support ticket below with details of your payment, and our support team will help clear it."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(prev => (prev === index ? null : index));
  };

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(null);

    // Simulate API request
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg("TICKET CREATED SUCCESSFULLY! Support staff will reach out via email shortly.");
      setSubject("");
      setMessage("");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2] p-6 md:p-12 font-sans text-brand-black">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-left">
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">
            SUPPORT PIT
          </h1>
          <p className="text-sm font-bold text-brand-black/60 uppercase tracking-wide">
            Need help? Ask the crew, read the guidelines, or submit a help ticket.
          </p>
        </div>

        {/* Dynamic content columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: FAQs & Quick Contacts */}
          <div className="lg:col-span-6 space-y-8">
            
            {/* FAQ Card */}
            <div className="card-brutalist p-6 md:p-8 bg-white shadow-[6px_6px_0px_0px_#1b1b1b] text-left">
              <h2 className="text-2xl font-black uppercase tracking-tight mb-6 border-b-2 border-brand-black pb-2">
                FREQUENT QUESTIONS
              </h2>

              <div className="space-y-4">
                {faqs.map((faq, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div key={index} className="border-3 border-brand-black bg-brand-bg shadow-brutalist-sm">
                      <button
                        onClick={() => toggleFaq(index)}
                        className="w-full p-4 flex justify-between items-center text-left font-black text-xs md:text-sm uppercase tracking-wide cursor-pointer hover:bg-brand-yellow/10 transition-colors"
                      >
                        <span>{faq.question}</span>
                        <span className="text-lg">{isOpen ? "▲" : "▼"}</span>
                      </button>
                      
                      {isOpen && (
                        <div className="p-4 border-t-3 border-brand-black bg-white text-xs font-bold text-brand-black/85 leading-relaxed">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Contacts */}
            <div className="card-brutalist p-6 md:p-8 bg-brand-yellow border-4 border-brand-black shadow-[6px_6px_0px_0px_#1b1b1b] text-left space-y-4">
              <h3 className="text-xl font-black uppercase">DIRECT ACCESS</h3>
              <p className="text-xs font-bold leading-relaxed text-brand-black/80 uppercase">
                If it's an emergency at the venue gate, contact our staff directly:
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-xs font-black uppercase tracking-wider">
                <div className="bg-white border-2 border-brand-black p-3 shadow-brutalist-sm">
                  <p className="text-brand-black/50 text-[9px] mb-0.5">EMAIL US</p>
                  <p className="text-brand-blue truncate">help@vibecheck.com</p>
                </div>
                <div className="bg-white border-2 border-brand-black p-3 shadow-brutalist-sm">
                  <p className="text-brand-black/50 text-[9px] mb-0.5">HOTLINE WHATSAPP</p>
                  <p className="text-brand-black">+62 888-999-000</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Support Ticket Form */}
          <div className="lg:col-span-6">
            <div className="card-brutalist p-6 md:p-8 bg-white shadow-[6px_6px_0px_0px_#1b1b1b] text-left space-y-6">
              <h2 className="text-2xl font-black uppercase tracking-tight border-b-2 border-brand-black pb-2">
                SUBMIT A TICKET
              </h2>

              {successMsg && (
                <div className="bg-brand-yellow border-3 border-brand-black p-4 text-xs font-black uppercase tracking-wide">
                  🎉 {successMsg}
                </div>
              )}

              <form onSubmit={handleTicketSubmit} className="space-y-4">
                
                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                    ISSUE CATEGORY
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="border-3 border-brand-black p-3.5 text-xs md:text-sm font-black uppercase tracking-wider bg-white outline-none appearance-none cursor-pointer shadow-brutalist-sm"
                  >
                    <option value="Ticket Issue">🎟️ Ticket Access / QR Code</option>
                    <option value="Payment Verification">💰 Bank Transfer Verification</option>
                    <option value="Account Issue">👤 Login / Profile Issue</option>
                    <option value="Refund Request">🔄 Transfer / Resell Query</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                    SUBJECT
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. My ticket is not showing up"
                    className="border-2 border-brand-black p-3.5 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-black uppercase tracking-wider text-brand-black/70 mb-1">
                    DETAILED DESCRIPTION
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue with order ID and proof details..."
                    rows={6}
                    className="border-2 border-brand-black p-3.5 text-sm font-bold bg-[#fafafa] focus:bg-white outline-none placeholder:text-brand-black/40 resize-none"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-brutalist-blue w-full py-4 text-sm font-black flex items-center justify-center gap-2 mt-6 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "SENDING..." : "SEND TICKET"} <span>➔</span>
                </button>

              </form>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
