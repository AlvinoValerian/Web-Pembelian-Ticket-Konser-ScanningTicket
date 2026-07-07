import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      fullName,
      orderNum,
      eventTitle,
      eventVenue,
      eventDate,
      quantity,
      ticketTier,
      tickets
    } = body;

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY environment variable");
      return NextResponse.json(
        { error: "Server configuration error: missing email API key" },
        { status: 500 }
      );
    }

    if (!email || !fullName || !orderNum || !eventTitle || !tickets || tickets.length === 0) {
      return NextResponse.json(
        { error: "Missing required order information for email delivery" },
        { status: 400 }
      );
    }

    // Build ticket codes list HTML - using unique ticket_code (starts with ORD-...-1, ORD-...-2) for each ticket
    const ticketCodesHtml = tickets
      .map(
        (t: any, idx: number) => `
        <div style="border: 1.5px solid #1b1b1b; border-radius: 8px; padding: 18px; margin-bottom: 16px; background-color: #ffffff; box-shadow: 3px 3px 0px rgba(27, 27, 27, 0.08); text-align: center;">
          <p style="margin: 0; font-size: 10px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">TICKET #${idx + 1} OF ${tickets.length}</p>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900; color: #111827; letter-spacing: 1.5px; font-family: monospace;">${t.ticket_code}</p>
          <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">OWNER: ${t.owner_name}</p>
          <div style="margin-top: 14px; border: 1.5px solid #e5e7eb; border-radius: 6px; padding: 8px; background-color: #ffffff; display: inline-block; margin-left: auto; margin-right: auto;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(t.ticket_code)}" alt="Ticket QR Code" style="width: 130px; height: 130px; display: block;" />
          </div>
          <p style="margin: 8px 0 0 0; font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">QR CODE (SCAN ME)</p>
        </div>
      `
      )
      .join("");

    // Modern Fine-Line VibeCheck HTML Ticket Template (1.5px borders for clean premium feel)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>VibeCheck E-Ticket</title>
      </head>
      <body style="margin: 0; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #1f2937;">
        <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1.5px solid #1b1b1b; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); overflow: hidden;">
          
          <!-- Banner Header -->
          <div style="background-color: #facc15; padding: 28px; border-bottom: 1.5px solid #1b1b1b; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; display: inline-block; border: 1.5px solid #1b1b1b; padding: 6px 14px; background-color: #ffffff; box-shadow: 2px 2px 0px #1b1b1b;">
              VIBECHECK
            </h1>
            <p style="margin: 10px 0 0 0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #1b1b1b; opacity: 0.75;">OFFLINE PURCHASE E-TICKET</p>
          </div>

          <!-- Ticket Body -->
          <div style="padding: 24px;">
            <p style="margin-top: 0; font-size: 13px; font-weight: 700; line-height: 1.6; text-transform: uppercase; color: #4b5563;">
              Hi ${fullName},<br/>
              Tiket Anda telah terdaftar secara langsung melalui Portal Admin. Berikut adalah rincian transaksi Anda:
            </p>

            <!-- Event Details Card -->
            <div style="border: 1.5px solid #1b1b1b; border-radius: 8px; padding: 20px; background-color: #eff6ff; box-shadow: 3px 3px 0px rgba(27, 27, 27, 0.06); margin-bottom: 24px;">
              <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; border-bottom: 1.5px dashed #1b1b1b; padding-bottom: 6px; color: #111827;">
                ${eventTitle}
              </h2>
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; line-height: 1.6; color: #374151;">
                <p style="margin: 4px 0;">📅 ${eventDate}</p>
                <p style="margin: 4px 0;">📍 ${eventVenue}</p>
                <p style="margin: 4px 0;">🎫 KATEGORI: ${ticketTier}</p>
                <p style="margin: 4px 0;">🔢 JUMLAH: ${quantity} TIKET</p>
                <p style="margin: 4px 0;">💳 ORDER NO: <span style="font-family: monospace; font-weight: 900; letter-spacing: 0.5px;">${orderNum}</span></p>
              </div>
            </div>

            <!-- Ticket Codes Section -->
            <h3 style="margin: 0 0 14px 0; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #1b1b1b; padding-bottom: 6px; color: #1f2937;">
              GATE ENTRY TICKETS
            </h3>
            
            ${ticketCodesHtml}

            <!-- Bottom Warning / Disclaimer -->
            <div style="margin-top: 24px; border: 1.5px solid #f87171; border-radius: 8px; padding: 14px; background-color: #fef2f2; box-shadow: 2px 2px 0px rgba(239, 68, 68, 0.05);">
              <p style="margin: 0; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #b91c1c; letter-spacing: 0.5px;">⚠️ PERHATIAN / GATE ENTRY INFO</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; line-height: 1.5; color: #7f1d1d; text-transform: uppercase;">
                Tunjukkan salah satu kode QR di atas saat berada di pintu masuk. Masing-masing tiket hanya dapat di-scan 1 kali. Penjualan ini bersifat final dan telah divalidasi langsung oleh pihak penyelenggara.
              </p>
            </div>

            <!-- Footer Details -->
            <div style="margin-top: 32px; border-top: 1.5px dashed #e5e7eb; padding-top: 16px; text-align: center; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.5px;">
              <p style="margin: 0;">ORDER ID: ${orderNum}</p>
              <p style="margin: 4px 0 0 0;">VibeCheck Ticketing System &copy; 2026. All rights reserved.</p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    // Make API Call to Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "VibeCheck <onboarding@resend.dev>",
        to: [email],
        subject: `[VIBECHECK] E-Ticket: ${eventTitle} (Order #${orderNum})`,
        html: htmlContent
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API Error details:", resendData);
      return NextResponse.json(
        { error: resendData.message || "Failed to send email through provider" },
        { status: resendResponse.status }
      );
    }

    return NextResponse.json({ success: true, id: resendData.id });
  } catch (err: any) {
    console.error("Error in send-email route handler:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
