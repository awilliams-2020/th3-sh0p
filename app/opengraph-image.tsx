import { ImageResponse } from "next/og";

// Link-preview card (og:image / twitter:image). Same mark as app/icon.svg, same palette as globals.css.
export const alt = "zwznco — Adam Williams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#0e0e0d",
          color: "#fafaf9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <svg width="128" height="128" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#1f1f1d" />
            <path d="M9.5 9.5h13l-13 13h13" fill="none" stroke="#fafaf9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.5 22.5h13" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -4 }}>zwznco</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 40, color: "#737370" }}>
          Adam Williams · Projects, metrics, and live snapshots
        </div>
      </div>
    ),
    size,
  );
}
