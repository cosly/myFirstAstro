import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Turnstile script loader
declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

// Supported languages
type SupportedLocale = 'nl' | 'en' | 'es';

const SUPPORTED_LOCALES: { id: SupportedLocale; name: string; flag: string; nativeName: string }[] = [
  { id: 'nl', name: 'Nederlands', flag: '🇳🇱', nativeName: 'Dutch' },
  { id: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
  { id: 'es', name: 'Español', flag: '🇪🇸', nativeName: 'Spanish' },
];

// Translations for the form
const formTranslations: Record<SupportedLocale, {
  whatCanWeDo: string;
  selectServiceType: string;
  describeYourNeeds: string;
  tellUsWhatYouNeed: string;
  budgetIndication: string;
  yourDetails: string;
  soWeCanContact: string;
  companyName: string;
  yourCompanyName: string;
  contactPerson: string;
  yourName: string;
  email: string;
  phone: string;
  iAmExistingClient: string;
  submitRequest: string;
  submitting: string;
  requestReceived: string;
  thankYou: string;
  newRequest: string;
  privacyConsent: string;
  privacyPolicy: string;
  preferredLanguage: string;
  languageDetected: string;
  forQuoteAndEmails: string;
  services: {
    website: { title: string; description: string };
    crm_setup: { title: string; description: string };
    marketing: { title: string; description: string };
    support: { title: string; description: string };
  };
  budgetOptions: {
    under_500: string;
    '500_1000': string;
    '1000_2500': string;
    above_2500: string;
    unknown: string;
  };
}> = {
  nl: {
    whatCanWeDo: 'Wat kunnen we voor u doen?',
    selectServiceType: 'Selecteer het type dienst',
    describeYourNeeds: 'Omschrijf uw wensen *',
    tellUsWhatYouNeed: 'Vertel ons wat u nodig heeft...',
    budgetIndication: 'Budget indicatie',
    yourDetails: 'Uw gegevens',
    soWeCanContact: 'Zodat we contact met u kunnen opnemen',
    companyName: 'Bedrijfsnaam *',
    yourCompanyName: 'Uw bedrijfsnaam',
    contactPerson: 'Contactpersoon *',
    yourName: 'Uw naam',
    email: 'Email *',
    phone: 'Telefoon',
    iAmExistingClient: 'Ik ben al klant bij Tesoro CRM',
    submitRequest: 'Verstuur Aanvraag',
    submitting: 'Bezig met versturen...',
    requestReceived: 'Aanvraag ontvangen!',
    thankYou: 'Bedankt voor uw aanvraag. We nemen binnen 24 uur contact met u op.',
    newRequest: 'Nieuwe aanvraag',
    privacyConsent: 'Door uw aanvraag te versturen gaat u akkoord met onze',
    privacyPolicy: 'privacyvoorwaarden',
    preferredLanguage: 'Voorkeurstaal',
    languageDetected: 'We hebben gedetecteerd dat u mogelijk {language} spreekt',
    forQuoteAndEmails: 'Voor de offerte en communicatie',
    services: {
      website: { title: 'Website', description: 'Aanpassingen, nieuwe pagina\'s, redesign' },
      crm_setup: { title: 'CRM Setup', description: 'Tesoro CRM inrichten & configureren' },
      marketing: { title: 'Marketing', description: 'Window cards, flyers, branding' },
      support: { title: 'Support', description: 'Ondersteuning & onderhoud' },
    },
    budgetOptions: {
      under_500: '< €500',
      '500_1000': '€500 - €1.000',
      '1000_2500': '€1.000 - €2.500',
      above_2500: '€2.500+',
      unknown: 'Weet ik nog niet',
    },
  },
  en: {
    whatCanWeDo: 'What can we do for you?',
    selectServiceType: 'Select the type of service',
    describeYourNeeds: 'Describe your needs *',
    tellUsWhatYouNeed: 'Tell us what you need...',
    budgetIndication: 'Budget indication',
    yourDetails: 'Your details',
    soWeCanContact: 'So we can contact you',
    companyName: 'Company name *',
    yourCompanyName: 'Your company name',
    contactPerson: 'Contact person *',
    yourName: 'Your name',
    email: 'Email *',
    phone: 'Phone',
    iAmExistingClient: 'I am already a Tesoro CRM customer',
    submitRequest: 'Submit Request',
    submitting: 'Submitting...',
    requestReceived: 'Request received!',
    thankYou: 'Thank you for your request. We will contact you within 24 hours.',
    newRequest: 'New request',
    privacyConsent: 'By submitting your request you agree to our',
    privacyPolicy: 'privacy policy',
    preferredLanguage: 'Preferred language',
    languageDetected: 'We detected that you might speak {language}',
    forQuoteAndEmails: 'For the quote and communication',
    services: {
      website: { title: 'Website', description: 'Modifications, new pages, redesign' },
      crm_setup: { title: 'CRM Setup', description: 'Set up & configure Tesoro CRM' },
      marketing: { title: 'Marketing', description: 'Window cards, flyers, branding' },
      support: { title: 'Support', description: 'Support & maintenance' },
    },
    budgetOptions: {
      under_500: '< €500',
      '500_1000': '€500 - €1,000',
      '1000_2500': '€1,000 - €2,500',
      above_2500: '€2,500+',
      unknown: 'I don\'t know yet',
    },
  },
  es: {
    whatCanWeDo: '¿Qué podemos hacer por usted?',
    selectServiceType: 'Seleccione el tipo de servicio',
    describeYourNeeds: 'Describa sus necesidades *',
    tellUsWhatYouNeed: 'Cuéntenos qué necesita...',
    budgetIndication: 'Indicación de presupuesto',
    yourDetails: 'Sus datos',
    soWeCanContact: 'Para que podamos contactarle',
    companyName: 'Nombre de empresa *',
    yourCompanyName: 'Su nombre de empresa',
    contactPerson: 'Persona de contacto *',
    yourName: 'Su nombre',
    email: 'Email *',
    phone: 'Teléfono',
    iAmExistingClient: 'Ya soy cliente de Tesoro CRM',
    submitRequest: 'Enviar solicitud',
    submitting: 'Enviando...',
    requestReceived: '¡Solicitud recibida!',
    thankYou: 'Gracias por su solicitud. Nos pondremos en contacto en 24 horas.',
    newRequest: 'Nueva solicitud',
    privacyConsent: 'Al enviar su solicitud, acepta nuestra',
    privacyPolicy: 'política de privacidad',
    preferredLanguage: 'Idioma preferido',
    languageDetected: 'Hemos detectado que posiblemente habla {language}',
    forQuoteAndEmails: 'Para el presupuesto y la comunicación',
    services: {
      website: { title: 'Sitio web', description: 'Modificaciones, nuevas páginas, rediseño' },
      crm_setup: { title: 'Configuración CRM', description: 'Configurar Tesoro CRM' },
      marketing: { title: 'Marketing', description: 'Tarjetas, folletos, branding' },
      support: { title: 'Soporte', description: 'Soporte y mantenimiento' },
    },
    budgetOptions: {
      under_500: '< €500',
      '500_1000': '€500 - €1.000',
      '1000_2500': '€1.000 - €2.500',
      above_2500: '€2.500+',
      unknown: 'Aún no lo sé',
    },
  },
};

const serviceTypeIcons: Record<string, string> = {
  website: '🌐',
  crm_setup: '⚙️',
  marketing: '🎨',
  support: '🔧',
};

interface FormData {
  serviceType: string;
  description: string;
  budgetIndication: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  isTesororClient: boolean;
  preferredLocale: SupportedLocale;
  // Honeypot fields (should remain empty)
  website: string;
  fax_number: string;
}

interface QuoteRequestFormProps {
  turnstileSiteKey?: string;
}

/**
 * Detect browser language and match to supported locales
 */
function detectBrowserLocale(): { locale: SupportedLocale; wasDetected: boolean } {
  if (typeof navigator === 'undefined') {
    return { locale: 'nl', wasDetected: false };
  }

  const browserLang = navigator.language || (navigator as any).userLanguage || '';
  const langCode = browserLang.split('-')[0].toLowerCase();

  // Check if browser language matches a supported locale
  const matched = SUPPORTED_LOCALES.find(l => l.id === langCode);
  if (matched) {
    return { locale: matched.id, wasDetected: true };
  }

  // Default to Dutch
  return { locale: 'nl', wasDetected: false };
}

export function QuoteRequestForm({ turnstileSiteKey }: QuoteRequestFormProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState(false);
  const [formStartTime] = useState(Date.now());
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  // Language detection
  const [detectedLocale, setDetectedLocale] = useState<{ locale: SupportedLocale; wasDetected: boolean }>({ locale: 'nl', wasDetected: false });
  const [showLanguageHint, setShowLanguageHint] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    serviceType: '',
    description: '',
    budgetIndication: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    isTesororClient: false,
    preferredLocale: 'nl',
    // Honeypot fields
    website: '',
    fax_number: '',
  });

  // Get current translations based on selected locale
  const t = formTranslations[formData.preferredLocale];

  // Detect browser language on mount
  useEffect(() => {
    const detected = detectBrowserLocale();
    setDetectedLocale(detected);

    // If we detected a non-Dutch language, show hint and set it as default
    if (detected.wasDetected && detected.locale !== 'nl') {
      setShowLanguageHint(true);
      setFormData(prev => ({ ...prev, preferredLocale: detected.locale }));
    }
  }, []);

  // Load Turnstile script
  useEffect(() => {
    if (!turnstileSiteKey) return;

    // Check if script already loaded
    if (window.turnstile) {
      renderTurnstile();
      return;
    }

    // Define callback before loading script
    window.onTurnstileLoad = () => {
      renderTurnstile();
    };

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
      }
    };
  }, [turnstileSiteKey]);

  const renderTurnstile = () => {
    if (!window.turnstile || !turnstileContainerRef.current || !turnstileSiteKey) return;

    // Remove existing widget if any
    if (turnstileWidgetId.current) {
      window.turnstile.remove(turnstileWidgetId.current);
    }

    turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        setTurnstileToken(token);
        setTurnstileError(false);
      },
      'error-callback': () => {
        setTurnstileError(true);
        setTurnstileToken(null);
      },
      'expired-callback': () => {
        setTurnstileToken(null);
      },
      theme: 'light',
      size: 'normal',
    });
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Check if Turnstile is required and token is missing
    if (turnstileSiteKey && !turnstileToken) {
      setError('Verificatie vereist. Wacht tot de verificatie is voltooid.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          turnstileToken,
          _formStartTime: formStartTime,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        setError(data.error || 'Er is iets misgegaan. Probeer het opnieuw.');
        // Reset Turnstile on error
        if (turnstileWidgetId.current && window.turnstile) {
          window.turnstile.reset(turnstileWidgetId.current);
          setTurnstileToken(null);
        }
      }
    } catch {
      setError('Er is iets misgegaan. Controleer uw internetverbinding en probeer het opnieuw.');
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
        <h2 className="text-2xl font-bold mb-2">{t.requestReceived}</h2>
        <p className="text-muted-foreground mb-6">
          {t.thankYou}
        </p>
        <Button onClick={() => window.location.reload()}>{t.newRequest}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Honeypot fields - hidden from real users, bots will fill these */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website (leave empty)</label>
        <input
          type="text"
          id="website"
          name="website"
          value={formData.website}
          onChange={(e) => updateField('website', e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
        <label htmlFor="fax_number">Fax (leave empty)</label>
        <input
          type="text"
          id="fax_number"
          name="fax_number"
          value={formData.fax_number}
          onChange={(e) => updateField('fax_number', e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Language Selection Banner */}
      {showLanguageHint && detectedLocale.wasDetected && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{SUPPORTED_LOCALES.find(l => l.id === detectedLocale.locale)?.flag}</span>
            <div className="flex-1">
              <p className="text-sm text-blue-800">
                {t.languageDetected.replace('{language}', SUPPORTED_LOCALES.find(l => l.id === detectedLocale.locale)?.name || '')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUPPORTED_LOCALES.map((locale) => (
                  <button
                    key={locale.id}
                    type="button"
                    onClick={() => {
                      updateField('preferredLocale', locale.id);
                      setShowLanguageHint(false);
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors',
                      formData.preferredLocale === locale.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'
                    )}
                  >
                    <span>{locale.flag}</span>
                    {locale.name}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLanguageHint(false)}
              className="text-blue-400 hover:text-blue-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Service Type */}
      {step >= 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t.whatCanWeDo}</h2>
            <p className="text-sm text-muted-foreground">{t.selectServiceType}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(['website', 'crm_setup', 'marketing', 'support'] as const).map((serviceId) => (
              <Card
                key={serviceId}
                className={cn(
                  'cursor-pointer transition-all hover:border-tesoro-300',
                  formData.serviceType === serviceId && 'border-tesoro-500 bg-tesoro-50 ring-2 ring-tesoro-500'
                )}
                onClick={() => {
                  updateField('serviceType', serviceId);
                  if (step === 1) setStep(2);
                }}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <span className="text-3xl">{serviceTypeIcons[serviceId]}</span>
                  <div>
                    <h3 className="font-medium">{t.services[serviceId].title}</h3>
                    <p className="text-sm text-muted-foreground">{t.services[serviceId].description}</p>
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
            <Label htmlFor="description">{t.describeYourNeeds}</Label>
            <Textarea
              id="description"
              placeholder={t.tellUsWhatYouNeed}
              rows={5}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t.budgetIndication}</Label>
            <div className="flex flex-wrap gap-2">
              {(['under_500', '500_1000', '1000_2500', 'above_2500', 'unknown'] as const).map((optionId) => (
                <button
                  key={optionId}
                  type="button"
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm transition-colors',
                    formData.budgetIndication === optionId
                      ? 'border-tesoro-500 bg-tesoro-50 text-tesoro-700'
                      : 'hover:border-tesoro-300'
                  )}
                  onClick={() => {
                    updateField('budgetIndication', optionId);
                    if (step === 2) setStep(3);
                  }}
                >
                  {t.budgetOptions[optionId]}
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
            <h2 className="text-lg font-semibold">{t.yourDetails}</h2>
            <p className="text-sm text-muted-foreground">{t.soWeCanContact}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">{t.companyName}</Label>
              <Input
                id="companyName"
                placeholder={t.yourCompanyName}
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">{t.contactPerson}</Label>
              <Input
                id="contactName"
                placeholder={t.yourName}
                value={formData.contactName}
                onChange={(e) => updateField('contactName', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@company.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t.phone}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+31 6 12345678"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
            </div>
          </div>

          {/* Language preference */}
          <div className="space-y-2">
            <Label htmlFor="preferredLocale">{t.preferredLanguage}</Label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LOCALES.map((locale) => (
                <button
                  key={locale.id}
                  type="button"
                  onClick={() => updateField('preferredLocale', locale.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors',
                    formData.preferredLocale === locale.id
                      ? 'border-tesoro-500 bg-tesoro-50 text-tesoro-700'
                      : 'hover:border-tesoro-300'
                  )}
                >
                  <span>{locale.flag}</span>
                  {locale.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t.forQuoteAndEmails}</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-tesoro-500 focus:ring-tesoro-500"
              checked={formData.isTesororClient}
              onChange={(e) => updateField('isTesororClient', e.target.checked)}
            />
            <span className="text-sm">{t.iAmExistingClient}</span>
          </label>

          {/* Turnstile widget */}
          {turnstileSiteKey && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div ref={turnstileContainerRef} />
              {turnstileError && (
                <p className="text-sm text-red-600">
                  Verificatie mislukt. Vernieuw de pagina om opnieuw te proberen.
                </p>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="tesoro"
            size="lg"
            className="w-full"
            disabled={
              isSubmitting ||
              !formData.description ||
              !formData.companyName ||
              !formData.contactName ||
              !formData.email ||
              (turnstileSiteKey && !turnstileToken)
            }
          >
            {isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t.submitting}
              </>
            ) : (
              t.submitRequest
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {t.privacyConsent}{' '}
            <a href="/privacy" className="underline hover:text-tesoro-500">{t.privacyPolicy}</a>.
          </p>
        </div>
      )}
    </form>
  );
}
