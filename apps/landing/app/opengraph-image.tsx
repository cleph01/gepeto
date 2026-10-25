import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "Gepeto — Dental Lab Delivery, Simplified";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  const iconData = readFileSync(join(process.cwd(), "public/gepeto-icon.png"));
  const iconSrc = `data:image/png;base64,${iconData.toString("base64")}`;

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

        {/* Orbital icon + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              background: "white",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} width={72} height={72} alt="" style={{ objectFit: "contain" }} />
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
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 10px",
          }}
        >
          <span>Dental lab logistics,</span>
          <span style={{ color: "#60A5FA" }}>finally solved.</span>
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
            gepeto.delivery
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
