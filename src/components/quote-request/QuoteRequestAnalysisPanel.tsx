import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuoteRequestAnalysis {
  suggestedServiceTypes: string[];
  confidence: number;
  estimatedBudgetRange: {
    min: number;
    max: number;
    currency: string;
  };
  budgetJustification: string;
  improvedDescription: string;
  keyRequirements: string[];
  potentialChallenges: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  complexity: 'simple' | 'moderate' | 'complex';
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedQuestions: string[];
  suggestedApproach: string;
  processedAt: string;
  aiProvider: string;
}

interface QuoteRequestAnalysisPanelProps {
  requestId: string;
  initialAnalysis?: QuoteRequestAnalysis | null;
}

const urgencyColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

const urgencyLabels = {
  low: 'Laag',
  medium: 'Gemiddeld',
  high: 'Hoog',
};

const complexityColors = {
  simple: 'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  complex: 'bg-red-100 text-red-800',
};

const complexityLabels = {
  simple: 'Eenvoudig',
  moderate: 'Gemiddeld',
  complex: 'Complex',
};

const sentimentIcons = {
  positive: '😊',
  neutral: '😐',
  negative: '😟',
};

const serviceLabels: Record<string, string> = {
  website: 'Website',
  crm_setup: 'CRM Setup',
  marketing: 'Marketing',
  support: 'Support',
};

export function QuoteRequestAnalysisPanel({
  requestId,
  initialAnalysis,
}: QuoteRequestAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<QuoteRequestAnalysis | null>(initialAnalysis || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('budget');

  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quote-requests/${requestId}/analysis`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analyse mislukt');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er is een fout opgetreden');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!analysis) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-xl">🤖</span>
            AI Analyse
          </h2>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="text-center py-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tesoro-100 mb-4">
            <svg className="h-6 w-6 text-tesoro-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="font-medium mb-1">Geen AI analyse beschikbaar</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Laat AI deze aanvraag analyseren voor budget suggesties en inzichten.
          </p>
          <Button
            variant="tesoro"
            onClick={runAnalysis}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="h-4 w-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyseren...
              </>
            ) : (
              <>
                <span className="mr-2">🤖</span>
                Start AI Analyse
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-xl">🤖</span>
          AI Analyse
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDate(analysis.processedAt)}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={runAnalysis}
            disabled={isLoading}
            className="h-7 px-2"
          >
            {isLoading ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <div className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium mb-1', urgencyColors[analysis.urgencyLevel])}>
            {urgencyLabels[analysis.urgencyLevel]}
          </div>
          <p className="text-xs text-muted-foreground">Urgentie</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <div className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium mb-1', complexityColors[analysis.complexity])}>
            {complexityLabels[analysis.complexity]}
          </div>
          <p className="text-xs text-muted-foreground">Complexiteit</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <div className="text-xl mb-1">{sentimentIcons[analysis.sentiment]}</div>
          <p className="text-xs text-muted-foreground">Sentiment</p>
        </div>
      </div>

      {/* Confidence & Services */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Voorgestelde services</span>
          <span className="text-xs text-muted-foreground">{Math.round(analysis.confidence * 100)}% zekerheid</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {analysis.suggestedServiceTypes.map((service) => (
            <span key={service} className="inline-flex items-center rounded-full bg-tesoro-100 px-3 py-1 text-sm font-medium text-tesoro-700">
              {serviceLabels[service] || service}
            </span>
          ))}
        </div>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-3">
        {/* Budget Section */}
        <div className="rounded-lg border">
          <button
            onClick={() => setExpandedSection(expandedSection === 'budget' ? null : 'budget')}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <span>💰</span>
              Budget Schatting
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-tesoro-600">
                {formatCurrency(analysis.estimatedBudgetRange.min)} - {formatCurrency(analysis.estimatedBudgetRange.max)}
              </span>
              <svg className={cn('h-4 w-4 transition-transform', expandedSection === 'budget' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {expandedSection === 'budget' && (
            <div className="border-t p-3 text-sm text-muted-foreground">
              {analysis.budgetJustification}
            </div>
          )}
        </div>

        {/* Improved Description */}
        <div className="rounded-lg border">
          <button
            onClick={() => setExpandedSection(expandedSection === 'description' ? null : 'description')}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <span>✨</span>
              Verbeterde Beschrijving
            </span>
            <svg className={cn('h-4 w-4 transition-transform', expandedSection === 'description' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'description' && (
            <div className="border-t p-3 text-sm">
              {analysis.improvedDescription}
            </div>
          )}
        </div>

        {/* Key Requirements */}
        <div className="rounded-lg border">
          <button
            onClick={() => setExpandedSection(expandedSection === 'requirements' ? null : 'requirements')}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <span>📋</span>
              Belangrijke Requirements
              <span className="text-xs text-muted-foreground">({analysis.keyRequirements.length})</span>
            </span>
            <svg className={cn('h-4 w-4 transition-transform', expandedSection === 'requirements' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'requirements' && (
            <div className="border-t p-3">
              <ul className="space-y-1 text-sm">
                {analysis.keyRequirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Challenges */}
        {analysis.potentialChallenges.length > 0 && (
          <div className="rounded-lg border">
            <button
              onClick={() => setExpandedSection(expandedSection === 'challenges' ? null : 'challenges')}
              className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium flex items-center gap-2">
                <span>⚠️</span>
                Mogelijke Uitdagingen
                <span className="text-xs text-muted-foreground">({analysis.potentialChallenges.length})</span>
              </span>
              <svg className={cn('h-4 w-4 transition-transform', expandedSection === 'challenges' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'challenges' && (
              <div className="border-t p-3">
                <ul className="space-y-1 text-sm">
                  {analysis.potentialChallenges.map((challenge, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {challenge}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Suggested Questions */}
        <div className="rounded-lg border">
          <button
            onClick={() => setExpandedSection(expandedSection === 'questions' ? null : 'questions')}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <span>❓</span>
              Stel deze vragen
              <span className="text-xs text-muted-foreground">({analysis.suggestedQuestions.length})</span>
            </span>
            <svg className={cn('h-4 w-4 transition-transform', expandedSection === 'questions' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'questions' && (
            <div className="border-t p-3">
              <ul className="space-y-2 text-sm">
                {analysis.suggestedQuestions.map((question, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Suggested Approach */}
        <div className="rounded-lg border">
          <button
            onClick={() => setExpandedSection(expandedSection === 'approach' ? null : 'approach')}
            className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium flex items-center gap-2">
              <span>🎯</span>
              Aanbevolen Aanpak
            </span>
            <svg className={cn('h-4 w-4 transition-transform', expandedSection === 'approach' && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'approach' && (
            <div className="border-t p-3 text-sm">
              {analysis.suggestedApproach}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
