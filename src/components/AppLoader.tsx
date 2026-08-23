import React, { useState, useEffect } from "react";
import "./AppLoader.css";

const CACHE_NAME = "liprep-core-v1";
const OFFLINE_COMPLETED_KEY = "liprep_offline_ready_v1";

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
  "https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6",
];

interface AppLoaderProps {
  children: React.ReactNode;
}

export default function AppLoader({ children }: AppLoaderProps) {
  const [isReady, setIsReady] = useState(() => {
    return localStorage.getItem(OFFLINE_COMPLETED_KEY) === "true";
  });
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing LiPrep engine...");
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function prepareOfflineEngine() {
      if (localStorage.getItem(OFFLINE_COMPLETED_KEY) === "true") {
        setIsReady(true);
        return;
      }

      setStatusText("Configuring offline cache storage...");
      let cache: Cache | null = null;
      try {
        if ("caches" in window) {
          cache = await caches.open(CACHE_NAME);
        }
      } catch (e) {
        console.warn("CacheStorage open error:", e);
      }

      const totalItems = ASSETS_TO_CACHE.length + 2;
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
              }
            }
          }
        } catch (e) {
          console.warn(`Could not cache asset ${assetUrl}:`, e);
        }

        if (assetUrl.includes("desmos")) {
          updateStep("Caching Desmos SAT graphing calculator...");
        } else if (assetUrl.includes("reference")) {
          updateStep("Downloading official formula sheets...");
        } else {
          updateStep("Caching application assets...");
        }
      }

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
          <span className="loader-offline-pill">Offline SAT Suite</span>
        </div>

        <h1 className="loader-headline">Downloading LiPrep to Device</h1>
        <p className="loader-description">
          Storing the application shell, Desmos SAT graphing suite, formula sheets, and diagnostic telemetry
          locally so you can practice with <strong>zero internet connection</strong>.
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
