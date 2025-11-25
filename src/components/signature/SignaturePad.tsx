import { useRef, useEffect, useState } from 'react';
import SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SignaturePadProps {
  onSign: (data: {
    signatureDataUrl: string;
    name: string;
    function: string;
  }) => void;
  onCancel: () => void;
}

export function SignaturePad({ onSign, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePadLib | null>(null);
  const [name, setName] = useState('');
  const [func, setFunc] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (canvasRef.current) {
      signaturePadRef.current = new SignaturePadLib(canvasRef.current, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      });

      signaturePadRef.current.addEventListener('beginStroke', () => {
        setIsEmpty(false);
      });

      // Resize canvas to fit container
      const resizeCanvas = () => {
        const canvas = canvasRef.current!;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const container = canvas.parentElement!;
        canvas.width = container.offsetWidth * ratio;
        canvas.height = 200 * ratio;
        canvas.style.width = `${container.offsetWidth}px`;
        canvas.style.height = '200px';
        canvas.getContext('2d')!.scale(ratio, ratio);
        signaturePadRef.current?.clear();
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
        signaturePadRef.current?.off();
      };
    }
  }, []);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSign = () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      return;
    }

    const signatureDataUrl = signaturePadRef.current.toDataURL('image/png');
    onSign({
      signatureDataUrl,
      name,
      function: func,
    });
  };

  const canSubmit = !isEmpty && name.trim() && agreed;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Offerte Accepteren</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Door te ondertekenen gaat u akkoord met deze offerte en de algemene voorwaarden.
        </p>
      </div>

      {/* Signature Canvas */}
      <div className="space-y-2">
        <Label>Uw handtekening</Label>
        <div className="border rounded-lg bg-white relative">
          <canvas
            ref={canvasRef}
            className="w-full touch-none"
            style={{ height: '200px' }}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-muted-foreground text-sm">
                Teken hier uw handtekening
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleClear}
        >
          Wissen
        </Button>
      </div>

      {/* Name and Function */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sign-name">Naam *</Label>
          <Input
            id="sign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Uw volledige naam"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sign-function">Functie</Label>
          <Input
            id="sign-function"
            value={func}
            onChange={(e) => setFunc(e.target.value)}
            placeholder="bijv. Directeur"
          />
        </div>
      </div>

      {/* Agreement */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-tesoro-500 focus:ring-tesoro-500"
        />
        <span className="text-sm">
          Ik ga akkoord met de{' '}
          <a href="/voorwaarden" target="_blank" className="text-tesoro-500 hover:underline">
            algemene voorwaarden
          </a>{' '}
          en accepteer deze offerte.
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
        >
          Annuleren
        </Button>
        <Button
          variant="tesoro"
          className="flex-1"
          onClick={handleSign}
          disabled={!canSubmit}
        >
          ✍️ Onderteken & Accepteer
        </Button>
      </div>
    </div>
  );
}
