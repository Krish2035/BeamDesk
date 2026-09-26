import { execFile, exec } from 'child_process';
import fs from 'fs';
import { logger } from './logger.js';

export interface AdbDevice {
  id: string;
  state: 'device' | 'offline' | 'unauthorized' | 'unknown';
  model?: string;
  isWireless?: boolean;
}

class AdbInputService {
  private adbPath: string = 'adb';
  private displaySize: { width: number; height: number } | null = null;
  private isAvailable: boolean = false;
  private lastResolutionCheck: number = 0;

  constructor() {
    this.detectAdb();
  }

  private detectAdb() {
    const knownPaths = [
      'C:\\platform-tools-latest-windows\\platform-tools\\adb.exe',
      'C:\\platform-tools\\adb.exe',
      'C:\\Users\\DELL\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
    ];

    for (const p of knownPaths) {
      if (fs.existsSync(p)) {
        this.adbPath = p;
        this.isAvailable = true;
        logger.info(`[ADB Service] Found adb.exe at ${p}`);
        return;
      }
    }

    // Fallback to system PATH
    exec('adb version', (err) => {
      if (!err) {
        this.adbPath = 'adb';
        this.isAvailable = true;
        logger.info('[ADB Service] Found adb in system PATH');
      } else {
        logger.warn('[ADB Service] adb not found on system.');
      }
    });
  }

  public async getDevices(): Promise<AdbDevice[]> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['devices', '-l'], (err, stdout) => {
        if (err || !stdout) {
          return resolve([]);
        }

        const lines = stdout.split('\n');
        const devices: AdbDevice[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('List of devices')) continue;

          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const id = parts[0];
            const state = parts[1] as any;
            const modelPart = parts.find((p) => p.startsWith('model:'));
            const model = modelPart ? modelPart.replace('model:', '') : undefined;
            const isWireless = id.includes(':') || /^\d+\.\d+\.\d+\.\d+/.test(id);

            devices.push({ id, state, model, isWireless });
          }
        }

        resolve(devices);
      });
    });
  }

  public async isDeviceConnected(): Promise<boolean> {
    const devices = await this.getDevices();
    return devices.some((d) => d.state === 'device');
  }

  public async connectWireless(ip: string, port = 5555): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const target = `${ip.trim()}:${port}`;
      execFile(this.adbPath, ['connect', target], (err, stdout, stderr) => {
        const out = stdout || stderr || '';
        if (out.includes('connected to') || out.includes('already connected')) {
          this.displaySize = null; // Reset resolution cache
          resolve({ success: true, message: out.trim() });
        } else {
          resolve({ success: false, message: out.trim() || 'Failed to connect via ADB' });
        }
      });
    });
  }

  public async getDisplaySize(): Promise<{ width: number; height: number }> {
    const now = Date.now();
    if (this.displaySize && now - this.lastResolutionCheck < 60000) {
      return this.displaySize;
    }

    return new Promise((resolve) => {
      execFile(this.adbPath, ['shell', 'wm', 'size'], (err, stdout) => {
        if (!err && stdout) {
          // Output format: "Physical size: 1080x2400" or "Override size: ..."
          const match = stdout.match(/(\d+)x(\d+)/);
          if (match) {
            this.displaySize = {
              width: parseInt(match[1], 10),
              height: parseInt(match[2], 10),
            };
            this.lastResolutionCheck = now;
            logger.info(`[ADB Service] Detected Android physical display size: ${this.displaySize.width}x${this.displaySize.height}`);
            return resolve(this.displaySize);
          }
        }

        // Fallback standard Android 1080p tall resolution
        const fallback = { width: 1080, height: 2400 };
        resolve(fallback);
      });
    });
  }

  // Physical Tap (Click) on Android Screen
  public async tap(xRatio: number, yRatio: number) {
    const size = await this.getDisplaySize();
    const x = Math.round(Math.max(0, Math.min(1, xRatio)) * size.width);
    const y = Math.round(Math.max(0, Math.min(1, yRatio)) * size.height);

    execFile(this.adbPath, ['shell', 'input', 'tap', x.toString(), y.toString()], (err) => {
      if (err) {
        logger.warn(`[ADB] Tap failed at (${x}, ${y}): ${err.message}`);
      }
    });
  }

  // Physical Swipe / Drag / Scroll on Android Screen
  public async swipe(x1Ratio: number, y1Ratio: number, x2Ratio: number, y2Ratio: number, durationMs = 250) {
    const size = await this.getDisplaySize();
    const x1 = Math.round(Math.max(0, Math.min(1, x1Ratio)) * size.width);
    const y1 = Math.round(Math.max(0, Math.min(1, y1Ratio)) * size.height);
    const x2 = Math.round(Math.max(0, Math.min(1, x2Ratio)) * size.width);
    const y2 = Math.round(Math.max(0, Math.min(1, y2Ratio)) * size.height);

    execFile(
      this.adbPath,
      ['shell', 'input', 'swipe', x1.toString(), y1.toString(), x2.toString(), y2.toString(), durationMs.toString()],
      (err) => {
        if (err) {
          logger.warn(`[ADB] Swipe failed: ${err.message}`);
        }
      }
    );
  }

  // Physical Android Key Event (Back, Home, Recents, Power, etc.)
  public async keyevent(code: number | string) {
    execFile(this.adbPath, ['shell', 'input', 'keyevent', code.toString()], (err) => {
      if (err) {
        logger.warn(`[ADB] Keyevent ${code} failed: ${err.message}`);
      }
    });
  }

  // Type text directly into active Android input field
  public async text(rawText: string) {
    if (!rawText) return;
    // Replace spaces with %s for adb shell input text
    const sanitized = rawText.replace(/ /g, '%s').replace(/["'\\$&;()|<>{}]/g, '');
    execFile(this.adbPath, ['shell', 'input', 'text', sanitized], (err) => {
      if (err) {
        logger.warn(`[ADB] Text input failed: ${err.message}`);
      }
    });
  }

  // Expand or collapse Android notification shade
  public async toggleNotifications(expand = true) {
    const action = expand ? 'expand-notifications' : 'collapse';
    execFile(this.adbPath, ['shell', 'cmd', 'statusbar', action], (err) => {
      if (err) {
        this.keyevent('KEYCODE_NOTIFICATION');
      }
    });
  }
}

export const adbInput = new AdbInputService();
