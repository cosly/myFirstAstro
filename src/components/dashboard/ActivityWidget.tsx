import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

interface Activity {
  id: string;
  quoteId: string;
  sessionId: string;
  eventType: string;
  eventData: string | null;
  deviceType: string | null;
  browserName: string | null;
  createdAt: string;
}

interface Session {
  id: string;
  quoteId: string;
  sessionId: string;
  isActive: boolean;
  deviceType: string | null;
  browserName: string | null;
  startedAt: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  customerName?: string;
}

interface ActivityWidgetProps {
  quotes: Quote[];
}

const eventTypeLabels: Record<string, string> = {
  page_open: 'Pagina geopend',
  page_close: 'Verlaten',
  section_view: 'Sectie bekeken',
  scroll: 'Gescrolld',
  option_toggle: 'Optie gewijzigd',
  idle_start: 'Inactief',
  idle_end: 'Actief',
  tab_blur: 'Tab verlaten',
  tab_focus: 'Tab terug',
  signature_start: 'Ondertekening',
  copy_text: 'Tekst gekopieerd',
};

const eventTypeColors: Record<string, string> = {
  page_open: 'bg-green-100 text-green-800',
  page_close: 'bg-gray-100 text-gray-800',
  section_view: 'bg-blue-100 text-blue-800',
  scroll: 'bg-slate-100 text-slate-800',
  option_toggle: 'bg-purple-100 text-purple-800',
  idle_start: 'bg-yellow-100 text-yellow-800',
  idle_end: 'bg-green-100 text-green-800',
  tab_blur: 'bg-orange-100 text-orange-800',
  tab_focus: 'bg-green-100 text-green-800',
  signature_start: 'bg-emerald-100 text-emerald-800',
  copy_text: 'bg-indigo-100 text-indigo-800',
};

export function ActivityWidget({ quotes }: ActivityWidgetProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number>(Date.now());

  // Fetch activities for all recent quotes
  useEffect(() => {
    const fetchAllActivities = async () => {
      setIsLoading(true);
      const allActivities: Activity[] = [];
      const allSessions: Session[] = [];

      // Fetch activities for each quote (limit to first 10 quotes)
      const quotesToFetch = quotes.slice(0, 10);

      await Promise.all(
        quotesToFetch.map(async (quote) => {
          try {
            const response = await fetch(`/api/quotes/${quote.id}/activities?limit=10`);
            if (response.ok) {
              const data = await response.json();
              allActivities.push(...data.activities);
              allSessions.push(...data.activeSessions);
            }
          } catch (error) {
            console.error(`Failed to fetch activities for ${quote.id}:`, error);
          }
        })
      );

      // Sort by creation date and take most recent 15
      allActivities.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setActivities(allActivities.slice(0, 15));
      setActiveSessions(allSessions.filter(s => s.isActive));
      setIsLoading(false);
      setLastFetch(Date.now());
    };

    if (quotes.length > 0) {
      fetchAllActivities();
    } else {
      setIsLoading(false);
    }
  }, [quotes]);

  // Poll for new activities every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (quotes.length > 0) {
        // Simplified refetch - just update the lastFetch to trigger useEffect
        setLastFetch(Date.now());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [quotes]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Zojuist';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}u`;
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  const getQuoteInfo = (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    return quote
      ? { number: quote.quoteNumber, customer: quote.customerName }
      : { number: quoteId.slice(0, 8), customer: null };
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Live Activiteit</h2>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <svg className="w-5 h-5 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Laden...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Live Activiteit</h2>
          {activeSessions.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {activeSessions.length} actief
            </span>
          )}
        </div>
        <a href="/activiteiten" className="text-sm text-tesoro-500 hover:underline">
          Bekijk alle
        </a>
      </div>

      {/* Active Sessions Banner */}
      {activeSessions.length > 0 && (
        <div className="px-6 py-3 bg-green-50 border-b border-green-100">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-medium">{activeSessions.length} klant{activeSessions.length !== 1 ? 'en' : ''} bekijkt nu een offerte</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {activeSessions.map(session => {
              const quote = getQuoteInfo(session.quoteId);
              return (
                <a
                  key={session.sessionId}
                  href={`/offertes/${session.quoteId}`}
                  className="text-xs bg-white px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors"
                >
                  #{quote.number} {quote.customer && `- ${quote.customer}`}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity List */}
      {activities.length > 0 ? (
        <div className="divide-y max-h-[320px] overflow-y-auto">
          {activities.map(activity => {
            const quote = getQuoteInfo(activity.quoteId);
            const eventData = activity.eventData ? JSON.parse(activity.eventData) : null;

            return (
              <div key={activity.id} className="px-6 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${eventTypeColors[activity.eventType] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {eventTypeLabels[activity.eventType] || activity.eventType}
                    </Badge>
                    <a
                      href={`/offertes/${activity.quoteId}`}
                      className="text-sm font-medium hover:text-tesoro-600"
                    >
                      #{quote.number}
                    </a>
                    {quote.customer && (
                      <span className="text-sm text-muted-foreground">{quote.customer}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(activity.createdAt)}</span>
                </div>

                {/* Extra event details */}
                {eventData && (
                  <div className="mt-1 text-xs text-muted-foreground pl-16">
                    {activity.eventType === 'scroll' && eventData.scrollDepth && (
                      <span>{eventData.scrollDepth}% gescrolld</span>
                    )}
                    {activity.eventType === 'section_view' && eventData.sectionTitle && (
                      <span>Sectie: {eventData.sectionTitle}</span>
                    )}
                    {activity.eventType === 'option_toggle' && eventData.optionName && (
                      <span>{eventData.optionName}: {eventData.selected ? 'geselecteerd' : 'gedeselecteerd'}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p className="text-sm">Nog geen activiteit</p>
          <p className="text-xs mt-1">Activiteit wordt getoond wanneer klanten offertes bekijken</p>
        </div>
      )}
    </div>
  );
}

export default ActivityWidget;
