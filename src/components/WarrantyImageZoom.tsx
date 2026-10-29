import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

type Props = {
  src: string;
  alt: string;
  onError?: () => void;
};

type Position = { x: number; y: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

export default function WarrantyImageZoom({ src, alt, onError }: Props) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<Position>({
    x: 0,
    y: 0,
  });
  const [dragging, setDragging] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef(1);
  const positionRef = useRef<Position>({ x: 0, y: 0 });

  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  const limitPosition = useCallback((x: number, y: number, scale: number): Position => {
    const viewer = viewerRef.current;
    const image = imageRef.current;

    if (!viewer || !image || scale <= 1) {
      return { x: 0, y: 0 };
    }

    // offsetWidth e offsetHeight não incluem transformações.
    const scaledWidth = image.offsetWidth * scale;
    const scaledHeight = image.offsetHeight * scale;

    const maxX = Math.max(0, (scaledWidth - viewer.clientWidth) / 2);

    const maxY = Math.max(0, (scaledHeight - viewer.clientHeight) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const updatePosition = useCallback(
    (x: number, y: number, scale: number) => {
      const next = limitPosition(x, y, scale);
      positionRef.current = next;
      setPosition(next);
    },
    [limitPosition]
  );

  const changeZoom = useCallback(
    (requested: number) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requested));

      zoomRef.current = next;
      setZoom(next);

      updatePosition(positionRef.current.x, positionRef.current.y, next);
    },
    [updatePosition]
  );

  const resetZoom = useCallback(() => {
    zoomRef.current = 1;
    setZoom(1);
    updatePosition(0, 0, 1);
  }, [updatePosition]);

  // Restaura o enquadramento quando outra imagem é aberta.
  useEffect(() => {
    resetZoom();
  }, [src, resetZoom]);

  // Listener não passivo: a roda do mouse controla o zoom,
  // sem provocar rolagem acidental da janela.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;

      changeZoom(zoomRef.current + delta);
    };

    viewer.addEventListener('wheel', handleWheel, {
      passive: false,
    });

    return () => {
      viewer.removeEventListener('wheel', handleWheel);
    };
  }, [changeZoom]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (zoomRef.current <= 1) return;

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX - positionRef.current.x,
      y: event.clientY - positionRef.current.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    updatePosition(event.clientX - drag.x, event.clientY - drag.y, zoomRef.current);
  };

  const stopDragging = () => {
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div className="space-y-3">
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">Visualização da imagem</span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Diminuir zoom"
            title="Diminuir zoom"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => changeZoom(zoomRef.current - ZOOM_STEP)}
            className="rounded-lg border border-border p-2 hover:bg-muted disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>

          <span className="w-14 text-center text-sm font-medium tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            aria-label="Aumentar zoom"
            title="Aumentar zoom"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => changeZoom(zoomRef.current + ZOOM_STEP)}
            className="rounded-lg border border-border p-2 hover:bg-muted disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={resetZoom}
            className="ml-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"
            title="Restaurar enquadramento"
          >
            <RotateCcw className="h-4 w-4" />
            Ajustar
          </button>
        </div>
      </div>

      {/* Área interativa */}
      <div
        ref={viewerRef}
        role="region"
        aria-label={`Visualização ampliada: ${alt}`}
        tabIndex={0}
        className="relative flex h-[62dvh] min-h-[260px] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{
          cursor: dragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in',
          touchAction: zoom > 1 ? 'none' : 'auto',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
        onDoubleClick={() => {
          if (zoomRef.current > 1) {
            resetZoom();
          } else {
            changeZoom(2);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            changeZoom(zoomRef.current + ZOOM_STEP);
          }

          if (event.key === '-') {
            event.preventDefault();
            changeZoom(zoomRef.current - ZOOM_STEP);
          }

          if (event.key === '0') {
            event.preventDefault();
            resetZoom();
          }
        }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          draggable={false}
          onError={onError}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Roda do mouse: zoom · Arraste quando ampliada · Duplo clique: ampliar ou restaurar
      </p>
    </div>
  );
}
