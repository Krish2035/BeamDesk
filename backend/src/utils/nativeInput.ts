import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import { logger } from './logger.js';

class NativeInputController {
  private psProcess: ChildProcessWithoutNullStreams | null = null;
  private isReady: boolean = false;
  private isWindows: boolean = os.platform() === 'win32';
  private screenWidth: number = 1920;
  private screenHeight: number = 1080;

  constructor() {
    if (this.isWindows) {
      this.initWindowsController();
    }
  }

  private initWindowsController() {
    try {
      this.psProcess = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const setupScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public class WinMouse {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP = 0x0010;

  public static void Click(int x, int y, int button) {
    SetCursorPos(x, y);
    if (button == 0) {
      mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
      mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    } else if (button == 2) {
      mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
      mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
    }
  }

  public static void DblClick(int x, int y) {
    SetCursorPos(x, y);
    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    System.Threading.Thread.Sleep(50);
    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
  }

  public static void Move(int x, int y) {
    SetCursorPos(x, y);
  }
}
"@ -ReferencedAssemblies System.Windows.Forms
Write-Output "WIN_MOUSE_READY"
`;

      this.psProcess.stdout.on('data', (data) => {
        const str = data.toString();
        if (str.includes('WIN_MOUSE_READY')) {
          this.isReady = true;
          logger.info('Native Windows Mouse & Keyboard Driver initialized successfully');
        }
      });

      this.psProcess.stderr.on('data', (data) => {
        logger.warn('NativeInput stderr:', data.toString().trim());
      });

      this.psProcess.stdin.write(setupScript + '\n');
    } catch (err: any) {
      logger.error('Failed to initialize Native Windows Input Controller:', err);
    }
  }

  public setScreenDimensions(width: number, height: number) {
    if (width > 0 && height > 0) {
      this.screenWidth = width;
      this.screenHeight = height;
    }
  }

  public handleClick(xRatio: number, yRatio: number, button: number = 0, isDbl: boolean = false) {
    if (!this.isWindows || !this.psProcess || !this.isReady) return;

    const screenX = Math.round(Math.max(0, Math.min(1, xRatio)) * this.screenWidth);
    const screenY = Math.round(Math.max(0, Math.min(1, yRatio)) * this.screenHeight);

    if (isDbl) {
      this.psProcess.stdin.write(`[WinMouse]::DblClick(${screenX}, ${screenY})\n`);
    } else {
      this.psProcess.stdin.write(`[WinMouse]::Click(${screenX}, ${screenY}, ${button})\n`);
    }
  }

  public handleMove(xRatio: number, yRatio: number) {
    if (!this.isWindows || !this.psProcess || !this.isReady) return;

    const screenX = Math.round(Math.max(0, Math.min(1, xRatio)) * this.screenWidth);
    const screenY = Math.round(Math.max(0, Math.min(1, yRatio)) * this.screenHeight);

    this.psProcess.stdin.write(`[WinMouse]::Move(${screenX}, ${screenY})\n`);
  }

  public handleKey(key: string, _code?: string) {
    if (!this.isWindows || !this.psProcess || !this.isReady) return;

    // Send key to active Windows window
    try {
      if (key.length === 1) {
        // Alphanumeric or symbol
        this.psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('${key}')\n`);
      } else if (key === 'Enter') {
        this.psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')\n`);
      } else if (key === 'Backspace') {
        this.psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')\n`);
      } else if (key === 'Tab') {
        this.psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{TAB}')\n`);
      } else if (key === 'Escape') {
        this.psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{ESC}')\n`);
      }
    } catch (err) {
      logger.error('Error sending native keystroke:', err);
    }
  }

  public cleanup() {
    if (this.psProcess) {
      this.psProcess.kill();
      this.psProcess = null;
      this.isReady = false;
    }
  }
}

export const nativeInput = new NativeInputController();
