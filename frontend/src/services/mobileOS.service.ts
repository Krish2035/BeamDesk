// ============================================================================
// BeamDesk Interactive Mobile OS Engine
// High-performance virtual mobile operating system canvas renderer
// Supports full bidirectional control: touch, mouse, keyboard, apps, navigation
// ============================================================================

export interface TouchRipple {
  x: number;
  y: number;
  time: number;
  color: string;
  radius: number;
  maxRadius: number;
}

export type MobileAppId =
  | 'browser'
  | 'settings'
  | 'files'
  | 'notes'
  | 'terminal'
  | 'camera'
  | 'monitor'
  | 'messages'
  | null;

export class MobileOSService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number | null = null;
  private intervalId: any = null;
  private stream: MediaStream | null = null;

  // OS State
  public currentApp: MobileAppId = null;
  public recentAppsOpen = false;
  public notificationShadeOpen = false;

  // Settings state
  public wifiEnabled = true;
  public bluetoothEnabled = true;
  public darkMode = true;
  public brightness = 85;
  public volume = 70;

  // Notes state
  public notesContent = 'Meeting Notes:\n- BeamDesk Remote Session active\n- Controlled from Laptop\n- Type on physical keyboard to edit this note!';
  public notesFocused = false;

  // Terminal state
  public terminalLines = [
    'BeamDesk Android Shell v2.4 (aarch64)',
    'Connected to remote controller over WebRTC',
    'Type "help" for available commands.',
    'root@android-device:~# ',
  ];
  public terminalInput = '';

  // Browser state
  public browserUrl = 'https://beamdesk.io';
  public browserSearchQuery = '';

  // Camera state
  public cameraFlash = false;
  public photoCount = 14;

  // Touch & cursor feedback
  private ripples: TouchRipple[] = [];
  private remotePointer: { x: number; y: number; time: number; label?: string } | null = null;
  private frameCount = 0;

  // Recent apps stack
  private recentAppsList: MobileAppId[] = ['browser', 'settings', 'notes', 'terminal'];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 720;
    this.canvas.height = 1280;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.objectFit = 'contain';
    this.canvas.setAttribute('id', 'beamdesk-mobile-os-canvas');

    this.ctx = this.canvas.getContext('2d', { alpha: false })!;

    // Start dual-engine rendering loop:
    // 1. requestAnimationFrame for ultra-smooth 60fps display
    // 2. setInterval (33ms) fallback to guarantee captureStream never starves frames
    this.startRenderLoop();
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public getStream(): MediaStream {
    if (!this.stream) {
      if ((this.canvas as any).captureStream) {
        this.stream = (this.canvas as any).captureStream(30);
      } else if ((this.canvas as any).mozCaptureStream) {
        this.stream = (this.canvas as any).mozCaptureStream(30);
      } else {
        // Fallback: create empty MediaStream
        this.stream = new MediaStream();
      }
    }
    return this.stream || new MediaStream();
  }

  // --- Remote Pointer / Touch Event Processing ---
  public handlePointer(action: string, xRatio: number, yRatio: number, button = 0) {
    const x = Math.max(0, Math.min(1, xRatio)) * this.canvas.width;
    const y = Math.max(0, Math.min(1, yRatio)) * this.canvas.height;

    // Add visual touch ripple
    this.ripples.push({
      x,
      y,
      time: Date.now(),
      color: button === 2 ? '#f59e0b' : '#38bdf8',
      radius: 8,
      maxRadius: 48,
    });

    this.remotePointer = {
      x,
      y,
      time: Date.now(),
      label: action === 'dblclick' ? '2x' : action === 'click' ? 'Click' : undefined,
    };

    // Haptic feedback if on physical mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }

    if (action === 'click' || action === 'mousedown' || action === 'dblclick') {
      this.processClickAt(x, y);
    }
  }

  private processClickAt(x: number, y: number) {
    // 1. Bottom Android Navigation Bar (y: 1210 to 1280)
    if (y >= 1210) {
      if (x < 240) {
        // Back Button
        this.handleNavAction('back');
      } else if (x >= 240 && x < 480) {
        // Home Button
        this.handleNavAction('home');
      } else {
        // Recent Apps Button
        this.handleNavAction('recents');
      }
      return;
    }

    // 2. Top Status Bar (y: 0 to 60) -> Toggle Notification Shade
    if (y <= 60) {
      this.notificationShadeOpen = !this.notificationShadeOpen;
      return;
    }

    // 3. Notification Shade is Open
    if (this.notificationShadeOpen) {
      if (y > 450) {
        this.notificationShadeOpen = false;
      } else {
        // Quick toggle buttons in notification shade (y: 100 to 220)
        if (y >= 90 && y <= 180) {
          if (x < 180) this.wifiEnabled = !this.wifiEnabled;
          else if (x < 360) this.bluetoothEnabled = !this.bluetoothEnabled;
          else if (x < 540) this.darkMode = !this.darkMode;
          else this.notificationShadeOpen = false;
        } else if (y >= 200 && y <= 270) {
          // Brightness slider
          this.brightness = Math.round(Math.max(10, Math.min(100, (x / 720) * 100)));
        } else if (y >= 280 && y <= 350) {
          // Volume slider
          this.volume = Math.round(Math.max(0, Math.min(100, (x / 720) * 100)));
        }
      }
      return;
    }

    // 4. Multitasking / Recent Apps Carousel is Open
    if (this.recentAppsOpen) {
      // Check if clicked "Close All" button (y: 1050 to 1120)
      if (y >= 1050 && y <= 1120 && x >= 240 && x <= 480) {
        this.recentAppsOpen = false;
        this.currentApp = null;
        return;
      }
      // Check if clicked an app card
      if (y >= 300 && y <= 900) {
        if (x >= 120 && x <= 600) {
          this.recentAppsOpen = false;
          // Switch to first recent app
          if (this.recentAppsList.length > 0) {
            this.currentApp = this.recentAppsList[0];
          }
        }
      } else {
        this.recentAppsOpen = false;
      }
      return;
    }

    // 5. App View is Open
    if (this.currentApp !== null) {
      this.processAppClick(this.currentApp, x, y);
      return;
    }

    // 6. Home Screen Clicks
    // Search Bar (y: 120 to 180)
    if (y >= 120 && y <= 180 && x >= 40 && x <= 680) {
      this.openApp('browser');
      return;
    }

    // App Grid (y: 260 to 860)
    // 2 rows x 4 cols: col 0..3, row 0..1
    const appGrid: MobileAppId[][] = [
      ['browser', 'settings', 'files', 'notes'],
      ['terminal', 'camera', 'monitor', 'messages'],
    ];

    if (y >= 260 && y <= 760) {
      const row = Math.floor((y - 260) / 160);
      const col = Math.floor((x - 30) / 165);
      if (row >= 0 && row < 2 && col >= 0 && col < 4) {
        const app = appGrid[row][col];
        if (app) this.openApp(app);
        return;
      }
    }

    // Bottom Favorite Dock (y: 1060 to 1180)
    if (y >= 1060 && y <= 1180) {
      const dockApps: MobileAppId[] = ['messages', 'browser', 'camera', 'settings'];
      const col = Math.floor((x - 40) / 160);
      if (col >= 0 && col < 4) {
        this.openApp(dockApps[col]);
      }
    }
  }

  private processAppClick(app: MobileAppId, x: number, y: number) {
    // App top bar back arrow (x: 20 to 90, y: 70 to 130)
    if (x >= 20 && x <= 90 && y >= 70 && y <= 130) {
      this.handleNavAction('back');
      return;
    }

    switch (app) {
      case 'browser':
        // URL / Search bar
        if (y >= 75 && y <= 135 && x >= 100 && x <= 680) {
          this.browserUrl = 'https://beamdesk.io/dashboard';
        }
        // Speed dial tiles (y: 220 to 380)
        if (y >= 220 && y <= 380) {
          if (x < 240) this.browserUrl = 'https://beamdesk.io/cloud';
          else if (x < 480) this.browserUrl = 'https://github.com';
          else this.browserUrl = 'https://wikipedia.org';
        }
        break;

      case 'settings':
        // Section toggles
        if (y >= 160 && y <= 230) this.wifiEnabled = !this.wifiEnabled;
        if (y >= 240 && y <= 310) this.bluetoothEnabled = !this.bluetoothEnabled;
        if (y >= 320 && y <= 390) this.darkMode = !this.darkMode;
        // Sliders
        if (y >= 430 && y <= 500) {
          this.brightness = Math.round(Math.max(10, Math.min(100, ((x - 80) / 560) * 100)));
        }
        if (y >= 520 && y <= 590) {
          this.volume = Math.round(Math.max(0, Math.min(100, ((x - 80) / 560) * 100)));
        }
        break;

      case 'notes':
        this.notesFocused = true;
        // Action buttons at bottom (y: 1100 to 1170)
        if (y >= 1100 && y <= 1170) {
          if (x < 360) {
            // New Note
            this.notesContent = 'New Note created at ' + new Date().toLocaleTimeString() + ':\n';
          } else {
            // Clear
            this.notesContent = '';
          }
        }
        break;

      case 'terminal':
        // Tap terminal prompt to focus
        this.notesFocused = false;
        break;

      case 'camera':
        // Shutter button (x: 300 to 420, y: 1050 to 1170)
        if (x >= 300 && x <= 420 && y >= 1050 && y <= 1170) {
          this.photoCount++;
          this.cameraFlash = true;
          setTimeout(() => (this.cameraFlash = false), 150);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([40, 20, 40]);
          }
        }
        break;

      case 'files':
        // Refresh or select category
        break;
    }
  }

  public openApp(app: MobileAppId) {
    this.currentApp = app;
    this.recentAppsOpen = false;
    this.notificationShadeOpen = false;
    if (app && !this.recentAppsList.includes(app)) {
      this.recentAppsList.unshift(app);
      if (this.recentAppsList.length > 5) this.recentAppsList.pop();
    }
  }

  public handleNavAction(action: 'back' | 'home' | 'recents' | 'notifications') {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }

    if (action === 'home') {
      this.currentApp = null;
      this.recentAppsOpen = false;
      this.notificationShadeOpen = false;
    } else if (action === 'back') {
      if (this.notificationShadeOpen) {
        this.notificationShadeOpen = false;
      } else if (this.recentAppsOpen) {
        this.recentAppsOpen = false;
      } else if (this.currentApp !== null) {
        this.currentApp = null;
      }
    } else if (action === 'recents') {
      this.recentAppsOpen = !this.recentAppsOpen;
      this.notificationShadeOpen = false;
    } else if (action === 'notifications') {
      this.notificationShadeOpen = !this.notificationShadeOpen;
    }
  }

  public handleKey(key: string, code: string, modifiers: any = {}) {
    if (key === 'Escape') {
      this.handleNavAction('back');
      return;
    }

    if (this.currentApp === 'notes') {
      if (key === 'Backspace') {
        this.notesContent = this.notesContent.slice(0, -1);
      } else if (key === 'Enter') {
        this.notesContent += '\n';
      } else if (key.length === 1) {
        this.notesContent += key;
      }
    } else if (this.currentApp === 'terminal') {
      if (key === 'Backspace') {
        this.terminalInput = this.terminalInput.slice(0, -1);
      } else if (key === 'Enter') {
        const cmd = this.terminalInput.trim();
        this.terminalLines.push(`root@android-device:~# ${this.terminalInput}`);
        this.executeTerminalCommand(cmd);
        this.terminalInput = '';
        if (this.terminalLines.length > 22) {
          this.terminalLines.splice(0, this.terminalLines.length - 22);
        }
      } else if (key.length === 1) {
        this.terminalInput += key;
      }
    } else if (this.currentApp === 'browser') {
      if (key === 'Backspace') {
        this.browserUrl = this.browserUrl.slice(0, -1);
      } else if (key === 'Enter') {
        if (!this.browserUrl.startsWith('http')) {
          this.browserUrl = 'https://' + this.browserUrl;
        }
      } else if (key.length === 1) {
        this.browserUrl += key;
      }
    }
  }

  private executeTerminalCommand(cmd: string) {
    const lower = cmd.toLowerCase();
    if (lower === 'help') {
      this.terminalLines.push(
        'Available commands: help, ping, ifconfig, uname, top, clear, status, date'
      );
    } else if (lower.startsWith('ping')) {
      this.terminalLines.push('PING 8.8.8.8 (8.8.8.8): 56 data bytes');
      this.terminalLines.push('64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=12.4 ms');
      this.terminalLines.push('64 bytes from 8.8.8.8: icmp_seq=2 ttl=118 time=11.8 ms');
      this.terminalLines.push('--- 8.8.8.8 ping statistics: 0% packet loss, avg = 12.1ms ---');
    } else if (lower === 'ifconfig' || lower === 'ip') {
      this.terminalLines.push('wlan0: inet 192.168.0.104 netmask 255.255.255.0 broadcast 192.168.0.255');
      this.terminalLines.push('      flags=4163<UP,BROADCAST,RUNNING,MULTICAST> mtu 1500');
      this.terminalLines.push('tun0:  inet 10.8.0.2 netmask 255.255.255.255 (BeamDesk WebRTC tunnel)');
    } else if (lower.startsWith('uname')) {
      this.terminalLines.push('Linux android 5.10.160-android14-9-g67a #1 SMP PREEMPT aarch64');
    } else if (lower === 'top') {
      this.terminalLines.push('Tasks: 184 total, 2 running. CPU: 12.4% usr, 4.2% sys, 83.4% idle');
      this.terminalLines.push('Mem: 8192MB total, 3942MB used, 4250MB free. BeamDesk: 2.1% CPU');
    } else if (lower === 'status') {
      this.terminalLines.push('[OK] WebRTC DataChannel: CONNECTED (RTT < 15ms)');
      this.terminalLines.push('[OK] MediaStream: 720x1280 @ 30/60fps H.264 Active');
    } else if (lower === 'date') {
      this.terminalLines.push(new Date().toString());
    } else if (lower === 'clear') {
      this.terminalLines = [];
    } else if (cmd) {
      this.terminalLines.push(`bash: ${cmd}: command not found. Type "help"`);
    }
  }

  // --- Continuous Rendering Engine ---
  private startRenderLoop() {
    const render = () => {
      this.renderFrame();
      this.animId = requestAnimationFrame(render);
    };
    this.animId = requestAnimationFrame(render);

    // Guaranteed fallback interval timer (33ms) so captureStream always has continuous frames
    this.intervalId = setInterval(() => {
      this.renderFrame();
    }, 33);
  }

  public renderFrame() {
    this.frameCount++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Base Wallpaper
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    if (this.darkMode) {
      bgGrad.addColorStop(0, '#0a0f1d');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
    } else {
      bgGrad.addColorStop(0, '#f8fafc');
      bgGrad.addColorStop(1, '#e2e8f0');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Dynamic decorative background shapes
    ctx.fillStyle = this.darkMode ? 'rgba(56, 189, 248, 0.04)' : 'rgba(56, 189, 248, 0.1)';
    ctx.beginPath();
    ctx.arc(w - 60, 220, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.darkMode ? 'rgba(168, 85, 247, 0.04)' : 'rgba(168, 85, 247, 0.1)';
    ctx.beginPath();
    ctx.arc(80, 750, 180, 0, Math.PI * 2);
    ctx.fill();

    // 2. Render Active Screen
    if (this.currentApp !== null) {
      this.renderAppView(this.currentApp);
    } else {
      this.renderHomeScreen();
    }

    // 3. Multitasking / Recent Apps Carousel Overlay
    if (this.recentAppsOpen) {
      this.renderRecentApps();
    }

    // 4. Notification Shade Overlay
    if (this.notificationShadeOpen) {
      this.renderNotificationShade();
    }

    // 5. Always Render Android Status Bar (top 56px)
    this.renderStatusBar();

    // 6. Always Render Android 3-Button Navigation Bar (bottom 70px)
    this.renderNavBar();

    // 7. Render Animated Touch Ripples
    this.renderRipples();

    // 8. Camera flash effect
    if (this.cameraFlash) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // --- Status Bar (top) ---
  private renderStatusBar() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(0, 0, w, 54);

    // Digital Clock
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(timeStr, 28, 36);

    // Online Host Session Badge
    ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
    ctx.beginPath();
    ctx.roundRect(140, 12, 220, 32, 16);
    ctx.fill();

    const dotPulse = (Math.sin(this.frameCount * 0.1) + 1) / 2;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(158, 28, 5 + dotPulse * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('BEAMDESK LIVE HOST', 174, 33);

    // Icons: 5G, Wi-Fi, Battery
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px system-ui, sans-serif';
    const wifiText = this.wifiEnabled ? '📶 5G' : '📵 No Net';
    ctx.fillText(`${wifiText}  🔋 96%`, w - 24, 35);
    ctx.textAlign = 'left';
  }

  // --- Navigation Bar (bottom 70px) ---
  private renderNavBar() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.fillRect(0, h - 70, w, 70);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 70);
    ctx.lineTo(w, h - 70);
    ctx.stroke();

    // ◀ Back Button (left 1/3)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(130, h - 35);
    ctx.lineTo(110, h - 35);
    ctx.lineTo(122, h - 47);
    ctx.moveTo(110, h - 35);
    ctx.lineTo(122, h - 23);
    ctx.stroke();

    // ⚪ Home Button (center 1/3)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(w / 2, h - 35, 14, 0, Math.PI * 2);
    ctx.stroke();

    // ▢ Recent Apps Button (right 1/3)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(w - 135, h - 47, 24, 24, 5);
    ctx.stroke();
  }

  // --- Home Screen ---
  private renderHomeScreen() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    // Search Bar (y: 85 to 145)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.beginPath();
    ctx.roundRect(32, 80, w - 64, 60, 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Google 'G' icon & search placeholder
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('G', 60, 118);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Search apps, web or type URL...', 96, 117);

    // Weather & Date Widget (y: 165 to 240)
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui, sans-serif';
    const dateStr = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    ctx.fillText(dateStr, 40, 195);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('☀️ 29°C  •  Partly Cloudy  •  Mumbai, IN', 40, 225);

    // App Icons Grid (8 Apps: 2 rows of 4)
    const apps = [
      { id: 'browser', name: 'Browser', icon: '🌐', grad: ['#0284c7', '#0369a1'] },
      { id: 'settings', name: 'Settings', icon: '⚙️', grad: ['#475569', '#334155'] },
      { id: 'files', name: 'Files', icon: '📁', grad: ['#f59e0b', '#d97706'] },
      { id: 'notes', name: 'Notes', icon: '📝', grad: ['#eab308', '#ca8a04'] },
      { id: 'terminal', name: 'Terminal', icon: '💻', grad: ['#059669', '#047857'] },
      { id: 'camera', name: 'Camera', icon: '📸', grad: ['#6366f1', '#4f46e5'] },
      { id: 'monitor', name: 'Health', icon: '📊', grad: ['#06b6d4', '#0891b2'] },
      { id: 'messages', name: 'Messages', icon: '💬', grad: ['#10b981', '#059669'] },
    ];

    apps.forEach((app, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = 50 + col * 165;
      const y = 280 + row * 160;

      // Icon Box (rounded rectangle with gradient)
      const grad = ctx.createLinearGradient(x, y, x + 85, y + 85);
      grad.addColorStop(0, app.grad[0]);
      grad.addColorStop(1, app.grad[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, 85, 85, 22);
      ctx.fill();

      // Shadow border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Emoji/Icon
      ctx.font = '40px system-ui, Apple Color Emoji';
      ctx.textAlign = 'center';
      ctx.fillText(app.icon, x + 42, y + 58);

      // App Label
      ctx.fillStyle = '#f8fafc';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(app.name, x + 42, y + 112);
      ctx.textAlign = 'left';
    });

    // Remote Control Hint Card (y: 630 to 980)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(32, 640, w - 64, 380, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('🎮 Interactive Mobile Remote Control', 56, 685);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('• Click any app above to launch directly from Laptop', 56, 730);
    ctx.fillText('• Use ◀ Back, ⚪ Home, ▢ Recents at bottom to navigate', 56, 770);
    ctx.fillText('• Type on laptop physical keyboard to write in Notes & Shell', 56, 810);
    ctx.fillText('• Pull down or tap top bar for Quick Settings toggles', 56, 850);

    // Status Ping Info Bar
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(56, 885, w - 112, 95, 16);
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('STREAM: 720x1280 @ 30/60fps | RTT: 12ms', 80, 925);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.fillText('BIDIRECTIONAL SYNC: Mouse, Touch & Key Active', 80, 955);

    // Bottom Favorite Dock (y: 1045 to 1185)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
    ctx.beginPath();
    ctx.roundRect(32, 1040, w - 64, 115, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const dock = [
      { icon: '📞', grad: ['#10b981', '#059669'] },
      { icon: '💬', grad: ['#0284c7', '#0369a1'] },
      { icon: '🌐', grad: ['#6366f1', '#4f46e5'] },
      { icon: '📷', grad: ['#e11d48', '#be123c'] },
    ];

    dock.forEach((d, i) => {
      const x = 60 + i * 160;
      const y = 1060;
      const grad = ctx.createLinearGradient(x, y, x + 72, y + 72);
      grad.addColorStop(0, d.grad[0]);
      grad.addColorStop(1, d.grad[1]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, 72, 72, 20);
      ctx.fill();

      ctx.font = '36px system-ui, Apple Color Emoji';
      ctx.textAlign = 'center';
      ctx.fillText(d.icon, x + 36, y + 50);
      ctx.textAlign = 'left';
    });
  }

  // --- App Views ---
  private renderAppView(app: MobileAppId) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // App Header Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 54, w, 70);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 124);
    ctx.lineTo(w, 124);
    ctx.stroke();

    // Back arrow (clickable)
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('◀ Back', 24, 98);

    // Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(app?.toUpperCase() || '', 140, 98);

    switch (app) {
      case 'browser':
        this.renderBrowserApp();
        break;
      case 'settings':
        this.renderSettingsApp();
        break;
      case 'notes':
        this.renderNotesApp();
        break;
      case 'terminal':
        this.renderTerminalApp();
        break;
      case 'camera':
        this.renderCameraApp();
        break;
      case 'monitor':
        this.renderMonitorApp();
        break;
      case 'files':
        this.renderFilesApp();
        break;
      case 'messages':
        this.renderMessagesApp();
        break;
    }
  }

  private renderBrowserApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    // URL Bar
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(24, 140, w - 48, 55, 14);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px monospace';
    ctx.fillText(`🔒 ${this.browserUrl}`, 44, 175);

    // Bookmarks / Fast Tiles
    const tiles = [
      { name: 'BeamDesk Cloud', url: 'beamdesk.io', icon: '⚡' },
      { name: 'GitHub Code', url: 'github.com', icon: '🐙' },
      { name: 'Wikipedia', url: 'wikipedia.org', icon: '📚' },
    ];

    tiles.forEach((t, i) => {
      const y = 230 + i * 90;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(24, y, w - 48, 75, 16);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      ctx.font = '32px system-ui';
      ctx.fillText(t.icon, 48, y + 48);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 18px system-ui';
      ctx.fillText(t.name, 100, y + 36);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px monospace';
      ctx.fillText(t.url, 100, y + 60);
    });

    // Simulated Webpage Content
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.roundRect(24, 530, w - 48, 620, 20);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('BeamDesk Cloud Remote Portal', 48, 580);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px system-ui';
    ctx.fillText('Connected Device: Android Mobile (ARM64)', 48, 620);
    ctx.fillText('Session Status: Peer-to-Peer Encrypted', 48, 655);
    ctx.fillText('Bidirectional Latency: 12ms (Direct LAN STUN)', 48, 690);

    ctx.fillStyle = '#10b981';
    ctx.fillText('✓ Real-time DOM and canvas synchronization', 48, 740);
    ctx.fillText('✓ WebRTC DataChannel control pipeline ready', 48, 780);
    ctx.fillText('✓ Physical Windows mouse driver enabled', 48, 820);
  }

  private renderSettingsApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    const sections = [
      { title: 'Wi-Fi Network', val: this.wifiEnabled ? 'Connected (5G BeamDesk)' : 'Disabled', state: this.wifiEnabled },
      { title: 'Bluetooth 5.3', val: this.bluetoothEnabled ? 'Active (Ready to pair)' : 'Off', state: this.bluetoothEnabled },
      { title: 'Dark Mode', val: this.darkMode ? 'Enabled (AMOLED Save)' : 'Light Mode', state: this.darkMode },
    ];

    sections.forEach((s, i) => {
      const y = 150 + i * 85;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(24, y, w - 48, 70, 16);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 18px system-ui';
      ctx.fillText(s.title, 48, y + 32);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui';
      ctx.fillText(s.val, 48, y + 54);

      // Toggle switch
      ctx.fillStyle = s.state ? '#10b981' : '#475569';
      ctx.beginPath();
      ctx.roundRect(w - 95, y + 18, 52, 30, 15);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.state ? w - 60 : w - 80, y + 33, 11, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sliders: Brightness & Volume
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(24, 420, w - 48, 170, 20);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 17px system-ui';
    ctx.fillText(`Display Brightness: ${this.brightness}%`, 48, 460);

    // Brightness bar
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(48, 480, w - 96, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(48, 480, (w - 96) * (this.brightness / 100), 12, 6);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`Media Volume: ${this.volume}%`, 48, 530);

    // Volume bar
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(48, 550, w - 96, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(48, 550, (w - 96) * (this.volume / 100), 12, 6);
    ctx.fill();
  }

  private renderNotesApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(24, 150, w - 48, 880, 20);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('📝 Remote Notepad (Live Keyboard Sync)', 48, 195);

    // Multi-line text
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '17px monospace';
    const lines = this.notesContent.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 48, 240 + i * 28);
    });

    // Blinking cursor
    if (this.frameCount % 40 < 20) {
      const lastLineY = 240 + (lines.length - 1) * 28;
      const lastLineX = 48 + ctx.measureText(lines[lines.length - 1] || '').width;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(lastLineX + 2, lastLineY - 18, 10, 22);
    }

    // Action buttons at bottom
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(48, 1060, 280, 55, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('+ New Note', 188, 1095);

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(w - 328, 1060, 280, 55, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Clear Note', w - 188, 1095);
    ctx.textAlign = 'left';
  }

  private renderTerminalApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.roundRect(20, 140, w - 40, 980, 16);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = '15px monospace';

    this.terminalLines.forEach((l, i) => {
      ctx.fillText(l, 36, 175 + i * 26);
    });

    // Current input line
    const curY = 175 + this.terminalLines.length * 26;
    ctx.fillText(`root@android-device:~# ${this.terminalInput}`, 36, curY);

    if (this.frameCount % 40 < 20) {
      const xOffset = 36 + ctx.measureText(`root@android-device:~# ${this.terminalInput}`).width;
      ctx.fillRect(xOffset + 2, curY - 14, 9, 16);
    }
  }

  private renderCameraApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    // Viewfinder
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 140, w - 40, 850);

    // Crosshairs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 40, 565);
    ctx.lineTo(w / 2 + 40, 565);
    ctx.moveTo(w / 2, 525);
    ctx.lineTo(w / 2, 605);
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Photos Captured: ${this.photoCount}`, w / 2, 930);

    // Shutter button
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, 1080, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, 1080, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'left';
  }

  private renderMonitorApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    // CPU Wave Graph
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(24, 150, w - 48, 260, 20);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText('Live CPU Load (8-Core aarch64)', 48, 190);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 48; x < w - 48; x += 10) {
      const y = 300 + Math.sin((x + this.frameCount * 4) * 0.04) * 35;
      if (x === 48) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Memory & Battery
    const stats = [
      { title: 'RAM Memory', val: '3.8 GB / 8.0 GB (47%)', color: '#10b981' },
      { title: 'Internal Storage', val: '58.4 GB / 128 GB (45%)', color: '#38bdf8' },
      { title: 'Battery Temp & Health', val: '31.2°C  •  Good Condition', color: '#f59e0b' },
      { title: 'WebRTC Encoder', val: 'Hardware H.264 Baseline 60fps', color: '#a855f7' },
    ];

    stats.forEach((s, i) => {
      const y = 435 + i * 85;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(24, y, w - 48, 70, 16);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui';
      ctx.fillText(s.title, 48, y + 28);

      ctx.fillStyle = s.color;
      ctx.font = 'bold 18px system-ui';
      ctx.fillText(s.val, 48, y + 54);
    });
  }

  private renderFilesApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    const files = [
      { name: 'quarterly_report.pdf', size: '2.4 MB', icon: '📄', date: 'Today, 2:15 PM' },
      { name: 'screenshot_2026.png', size: '4.1 MB', icon: '🖼️', date: 'Today, 1:40 PM' },
      { name: 'beamdesk_remote.apk', size: '18.6 MB', icon: '📦', date: 'Yesterday' },
      { name: 'notes_backup.txt', size: '14 KB', icon: '📝', date: 'Sep 24' },
      { name: 'presentation_slides.pptx', size: '12.8 MB', icon: '📊', date: 'Sep 22' },
    ];

    files.forEach((f, i) => {
      const y = 150 + i * 90;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(24, y, w - 48, 75, 16);
      ctx.fill();

      ctx.font = '32px system-ui';
      ctx.fillText(f.icon, 48, y + 48);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 17px system-ui';
      ctx.fillText(f.name, 100, y + 34);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui';
      ctx.fillText(`${f.size}  •  ${f.date}`, 100, y + 58);
    });
  }

  private renderMessagesApp() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    const chats = [
      { text: 'BeamDesk Remote Session connected!', isSelf: false, time: '8:00 PM' },
      { text: 'Controlling phone directly from laptop now.', isSelf: true, time: '8:01 PM' },
      { text: 'Screen mirroring and click sync verified.', isSelf: false, time: '8:02 PM' },
    ];

    chats.forEach((c, i) => {
      const y = 160 + i * 110;
      const boxW = 420;
      const boxX = c.isSelf ? w - boxW - 28 : 28;

      ctx.fillStyle = c.isSelf ? '#2563eb' : '#334155';
      ctx.beginPath();
      ctx.roundRect(boxX, y, boxW, 80, 18);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '16px system-ui';
      ctx.fillText(c.text, boxX + 20, y + 36);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px system-ui';
      ctx.fillText(c.time, boxX + 20, y + 62);
    });
  }

  // --- Multitasking / Recent Apps Overlay ---
  private renderRecentApps() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Recent Apps', w / 2, 220);

    // App Card
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(100, 270, w - 200, 680, 28);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '64px system-ui';
    ctx.fillText('📱', w / 2, 540);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('Active Mobile OS Workspace', w / 2, 620);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px system-ui';
    ctx.fillText('Tap card to switch app', w / 2, 660);

    // Close All Button
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 120, 1020, 240, 60, 30);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText('Close All', w / 2, 1058);
    ctx.textAlign = 'left';
  }

  // --- Notification Shade Overlay ---
  private renderNotificationShade() {
    const ctx = this.ctx;
    const w = this.canvas.width;

    ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.fillRect(0, 0, w, 520);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.lineTo(w, 520);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText('Quick Settings', 32, 95);

    // Toggles: Wi-Fi, Bluetooth, Dark Mode, Flashlight
    const toggles = [
      { name: 'Wi-Fi', active: this.wifiEnabled, icon: '📶' },
      { name: 'Bluetooth', active: this.bluetoothEnabled, icon: '⚡' },
      { name: 'Dark Mode', active: this.darkMode, icon: '🌙' },
      { name: 'Torch', active: this.cameraFlash, icon: '🔦' },
    ];

    toggles.forEach((t, i) => {
      const x = 32 + i * 165;
      const y = 125;
      ctx.fillStyle = t.active ? '#0284c7' : '#334155';
      ctx.beginPath();
      ctx.roundRect(x, y, 145, 80, 18);
      ctx.fill();

      ctx.font = '28px system-ui';
      ctx.fillText(t.icon, x + 20, y + 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui';
      ctx.fillText(t.name, x + 60, y + 48);
    });

    // Sliders in notification shade
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px system-ui';
    ctx.fillText(`Brightness (${this.brightness}%)`, 32, 245);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(32, 260, w - 64, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(32, 260, (w - 64) * (this.brightness / 100), 14, 7);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`Volume (${this.volume}%)`, 32, 315);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(32, 330, w - 64, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(32, 330, (w - 64) * (this.volume / 100), 14, 7);
    ctx.fill();

    // Pull bar
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 40, 500, 80, 6, 3);
    ctx.fill();
  }

  // --- Render Ripples & Crosshair ---
  private renderRipples() {
    const ctx = this.ctx;
    const now = Date.now();

    // Filter active ripples
    this.ripples = this.ripples.filter((r) => now - r.time < 800);

    this.ripples.forEach((r) => {
      const progress = (now - r.time) / 800;
      const radius = r.radius + (r.maxRadius - r.radius) * progress;
      const alpha = 1 - progress;

      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5 * alpha;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 * alpha, 0, Math.PI * 2);
      ctx.fill();
    });

    // Remote Pointer Crosshair (from laptop)
    if (this.remotePointer && now - this.remotePointer.time < 2000) {
      const age = (now - this.remotePointer.time) / 2000;
      const alpha = 1 - age;
      const p = this.remotePointer;

      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 14, p.y);
      ctx.lineTo(p.x + 14, p.y);
      ctx.moveTo(p.x, p.y - 14);
      ctx.lineTo(p.x, p.y + 14);
      ctx.stroke();

      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (p.label) {
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(p.label, p.x + 10, p.y - 10);
      }
    }
  }

  public destroy() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

export const mobileOS = new MobileOSService();
