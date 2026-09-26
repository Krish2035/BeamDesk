import { Router } from 'express';
import { adbInput } from '../utils/adbInput.js';
import { adbScreen } from '../utils/adbScreen.js';

export const adbRouter = Router();

// Get connected ADB devices and status
adbRouter.get('/status', async (_req, res) => {
  try {
    const devices = await adbInput.getDevices();
    const isConnected = devices.some((d) => d.state === 'device');
    const displaySize = isConnected ? await adbInput.getDisplaySize() : null;

    res.json({
      success: true,
      isConnected,
      devices,
      displaySize,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single frame screenshot endpoint
adbRouter.get('/screenshot', async (_req, res) => {
  try {
    const frame = await adbScreen.captureSingleFrame();
    if (!frame) {
      return res.status(503).json({ success: false, message: 'No ADB screen frame available' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(frame);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// High-performance MJPEG live screen stream for browsers
adbRouter.get('/stream.mjpg', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Connection: 'keep-alive',
    Pragma: 'no-cache',
  });

  adbScreen.startStream(20);

  const onFrame = (frame: Buffer) => {
    try {
      res.write('--myboundary\r\n');
      res.write('Content-Type: image/png\r\n');
      res.write(`Content-Length: ${frame.length}\r\n\r\n`);
      res.write(frame);
      res.write('\r\n');
    } catch {
      cleanup();
    }
  };

  const cleanup = () => {
    adbScreen.off('frame', onFrame);
  };

  adbScreen.on('frame', onFrame);

  // Send an immediate first frame if one exists
  const initial = adbScreen.getLatestFrame();
  if (initial) {
    onFrame(initial);
  }

  req.on('close', cleanup);
  req.on('finish', cleanup);
});

// Tap physical touch coordinate
adbRouter.post('/tap', async (req, res) => {
  try {
    const { x, y } = req.body;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({ success: false, message: 'x and y coordinates required' });
    }
    await adbInput.tap(x, y);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Swipe / Drag physical touch
adbRouter.post('/swipe', async (req, res) => {
  try {
    const { x1, y1, x2, y2, durationMs } = req.body;
    await adbInput.swipe(x1, y1, x2, y2, durationMs || 200);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Key navigation event
adbRouter.post('/key', async (req, res) => {
  try {
    const { code } = req.body;
    if (code === undefined) {
      return res.status(400).json({ success: false, message: 'Keycode required' });
    }
    await adbInput.keyevent(code);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Type text into Android phone
adbRouter.post('/text', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text required' });
    }
    await adbInput.text(text);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Connect wireless ADB
adbRouter.post('/connect', async (req, res) => {
  try {
    const { ip, port } = req.body;
    if (!ip) {
      return res.status(400).json({ success: false, message: 'IP address required' });
    }
    const result = await adbInput.connectWireless(ip, port || 5555);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
