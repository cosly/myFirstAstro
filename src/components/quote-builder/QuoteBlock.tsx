import React from 'react';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { QuoteLineComponent } from './QuoteLine';
import type { QuoteBlock, QuoteLine } from './types';
import { cn } from '@/lib/utils';

interface QuoteBlockProps {
  block: QuoteBlock;
  onUpdate: (updates: Partial<QuoteBlock>) => void;
  onDelete: () => void;
  onAddLine: () => void;
  onUpdateLine: (lineId: string, updates: Partial<QuoteLine>) => void;
  onDeleteLine: (lineId: string) => void;
  onLineDragEnd: (event: DragEndEvent) => void;
  sensors: SensorDescriptor<SensorOptions>[];
}

export function QuoteBlockComponent({
  block,
  onUpdate,
  onDelete,
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  onLineDragEnd,
  sensors,
}: QuoteBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl border bg-card transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary opacity-90',
        block.isOptional && 'border-dashed border-2 border-tesoro-300'
      )}
    >
      {/* Block Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        {/* Block Title */}
        <Input
          value={block.title || ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder={block.blockType === 'text' ? 'Sectie titel' : 'Prijsblok titel'}
          className="flex-1 border-0 bg-transparent font-semibold focus-visible:ring-0"
        />

        {/* Optional Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Optioneel</span>
          <Switch
            checked={block.isOptional}
            onCheckedChange={(checked) => onUpdate({ isOptional: checked })}
          />
        </div>

        {/* Actions */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
      </div>

      {/* Block Content */}
      <div className="p-4">
        {block.blockType === 'text' && (
          <div className="space-y-2">
            <Textarea
              value={block.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Voer hier uw tekst in..."
              rows={4}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs">
                🤖 AI Verbeteren
              </Button>
              <Button variant="outline" size="sm" className="text-xs">
                🌍 Vertalen
              </Button>
            </div>
          </div>
        )}

        {block.blockType === 'pricing_table' && (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
              <div className="col-span-1"></div>
              <div className="col-span-4">Omschrijving</div>
              <div className="col-span-1 text-right">Aantal</div>
              <div className="col-span-1">Eenheid</div>
              <div className="col-span-2 text-right">Prijs</div>
              <div className="col-span-2 text-right">Totaal</div>
              <div className="col-span-1"></div>
            </div>

            {/* Lines */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onLineDragEnd}
            >
              <SortableContext
                items={block.lines.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {block.lines.map((line) => (
                    <QuoteLineComponent
                      key={line.id}
                      line={line}
                      onUpdate={(updates) => onUpdateLine(line.id, updates)}
                      onDelete={() => onDeleteLine(line.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Line */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={onAddLine}
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Regel toevoegen
            </Button>
          </div>
        )}

        {block.blockType === 'image' && (
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
            <svg className="h-12 w-12 mx-auto text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm text-muted-foreground">
              Sleep een afbeelding hierheen of klik om te uploaden
            </p>
            <Button variant="outline" size="sm" className="mt-4">
              Afbeelding kiezen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
