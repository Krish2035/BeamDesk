import { Router } from 'express';
import { adbInput } from '../utils/adbInput.js';

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

// Execute navigation key
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
