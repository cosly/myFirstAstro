import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Viewer {
  sessionId: string;
  userType: 'customer' | 'team';
  userName?: string;
  deviceType: string;
  browserName: string;
  joinedAt: string;
}

interface Activity {
  id: string;
  quoteId: string;
  quoteNumber?: string;
  customerName?: string;
  sessionId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  deviceType?: string;
  browserName?: string;
  createdAt: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  customerName?: string;
}

interface LiveActivitiesProps {
  quotes?: Quote[];
  selectedQuoteId?: string;
  onQuoteSelect?: (quoteId: string | null) => void;
}

const eventTypeLabels: Record<string, string> = {
  page_open: 'Pagina geopend',
  page_close: 'Pagina gesloten',
  section_view: 'Sectie bekeken',
  scroll: 'Gescrolld',
  option_toggle: 'Optie gewijzigd',
  idle_start: 'Inactief',
  idle_end: 'Weer actief',
  tab_blur: 'Tab verlaten',
  tab_focus: 'Tab terug',
  signature_start: 'Ondertekening gestart',
  copy_text: 'Tekst gekopieerd',
  viewer_joined: 'Kijker gekomen',
  viewer_left: 'Kijker vertrokken',
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
  viewer_joined: 'bg-green-100 text-green-800',
  viewer_left: 'bg-red-100 text-red-800',
};

const deviceIcons: Record<string, string> = {
  desktop: '🖥️',
  tablet: '📱',
  mobile: '📱',
};

export function LiveActivities({ quotes = [], selectedQuoteId, onQuoteSelect }: LiveActivitiesProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeViewers, setActiveViewers] = useState<Map<string, Viewer[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connectToQuote = useCallback((quoteId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = new URL(`${protocol}//${window.location.host}/api/ws/quote/${quoteId}`);
    wsUrl.searchParams.set('userType', 'team');
    wsUrl.searchParams.set('userName', 'Dashboard');

    try {
      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        console.log('[LiveActivities] Connected to quote:', quoteId);
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('[LiveActivities] Disconnected');

        // Attempt reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectToQuote(quoteId);
          }, delay);
        }
      };

      ws.onerror = () => {
        setConnectionError('Verbindingsfout');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(quoteId, data);
        } catch {
          // Ignore parse errors
        }
      };
    } catch (error) {
      console.error('[LiveActivities] Failed to connect:', error);
      setConnectionError('Kan niet verbinden');
    }
  }, []);

  const handleWebSocketMessage = useCallback((quoteId: string, data: Record<string, unknown>) => {
    const quote = quotes.find(q => q.id === quoteId);

    if (data.type === 'viewer_joined') {
      setActiveViewers(prev => {
        const newMap = new Map(prev);
        const viewers = newMap.get(quoteId) || [];
        const newViewer: Viewer = {
          sessionId: data.sessionId as string,
          userType: data.userType as 'customer' | 'team',
          userName: data.userName as string | undefined,
          deviceType: data.deviceType as string,
          browserName: data.browserName as string,
          joinedAt: new Date().toISOString(),
        };
        newMap.set(quoteId, [...viewers, newViewer]);
        return newMap;
      });

      // Add to activity feed
      addActivity({
        quoteId,
        quoteNumber: quote?.quoteNumber,
        customerName: quote?.customerName,
        sessionId: data.sessionId as string,
        eventType: 'viewer_joined',
        eventData: data,
      });
    }

    if (data.type === 'viewer_left') {
      setActiveViewers(prev => {
        const newMap = new Map(prev);
        const viewers = newMap.get(quoteId) || [];
        newMap.set(quoteId, viewers.filter(v => v.sessionId !== data.sessionId));
        return newMap;
      });

      // Add to activity feed
      addActivity({
        quoteId,
        quoteNumber: quote?.quoteNumber,
        customerName: quote?.customerName,
        sessionId: data.sessionId as string,
        eventType: 'viewer_left',
        eventData: data,
      });
    }

    if (data.type === 'viewers_list') {
      const viewers = (data.viewers as Viewer[]) || [];
      setActiveViewers(prev => {
        const newMap = new Map(prev);
        newMap.set(quoteId, viewers);
        return newMap;
      });
    }

    // Handle activity events
    if (['scroll', 'section_view', 'option_toggle', 'signature_start', 'idle_start', 'idle_end', 'tab_blur', 'tab_focus', 'copy_text'].includes(data.type as string)) {
      addActivity({
        quoteId,
        quoteNumber: quote?.quoteNumber,
        customerName: quote?.customerName,
        sessionId: data.sessionId as string || 'unknown',
        eventType: data.type as string,
        eventData: data,
      });
    }
  }, [quotes]);

  const addActivity = useCallback((activity: Omit<Activity, 'id' | 'createdAt'>) => {
    const newActivity: Activity = {
      ...activity,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    setActivities(prev => {
      const updated = [newActivity, ...prev];
      // Keep only last 100 activities
      return updated.slice(0, 100);
    });
  }, []);

  // Connect when quote is selected
  useEffect(() => {
    if (selectedQuoteId) {
      connectToQuote(selectedQuoteId);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [selectedQuoteId, connectToQuote]);

  // Fetch initial activities
  useEffect(() => {
    if (selectedQuoteId) {
      fetchActivities(selectedQuoteId);
    }
  }, [selectedQuoteId]);

  const fetchActivities = async (quoteId: string) => {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/activities?limit=50`);
      if (response.ok) {
        const data = await response.json();
        const quote = quotes.find(q => q.id === quoteId);

        const formattedActivities: Activity[] = data.activities.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          quoteId: a.quoteId as string,
          quoteNumber: quote?.quoteNumber,
          customerName: quote?.customerName,
          sessionId: a.sessionId as string,
          eventType: a.eventType as string,
          eventData: a.eventData ? JSON.parse(a.eventData as string) : undefined,
          deviceType: a.deviceType as string,
          browserName: a.browserName as string,
          createdAt: a.createdAt as string,
        }));

        setActivities(formattedActivities);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Zojuist';
    if (diffMin < 60) return `${diffMin} min geleden`;
    if (diffHour < 24) return `${diffHour} uur geleden`;
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  const getTotalActiveViewers = () => {
    let total = 0;
    activeViewers.forEach(viewers => {
      total += viewers.filter(v => v.userType === 'customer').length;
    });
    return total;
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Live Activiteit</h2>
        <div className="flex items-center gap-2">
          {selectedQuoteId ? (
            <>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Verbonden' : connectionError || 'Niet verbonden'}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Selecteer een offerte</span>
          )}
        </div>
      </div>

      {/* Quote Selector */}
      {quotes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onQuoteSelect?.(null)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              !selectedQuoteId
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Alle
          </button>
          {quotes.slice(0, 10).map(quote => (
            <button
              key={quote.id}
              onClick={() => onQuoteSelect?.(quote.id)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedQuoteId === quote.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {quote.quoteNumber}
              {activeViewers.get(quote.id)?.some(v => v.userType === 'customer') && (
                <span className="ml-1 w-2 h-2 inline-block bg-green-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Active Viewers Summary */}
      {getTotalActiveViewers() > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {getTotalActiveViewers()} actieve kijker{getTotalActiveViewers() !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(activeViewers.entries()).map(([quoteId, viewers]) => {
                const customerViewers = viewers.filter(v => v.userType === 'customer');
                if (customerViewers.length === 0) return null;

                const quote = quotes.find(q => q.id === quoteId);
                return (
                  <div key={quoteId} className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {quote?.quoteNumber || quoteId.slice(0, 8)}
                      {quote?.customerName && (
                        <span className="text-muted-foreground ml-2">({quote.customerName})</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {customerViewers.map(viewer => (
                        <span key={viewer.sessionId} className="text-muted-foreground">
                          {deviceIcons[viewer.deviceType] || '🖥️'} {viewer.browserName}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Activiteiten Feed</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {selectedQuoteId ? 'Nog geen activiteiten' : 'Selecteer een offerte om activiteiten te zien'}
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {activities.map(activity => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${eventTypeColors[activity.eventType] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {eventTypeLabels[activity.eventType] || activity.eventType}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">
                        {activity.quoteNumber || activity.quoteId.slice(0, 8)}
                      </span>
                      {activity.customerName && (
                        <span className="text-muted-foreground truncate">
                          {activity.customerName}
                        </span>
                      )}
                    </div>
                    {activity.eventData && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {activity.eventType === 'scroll' && activity.eventData.scrollDepth && (
                          <span>{activity.eventData.scrollDepth as number}% gescrolld</span>
                        )}
                        {activity.eventType === 'section_view' && activity.eventData.sectionTitle && (
                          <span>Sectie: {activity.eventData.sectionTitle as string}</span>
                        )}
                        {activity.eventType === 'option_toggle' && activity.eventData.optionName && (
                          <span>
                            {activity.eventData.optionName as string}:{' '}
                            {activity.eventData.selected ? 'geselecteerd' : 'gedeselecteerd'}
                          </span>
                        )}
                        {(activity.eventType === 'viewer_joined' || activity.eventType === 'viewer_left') && (
                          <span>
                            {deviceIcons[(activity.eventData.deviceType as string) || 'desktop'] || '🖥️'}{' '}
                            {activity.eventData.browserName as string || 'Browser'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LiveActivities;
