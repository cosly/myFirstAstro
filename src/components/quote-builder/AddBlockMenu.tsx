import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { QuoteBlock } from './types';
import { cn } from '@/lib/utils';

interface AddBlockMenuProps {
  onAdd: (type: QuoteBlock['blockType']) => void;
}

const blockTypes = [
  {
    type: 'pricing_table' as const,
    icon: '💰',
    title: 'Prijstabel',
    description: 'Tabel met prijsregels',
  },
  {
    type: 'text' as const,
    icon: '📝',
    title: 'Tekst',
    description: 'Vrije tekst sectie',
  },
  {
    type: 'image' as const,
    icon: '🖼️',
    title: 'Afbeelding',
    description: 'Upload een afbeelding',
  },
  {
    type: 'pricing_plans' as const,
    icon: '📦',
    title: 'Pakketten',
    description: 'Kies-uit-pakket opties',
  },
];

export function AddBlockMenu({ onAdd }: AddBlockMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {!isOpen ? (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setIsOpen(true)}
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Blok toevoegen
        </Button>
      ) : (
        <div className="rounded-xl border bg-card p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Kies een blok type</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {blockTypes.map((block) => (
              <button
                key={block.type}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  'hover:border-tesoro-300 hover:bg-tesoro-50'
                )}
                onClick={() => {
                  onAdd(block.type);
                  setIsOpen(false);
                }}
              >
                <span className="text-2xl">{block.icon}</span>
                <div>
                  <p className="font-medium text-sm">{block.title}</p>
                  <p className="text-xs text-muted-foreground">{block.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
