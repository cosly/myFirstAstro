import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { QuoteLine } from './types';
import { cn, formatCurrency, calculateLineTotal } from '@/lib/utils';

interface QuoteLineProps {
  line: QuoteLine;
  onUpdate: (updates: Partial<QuoteLine>) => void;
  onDelete: () => void;
}

export function QuoteLineComponent({ line, onUpdate, onDelete }: QuoteLineProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const lineTotal = calculateLineTotal(
    line.quantity,
    line.unitPrice,
    line.discountType,
    line.discountValue
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid grid-cols-12 gap-2 items-center rounded-lg p-2 hover:bg-muted/50 group',
        isDragging && 'bg-muted shadow-lg ring-2 ring-primary z-10',
        line.isOptional && 'bg-tesoro-50/50'
      )}
    >
      {/* Drag Handle */}
      <div className="col-span-1 flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 text-muted-foreground opacity-0 group-hover:opacity-100 active:cursor-grabbing transition-opacity"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        {/* Optional indicator */}
        <div className="flex items-center" title={line.isOptional ? 'Optioneel item' : 'Maak optioneel'}>
          <Switch
            checked={line.isOptional}
            onCheckedChange={(checked) => onUpdate({ isOptional: checked })}
            className="scale-75"
          />
        </div>
      </div>

      {/* Description */}
      <div className="col-span-4">
        <Input
          value={line.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Omschrijving"
          className="h-8 text-sm"
        />
      </div>

      {/* Quantity */}
      <div className="col-span-1">
        <Input
          type="number"
          min="0"
          step="0.5"
          value={line.quantity}
          onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
          className="h-8 text-sm text-right"
        />
      </div>

      {/* Unit */}
      <div className="col-span-1">
        <select
          value={line.unit}
          onChange={(e) => onUpdate({ unit: e.target.value })}
          className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
        >
          <option value="stuk">stuk</option>
          <option value="uur">uur</option>
          <option value="dag">dag</option>
          <option value="maand">maand</option>
          <option value="jaar">jaar</option>
          <option value="m²">m²</option>
        </select>
      </div>

      {/* Unit Price */}
      <div className="col-span-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={line.unitPrice}
            onChange={(e) => onUpdate({ unitPrice: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm text-right pl-6"
          />
        </div>
      </div>

      {/* Line Total */}
      <div className="col-span-2 text-right">
        <span className={cn(
          'text-sm font-medium',
          line.isOptional && 'text-muted-foreground'
        )}>
          {formatCurrency(lineTotal)}
        </span>
        {line.isOptional && (
          <span className="ml-1 text-xs text-tesoro-500">(optioneel)</span>
        )}
      </div>

      {/* Delete */}
      <div className="col-span-1 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
          onClick={onDelete}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
