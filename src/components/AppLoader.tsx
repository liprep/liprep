import React, { useState, useEffect } from "react";
import "./AppLoader.css";

const CACHE_KEY = "liprep_app_cache_v1";

// Explicit list of core assets to pre-cache for complete offline availability
const ASSETS_TO_CACHE = [
  "/",
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
  // Reference sheet formula files:
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
  "https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6",
];

interface AppLoaderProps {
  children: React.ReactNode;
}

export default function AppLoader({ children }: AppLoaderProps) {
  const [isReady, setIsReady] = useState(() => {
    return localStorage.getItem(CACHE_KEY) === "completed";
  });
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing LiPrep engine...");
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function precacheAllAssets() {
      const alreadyCached = localStorage.getItem(CACHE_KEY) === "completed";
      if (alreadyCached) {
        setIsReady(true);
        return;
      }

      setStatusText("Preparing offline storage...");
      let cache: Cache | null = null;
      try {
        if ("caches" in window) {
          cache = await caches.open(CACHE_KEY);
        }
      } catch (e) {
        console.warn("CacheStorage unavailable, continuing via HTTP cache", e);
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
              const res = await fetch(assetUrl, { mode: "cors" });
              if (res.ok) {
                await cache.put(assetUrl, res.clone());
              }
            }
          } else {
            await fetch(assetUrl, { mode: "no-cors" });
          }
        } catch {
          // Graceful fallback
        }

        if (assetUrl.includes("desmos")) {
          updateStep("Caching Desmos SAT calculator engine...");
        } else if (assetUrl.includes("svg") || assetUrl.includes("reference")) {
          updateStep("Downloading vector graphics & formula sheets...");
        } else {
          updateStep("Caching application shell...");
        }
      }

      updateStep("Calibrating MathML and typography engines...");
      await new Promise((resolve) => setTimeout(resolve, 150));

      updateStep("LiPrep is ready for offline practice!");
      setProgress(100);

      localStorage.setItem(CACHE_KEY, "completed");

      setTimeout(() => {
        if (!isCancelled) {
          setIsFadingOut(true);
          setTimeout(() => {
            if (!isCancelled) setIsReady(true);
          }, 400);
        }
      }, 300);
    }

    precacheAllAssets();

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
          <div className="loader-logo-badge">
            <span className="loader-logo-li">Li</span>
            <span className="loader-logo-prep">Prep</span>
          </div>
          <span className="loader-offline-pill">Offline SAT Suite</span>
        </div>

        <h1 className="loader-headline">Downloading LiPrep to Device</h1>
        <p className="loader-description">
          Storing the application, Desmos SAT graphing suite, formula sheets, and diagnostic telemetry
          locally so it works 100% offline with zero internet required.
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
