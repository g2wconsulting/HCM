import { useRef, useState, useEffect } from 'react';
import type { SignatureRecord } from '../lib/types';
import { Button } from './ui';

const TYPED_FONTS = ["'Fraunces', serif", "'IBM Plex Mono', monospace", "cursive"];

type Mode = 'typed' | 'drawn' | 'uploaded';

export function SignaturePad({
  defaultName, defaultTitle, requireTitle, onSign, onCancel, allowedModes,
}: {
  defaultName: string;
  defaultTitle?: string;
  /** Require the signer to also type their job title/role before signing. */
  requireTitle?: boolean;
  onSign: (sig: SignatureRecord) => void;
  onCancel?: () => void;
  /** Which signing methods to offer. Defaults to typed + drawn (internal,
   * quick sign-off use). For a document going out for real external
   * e-signature, pass ['drawn', 'uploaded'] — a genuine hand signature,
   * either drawn live or an image of a real signature, never plain typed
   * text standing in for one. */
  allowedModes?: Mode[];
}) {
  const modes = allowedModes ?? ['typed', 'drawn'];
  const [mode, setMode] = useState<Mode>(modes[0]);
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [fontIdx, setFontIdx] = useState(0);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (mode !== 'drawn') return;
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

  function handleFileUpload(file: File) {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (PNG or JPG) of your signature.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setUploadedDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function submit() {
    if (requireTitle && !title.trim()) return;
    const titleField = requireTitle ? { title: title.trim() } : {};
    if (mode === 'typed') {
      if (!name.trim()) return;
      onSign({ name: name.trim(), ...titleField, method: 'typed', typedFont: TYPED_FONTS[fontIdx], signedAt: new Date().toISOString() });
    } else if (mode === 'drawn') {
      if (!hasDrawn.current || !canvasRef.current) return;
      onSign({ name: name.trim() || defaultName, ...titleField, method: 'drawn', dataUrl: canvasRef.current.toDataURL('image/png'), signedAt: new Date().toISOString() });
    } else {
      if (!uploadedDataUrl) return;
      onSign({ name: name.trim() || defaultName, ...titleField, method: 'uploaded', dataUrl: uploadedDataUrl, signedAt: new Date().toISOString() });
    }
  }

  const canSubmit = !requireTitle || title.trim().length > 0;

  const modeLabels: Record<Mode, string> = { typed: 'Type signature', drawn: 'Draw signature', uploaded: 'Upload signature' };

  return (
    <div className="ledger-card p-5">
      {modes.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          {modes.map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`focus-ring px-3 py-1.5 rounded-md text-sm font-medium border ${mode === m ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-dark)]' : 'border-[var(--border)] text-[var(--ink-soft)]'}`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
      )}

      {requireTitle && (
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title / role (e.g. Project Manager)"
          className="focus-ring w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm mb-3"
        />
      )}

      {mode === 'typed' && (
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
      )}

      {mode === 'drawn' && (
        <div className="space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full legal name"
            className="focus-ring w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
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

      {mode === 'uploaded' && (
        <div className="space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Full legal name"
            className="focus-ring w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
          />
          {uploadedDataUrl ? (
            <div className="rounded-md border border-dashed border-[var(--border)] bg-white px-4 py-4 flex flex-col items-center gap-2">
              <img src={uploadedDataUrl} alt="Uploaded signature" className="max-h-24" />
              <button onClick={() => fileInputRef.current?.click()} className="focus-ring text-xs text-[var(--accent)] hover:underline">Choose a different image</button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="focus-ring w-full rounded-md border-2 border-dashed border-[var(--border)] py-8 text-center text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Upload an image of your signature (PNG or JPG)
            </button>
          )}
          {uploadError && <p className="text-xs text-[var(--bad)]">{uploadError}</p>}
        </div>
      )}

      <p className="text-xs text-[var(--muted)] mt-4">
        By signing, you certify this record is accurate to the best of your knowledge. Signed {new Date().toLocaleString()}.
      </p>

      <div className="flex gap-2 mt-4">
        <Button onClick={submit} disabled={!canSubmit}>Sign &amp; confirm</Button>
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
      <div className="flex flex-col">
        {sig.title && (
          <span className="text-xs text-[var(--ink-soft)]">{sig.method !== 'typed' ? `${sig.name}, ` : ''}{sig.title}</span>
        )}
        <span className="text-xs text-[var(--muted)] tabular">signed {new Date(sig.signedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
