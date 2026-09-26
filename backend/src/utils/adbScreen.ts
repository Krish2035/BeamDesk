import { spawn, ChildProcess } from 'child_process';
import EventEmitter from 'events';
import fs from 'fs';
import { logger } from './logger.js';

class AdbScreenService extends EventEmitter {
  private adbPath = 'adb';
  private isStreaming = false;
  private currentFrame: Buffer | null = null;
  private captureProcess: ChildProcess | null = null;
  private intervalTimer: any = null;

  constructor() {
    super();
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
        return;
      }
    }
  }

  public getLatestFrame(): Buffer | null {
    return this.currentFrame;
  }

  // Capture a single PNG/JPEG frame from connected Android device
  public async captureSingleFrame(): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const proc = spawn(this.adbPath, ['exec-out', 'screencap', '-p']);
      const chunks: Buffer[] = [];

      proc.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      proc.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          const buffer = Buffer.concat(chunks);
          this.currentFrame = buffer;
          resolve(buffer);
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => {
        resolve(null);
      });
    });
  }

  // Start continuous frame capture loop for low-latency live mirroring
  public startStream(fps = 20) {
    if (this.isStreaming) return;
    this.isStreaming = true;
    const intervalMs = Math.max(33, Math.round(1000 / fps));

    let inFlight = false;

    this.intervalTimer = setInterval(async () => {
      if (inFlight || !this.isStreaming) return;
      inFlight = true;

      try {
        const frame = await this.captureSingleFrame();
        if (frame && frame.length > 1000) {
          this.currentFrame = frame;
          this.emit('frame', frame);
        }
      } catch (err) {
        // Ignored during streaming
      } finally {
        inFlight = false;
      }
    }, intervalMs);

    logger.info(`[ADB Screen] Stream started at ~${fps} FPS`);
  }

  public stopStream() {
    this.isStreaming = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    logger.info('[ADB Screen] Stream stopped');
  }

  public isActive(): boolean {
    return this.isStreaming;
  }
}

export const adbScreen = new AdbScreenService();
