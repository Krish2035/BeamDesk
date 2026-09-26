import React, { useEffect, useState } from 'react';
import { MousePointer } from 'lucide-react';

interface RemoteCursorState {
  x: number;
  y: number;
  visible: boolean;
  clicked: boolean;
}

export const RemoteCursor: React.FC = () => {
  const [cursor, setCursor] = useState<RemoteCursorState>({
    x: 0,
    y: 0,
    visible: false,
    clicked: false,
  });

  useEffect(() => {
    let hideTimeout: any = null;

    const handleRemoteMouse = (e: any) => {
      const data = e.detail;
      if (!data) return;

      const screenX = data.x * window.innerWidth;
      const screenY = data.y * window.innerHeight;

      setCursor({
        x: screenX,
        y: screenY,
        visible: true,
        clicked: data.action === 'mousedown' || data.action === 'click',
      });

      // Dispatch real DOM click on host elements
      if (data.action === 'click' || data.action === 'mousedown') {
        try {
          const target = document.elementFromPoint(screenX, screenY);
          if (target && !target.closest('.pointer-events-none')) {
            target.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: screenX,
                clientY: screenY,
              })
            );
          }
        } catch {}
      }

      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setCursor((prev) => ({ ...prev, visible: false }));
      }, 3000);
    };

    window.addEventListener('beamdesk:remote-mouse', handleRemoteMouse);
    return () => {
      window.removeEventListener('beamdesk:remote-mouse', handleRemoteMouse);
      clearTimeout(hideTimeout);
    };
  }, []);

  if (!cursor.visible) return null;

  return (
    <div
      className="fixed pointer-events-none z-50 transition-all duration-75 ease-out"
      style={{
        left: `${cursor.x}px`,
        top: `${cursor.y}px`,
        transform: 'translate(-2px, -2px)',
      }}
    >
      <div className="relative">
        <MousePointer className="w-5 h-5 text-brand-600 drop-shadow fill-brand-600/30" />
        <span className="absolute left-4 top-3 px-1.5 py-0.5 bg-brand-600 text-white text-[10px] font-bold rounded shadow-sm">
          Remote
        </span>
        {cursor.clicked && (
          <span className="absolute -inset-2 rounded-full border-2 border-brand-500 animate-ping" />
        )}
      </div>
    </div>
  );
};
