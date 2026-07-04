import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const targetUrl = process.argv[2] ?? 'http://127.0.0.1:5173/?renderer=r3f';
const outDir = path.resolve(process.argv[3] ?? '.qa');
const chromium = process.env.CHROMIUM_PATH || findChromium();
const viewportWidth = Number(process.env.QA_WIDTH ?? 1440);
const viewportHeight = Number(process.env.QA_HEIGHT ?? 900);
const waitMs = Number(process.env.QA_WAIT_MS ?? 12000);
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(path.join(os.tmpdir(), 'magic-academy-cdp-profile-'));

mkdirSync(outDir, { recursive: true });

const browser = spawn(chromium, [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--ignore-certificate-errors',
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  `--window-size=${viewportWidth},${viewportHeight}`,
  '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const browserLogs = [];
browser.stdout.on('data', (chunk) => browserLogs.push(chunk.toString()));
browser.stderr.on('data', (chunk) => browserLogs.push(chunk.toString()));

const consoleEvents = [];
const exceptions = [];

function findChromium() {
  const candidates = [
    '/snap/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return 'chromium';
}

async function waitForCdp(portNumber) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${portNumber}/json/version`);
      if (response.ok) return;
    } catch {
      await delay(120);
    }
  }
  throw new Error('Timed out waiting for Chromium CDP');
}

async function createPage(portNumber) {
  const response = await fetch(`http://127.0.0.1:${portNumber}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
  });
  if (!response.ok) throw new Error(`Failed to create page: ${response.status}`);
  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.eventWaiters = new Map();
  }

  async open() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method) {
        for (const listener of this.listeners) listener(message);
        const waiters = this.eventWaiters.get(message.method);
        if (waiters) {
          for (const waiter of waiters) waiter(message);
          this.eventWaiters.delete(message.method);
        }
      }
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
    });
  }

  onEvent(listener) {
    this.listeners.push(listener);
  }

  waitForEvent(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP event timeout: ${method}`)), timeoutMs);
      const waiters = this.eventWaiters.get(method) ?? [];
      waiters.push((message) => {
        clearTimeout(timer);
        resolve(message);
      });
      this.eventWaiters.set(method, waiters);
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  try {
    await waitForCdp(port);
    const page = await createPage(port);
    const cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.open();
    cdp.onEvent((message) => {
      if (message.method === 'Runtime.consoleAPICalled') {
        consoleEvents.push({
          type: message.params.type,
          args: message.params.args?.map((arg) => arg.value ?? arg.description ?? arg.type),
        });
      }
      if (message.method === 'Runtime.exceptionThrown') {
        exceptions.push(message.params.exceptionDetails);
      }
      if (message.method === 'Log.entryAdded') {
        consoleEvents.push({
          type: message.params.entry.level,
          args: [message.params.entry.text],
        });
      }
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: viewportWidth < 700,
    });
    await cdp.send('Page.navigate', { url: targetUrl });
    await cdp.waitForEvent('Page.loadEventFired', 10000);
    await delay(waitMs);

    const evaluation = await cdp.send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(() => {
        const canvas = document.querySelector('canvas');
        const shell = document.querySelector('.r3f-canvas-shell');
        const debug = window.__game && typeof window.__game.getDebugState === 'function'
          ? window.__game.getDebugState()
          : null;
        return {
          title: document.title,
          bodyClass: document.body.className,
          shell: shell ? {
            clientWidth: shell.clientWidth,
            clientHeight: shell.clientHeight,
            text: shell.textContent,
          } : null,
          canvas: canvas ? {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            dataEngine: canvas.getAttribute('data-engine'),
          } : null,
          debug,
          diagnostics: window.__r3fSceneDiagnostics || null,
          assetLoads: window.__r3fAssetLoads || null,
          chunkRenderState: window.__r3fChunkRenderState || null,
          resources: performance.getEntriesByType('resource')
            .filter((entry) => entry.name.includes('/assets/world/') || entry.name.includes('/assets/models/'))
            .map((entry) => ({
              name: entry.name,
              initiatorType: entry.initiatorType,
              duration: Math.round(entry.duration),
              transferSize: entry.transferSize || 0,
              encodedBodySize: entry.encodedBodySize || 0,
            })),
        };
      })()`,
    });

    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const screenshotPath = path.join(outDir, `r3f-cdp-${viewportWidth}x${viewportHeight}.png`);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    const report = {
      targetUrl,
      viewport: { width: viewportWidth, height: viewportHeight },
      waitMs,
      screenshotPath,
      evaluation: evaluation.result?.value,
      consoleEvents,
      exceptions,
      browserLogs: browserLogs.join('').split('\n').filter(Boolean).slice(-40),
    };
    writeFileSync(path.join(outDir, 'r3f-cdp-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));

    cdp.close();
    return exceptions.length > 0 ? 2 : 0;
  } finally {
    await terminateBrowser();
  }
}

async function terminateBrowser() {
  if (browser.pid) {
    try {
      process.kill(-browser.pid, 'SIGTERM');
    } catch {
      try {
        browser.kill('SIGTERM');
      } catch {
        // Browser is already gone.
      }
    }
    await delay(700);
    try {
      process.kill(-browser.pid, 'SIGKILL');
    } catch {
      // Process group exited after SIGTERM.
    }
  }
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Temporary profile cleanup is best-effort.
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
