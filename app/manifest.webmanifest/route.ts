import { NextRequest, NextResponse } from "next/server";

import baseManifest from "../../public/manifest.json";
import { readPwaDisplayPreference } from "@/lib/pwa-display-mode";

export const runtime = "nodejs";

// Edge's installed PWA renders the top status-bar area as a solid band in
// `standalone` mode instead of showing the native status bar. Serving
// `minimal-ui` brings the native status bar (clock/battery/signal) back —
// but ONLY for Edge, so Chrome/others keep the fully immersive look.
// The manifest is fetched per browser at install time, so UA sniffing here works.
// Takes effect only on (re)install.
//
// theme_color / background_color stay light in every branch: a dark manifest
// theme_color makes Android paint a solid black system-status-bar band above
// light pages. Runtime status-bar tone is driven live by <meta name=theme-color>.
//
// An explicit cookie can override the install mode. With no cookie, keep the
// upstream behavior so existing installs and users are not silently changed.
export function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent") || "";
  const isEdge = /Edg/i.test(ua);
  const preference = readPwaDisplayPreference(request.headers.get("cookie") || "");

  const manifest = preference === "fullscreen"
    ? {
        ...baseManifest,
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
      }
    : preference === "standalone"
      ? {
          ...baseManifest,
          display: isEdge ? "minimal-ui" : "standalone",
          display_override: isEdge ? ["minimal-ui", "standalone"] : ["standalone", "minimal-ui"],
        }
      : isEdge
        ? {
            ...baseManifest,
            display: "minimal-ui",
            display_override: ["minimal-ui", "standalone"],
          }
        : baseManifest;

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "vary": "user-agent, cookie",
      "cache-control": "no-store",
    },
  });
}
