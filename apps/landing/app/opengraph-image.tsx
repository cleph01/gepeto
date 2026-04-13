import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Gepeto — Dental Lab Delivery, Simplified";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F1B2D",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(24,95,165,0.22), transparent 70%)",
          }}
        />

        {/* Logo mark + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 40,
          }}
        >
          {/* Tooth icon — matches dispatcher-web */}
          <div
            style={{
              width: 72,
              height: 72,
              background: "#185FA5",
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="42" height="42" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z"
                fill="white"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Gepeto
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            maxWidth: 780,
            marginBottom: 20,
          }}
        >
          Dental lab logistics,{" "}
          <span style={{ color: "#185FA5" }}>finally solved.</span>
        </div>

        {/* Sub-copy */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.45)",
            textAlign: "center",
            maxWidth: 680,
            lineHeight: 1.5,
          }}
        >
          Purpose-built dispatch &amp; delivery tracking for dental labs.
        </div>

        {/* Domain badge */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 100,
            padding: "8px 20px",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3B6D11",
            }}
          />
          <span
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.45)",
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            gepeto.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
