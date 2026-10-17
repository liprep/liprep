import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import path from 'path';

function gitOutput(command: string): string | null {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

// Cloudflare Pages injects CF_PAGES_COMMIT_SHA into the build environment.
// All values are inlined at build time so the app can display them fully offline.
function resolveBuildInfo() {
  const commitSha = process.env.CF_PAGES_COMMIT_SHA ?? gitOutput('git rev-parse HEAD');
  const commitMessage = gitOutput('git log -1 --pretty=%s') ?? '';
  const commitDateIso = gitOutput('git log -1 --pretty=%cs') ?? '';
  const commitDate = commitDateIso
    ? new Date(`${commitDateIso}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';
  const version = commitSha?.slice(0, 7) ?? 'dev';
  return { version, commitSha: commitSha ?? '', commitMessage, commitDate };
}

const {
  version: APP_VERSION,
  commitSha: APP_COMMIT_SHA,
  commitMessage: APP_COMMIT_MESSAGE,
  commitDate: APP_COMMIT_DATE,
} = resolveBuildInfo();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT_SHA__: JSON.stringify(APP_COMMIT_SHA),
    __APP_COMMIT_MESSAGE__: JSON.stringify(APP_COMMIT_MESSAGE),
    __APP_COMMIT_DATE__: JSON.stringify(APP_COMMIT_DATE),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5000,
  },
});
