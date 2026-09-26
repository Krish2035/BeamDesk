import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readJsonFile<T>(filename: string, fallback: T): T {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonFile(filename, fallback);
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return fallback;
  }
}

export function writeJsonFile<T>(filename: string, data: T): void {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing ${filename}:`, err);
  }
}
