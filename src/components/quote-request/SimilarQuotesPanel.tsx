import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SimilarQuote {
  id: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
  customer: {
    name: string;
    company: string | null;
  } | null;
  lineCount: number;
  score: number | null;
}

interface SimilarQuotesPanelProps {
  requestId: string;
}

const statusLabels: Record<string, string> = {
  draft: 'Concept',
  sent: 'Verzonden',
  accepted: 'Geaccepteerd',
  rejected: 'Afgewezen',
  expired: 'Verlopen',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-yellow-100 text-yellow-800',
};

export function SimilarQuotesPanel({ requestId }: SimilarQuotesPanelProps) {
  const [quotes, setQuotes] = useState<SimilarQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');

  useEffect(() => {
    async function fetchSimilarQuotes() {
      try {
        const response = await fetch(`/api/quote-requests/${requestId}/similar-quotes`);
        if (!response.ok) {
          throw new Error('Failed to fetch similar quotes');
        }
        const data = await response.json();
        setQuotes(data.results || []);
        setSource(data.source || 'unknown');
      } catch (err) {
        setError('Kon vergelijkbare offertes niet laden');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchSimilarQuotes();
  }, [requestId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vergelijkbare Offertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <svg className="h-6 w-6 animate-spin text-tesoro-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="ml-2 text-muted-foreground">Zoeken naar vergelijkbare offertes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vergelijkbare Offertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (quotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vergelijkbare Offertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Geen vergelijkbare offertes gevonden.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vergelijkbare Offertes
          </span>
          {source === 'vectorize' && (
            <Badge variant="outline" className="text-xs">
              <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Matching
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {quotes.map((quote) => (
            <a
              key={quote.id}
              href={`/offertes/${quote.id}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{quote.title}</h4>
                    <Badge className={statusColors[quote.status] || 'bg-gray-100'}>
                      {statusLabels[quote.status] || quote.status}
                    </Badge>
                  </div>
                  {quote.customer && (
                    <p className="text-sm text-muted-foreground truncate">
                      {quote.customer.company || quote.customer.name}
                    </p>
                  )}
                  {quote.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {quote.description}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-tesoro-700">
                    €{quote.totalAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </p>
                  {quote.score !== null && quote.score > 0 && (
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <div className="h-1.5 w-12 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-tesoro-500 rounded-full"
                          style={{ width: `${Math.round(quote.score * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(quote.score * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>{quote.lineCount} regels</span>
                <span>
                  {new Date(quote.createdAt).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </a>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full" asChild>
            <a href="/offertes">Alle offertes bekijken</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
