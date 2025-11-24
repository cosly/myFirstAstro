import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { SignaturePad } from '@/components/signature/SignaturePad';
import type { Quote, QuoteBlock, QuoteLine } from '@/components/quote-builder/types';
import { cn, formatCurrency, formatDate, calculateLineTotal } from '@/lib/utils';

interface QuoteViewerProps {
  quote: Quote;
  customer: {
    companyName: string;
    contactName: string;
    email: string;
  };
  onUpdateSelection: (blockId: string, lineId: string | null, selected: boolean) => void;
  onAccept: (signatureData: { signatureDataUrl: string; name: string; function: string }) => void;
  onDecline: (reason?: string) => void;
  onAskQuestion: (message: string) => void;
}

export function QuoteViewer({
  quote,
  customer,
  onUpdateSelection,
  onAccept,
  onDecline,
  onAskQuestion,
}: QuoteViewerProps) {
  const [showSignature, setShowSignature] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  // Calculate current totals based on selections
  const calculateCurrentTotals = () => {
    let subtotal = 0;
    let btwAmount = 0;

    quote.blocks.forEach((block) => {
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

    return { subtotal, btwAmount, total: subtotal + btwAmount };
  };

  const totals = calculateCurrentTotals();

  if (showSignature) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <SignaturePad
          onSign={onAccept}
          onCancel={() => setShowSignature(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-card rounded-xl border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tesoro-500">
                <span className="text-xl font-bold text-white">T</span>
              </div>
              <span className="text-xl font-semibold">Tesoro CRM</span>
            </div>
            <h1 className="text-2xl font-bold mt-4">{quote.title}</h1>
            <p className="text-muted-foreground">Offerte #{quote.quoteNumber}</p>
          </div>
          <div className="text-right">
            <Badge variant={quote.status === 'sent' ? 'info' : 'secondary'}>
              {quote.status === 'sent' ? 'Nieuw' : quote.status}
            </Badge>
            {quote.validUntil && (
              <p className="text-sm text-muted-foreground mt-2">
                Geldig tot: {formatDate(quote.validUntil)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Opgesteld voor:</p>
            <p className="font-medium">{customer.companyName}</p>
            <p>{customer.contactName}</p>
            <p className="text-muted-foreground">{customer.email}</p>
          </div>
        </div>

        {quote.introText && (
          <div className="mt-6 pt-6 border-t">
            <p className="whitespace-pre-wrap">{quote.introText}</p>
          </div>
        )}
      </div>

      {/* Blocks */}
      <div className="space-y-6 mb-6">
        {quote.blocks.map((block) => (
          <QuoteBlockView
            key={block.id}
            block={block}
            onToggleBlock={(selected) => onUpdateSelection(block.id, null, selected)}
            onToggleLine={(lineId, selected) => onUpdateSelection(block.id, lineId, selected)}
          />
        ))}
      </div>

      {/* Footer Text */}
      {quote.footerText && (
        <div className="bg-card rounded-xl border p-6 mb-6">
          <p className="whitespace-pre-wrap text-sm">{quote.footerText}</p>
        </div>
      )}

      {/* Totals & Actions */}
      <div className="bg-card rounded-xl border p-6 sticky bottom-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Totals */}
          <div className="space-y-1">
            <div className="flex gap-6 text-sm">
              <span className="text-muted-foreground">Subtotaal: {formatCurrency(totals.subtotal)}</span>
              <span className="text-muted-foreground">BTW: {formatCurrency(totals.btwAmount)}</span>
            </div>
            <p className="text-2xl font-bold">
              Totaal: {formatCurrency(totals.total)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowQuestionModal(true)}
            >
              Vraag stellen
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeclineModal(true)}
            >
              Afwijzen
            </Button>
            <Button
              variant="tesoro"
              onClick={() => setShowSignature(true)}
            >
              ✍️ Accepteren
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Block View Component
function QuoteBlockView({
  block,
  onToggleBlock,
  onToggleLine,
}: {
  block: QuoteBlock;
  onToggleBlock: (selected: boolean) => void;
  onToggleLine: (lineId: string, selected: boolean) => void;
}) {
  const isEnabled = !block.isOptional || block.isSelectedByCustomer;

  return (
    <div
      className={cn(
        'bg-card rounded-xl border overflow-hidden transition-opacity',
        block.isOptional && !block.isSelectedByCustomer && 'opacity-60'
      )}
    >
      {/* Block Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          {block.isOptional && (
            <Switch
              checked={block.isSelectedByCustomer}
              onCheckedChange={onToggleBlock}
            />
          )}
          <div>
            <h3 className="font-semibold">{block.title}</h3>
            {block.isOptional && (
              <span className="text-xs text-tesoro-600">Optioneel</span>
            )}
          </div>
        </div>
      </div>

      {/* Block Content */}
      <div className="p-6">
        {block.blockType === 'text' && block.description && (
          <p className="whitespace-pre-wrap">{block.description}</p>
        )}

        {block.blockType === 'pricing_table' && (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 pb-2 border-b">
              <div className="col-span-1"></div>
              <div className="col-span-5">Omschrijving</div>
              <div className="col-span-2 text-right">Aantal</div>
              <div className="col-span-2 text-right">Prijs</div>
              <div className="col-span-2 text-right">Totaal</div>
            </div>

            {/* Lines */}
            {block.lines.map((line) => (
              <QuoteLineView
                key={line.id}
                line={line}
                blockEnabled={isEnabled}
                onToggle={(selected) => onToggleLine(line.id, selected)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Line View Component
function QuoteLineView({
  line,
  blockEnabled,
  onToggle,
}: {
  line: QuoteLine;
  blockEnabled: boolean;
  onToggle: (selected: boolean) => void;
}) {
  const lineTotal = calculateLineTotal(
    line.quantity,
    line.unitPrice,
    line.discountType,
    line.discountValue
  );

  const isEnabled = blockEnabled && (!line.isOptional || line.isSelectedByCustomer);

  return (
    <div
      className={cn(
        'grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-lg',
        line.isOptional && 'bg-tesoro-50/50',
        !isEnabled && 'opacity-50'
      )}
    >
      {/* Toggle */}
      <div className="col-span-1">
        {line.isOptional && (
          <Switch
            checked={line.isSelectedByCustomer}
            onCheckedChange={onToggle}
            disabled={!blockEnabled}
            className="scale-90"
          />
        )}
      </div>

      {/* Description */}
      <div className="col-span-5">
        <p className={cn(!isEnabled && 'line-through')}>{line.description}</p>
        {line.isOptional && (
          <span className="text-xs text-tesoro-600">Optioneel</span>
        )}
      </div>

      {/* Quantity */}
      <div className="col-span-2 text-right text-sm">
        {line.quantity} {line.unit}
      </div>

      {/* Unit Price */}
      <div className="col-span-2 text-right text-sm">
        {formatCurrency(line.unitPrice)}
      </div>

      {/* Total */}
      <div className="col-span-2 text-right font-medium">
        {formatCurrency(lineTotal)}
      </div>
    </div>
  );
}
