import type { Quote } from './types';
import { formatCurrency, calculateLineTotal } from '@/lib/utils';

interface PriceSummaryProps {
  quote: Quote;
}

export function PriceSummary({ quote }: PriceSummaryProps) {
  // Calculate optional items total
  let optionalTotal = 0;
  quote.blocks.forEach((block) => {
    if (block.isOptional && block.isSelectedByCustomer) {
      block.lines.forEach((line) => {
        if (!line.isOptional || line.isSelectedByCustomer) {
          optionalTotal += calculateLineTotal(
            line.quantity,
            line.unitPrice,
            line.discountType,
            line.discountValue
          );
        }
      });
    } else if (!block.isOptional) {
      block.lines.forEach((line) => {
        if (line.isOptional && line.isSelectedByCustomer) {
          optionalTotal += calculateLineTotal(
            line.quantity,
            line.unitPrice,
            line.discountType,
            line.discountValue
          );
        }
      });
    }
  });

  // Calculate total with all options
  let totalWithAllOptions = 0;
  let btwWithAllOptions = 0;
  quote.blocks.forEach((block) => {
    block.lines.forEach((line) => {
      const lineTotal = calculateLineTotal(
        line.quantity,
        line.unitPrice,
        line.discountType,
        line.discountValue
      );
      totalWithAllOptions += lineTotal;
      btwWithAllOptions += lineTotal * (line.btwRate / 100);
    });
  });

  const hasOptionalItems = optionalTotal > 0 || quote.blocks.some(b => b.isOptional);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4 sticky top-4">
      <h3 className="font-semibold">Prijsoverzicht</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotaal</span>
          <span>{formatCurrency(quote.subtotal)}</span>
        </div>

        {quote.discountValue && quote.discountValue > 0 && (
          <div className="flex justify-between text-green-600">
            <span>
              Korting
              {quote.discountType === 'percentage' && ` (${quote.discountValue}%)`}
            </span>
            <span>
              -{formatCurrency(
                quote.discountType === 'percentage'
                  ? quote.subtotal * (quote.discountValue / 100)
                  : quote.discountValue
              )}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">BTW</span>
          <span>{formatCurrency(quote.btwAmount)}</span>
        </div>

        <div className="border-t pt-2 flex justify-between font-semibold text-base">
          <span>Totaal</span>
          <span>{formatCurrency(quote.total)}</span>
        </div>
      </div>

      {hasOptionalItems && (
        <>
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Inclusief alle opties</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotaal</span>
              <span>{formatCurrency(totalWithAllOptions)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">BTW</span>
              <span>{formatCurrency(btwWithAllOptions)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Totaal incl. opties</span>
              <span>{formatCurrency(totalWithAllOptions + btwWithAllOptions)}</span>
            </div>
          </div>
        </>
      )}

      <div className="border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Alle prijzen zijn exclusief BTW tenzij anders aangegeven.
        </p>
      </div>
    </div>
  );
}
