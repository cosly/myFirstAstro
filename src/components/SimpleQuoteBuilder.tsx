import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';

interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
}

interface Service {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  defaultPrice: number;
  unit: string;
  btwRate: number;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  btwRate: number;
}

interface ExistingQuote {
  id: string;
  quoteNumber: string;
  customerId: string;
  title: string;
  introText: string | null;
  footerText: string | null;
  blocks: Array<{
    lines: Array<{
      id: string;
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      btwRate: number;
    }>;
  }>;
}

interface TextTemplate {
  id: string;
  type: string;
  name: string;
  content: string;
  isDefault: boolean;
}

interface SimpleQuoteBuilderProps {
  customers?: Customer[];
  initialCustomerId?: string | null;
  existingQuote?: ExistingQuote | null;
}

export function SimpleQuoteBuilder({ customers = [], initialCustomerId, existingQuote }: SimpleQuoteBuilderProps) {
  const [quoteId] = useState<string | null>(existingQuote?.id || null);
  const [customerId, setCustomerId] = useState<string>(existingQuote?.customerId || initialCustomerId || '');
  const [title, setTitle] = useState(existingQuote?.title || 'Offerte');
  const [introText, setIntroText] = useState(existingQuote?.introText || '');
  const [footerText, setFooterText] = useState(existingQuote?.footerText || '');
  const [textTemplates, setTextTemplates] = useState<TextTemplate[]>([]);
  const [lines, setLines] = useState<QuoteLine[]>(() => {
    if (existingQuote?.blocks?.[0]?.lines) {
      return existingQuote.blocks[0].lines.map(l => ({
        id: l.id || crypto.randomUUID(),
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        btwRate: l.btwRate || 21,
      }));
    }
    return [];
  });
  const [validityDays, setValidityDays] = useState(30);

  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCatalog, setShowCatalog] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch catalog data and text templates
  useEffect(() => {
    async function fetchData() {
      try {
        const [servicesRes, categoriesRes, templatesRes] = await Promise.all([
          fetch('/api/services'),
          fetch('/api/categories'),
          fetch('/api/text-templates'),
        ]);

        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setTextTemplates(templatesData);

          // Set default intro if not editing existing quote
          if (!existingQuote?.introText) {
            const defaultIntro = templatesData.find((t: TextTemplate) => t.type === 'intro' && t.isDefault);
            if (defaultIntro) setIntroText(defaultIntro.content);
          }

          // Set default footer if not editing existing quote
          if (!existingQuote?.footerText) {
            const defaultFooter = templatesData.find((t: TextTemplate) => t.type === 'footer' && t.isDefault);
            if (defaultFooter) setFooterText(defaultFooter.content);
          }
        }

        if (servicesRes.ok) {
          const data = await servicesRes.json();
          setServices(data);
        }
        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories(data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    }
    fetchData();
  }, [existingQuote]);

  const selectedCustomer = customers.find(c => c.id === customerId);

  // Calculate totals
  const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
  const btwAmount = lines.reduce((sum, line) => {
    const lineTotal = line.quantity * line.unitPrice;
    return sum + (lineTotal * line.btwRate / 100);
  }, 0);
  const total = subtotal + btwAmount;

  // Add service from catalog
  const addService = (service: Service) => {
    const newLine: QuoteLine = {
      id: crypto.randomUUID(),
      description: service.name,
      quantity: 1,
      unit: service.unit,
      unitPrice: service.defaultPrice,
      btwRate: service.btwRate,
    };
    setLines([...lines, newLine]);
    setShowCatalog(false);
  };

  // Add empty line
  const addEmptyLine = () => {
    const newLine: QuoteLine = {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit: 'stuk',
      unitPrice: 0,
      btwRate: 21,
    };
    setLines([...lines, newLine]);
  };

  // Update line
  const updateLine = (id: string, field: keyof QuoteLine, value: string | number) => {
    setLines(lines.map(line =>
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  // Remove line
  const removeLine = (id: string) => {
    setLines(lines.filter(line => line.id !== id));
  };

  // Move line up/down
  const moveLine = (id: string, direction: 'up' | 'down') => {
    const index = lines.findIndex(l => l.id === id);
    if (direction === 'up' && index > 0) {
      const newLines = [...lines];
      [newLines[index - 1], newLines[index]] = [newLines[index], newLines[index - 1]];
      setLines(newLines);
    } else if (direction === 'down' && index < lines.length - 1) {
      const newLines = [...lines];
      [newLines[index], newLines[index + 1]] = [newLines[index + 1], newLines[index]];
      setLines(newLines);
    }
  };

  const handleSave = async (send = false) => {
    if (!customerId) {
      setMessage({ type: 'error', text: 'Selecteer eerst een klant' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validityDays);

      const payload = {
        customerId,
        title,
        introText,
        footerText,
        status: send ? 'sent' : 'draft',
        validUntil: validUntil.toISOString(),
        subtotal,
        btwAmount,
        total,
        blocks: lines.length > 0 ? [{
          blockType: 'pricing_table',
          title: 'Prijsopgave',
          position: 0,
          isOptional: false,
          isSelectedByCustomer: true,
          lines: lines.map((line, index) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            btwRate: line.btwRate,
            lineTotal: line.quantity * line.unitPrice,
            position: index,
            isOptional: false,
            isSelectedByCustomer: true,
          })),
        }] : [],
      };

      const isUpdate = !!quoteId;
      const url = isUpdate ? `/api/quotes/${quoteId}` : '/api/quotes';
      const method = isUpdate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save quote');
      }

      const data = await response.json();
      setMessage({ type: 'success', text: send ? 'Offerte verstuurd!' : 'Offerte opgeslagen!' });

      setTimeout(() => {
        window.location.href = `/offertes/${quoteId || data.id}`;
      }, 1000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Er ging iets mis' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredServices = selectedCategory
    ? services.filter(s => s.categoryId === selectedCategory)
    : services;

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-6">
        {message && (
          <div className={`rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Customer Selection */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Klant *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecteer een klant...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName} - {customer.contactName}
                </option>
              ))}
            </select>
            {selectedCustomer && (
              <p className="text-sm text-muted-foreground">{selectedCustomer.email}</p>
            )}
          </div>
        </div>

        {/* Quote Header */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Titel</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Offerte titel"
              className="text-lg font-semibold"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Introductie tekst</label>
              {textTemplates.filter(t => t.type === 'intro').length > 0 && (
                <select
                  className="text-sm border rounded px-2 py-1 bg-background"
                  value=""
                  onChange={(e) => {
                    const template = textTemplates.find(t => t.id === e.target.value);
                    if (template) setIntroText(template.content);
                  }}
                >
                  <option value="">Template kiezen...</option>
                  {textTemplates.filter(t => t.type === 'intro').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
            <Textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              placeholder="Beste klant, hierbij ontvangt u onze offerte voor..."
              rows={3}
            />
          </div>
        </div>

        {/* Quote Lines */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Prijsopgave</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCatalog(!showCatalog)}>
                📦 Uit catalogus
              </Button>
              <Button variant="outline" size="sm" onClick={addEmptyLine}>
                + Lege regel
              </Button>
            </div>
          </div>

          {/* Catalog Panel */}
          {showCatalog && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-3 py-1 rounded-full text-sm ${
                    !selectedCategory ? 'bg-tesoro-500 text-white' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Alle
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedCategory === cat.id ? 'bg-tesoro-500 text-white' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {filteredServices.map(service => (
                  <button
                    key={service.id}
                    onClick={() => addService(service)}
                    className="flex items-center justify-between p-3 bg-card border rounded-lg hover:border-tesoro-500 transition-colors text-left"
                  >
                    <div>
                      <div className="font-medium">{service.name}</div>
                      {service.description && (
                        <div className="text-sm text-muted-foreground">{service.description}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(service.defaultPrice)}</div>
                      <div className="text-xs text-muted-foreground">per {service.unit}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lines Table */}
          {lines.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr,80px,80px,100px,100px,80px] gap-2 text-sm font-medium text-muted-foreground px-2">
                <div>Omschrijving</div>
                <div>Aantal</div>
                <div>Eenheid</div>
                <div>Prijs</div>
                <div>Totaal</div>
                <div></div>
              </div>
              {lines.map((line, index) => (
                <div key={line.id} className="grid grid-cols-[1fr,80px,80px,100px,100px,80px] gap-2 items-center bg-muted/30 rounded-lg p-2">
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                    placeholder="Omschrijving"
                    className="h-9"
                  />
                  <Input
                    type="number"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                  <select
                    value={line.unit}
                    onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="stuk">stuk</option>
                    <option value="uur">uur</option>
                    <option value="maand">maand</option>
                    <option value="jaar">jaar</option>
                    <option value="project">project</option>
                  </select>
                  <Input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                  <div className="font-medium text-sm">
                    {formatCurrency(line.quantity * line.unitPrice)}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveLine(line.id, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-muted rounded disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveLine(line.id, 'down')}
                      disabled={index === lines.length - 1}
                      className="p-1 hover:bg-muted rounded disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeLine(line.id)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nog geen regels toegevoegd.</p>
              <p className="text-sm">Klik op "Uit catalogus" om producten toe te voegen.</p>
            </div>
          )}
        </div>

        {/* Footer Text */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Afsluiting / Voorwaarden</label>
              {textTemplates.filter(t => t.type === 'footer' || t.type === 'terms').length > 0 && (
                <select
                  className="text-sm border rounded px-2 py-1 bg-background"
                  value=""
                  onChange={(e) => {
                    const template = textTemplates.find(t => t.id === e.target.value);
                    if (template) setFooterText(template.content);
                  }}
                >
                  <option value="">Template kiezen...</option>
                  {textTemplates.filter(t => t.type === 'footer').length > 0 && (
                    <optgroup label="Afsluiting">
                      {textTemplates.filter(t => t.type === 'footer').map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {textTemplates.filter(t => t.type === 'terms').length > 0 && (
                    <optgroup label="Voorwaarden">
                      {textTemplates.filter(t => t.type === 'terms').map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>
            <Textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Wij hopen u hiermee een passend aanbod te hebben gedaan..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 space-y-4">
        {/* Price Summary */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold">Totaal</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotaal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">BTW</span>
              <span>{formatCurrency(btwAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Totaal</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

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
          <Button
            className="w-full bg-tesoro-500 hover:bg-tesoro-600"
            onClick={() => handleSave(true)}
            disabled={isSaving}
          >
            Verstuur naar klant
          </Button>
        </div>

        {/* Info */}
        <div className="rounded-xl border bg-card p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">Concept</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Regels</span>
            <span>{lines.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
