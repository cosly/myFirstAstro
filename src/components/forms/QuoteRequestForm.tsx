import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const serviceTypes = [
  {
    id: 'website',
    icon: '🌐',
    title: 'Website',
    description: 'Aanpassingen, nieuwe pagina\'s, redesign',
  },
  {
    id: 'crm_setup',
    icon: '⚙️',
    title: 'CRM Setup',
    description: 'Tesoro CRM inrichten & configureren',
  },
  {
    id: 'marketing',
    icon: '🎨',
    title: 'Marketing',
    description: 'Window cards, flyers, branding',
  },
  {
    id: 'support',
    icon: '🔧',
    title: 'Support',
    description: 'Ondersteuning & onderhoud',
  },
];

const budgetOptions = [
  { id: 'under_500', label: '< €500' },
  { id: '500_1000', label: '€500 - €1.000' },
  { id: '1000_2500', label: '€1.000 - €2.500' },
  { id: 'above_2500', label: '€2.500+' },
  { id: 'unknown', label: 'Weet ik nog niet' },
];

interface FormData {
  serviceType: string;
  description: string;
  budgetIndication: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  isTesororClient: boolean;
}

export function QuoteRequestForm() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    serviceType: '',
    description: '',
    budgetIndication: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    isTesororClient: false,
  });

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        alert('Er is iets misgegaan. Probeer het opnieuw.');
      }
    } catch {
      alert('Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Aanvraag ontvangen!</h2>
        <p className="text-muted-foreground mb-6">
          Bedankt voor uw aanvraag. We nemen binnen 24 uur contact met u op.
        </p>
        <Button onClick={() => window.location.reload()}>Nieuwe aanvraag</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Step 1: Service Type */}
      {step >= 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Wat kunnen we voor u doen?</h2>
            <p className="text-sm text-muted-foreground">Selecteer het type dienst</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {serviceTypes.map((service) => (
              <Card
                key={service.id}
                className={cn(
                  'cursor-pointer transition-all hover:border-tesoro-300',
                  formData.serviceType === service.id && 'border-tesoro-500 bg-tesoro-50 ring-2 ring-tesoro-500'
                )}
                onClick={() => {
                  updateField('serviceType', service.id);
                  if (step === 1) setStep(2);
                }}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <span className="text-3xl">{service.icon}</span>
                  <div>
                    <h3 className="font-medium">{service.title}</h3>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Description & Budget */}
      {step >= 2 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="space-y-2">
            <Label htmlFor="description">Omschrijf uw wensen *</Label>
            <Textarea
              id="description"
              placeholder="Vertel ons wat u nodig heeft..."
              rows={5}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Budget indicatie</Label>
            <div className="flex flex-wrap gap-2">
              {budgetOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm transition-colors',
                    formData.budgetIndication === option.id
                      ? 'border-tesoro-500 bg-tesoro-50 text-tesoro-700'
                      : 'hover:border-tesoro-300'
                  )}
                  onClick={() => {
                    updateField('budgetIndication', option.id);
                    if (step === 2) setStep(3);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Contact Info */}
      {step >= 3 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div>
            <h2 className="text-lg font-semibold">Uw gegevens</h2>
            <p className="text-sm text-muted-foreground">Zodat we contact met u kunnen opnemen</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Bedrijfsnaam *</Label>
              <Input
                id="companyName"
                placeholder="Uw bedrijfsnaam"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contactpersoon *</Label>
              <Input
                id="contactName"
                placeholder="Uw naam"
                value={formData.contactName}
                onChange={(e) => updateField('contactName', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@bedrijf.nl"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefoon</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="06 12345678"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-tesoro-500 focus:ring-tesoro-500"
              checked={formData.isTesororClient}
              onChange={(e) => updateField('isTesororClient', e.target.checked)}
            />
            <span className="text-sm">Ik ben al klant bij Tesoro CRM</span>
          </label>

          <Button
            type="submit"
            variant="tesoro"
            size="lg"
            className="w-full"
            disabled={isSubmitting || !formData.description || !formData.companyName || !formData.contactName || !formData.email}
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Bezig met versturen...
              </>
            ) : (
              'Verstuur Aanvraag'
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
