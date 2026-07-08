import { useRef, useState, useEffect } from 'react';
import type { SignatureRecord } from '../lib/types';
import { Button } from './ui';

const TYPED_FONTS = ["'Fraunces', serif", "'IBM Plex Mono', monospace", "cursive"];

export function SignaturePad({
  defaultName, onSign, onCancel,
}: {
  defaultName: string;
  onSign: (sig: SignatureRecord) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<'typed' | 'drawn'>('typed');
  const [name, setName] = useState(defaultName);
  const [fontIdx, setFontIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#211D18';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
  }, [mode]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    hasDrawn.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    const { x, y } = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const { x, y } = pos(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
  }
  function end() { drawing.current = false; }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      hasDrawn.current = false;
    }
  }

  function submit() {
    if (mode === 'typed') {
      if (!name.trim()) return;
      onSign({ name: name.trim(), method: 'typed', typedFont: TYPED_FONTS[fontIdx], signedAt: new Date().toISOString() });
    } else {
      if (!hasDrawn.current || !canvasRef.current) return;
      onSign({ name: name.trim() || defaultName, method: 'drawn', dataUrl: canvasRef.current.toDataURL('image/png'), signedAt: new Date().toISOString() });
    }
  }

  return (
    <div className="ledger-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setMode('typed')} className={`focus-ring px-3 py-1.5 rounded-md text-sm font-medium border ${mode === 'typed' ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-dark)]' : 'border-[var(--border)] text-[var(--ink-soft)]'}`}>Type signature</button>
        <button onClick={() => setMode('drawn')} className={`focus-ring px-3 py-1.5 rounded-md text-sm font-medium border ${mode === 'drawn' ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-dark)]' : 'border-[var(--border)] text-[var(--ink-soft)]'}`}>Draw signature</button>
      </div>

      {mode === 'typed' ? (
        <div className="space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full legal name"
            className="focus-ring w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
          <div className="rounded-md border border-dashed border-[var(--border)] bg-white px-4 py-6 flex items-center justify-center min-h-[92px]">
            <span style={{ fontFamily: TYPED_FONTS[fontIdx] }} className="text-3xl text-[var(--ink)]">
              {name || 'Your name here'}
            </span>
          </div>
          <div className="flex gap-2">
            {TYPED_FONTS.map((f, i) => (
              <button key={f} onClick={() => setFontIdx(i)}
                className={`focus-ring px-3 py-1 rounded border text-sm ${fontIdx === i ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)]'}`}
                style={{ fontFamily: f }}>
                Aa
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            width={480}
            height={140}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="w-full touch-none rounded-md border border-dashed border-[var(--border)] bg-white"
          />
          <button onClick={clearCanvas} className="focus-ring text-sm text-[var(--muted)] hover:text-[var(--ink)] underline">Clear</button>
        </div>
      )}

      <p className="text-xs text-[var(--muted)] mt-4">
        By signing, you certify this record is accurate to the best of your knowledge. Signed {new Date().toLocaleString()}.
      </p>

      <div className="flex gap-2 mt-4">
        <Button onClick={submit}>Sign &amp; confirm</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

export function SignaturePreview({ sig }: { sig: SignatureRecord }) {
  return (
    <div className="flex items-center gap-3">
      {sig.method === 'typed' ? (
        <span style={{ fontFamily: sig.typedFont }} className="text-xl">{sig.name}</span>
      ) : (
        <img src={sig.dataUrl} alt={`Signature of ${sig.name}`} className="h-10 border-b border-[var(--border)]" />
      )}
      <span className="text-xs text-[var(--muted)] tabular">signed {new Date(sig.signedAt).toLocaleDateString()}</span>
    </div>
  );
}
