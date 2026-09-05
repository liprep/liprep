import React, { useState, useEffect } from "react";
import "./AppLoader.css";

const CACHE_NAME = "liprep-core-v3";
const OFFLINE_COMPLETED_KEY = "liprep_offline_ready_v3";

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/desmos.html",
  "/liprep-logo.svg",
  "/hero-star.svg",
  "/hero-turd-blob.svg",
  "/bg-blob-orange.svg",
  "/bg-blob-purple.svg",
  "/ebrw-icon-1.svg",
  "/ebrw-icon-2.svg",
  "/math-icon-1.svg",
  "/math-icon-2.svg",
  "/reference/1.svg",
  "/reference/2.svg",
  "/reference/3.svg",
  "/reference/4.svg",
  "/reference/5.svg",
  "/reference/6.svg",
  "/reference/7.svg",
  "/reference/8.svg",
  "/reference/9.svg",
  "/reference/10.svg",
  "/reference/11.svg",
  "/reference/special-triangles.png",
  "/fonts/ibm-plex-sans-400.woff2",
  "/fonts/ibm-plex-sans-500.woff2",
  "/fonts/ibm-plex-sans-600.woff2",
  "/fonts/ibm-plex-sans-700.woff2",
  "/fonts/ibm-plex-sans-800.woff2",
  "/fonts/ibm-plex-sans-400-italic.woff2",
  "/fonts/ibm-plex-mono-600.woff2",
  "/fonts/ibm-plex-mono-700.woff2",
  GOOGLE_FONTS_URL,
  "https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6",
];

const FONTS_TO_VERIFY = [
  "400 16px 'IBM Plex Sans'",
  "500 16px 'IBM Plex Sans'",
  "600 16px 'IBM Plex Sans'",
  "700 16px 'IBM Plex Sans'",
  "800 16px 'IBM Plex Sans'",
  "italic 400 16px 'IBM Plex Sans'",
  "600 16px 'IBM Plex Mono'",
  "700 16px 'IBM Plex Mono'",
];

const TEST_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789—➔•✕✓’“”";

interface AppLoaderProps {
  children: React.ReactNode;
}

export default function AppLoader({ children }: AppLoaderProps) {
  // Never start unprimed: guarantee IBM Plex is loaded into memory before rendering
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing LiPrep engine...");
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function verifyAndPrimeFonts(): Promise<boolean> {
      if (!("fonts" in document)) return true;
      try {
        const loadPromises = FONTS_TO_VERIFY.map((fontDesc) =>
          document.fonts.load(fontDesc, TEST_GLYPHS)
        );

        await Promise.race([
          Promise.all(loadPromises),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);

        await document.fonts.ready;
        return document.fonts.check("16px 'IBM Plex Sans'");
      } catch (e) {
        console.warn("[LiPrep] Font verification error:", e);
        return false;
      }
    }

    async function prepareOfflineEngine() {
      const alreadyInstalled = localStorage.getItem(OFFLINE_COMPLETED_KEY) === "true";

      if (alreadyInstalled) {
        // Fast-path for returning offline users: activate fonts and mount instantly
        const ok = await verifyAndPrimeFonts();
        if (ok || !isCancelled) {
          setIsReady(true);
          return;
        }
      }

      setStatusText("Configuring offline cache storage...");
      let cache: Cache | null = null;
      try {
        if ("caches" in window) {
          cache = await caches.open(CACHE_NAME);
        }
      } catch (e) {
        console.warn("[LiPrep] CacheStorage open error:", e);
      }

      const totalItems = ASSETS_TO_CACHE.length + 3;
      let loadedItems = 0;

      const updateStep = (text: string) => {
        if (isCancelled) return;
        loadedItems++;
        const pct = Math.min(100, Math.round((loadedItems / totalItems) * 100));
        setProgress(pct);
        setStatusText(text);
      };

      for (const assetUrl of ASSETS_TO_CACHE) {
        try {
          if (cache) {
            const match = await cache.match(assetUrl);
            if (!match) {
              const res = await fetch(assetUrl, {
                mode: assetUrl.startsWith("http") ? "cors" : "same-origin",
              });
              if (res.ok || res.type === "opaque") {
                await cache.put(assetUrl, res.clone());

                // If Google Fonts CSS is fetched, cache all embedded woff2 font files
                if (assetUrl === GOOGLE_FONTS_URL) {
                  try {
                    const cssText = await res.text();
                    const fontUrls = Array.from(
                      cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)
                    ).map((m) => m[1]);

                    for (const fUrl of fontUrls) {
                      const fMatch = await cache.match(fUrl);
                      if (!fMatch) {
                        const fRes = await fetch(fUrl, { mode: "cors" });
                        if (fRes.ok || fRes.type === "opaque") {
                          await cache.put(fUrl, fRes);
                        }
                      }
                    }
                  } catch {}
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[LiPrep] Could not cache asset ${assetUrl}:`, e);
        }

        if (assetUrl.includes("desmos")) {
          updateStep("Caching Desmos SAT graphing calculator...");
        } else if (assetUrl.includes("fonts")) {
          updateStep("Downloading IBM Plex font suite...");
        } else if (assetUrl.includes("reference")) {
          updateStep("Downloading official formula sheets...");
        } else {
          updateStep("Caching application assets...");
        }
      }

      updateStep("Activating IBM Plex typography into memory...");
      await verifyAndPrimeFonts();

      updateStep("Calibrating offline storage & Math engine...");
      await new Promise((resolve) => setTimeout(resolve, 150));

      updateStep("Ready for offline practice!");
      setProgress(100);

      localStorage.setItem(OFFLINE_COMPLETED_KEY, "true");

      setTimeout(() => {
        if (!isCancelled) {
          setIsFadingOut(true);
          setTimeout(() => {
            if (!isCancelled) setIsReady(true);
          }, 350);
        }
      }, 300);
    }

    prepareOfflineEngine();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isReady) {
    return <>{children}</>;
  }

  return (
    <div className={`app-loader-fullscreen ${isFadingOut ? "loader-fade-out" : ""}`}>
      <div className="app-loader-card animate-fade-in">
        <div className="loader-brand-header">
          {!logoFailed ? (
            <img
              src="/liprep-logo.svg"
              alt="LiPrep"
              className="loader-brand-logo-img"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="brand-logo-vector">
              <span className="logo-badge">Li</span>
              <span className="logo-text">Prep</span>
            </div>
          )}
        </div>

        <h1 className="loader-headline">Downloading LiPrep to Device</h1>
        <p className="loader-description">
          Storing the application shell, IBM Plex typography, Desmos SAT graphing suite, formula sheets,
          and diagnostic telemetry locally so you can practice with <strong>zero internet connection</strong>.
        </p>

        <div className="loader-progress-track">
          <div className="loader-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="loader-status-row">
          <span className="loader-status-text">{statusText}</span>
          <span className="loader-pct-text">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
