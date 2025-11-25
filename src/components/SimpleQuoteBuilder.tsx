import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
}

interface SimpleQuoteBuilderProps {
  customers?: Customer[];
  initialCustomerId?: string | null;
}

export function SimpleQuoteBuilder({ customers = [], initialCustomerId }: SimpleQuoteBuilderProps) {
  const [customerId, setCustomerId] = useState<string>(initialCustomerId || '');
  const [title, setTitle] = useState('Offerte');
  const [introText, setIntroText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const handleSave = async () => {
    if (!customerId) {
      setMessage({ type: 'error', text: 'Selecteer eerst een klant' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          title,
          introText,
          blocks: [],
          subtotal: 0,
          btwAmount: 0,
          total: 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save quote');
      }

      const data = await response.json();
      setMessage({ type: 'success', text: 'Offerte opgeslagen!' });

      setTimeout(() => {
        window.location.href = `/offertes/${data.id}`;
      }, 1000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Er ging iets mis' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

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

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Titel</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Offerte titel"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Introductie tekst</label>
          <Textarea
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            placeholder="Beste klant, hierbij ontvangt u onze offerte..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Opslaan...' : 'Opslaan als concept'}
        </Button>
      </div>
    </div>
  );
}
