import React, { useState, useEffect } from "react";
import "./AppLoader.css";

// Fallback if /sw.js cannot be fetched/parsed. The live value is discovered
// at runtime by parsing SHELL_CACHE out of /sw.js (single source of truth),
// so bumping the version in sw.js is enough — no manual sync needed.
const SHELL_CACHE_FALLBACK = "liprep-shell-v8";
const RUNTIME_CACHE = "liprep-runtime-v1";
const OFFLINE_COMPLETED_KEY = "liprep_offline_ready_v8";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
  "/icons.svg",
  "/liprep-logo.svg",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/apple-touch-icon.png",
  "/desmos.html",
  "/desmos-calculator.js",
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
  "/fonts/ibm-plex-sans-400-italic.woff2",
  "/fonts/ibm-plex-mono-600.woff2",
  "/fonts/ibm-plex-mono-700.woff2",
  "/fonts/stix-two-math-400.woff2",
];

// Shell must contain these or offline boot is impossible — the ready flag is
// only set when ALL of these verify from cache.
const CRITICAL_SHELL_ASSETS = [
  "/index.html",
  "/desmos.html",
  "/desmos-calculator.js",
];

const FONTS_TO_VERIFY = [
  "400 16px 'IBM Plex Sans'",
  "500 16px 'IBM Plex Sans'",
  "600 16px 'IBM Plex Sans'",
  "700 16px 'IBM Plex Sans'",
  "italic 400 16px 'IBM Plex Sans'",
  "600 16px 'IBM Plex Mono'",
  "700 16px 'IBM Plex Mono'",
  "400 16px 'STIX Two Math'",
];

const TEST_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789—➔•✕✓’“”";
const MATH_TEST_GLYPHS = "∀∂∃∅∇∈∉∋∏∑−√∞∠∧∨∩∪∫∴∼≅≈≠≡≤≥⊂⊃⊕⊗⋅αβπθλμ0123456789+=";

interface AppLoaderProps {
  children: React.ReactNode;
}

/** Parse SHELL_CACHE out of the live service worker — single source of truth. */
async function resolveShellCacheName(): Promise<string> {
  try {
    const res = await fetch("/sw.js", { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/const\s+SHELL_CACHE\s*=\s*"([^"]+)"/);
      if (match?.[1]) return match[1];
    }
  } catch {
    // Offline or unparsable: fall back to the compiled-in constant.
  }
  return SHELL_CACHE_FALLBACK;
}

/**
 * Hashed Vite bundles (/assets/index-*.js/css) can't be listed at build time
 * in sw.js. Collect whatever this page actually loaded so the first online
 * visit caches them — closing the "needs two online loads" offline gap
 * (the SW can't intercept the page that installed it until reload).
 */
function getCurrentBundleUrls(): string[] {
  const urls = new Set<string>();
  try {
    document.querySelectorAll("script[src]").forEach((el) => {
      const src = (el as HTMLScriptElement).src;
      if (src) urls.add(src);
    });
    document
      .querySelectorAll('link[rel="stylesheet"][href]')
      .forEach((el) => {
        const href = (el as HTMLLinkElement).href;
        if (href) urls.add(href);
      });
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    for (const entry of resources) {
      if (entry.name && entry.name.includes("/assets/")) urls.add(entry.name);
    }
  } catch {
    // Non-fatal: bundles just won't be explicitly primed this run.
  }
  return [...urls].filter((u) => {
    try {
      return new URL(u, window.location.origin).origin === window.location.origin;
    } catch {
      return false;
    }
  });
}

async function cacheUrl(cache: Cache | null, url: string): Promise<boolean> {
  if (!cache) return false;
  try {
    const match = await cache.match(url);
    if (match) return true;
    const res = await fetch(url, { mode: "same-origin" });
    if (res.ok) {
      await cache.put(url, res.clone());
      return true;
    }
    return false;
  } catch {
    return false;
  }
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
          document.fonts.load(
            fontDesc,
            fontDesc.includes("STIX Two Math") ? MATH_TEST_GLYPHS : TEST_GLYPHS
          )
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

    async function isOfflineReady(
      shellCache: Cache | null,
      runtimeCache: Cache | null
    ): Promise<boolean> {
      if (!shellCache || !runtimeCache) return false;
      try {
        // Critical shell files must all be cached…
        for (const asset of CRITICAL_SHELL_ASSETS) {
          const hit = await shellCache.match(asset);
          if (!hit) return false;
        }
        const indexHit = await shellCache.match("/index.html");
        if (!indexHit) return false;
        // …and the exact bundles THIS page booted from must be cached,
        // otherwise the next offline boot has HTML but no JS/CSS.
        for (const bundleUrl of getCurrentBundleUrls()) {
          const hit =
            (await runtimeCache.match(bundleUrl)) ||
            (await shellCache.match(bundleUrl));
          if (!hit) return false;
        }
        return true;
      } catch {
        return false;
      }
    }

    async function prepareOfflineEngine() {
      const shellCacheName = await resolveShellCacheName();
      const flagReady = localStorage.getItem(OFFLINE_COMPLETED_KEY) === "true";

      let shellCache: Cache | null = null;
      let runtimeCache: Cache | null = null;
      try {
        if ("caches" in window) {
          shellCache = await caches.open(shellCacheName);
          runtimeCache = await caches.open(RUNTIME_CACHE);
        }
      } catch (e) {
        console.warn("[LiPrep] CacheStorage open error:", e);
      }

      if (flagReady && shellCache && runtimeCache) {
        // Fast-path for returning users — but VERIFY first. A stale flag
        // from a failed prime or a new SW version must not skip caching.
        const verified = await isOfflineReady(shellCache, runtimeCache);
        if (verified) {
          await verifyAndPrimeFonts();
          if (!isCancelled) setIsReady(true);
          return;
        }
        // Flag lied (or caches were evicted): fall through to full prime.
        console.warn("[LiPrep] Offline flag set but cache incomplete — re-priming.");
      }

      setStatusText("Configuring offline cache storage...");
      const bundleUrls = getCurrentBundleUrls();
      const totalItems = ASSETS_TO_CACHE.length + bundleUrls.length + 3;
      let loadedItems = 0;

      const updateStep = (text: string) => {
        if (isCancelled) return;
        loadedItems++;
        const pct = Math.min(100, Math.round((loadedItems / totalItems) * 100));
        setProgress(pct);
        setStatusText(text);
      };

      let shellFailures = 0;
      for (const assetUrl of ASSETS_TO_CACHE) {
        const ok = await cacheUrl(shellCache, assetUrl);
        if (!ok) shellFailures++;

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

      let bundleFailures = 0;
      for (const bundleUrl of bundleUrls) {
        try {
          if (runtimeCache) {
            const hit =
              (await runtimeCache.match(bundleUrl)) ||
              (await shellCache?.match(bundleUrl));
            if (!hit) {
              const res = await fetch(bundleUrl, { mode: "same-origin" });
              if (res.ok) {
                await runtimeCache.put(bundleUrl, res.clone());
              } else {
                bundleFailures++;
              }
            }
          }
        } catch {
          bundleFailures++;
        }
        updateStep("Caching application code for offline use...");
      }

      updateStep("Activating IBM Plex typography into memory...");
      await verifyAndPrimeFonts();

      updateStep("Calibrating offline storage & Math engine...");
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Only claim offline-readiness when the critical shell + this page's
      // exact bundles verify from cache. Otherwise clear the flag so the
      // next launch retries instead of fast-pathing on a lie.
      const criticalOk = await isOfflineReady(shellCache, runtimeCache);
      if (criticalOk) {
        localStorage.setItem(OFFLINE_COMPLETED_KEY, "true");
        updateStep("Ready for offline practice!");
      } else {
        localStorage.removeItem(OFFLINE_COMPLETED_KEY);
        console.warn(
          `[LiPrep] Offline prime incomplete (shell failures: ${shellFailures}, bundle failures: ${bundleFailures}) — will retry next launch. App still usable online.`
        );
        updateStep(
          shellFailures > 0 || bundleFailures > 0
            ? "Some offline files failed — connect and reload to retry."
            : "Ready for offline practice!"
        );
      }
      setProgress(100);

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
