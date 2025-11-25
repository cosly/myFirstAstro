import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/signature/SignaturePad';
import type { Quote, QuoteBlock, QuoteLine } from '@/components/quote-builder/types';
import { cn, formatCurrency, formatDate, calculateLineTotal } from '@/lib/utils';

interface Comment {
  id: string;
  lineId: string | null;
  lineDescription: string | null;
  authorType: 'team' | 'customer';
  authorName: string | null;
  authorEmail: string | null;
  message: string;
  createdAt: string;
}

interface CustomerPortalTranslations {
  quoteFor: string;
  preparedBy: string;
  preparedFor: string;
  quoteNumber: string;
  quoteNumberShort: string;
  validUntil: string;
  expired: string;
  total: string;
  subtotal: string;
  vat: string;
  optional: string;
  included: string;
  perUnit: string;
  unknown: string;
  unknownDate: string;
  open: string;
  actions: {
    accept: string;
    decline: string;
    askQuestion: string;
    downloadPdf: string;
  };
  acceptConfirm: string;
  declineConfirm: string;
  acceptSuccess: string;
  declineSuccess: string;
  signature: {
    title: string;
    instruction: string;
    name: string;
    function: string;
    clear: string;
    confirm: string;
  };
  question: {
    title: string;
    titleAboutLine: string;
    placeholder: string;
    send: string;
    success: string;
    aboutLine: string;
    lineQuestion: string;
    generalQuestion: string;
    askAboutLine: string;
  };
  decline: {
    title: string;
    confirm: string;
    reasonPlaceholder: string;
    submitting: string;
    cancel: string;
  };
  chat: {
    title: string;
    loading: string;
    noMessages: string;
    startConversation: string;
    placeholder: string;
    send: string;
    sending: string;
    you: string;
    team: string;
    replyTo: string;
  };
  table: {
    description: string;
    quantity: string;
    price: string;
    lineTotal: string;
  };
  errors: {
    selectionFailed: string;
    acceptFailed: string;
    declineFailed: string;
    questionFailed: string;
    messageFailed: string;
  };
  success: {
    questionSent: string;
  };
}

interface QuoteViewerProps {
  quote: Quote;
  customer: {
    companyName: string;
    contactName: string;
    email: string;
  };
  publicToken: string;
  locale?: string;
  translations?: CustomerPortalTranslations;
}

// Default translations (Dutch)
const defaultTranslations: CustomerPortalTranslations = {
  quoteFor: 'Offerte voor',
  preparedBy: 'Opgesteld door',
  preparedFor: 'Opgesteld voor',
  quoteNumber: 'Offertenummer',
  quoteNumberShort: 'Offerte #',
  validUntil: 'Geldig tot',
  expired: 'Deze offerte is verlopen',
  total: 'Totaal',
  subtotal: 'Subtotaal',
  vat: 'BTW',
  optional: 'Optioneel',
  included: 'Inbegrepen',
  perUnit: 'per',
  unknown: 'Onbekend',
  unknownDate: 'onbekende datum',
  open: 'Open',
  actions: {
    accept: 'Offerte accepteren',
    decline: 'Afwijzen',
    askQuestion: 'Stel een vraag',
    downloadPdf: 'Download PDF',
  },
  acceptConfirm: 'Weet je zeker dat je deze offerte wilt accepteren?',
  declineConfirm: 'Weet je zeker dat je deze offerte wilt afwijzen?',
  acceptSuccess: 'Bedankt! De offerte is geaccepteerd.',
  declineSuccess: 'De offerte is afgewezen.',
  signature: {
    title: 'Handtekening',
    instruction: 'Teken hieronder om de offerte te accepteren',
    name: 'Naam',
    function: 'Functie',
    clear: 'Wissen',
    confirm: 'Bevestig & Accepteer',
  },
  question: {
    title: 'Stel een vraag',
    titleAboutLine: 'Vraag over regel',
    placeholder: 'Typ hier uw vraag...',
    send: 'Verstuur vraag',
    success: 'Uw vraag is verstuurd!',
    aboutLine: 'Over',
    lineQuestion: 'Stel uw vraag over deze regel. Wij nemen zo snel mogelijk contact met u op.',
    generalQuestion: 'Heeft u een vraag over deze offerte? Wij nemen zo snel mogelijk contact met u op.',
    askAboutLine: 'Vraag stellen over deze regel',
  },
  decline: {
    title: 'Offerte afwijzen',
    confirm: 'Weet u zeker dat u deze offerte wilt afwijzen? U kunt optioneel een reden opgeven.',
    reasonPlaceholder: 'Reden voor afwijzing (optioneel)',
    submitting: 'Bezig...',
    cancel: 'Annuleren',
  },
  chat: {
    title: 'Vragen & Opmerkingen',
    loading: 'Laden...',
    noMessages: 'Nog geen berichten',
    startConversation: 'Stel een vraag over de offerte',
    placeholder: 'Stel een vraag...',
    send: 'Verstuur',
    sending: 'Versturen...',
    you: 'U',
    team: 'Tesoro',
    replyTo: 'Re',
  },
  table: {
    description: 'Omschrijving',
    quantity: 'Aantal',
    price: 'Prijs',
    lineTotal: 'Totaal',
  },
  errors: {
    selectionFailed: 'Kon selectie niet opslaan. Probeer het opnieuw.',
    acceptFailed: 'Kon offerte niet accepteren. Probeer het opnieuw.',
    declineFailed: 'Kon offerte niet afwijzen. Probeer het opnieuw.',
    questionFailed: 'Kon vraag niet versturen. Probeer het opnieuw.',
    messageFailed: 'Kon bericht niet versturen. Probeer het opnieuw.',
  },
  success: {
    questionSent: 'Uw vraag is verzonden! We nemen zo snel mogelijk contact met u op.',
  },
};

export function QuoteViewer({
  quote: initialQuote,
  customer,
  publicToken,
  locale = 'nl',
  translations = defaultTranslations,
}: QuoteViewerProps) {
  const t = translations;
  const [quote, setQuote] = useState(initialQuote);
  const [showSignature, setShowSignature] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionMessage, setQuestionMessage] = useState('');
  const [questionLineId, setQuestionLineId] = useState<string | null>(null);
  const [questionLineDescription, setQuestionLineDescription] = useState<string>('');
  const [declineReason, setDeclineReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Chat sidebar state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Load comments on mount and when chat is opened
  const loadComments = useCallback(async () => {
    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/public/quote/${publicToken}/question`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [publicToken]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Send message from chat sidebar
  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/public/quote/${publicToken}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });

      if (response.ok) {
        setNewMessage('');
        // Reload comments to show the new one
        await loadComments();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [publicToken, newMessage, loadComments]);

  // Update selection via API
  const handleUpdateSelection = useCallback(async (blockId: string, lineId: string | null, selected: boolean) => {
    try {
      const response = await fetch(`/api/public/quote/${publicToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, lineId, selected }),
      });

      if (!response.ok) {
        throw new Error('Failed to update selection');
      }

      // Update local state
      setQuote(prev => ({
        ...prev,
        blocks: prev.blocks.map(block => {
          if (block.id === blockId) {
            if (lineId === null) {
              return { ...block, isSelectedByCustomer: selected };
            }
            return {
              ...block,
              lines: block.lines.map(line =>
                line.id === lineId ? { ...line, isSelectedByCustomer: selected } : line
              ),
            };
          }
          return block;
        }),
      }));
    } catch (error) {
      console.error('Failed to update selection:', error);
      setErrorMessage(t.errors.selectionFailed);
      setTimeout(() => setErrorMessage(''), 3000);
    }
  }, [publicToken]);

  // Accept quote via API
  const handleAccept = useCallback(async (signatureData: { signatureDataUrl: string; name: string; function: string }) => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/public/quote/${publicToken}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signatureData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to accept quote');
      }

      // Redirect to success state
      window.location.reload();
    } catch (error) {
      console.error('Failed to accept quote:', error);
      setErrorMessage(error instanceof Error ? error.message : t.errors.acceptFailed);
      setShowSignature(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [publicToken]);

  // Decline quote via API
  const handleDecline = useCallback(async () => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/public/quote/${publicToken}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to decline quote');
      }

      window.location.reload();
    } catch (error) {
      console.error('Failed to decline quote:', error);
      setErrorMessage(error instanceof Error ? error.message : t.errors.declineFailed);
    } finally {
      setIsSubmitting(false);
      setShowDeclineModal(false);
    }
  }, [publicToken, declineReason]);

  // Ask question via API
  const handleAskQuestion = useCallback(async () => {
    if (!questionMessage.trim()) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/public/quote/${publicToken}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: questionMessage,
          lineId: questionLineId, // Include line ID if asking about specific line
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send question');
      }

      setSuccessMessage(t.success.questionSent);
      setQuestionMessage('');
      setQuestionLineId(null);
      setQuestionLineDescription('');
      setShowQuestionModal(false);
      // Reload comments to show the new one
      await loadComments();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Failed to send question:', error);
      setErrorMessage(error instanceof Error ? error.message : t.errors.questionFailed);
    } finally {
      setIsSubmitting(false);
    }
  }, [publicToken, questionMessage, questionLineId, loadComments]);

  // Open question modal for a specific line
  const openLineQuestion = useCallback((lineId: string, lineDescription: string) => {
    setQuestionLineId(lineId);
    setQuestionLineDescription(lineDescription);
    setQuestionMessage('');
    setShowQuestionModal(true);
  }, []);

  // Open general question modal
  const openGeneralQuestion = useCallback(() => {
    setQuestionLineId(null);
    setQuestionLineDescription('');
    setQuestionMessage('');
    setShowQuestionModal(true);
  }, []);

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
          onSign={handleAccept}
          onCancel={() => setShowSignature(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-6 max-w-6xl mx-auto">
      {/* Main content */}
      <div className="flex-1 max-w-4xl">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          {errorMessage}
        </div>
      )}

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
            <p className="text-muted-foreground">{t.quoteNumberShort}{quote.quoteNumber}</p>
          </div>
          <div className="text-right">
            <Badge variant={quote.status === 'sent' || quote.status === 'viewed' ? 'info' : 'secondary'}>
              {quote.status === 'sent' || quote.status === 'viewed' ? t.open : quote.status}
            </Badge>
            {quote.validUntil && (
              <p className="text-sm text-muted-foreground mt-2">
                {t.validUntil}: {formatDate(quote.validUntil)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t.preparedFor}:</p>
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
            onToggleBlock={(selected) => handleUpdateSelection(block.id, null, selected)}
            onToggleLine={(lineId, selected) => handleUpdateSelection(block.id, lineId, selected)}
            onAskLineQuestion={openLineQuestion}
            translations={t}
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
              <span className="text-muted-foreground">{t.subtotal}: {formatCurrency(totals.subtotal)}</span>
              <span className="text-muted-foreground">{t.vat}: {formatCurrency(totals.btwAmount)}</span>
            </div>
            <p className="text-2xl font-bold">
              {t.total}: {formatCurrency(totals.total)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={openGeneralQuestion}
            >
              {t.actions.askQuestion}
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeclineModal(true)}
            >
              {t.actions.decline}
            </Button>
            <Button
              variant="tesoro"
              onClick={() => setShowSignature(true)}
            >
              ✍️ {t.actions.accept}
            </Button>
          </div>
        </div>
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t.decline.title}</h3>
            <p className="text-muted-foreground mb-4">
              {t.decline.confirm}
            </p>
            <Textarea
              placeholder={t.decline.reasonPlaceholder}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeclineModal(false)}>
                {t.decline.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={isSubmitting}
              >
                {isSubmitting ? t.decline.submitting : t.actions.decline}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {questionLineId ? t.question.titleAboutLine : t.question.title}
            </h3>
            {questionLineId && questionLineDescription && (
              <div className="mb-4 p-3 bg-tesoro-50 rounded-lg border border-tesoro-200">
                <p className="text-sm text-muted-foreground">{t.question.aboutLine}:</p>
                <p className="font-medium text-tesoro-900">{questionLineDescription}</p>
              </div>
            )}
            <p className="text-muted-foreground mb-4">
              {questionLineId ? t.question.lineQuestion : t.question.generalQuestion}
            </p>
            <Textarea
              placeholder={t.question.placeholder}
              value={questionMessage}
              onChange={(e) => setQuestionMessage(e.target.value)}
              className="mb-4"
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => {
                setShowQuestionModal(false);
                setQuestionLineId(null);
                setQuestionLineDescription('');
              }}>
                {t.decline.cancel}
              </Button>
              <Button
                variant="tesoro"
                onClick={handleAskQuestion}
                disabled={isSubmitting || !questionMessage.trim()}
              >
                {isSubmitting ? t.chat.sending : t.question.send}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Chat Sidebar */}
      <div className="w-80 shrink-0">
        <div className="sticky top-4 rounded-xl border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-tesoro-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="font-semibold">{t.chat.title}</h3>
            </div>
            {comments.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-tesoro-500 text-xs text-white">
                {comments.length}
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-4">
            {isLoadingComments ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t.chat.loading}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm">{t.chat.noMessages}</p>
                <p className="text-xs mt-1">{t.chat.startConversation}</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    'rounded-lg p-3',
                    comment.authorType === 'customer'
                      ? 'bg-tesoro-50 ml-4'
                      : 'bg-muted mr-4'
                  )}
                >
                  {comment.lineDescription && (
                    <div className="text-xs text-tesoro-600 mb-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      {t.chat.replyTo}: {comment.lineDescription}
                    </div>
                  )}
                  <p className="text-sm">{comment.message}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{comment.authorType === 'team' ? t.chat.team : t.chat.you}</span>
                    <span>
                      {new Date(comment.createdAt).toLocaleDateString(locale === 'nl' ? 'nl-NL' : locale === 'es' ? 'es-ES' : 'en-US', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                placeholder={t.chat.placeholder}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <Button
              variant="tesoro"
              size="sm"
              className="w-full mt-2"
              onClick={handleSendMessage}
              disabled={isSubmitting || !newMessage.trim()}
            >
              {isSubmitting ? t.chat.sending : t.chat.send}
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
  onAskLineQuestion,
  translations,
}: {
  block: QuoteBlock;
  onToggleBlock: (selected: boolean) => void;
  onToggleLine: (lineId: string, selected: boolean) => void;
  onAskLineQuestion: (lineId: string, lineDescription: string) => void;
  translations: CustomerPortalTranslations;
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
              <span className="text-xs text-tesoro-600">{translations.optional}</span>
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
              <div className="col-span-4">{translations.table.description}</div>
              <div className="col-span-1"></div>
              <div className="col-span-2 text-right">{translations.table.quantity}</div>
              <div className="col-span-2 text-right">{translations.table.price}</div>
              <div className="col-span-2 text-right">{translations.table.lineTotal}</div>
            </div>

            {/* Lines */}
            {block.lines.map((line) => (
              <QuoteLineView
                key={line.id}
                line={line}
                blockEnabled={isEnabled}
                onToggle={(selected) => onToggleLine(line.id, selected)}
                onAskQuestion={() => onAskLineQuestion(line.id, line.description)}
                translations={translations}
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
  onAskQuestion,
  translations,
}: {
  line: QuoteLine;
  blockEnabled: boolean;
  onToggle: (selected: boolean) => void;
  onAskQuestion: () => void;
  translations: CustomerPortalTranslations;
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
        'grid grid-cols-12 gap-2 items-center py-2 px-2 rounded-lg group hover:bg-muted/50',
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
      <div className="col-span-4">
        <p className={cn(!isEnabled && 'line-through')}>{line.description}</p>
        {line.isOptional && (
          <span className="text-xs text-tesoro-600">{translations.optional}</span>
        )}
      </div>

      {/* Question button */}
      <div className="col-span-1 flex justify-center">
        <button
          onClick={onAskQuestion}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-tesoro-100 text-tesoro-600"
          title={translations.question.askAboutLine}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
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
