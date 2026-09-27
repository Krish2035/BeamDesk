/**
 * BeamDesk Windows Desktop Input Agent
 * 
 * Allows remote mobile devices to click and control the entire Windows laptop
 * (Desktop, Start Menu, Taskbar, and all Windows applications).
 */

const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const PORT = 49152;
const isWindows = os.platform() === 'win32';

let screenWidth = 1920;
let screenHeight = 1080;
let isReady = false;
let psProcess = null;

// Initialize Windows PowerShell Win32 Input Driver
function initWindowsDriver() {
  if (!isWindows) {
    console.log('[BeamDesk Agent] Warning: Not running on Windows. OS mouse control is only active on Windows.');
    return;
  }

  try {
    psProcess = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const setupScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinMouse {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
  public const uint MOUSEEVENTF_WHEEL = 0x0800;

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

  public static void MouseDown(int x, int y, int button) {
    SetCursorPos(x, y);
    if (button == 0) {
      mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
    } else if (button == 2) {
      mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
    }
  }

  public static void MouseUp(int x, int y, int button) {
    SetCursorPos(x, y);
    if (button == 0) {
      mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    } else if (button == 2) {
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

  public static void Scroll(int amount) {
    mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)amount, 0);
  }
}
"@ -ReferencedAssemblies System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "WIN_DRIVER_READY:$($screen.Width):$($screen.Height)"
`;

    psProcess.stdout.on('data', (data) => {
      const str = data.toString();
      if (str.includes('WIN_DRIVER_READY')) {
        const match = str.match(/WIN_DRIVER_READY:(\d+):(\d+)/);
        if (match) {
          screenWidth = parseInt(match[1], 10);
          screenHeight = parseInt(match[2], 10);
        }
        isReady = true;
        console.log(`[BeamDesk Agent] ✓ Windows OS Input Driver Active`);
        console.log(`[BeamDesk Agent] ✓ Screen Resolution: ${screenWidth}x${screenHeight}`);
        console.log(`[BeamDesk Agent] ✓ Ready to receive remote clicks from your phone!\n`);
      }
    });

    psProcess.stderr.on('data', (data) => {
      const err = data.toString().trim();
      if (err) console.error('[BeamDesk Agent] PowerShell:', err);
    });

    psProcess.stdin.write(setupScript + '\n');
  } catch (err) {
    console.error('[BeamDesk Agent] Failed to initialize Windows driver:', err);
  }
}

function handleInput(payload) {
  if (!isWindows || !isReady || !psProcess) return;

  const { action, x, y, button = 0, isDrag = false, key } = payload;

  if (action === 'key' && key) {
    try {
      if (key === 'Enter') {
        psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')\n`);
      } else if (key === 'Backspace') {
        psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')\n`);
      } else if (key === 'Tab') {
        psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{TAB}')\n`);
      } else if (key === 'Escape') {
        psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('{ESC}')\n`);
      } else if (key === ' ' || key === 'Space') {
        psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait(' ')\n`);
      } else if (key.length === 1) {
        // Escape special SendKeys characters: + ^ % ~ ( ) { } [ ]
        const escaped = key.replace(/([+^%~(){}[\]])/g, '{$1}');
        psProcess.stdin.write(`[System.Windows.Forms.SendKeys]::SendWait('${escaped}')\n`);
      }
    } catch (e) {
      console.error('[BeamDesk Agent] Error injecting keystroke:', e);
    }
    return;
  }

  if (typeof x !== 'number' || typeof y !== 'number') return;

  const screenX = Math.round(Math.max(0, Math.min(1, x)) * screenWidth);
  const screenY = Math.round(Math.max(0, Math.min(1, y)) * screenHeight);

  switch (action) {
    case 'click':
      psProcess.stdin.write(`[WinMouse]::Click(${screenX}, ${screenY}, ${button})\n`);
      break;
    case 'mousedown':
      psProcess.stdin.write(`[WinMouse]::MouseDown(${screenX}, ${screenY}, ${button})\n`);
      break;
    case 'mouseup':
      psProcess.stdin.write(`[WinMouse]::MouseUp(${screenX}, ${screenY}, ${button})\n`);
      break;
    case 'dblclick':
      psProcess.stdin.write(`[WinMouse]::DblClick(${screenX}, ${screenY})\n`);
      break;
    case 'mousemove':
      if (isDrag) {
        psProcess.stdin.write(`[WinMouse]::Move(${screenX}, ${screenY})\n`);
      } else {
        psProcess.stdin.write(`[WinMouse]::Move(${screenX}, ${screenY})\n`);
      }
      break;
    case 'scroll':
      const delta = payload.delta || -120;
      psProcess.stdin.write(`[WinMouse]::Scroll(${delta})\n`);
      break;
  }
}

// HTTP Server with Private Network Access CORS
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', isReady, screenWidth, screenHeight }));
    return;
  }

  if (req.url === '/input' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        handleInput(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n===============================================================');
  console.log('       BeamDesk Windows Remote Control Agent v1.0              ');
  console.log('===============================================================');
  console.log(`[BeamDesk Agent] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[BeamDesk Agent] Connecting to Windows OS subsystem...`);
  initWindowsDriver();
});

process.on('SIGINT', () => {
  if (psProcess) psProcess.kill();
  process.exit(0);
});
