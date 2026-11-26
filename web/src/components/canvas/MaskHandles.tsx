import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useStudioStore } from '../../store/useStudioStore';

/**
 * On-canvas interactive pointer handles for spatial masks (D-07, FX-03, T-02-08).
 * Synchronized with CenterStage canvas transforms, clamping coordinates to [0.0, 1.0],
 * with pointer capture and accessible keyboard nudging.
 */
export default function MaskHandles() {
  const activeStack = useStudioStore((s) => s.activeStack);
  const selectedPassId = useStudioStore((s) => s.selectedPassId);
  const updatePassParam = useStudioStore((s) => s.updatePassParam);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dragging state tracking
  const centerDragRef = useRef<{
    startX: number;
    startY: number;
    baseCenterX: number;
    baseCenterY: number;
  } | null>(null);

  const sizeDragRef = useRef<{
    startX: number;
    startY: number;
    baseWidth: number;
    baseHeight: number;
    baseRadius: number;
  } | null>(null);

  // Find targeted masks pass: selected pass if it is masks, or first enabled masks pass in activeStack
  const maskPass =
    activeStack.find((p) => p.instanceId === selectedPassId && p.effectId === 'masks' && p.enabled) ||
    activeStack.find((p) => p.effectId === 'masks' && p.enabled);

  if (!maskPass) {
    return null;
  }

  const passId = maskPass.instanceId;
  const shape = (maskPass.parameters.shape as 'vignette' | 'box' | 'circle') || 'vignette';
  const centerX = typeof maskPass.parameters.centerX === 'number' ? maskPass.parameters.centerX : 0.5;
  const centerY = typeof maskPass.parameters.centerY === 'number' ? maskPass.parameters.centerY : 0.5;
  const width = typeof maskPass.parameters.width === 'number' ? maskPass.parameters.width : 0.8;
  const height = typeof maskPass.parameters.height === 'number' ? maskPass.parameters.height : 0.8;
  const radius = typeof maskPass.parameters.radius === 'number' ? maskPass.parameters.radius : 0.4;

  // 1. Center Handle Pointer Handlers
  const onCenterPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    centerDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseCenterX: centerX,
      baseCenterY: centerY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onCenterPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = centerDragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;

    // Clamp coordinates strictly to [0.0, 1.0] per T-02-08
    const nextX = Math.max(0.0, Math.min(1.0, Math.round((drag.baseCenterX + dx) * 100) / 100));
    const nextY = Math.max(0.0, Math.min(1.0, Math.round((drag.baseCenterY + dy) * 100) / 100));

    updatePassParam(passId, 'centerX', nextX);
    updatePassParam(passId, 'centerY', nextY);
  };

  const onCenterPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    centerDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onCenterKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    let nextX = centerX;
    let nextY = centerY;

    if (e.key === 'ArrowLeft') {
      nextX = Math.max(0.0, Math.round((centerX - step) * 100) / 100);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      nextX = Math.min(1.0, Math.round((centerX + step) * 100) / 100);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      nextY = Math.max(0.0, Math.round((centerY - step) * 100) / 100);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      nextY = Math.min(1.0, Math.round((centerY + step) * 100) / 100);
      e.preventDefault();
    } else {
      return;
    }

    updatePassParam(passId, 'centerX', nextX);
    updatePassParam(passId, 'centerY', nextY);
  };

  // 2. Size / Radius Handle Pointer Handlers
  const onSizePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    sizeDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseWidth: width,
      baseHeight: height,
      baseRadius: radius,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSizePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = sizeDragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;

    if (shape === 'box') {
      const nextW = Math.max(0.05, Math.min(1.0, Math.round((drag.baseWidth + dx * 2) * 100) / 100));
      const nextH = Math.max(0.05, Math.min(1.0, Math.round((drag.baseHeight + dy * 2) * 100) / 100));
      updatePassParam(passId, 'width', nextW);
      updatePassParam(passId, 'height', nextH);
    } else {
      // circle or vignette: radius
      const nextR = Math.max(0.05, Math.min(1.0, Math.round((drag.baseRadius + dx) * 100) / 100));
      updatePassParam(passId, 'radius', nextR);
    }
  };

  const onSizePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    sizeDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onSizeKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;

    if (shape === 'box') {
      if (e.key === 'ArrowRight') {
        const nextW = Math.min(1.0, Math.round((width + step) * 100) / 100);
        updatePassParam(passId, 'width', nextW);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        const nextW = Math.max(0.05, Math.round((width - step) * 100) / 100);
        updatePassParam(passId, 'width', nextW);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        const nextH = Math.min(1.0, Math.round((height + step) * 100) / 100);
        updatePassParam(passId, 'height', nextH);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        const nextH = Math.max(0.05, Math.round((height - step) * 100) / 100);
        updatePassParam(passId, 'height', nextH);
        e.preventDefault();
      }
    } else {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        const nextR = Math.min(1.0, Math.round((radius + step) * 100) / 100);
        updatePassParam(passId, 'radius', nextR);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        const nextR = Math.max(0.05, Math.round((radius - step) * 100) / 100);
        updatePassParam(passId, 'radius', nextR);
        e.preventDefault();
      }
    }
  };

  // Compute position for edge/radius handle
  const edgeHandleLeft = shape === 'box' ? (centerX + width * 0.5) * 100 : (centerX + radius) * 100;
  const edgeHandleTop = shape === 'box' ? (centerY + height * 0.5) * 100 : centerY * 100;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
      aria-hidden="false"
      data-testid="mask-handles-overlay"
    >
      {/* SVG Outline Guide */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
        {shape === 'box' ? (
          <rect
            x={`${(centerX - width * 0.5) * 100}%`}
            y={`${(centerY - height * 0.5) * 100}%`}
            width={`${width * 100}%`}
            height={`${height * 100}%`}
            fill="none"
            stroke="var(--text-highlight, #e9ebf0)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />
        ) : (
          <ellipse
            cx={`${centerX * 100}%`}
            cy={`${centerY * 100}%`}
            rx={`${radius * 100}%`}
            ry={`${radius * 100}%`}
            fill="none"
            stroke="var(--text-highlight, #e9ebf0)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />
        )}
      </svg>

      {/* Center Draggable Handle */}
      <button
        type="button"
        role="button"
        aria-label="Mask center handle. Use arrow keys to adjust."
        tabIndex={0}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-base bg-highlight p-1 shadow-md transition-transform hover:scale-125 focus:scale-125"
        style={{
          left: `${centerX * 100}%`,
          top: `${centerY * 100}%`,
          width: '18px',
          height: '18px',
          touchAction: 'none',
        }}
        onPointerDown={onCenterPointerDown}
        onPointerMove={onCenterPointerMove}
        onPointerUp={onCenterPointerUp}
        onKeyDown={onCenterKeyDown}
      >
        <span className="sr-only">Mask Center Position</span>
        <span className="block h-1.5 w-1.5 rounded-full bg-white mx-auto my-auto" />
      </button>

      {/* Edge / Radius Draggable Handle */}
      <button
        type="button"
        role="button"
        aria-label={
          shape === 'box'
            ? 'Mask box size handle. Use arrow keys to adjust.'
            : 'Mask radius handle. Use arrow keys to adjust.'
        }
        tabIndex={0}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 border border-base bg-highlight p-1 shadow-md transition-transform hover:scale-125 focus:scale-125"
        style={{
          left: `${edgeHandleLeft}%`,
          top: `${edgeHandleTop}%`,
          width: '14px',
          height: '14px',
          cursor: shape === 'box' ? 'nwse-resize' : 'ew-resize',
          touchAction: 'none',
        }}
        onPointerDown={onSizePointerDown}
        onPointerMove={onSizePointerMove}
        onPointerUp={onSizePointerUp}
        onKeyDown={onSizeKeyDown}
      >
        <span className="sr-only">
          {shape === 'box' ? 'Mask Box Size' : 'Mask Radius'}
        </span>
      </button>
    </div>
  );
}
