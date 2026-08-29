# LiPrep

LiPrep (Libre Prep) is an open-source, local-first SAT practice platform with zero paywalls, tracking, or fluff.

---

## ✨ Features

- **100% Offline-First:** Fully functional without an internet connection (PWA + All progress data stored locally).
- **Bluebook Interface:** Simulates Bluebook's UI with all necessary features like Desmos.
- **Cool Analytics:** nice lookin stats that give you useful insight to do targeted practice.
- **Private:** All progress, attempts, and question data remain strictly on your local device.

---
## 📸 Screenshots
<img width="1900" height="958" alt="image" src="https://github.com/user-attachments/assets/3989c0f9-49db-46f8-8460-5bce0d72af8c" />
<img width="1791" height="980" alt="image" src="https://github.com/user-attachments/assets/ae13437c-1023-44f3-9321-4c9fc840636e" />
<img width="1782" height="981" alt="image" src="https://github.com/user-attachments/assets/bc6b08c4-106b-4c3b-9499-d58d7f5eef2b" />

---
## 🚀 How to use
- Go to https://liprep.pages.dev/
- Press the `install` button that shows up in your Browser somewhere if you want to use liprep offline.
- Now, you will need to bring your own `.json` question bank copy, import it to liprep, and you're good to go!

---
## 🏗️ Building Liprep locally
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
