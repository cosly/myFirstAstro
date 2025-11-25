import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { QuoteBlockComponent } from './QuoteBlock';
import { PriceSummary } from './PriceSummary';
import { AddBlockMenu } from './AddBlockMenu';
import type { Quote, QuoteBlock, QuoteLine } from './types';
import { generateId, calculateLineTotal } from '@/lib/utils';

interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
}

interface QuoteBuilderProps {
  initialQuote?: Partial<Quote>;
  customers?: Customer[];
  initialCustomerId?: string | null;
  requestId?: string | null;
  onSave?: (quote: Quote) => void;
  onSend?: (quote: Quote) => void;
}

const defaultQuote: Quote = {
  id: generateId(),
  quoteNumber: '',
  title: 'Offerte',
  introText: '',
  footerText: '',
  blocks: [],
  status: 'draft',
  subtotal: 0,
  btwAmount: 0,
  total: 0,
};

export function QuoteBuilder({
  initialQuote,
  customers = [],
  initialCustomerId,
  requestId,
  onSave,
}: QuoteBuilderProps) {
  const [quote, setQuote] = useState<Quote>({ ...defaultQuote, ...initialQuote });
  const [customerId, setCustomerId] = useState<string>(initialCustomerId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validityDays, setValidityDays] = useState(30);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate totals whenever blocks change
  const calculateTotals = useCallback((blocks: QuoteBlock[]) => {
    let subtotal = 0;
    let btwAmount = 0;

    blocks.forEach((block) => {
      if (!block.isOptional || block.isSelectedByCustomer) {
        block.lines.forEach((line) => {
          if (!line.isOptional || line.isSelectedByCustomer) {
            const lineTotal = calculateLineTotal(
              line.quantity,
              line.unitPrice,
              line.discountType,
              line.discountValue
            );
            subtotal += lineTotal;
            btwAmount += lineTotal * (line.btwRate / 100);
          }
        });
      }
    });

    return {
      subtotal,
      btwAmount,
      total: subtotal + btwAmount,
    };
  }, []);

  // Update quote and recalculate
  const updateQuote = useCallback(
    (updates: Partial<Quote>) => {
      setQuote((prev) => {
        const newQuote = { ...prev, ...updates };
        if (updates.blocks) {
          const totals = calculateTotals(updates.blocks);
          return { ...newQuote, ...totals };
        }
        return newQuote;
      });
    },
    [calculateTotals]
  );

  // Block operations
  const addBlock = (type: QuoteBlock['blockType']) => {
    const newBlock: QuoteBlock = {
      id: generateId(),
      blockType: type,
      title: type === 'text' ? 'Tekst sectie' : type === 'pricing_table' ? 'Prijsopgave' : '',
      description: '',
      isOptional: false,
      isSelectedByCustomer: true,
      position: quote.blocks.length,
      lines: type === 'pricing_table' ? [createEmptyLine(0)] : [],
    };
    updateQuote({ blocks: [...quote.blocks, newBlock] });
  };

  const updateBlock = (blockId: string, updates: Partial<QuoteBlock>) => {
    const newBlocks = quote.blocks.map((block) =>
      block.id === blockId ? { ...block, ...updates } : block
    );
    updateQuote({ blocks: newBlocks });
  };

  const deleteBlock = (blockId: string) => {
    const newBlocks = quote.blocks
      .filter((block) => block.id !== blockId)
      .map((block, index) => ({ ...block, position: index }));
    updateQuote({ blocks: newBlocks });
  };

  // Line operations
  const createEmptyLine = (position: number): QuoteLine => ({
    id: generateId(),
    description: '',
    quantity: 1,
    unit: 'stuk',
    unitPrice: 0,
    btwRate: 21,
    isOptional: false,
    isSelectedByCustomer: true,
    position,
  });

  const addLine = (blockId: string) => {
    const block = quote.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newLine = createEmptyLine(block.lines.length);
    updateBlock(blockId, { lines: [...block.lines, newLine] });
  };

  const updateLine = (blockId: string, lineId: string, updates: Partial<QuoteLine>) => {
    const block = quote.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newLines = block.lines.map((line) =>
      line.id === lineId ? { ...line, ...updates } : line
    );
    updateBlock(blockId, { lines: newLines });
  };

  const deleteLine = (blockId: string, lineId: string) => {
    const block = quote.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const newLines = block.lines
      .filter((line) => line.id !== lineId)
      .map((line, index) => ({ ...line, position: index }));
    updateBlock(blockId, { lines: newLines });
  };

  // Drag and drop handlers
  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = quote.blocks.findIndex((b) => b.id === active.id);
    const newIndex = quote.blocks.findIndex((b) => b.id === over.id);

    const newBlocks = arrayMove(quote.blocks, oldIndex, newIndex).map((block, index) => ({
      ...block,
      position: index,
    }));

    updateQuote({ blocks: newBlocks });
  };

  const handleLineDragEnd = (blockId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const block = quote.blocks.find((b) => b.id === blockId);
    if (!block) return;

    const oldIndex = block.lines.findIndex((l) => l.id === active.id);
    const newIndex = block.lines.findIndex((l) => l.id === over.id);

    const newLines = arrayMove(block.lines, oldIndex, newIndex).map((line, index) => ({
      ...line,
      position: index,
    }));

    updateBlock(blockId, { lines: newLines });
  };

  // Save handler
  const handleSave = async (sendAfterSave = false) => {
    // Validate customer selection
    if (!customerId) {
      setSaveMessage({ type: 'error', text: 'Selecteer eerst een klant' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    // Validate blocks
    if (quote.blocks.length === 0) {
      setSaveMessage({ type: 'error', text: 'Voeg minimaal één blok toe' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validityDays);

      const payload = {
        ...quote,
        customerId,
        requestId: requestId || undefined,
        validUntil: validUntil.toISOString(),
        status: sendAfterSave ? 'sent' : 'draft',
      };

      if (onSave) {
        onSave(quote);
      } else {
        const response = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save quote');
        }

        const data = await response.json();

        setSaveMessage({
          type: 'success',
          text: sendAfterSave ? 'Offerte verstuurd!' : 'Offerte opgeslagen!'
        });

        // Redirect to quote detail page after short delay
        setTimeout(() => {
          window.location.href = `/offertes/${data.id}`;
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to save quote:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Kon offerte niet opslaan'
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCustomer = customers.find(c => c.id === customerId);

  return (
    <div className="flex gap-6">
      {/* Main Editor */}
      <div className="flex-1 space-y-6">
        {/* Status Messages */}
        {saveMessage && (
          <div className={`rounded-lg p-4 ${
            saveMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Customer Selection */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Klant *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tesoro-500"
            >
              <option value="">Selecteer een klant...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName} - {customer.contactName}
                </option>
              ))}
            </select>
            {selectedCustomer && (
              <p className="text-sm text-muted-foreground">
                {selectedCustomer.email}
              </p>
            )}
          </div>
        </div>

        {/* Quote Header */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Titel</label>
            <Input
              value={quote.title}
              onChange={(e) => updateQuote({ title: e.target.value })}
              placeholder="Offerte titel"
              className="text-lg font-semibold"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Introductie tekst</label>
            <Textarea
              value={quote.introText || ''}
              onChange={(e) => updateQuote({ introText: e.target.value })}
              placeholder="Beste klant, hierbij ontvangt u onze offerte voor..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs">
                🤖 AI Schrijven
              </Button>
              <Button variant="outline" size="sm" className="text-xs">
                🌍 Vertalen
              </Button>
            </div>
          </div>
        </div>

        {/* Blocks */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleBlockDragEnd}
        >
          <SortableContext
            items={quote.blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {quote.blocks.map((block) => (
                <QuoteBlockComponent
                  key={block.id}
                  block={block}
                  onUpdate={(updates) => updateBlock(block.id, updates)}
                  onDelete={() => deleteBlock(block.id)}
                  onAddLine={() => addLine(block.id)}
                  onUpdateLine={(lineId, updates) => updateLine(block.id, lineId, updates)}
                  onDeleteLine={(lineId) => deleteLine(block.id, lineId)}
                  onLineDragEnd={(event) => handleLineDragEnd(block.id, event)}
                  sensors={sensors}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add Block */}
        <AddBlockMenu onAdd={addBlock} />

        {/* Footer Text */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Afsluiting / Voorwaarden</label>
            <Textarea
              value={quote.footerText || ''}
              onChange={(e) => updateQuote({ footerText: e.target.value })}
              placeholder="Wij hopen u hiermee een passend aanbod te hebben gedaan..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 space-y-4">
        {/* Price Summary */}
        <PriceSummary quote={quote} />

        {/* Validity */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <label className="text-sm font-medium">Geldigheid</label>
          <select
            value={validityDays}
            onChange={(e) => setValidityDays(Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={14}>14 dagen</option>
            <option value={30}>30 dagen</option>
            <option value={60}>60 dagen</option>
            <option value={90}>90 dagen</option>
          </select>
        </div>

        {/* Actions */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSave(false)}
            disabled={isSaving}
          >
            {isSaving ? 'Opslaan...' : 'Opslaan als concept'}
          </Button>
          <Button variant="outline" className="w-full" disabled>
            Voorbeeld bekijken
          </Button>
          <Button
            variant="tesoro"
            className="w-full"
            onClick={() => handleSave(true)}
            disabled={isSaving}
          >
            Verstuur naar klant
          </Button>
        </div>

        {/* Quick Info */}
        <div className="rounded-xl border bg-card p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">Concept</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Offerte nr.</span>
            <span className="font-mono">{quote.quoteNumber || 'Nog niet toegewezen'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
