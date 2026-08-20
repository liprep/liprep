# LiPrep

> A fast, free, and offline-first digital SAT practice suite.

LiPrep (Libre Prep) is an open-source, local-first test prep platform designed to replicate the Bluebook testing experience with zero paywalls, tracking, or fluff.

---

## ✨ Features

- ⚡ **100% Offline-First:** Fully functional without an internet connection using IndexedDB & CacheStorage.
- 🎯 **Bluebook Interface:** Authentic digital SAT UI, including student-produced response (SPR) parsing and option elimination.
- 📊 **Telemetry & Analytics:** Deep diagnostic metrics—accuracy curves, pacing quadrant matrix, and domain equilibrium radar.
- 📐 **Integrated Tools:** Embedded Desmos SAT graphing calculator & official math reference sheet.
- 🔒 **Private:** All progress, attempts, and question data remain strictly on your local device.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/liprep/liprep.git

# Navigate to the project directory
cd liprep

# Install dependencies
npm install

# Start local dev server
npm run dev
```

### Building for Production

```bash
npm run build
```

---

## 🛠 Tech Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** Custom Retro CSS + Tailwind
- **Local Database:** Dexie.js (IndexedDB)
- **Math/Rich Content:** Native MathML + DOMPurify + HTML-React-Parser

---

## 📄 License

MIT © [LiPrep](https://github.com/liprep)
