/**
 * QuoteTracker - Client-side activity tracking for quote pages
 *
 * Tracks customer behavior and sends events via WebSocket for real-time
 * dashboard updates and via HTTP for persistent storage.
 */

interface TrackerConfig {
  quoteId: string;
  sessionId?: string;
  userType?: 'customer' | 'team';
  userName?: string;
  userId?: string;
  enableWebSocket?: boolean;
  enablePersistence?: boolean;
  scrollThrottleMs?: number;
  idleTimeoutMs?: number;
}

interface DeviceInfo {
  deviceType: 'desktop' | 'tablet' | 'mobile';
  browserName: string;
  osName: string;
}

type EventType =
  | 'page_open'
  | 'page_close'
  | 'section_view'
  | 'scroll'
  | 'option_toggle'
  | 'idle_start'
  | 'idle_end'
  | 'tab_blur'
  | 'tab_focus'
  | 'signature_start'
  | 'copy_text';

export class QuoteTracker {
  private config: Required<TrackerConfig>;
  private ws: WebSocket | null = null;
  private deviceInfo: DeviceInfo;
  private pageLoadTime: number;
  private lastScrollTime: number = 0;
  private maxScrollDepth: number = 0;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private isIdle: boolean = false;
  private sectionsViewed: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isConnected: boolean = false;

  constructor(config: TrackerConfig) {
    this.config = {
      sessionId: config.sessionId || this.generateSessionId(),
      userType: config.userType || 'customer',
      userName: config.userName || undefined,
      userId: config.userId || undefined,
      enableWebSocket: config.enableWebSocket ?? true,
      enablePersistence: config.enablePersistence ?? true,
      scrollThrottleMs: config.scrollThrottleMs || 500,
      idleTimeoutMs: config.idleTimeoutMs || 30000, // 30 seconds
      ...config,
    };

    this.deviceInfo = this.getDeviceInfo();
    this.pageLoadTime = Date.now();

    // Store session ID for persistence across page reloads
    try {
      sessionStorage.setItem(`quote_session_${this.config.quoteId}`, this.config.sessionId);
    } catch {
      // sessionStorage not available
    }
  }

  /**
   * Initialize tracking - call this when the page loads
   */
  init(): void {
    // Connect WebSocket
    if (this.config.enableWebSocket) {
      this.connectWebSocket();
    }

    // Track page open
    this.trackEvent('page_open', {});

    // Set up event listeners
    this.setupScrollTracking();
    this.setupVisibilityTracking();
    this.setupIdleTracking();
    this.setupCopyTracking();
    this.setupUnloadTracking();
  }

  /**
   * Clean up - call this when navigating away
   */
  destroy(): void {
    this.trackEvent('page_close', {
      totalTimeSeconds: Math.floor((Date.now() - this.pageLoadTime) / 1000),
      maxScrollDepth: this.maxScrollDepth,
      sectionsViewed: Array.from(this.sectionsViewed),
    });

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
  }

  /**
   * Track section visibility - call when a section comes into view
   */
  trackSectionView(sectionId: string, sectionTitle?: string): void {
    if (this.sectionsViewed.has(sectionId)) return;

    this.sectionsViewed.add(sectionId);
    this.trackEvent('section_view', { sectionId, sectionTitle });
  }

  /**
   * Track option toggle - call when customer selects/deselects an option
   */
  trackOptionToggle(optionId: string, optionName: string, selected: boolean): void {
    this.trackEvent('option_toggle', { optionId, optionName, selected });
  }

  /**
   * Track signature start - call when customer starts signing
   */
  trackSignatureStart(): void {
    this.trackEvent('signature_start', {});
  }

  // ============================================
  // Private methods
  // ============================================

  private generateSessionId(): string {
    // Try to get existing session ID
    try {
      const existing = sessionStorage.getItem(`quote_session_${this.config.quoteId}`);
      if (existing) return existing;
    } catch {
      // sessionStorage not available
    }

    // Generate new session ID
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;

    // Device type
    let deviceType: 'desktop' | 'tablet' | 'mobile' = 'desktop';
    if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/mobile|iphone|android/i.test(ua)) {
      deviceType = 'mobile';
    }

    // Browser name
    let browserName = 'Unknown';
    if (ua.includes('Firefox')) browserName = 'Firefox';
    else if (ua.includes('Chrome')) browserName = 'Chrome';
    else if (ua.includes('Safari')) browserName = 'Safari';
    else if (ua.includes('Edge')) browserName = 'Edge';

    // OS name
    let osName = 'Unknown';
    if (ua.includes('Windows')) osName = 'Windows';
    else if (ua.includes('Mac')) osName = 'macOS';
    else if (ua.includes('Linux')) osName = 'Linux';
    else if (ua.includes('Android')) osName = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS';

    return { deviceType, browserName, osName };
  }

  private connectWebSocket(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = new URL(`${protocol}//${window.location.host}/api/ws/quote/${this.config.quoteId}`);

    wsUrl.searchParams.set('sessionId', this.config.sessionId);
    wsUrl.searchParams.set('userType', this.config.userType);
    if (this.config.userName) wsUrl.searchParams.set('userName', this.config.userName);
    if (this.config.userId) wsUrl.searchParams.set('userId', this.config.userId);
    wsUrl.searchParams.set('deviceType', this.deviceInfo.deviceType);
    wsUrl.searchParams.set('browserName', this.deviceInfo.browserName);

    try {
      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[QuoteTracker] WebSocket connected');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('[QuoteTracker] WebSocket disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[QuoteTracker] WebSocket error:', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle incoming messages (e.g., team member joins)
          this.handleWebSocketMessage(data);
        } catch {
          // Ignore parse errors
        }
      };
    } catch (error) {
      console.error('[QuoteTracker] Failed to create WebSocket:', error);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[QuoteTracker] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    setTimeout(() => {
      console.log(`[QuoteTracker] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connectWebSocket();
    }, delay);
  }

  private handleWebSocketMessage(data: Record<string, unknown>): void {
    // Can be extended to handle messages from team members
    // For example, showing "Team member is viewing" indicator
    if (data.type === 'viewer_joined' && data.userType === 'team') {
      window.dispatchEvent(new CustomEvent('quote-team-viewer', { detail: data }));
    }
  }

  private trackEvent(eventType: EventType, eventData: Record<string, unknown>): void {
    const event = {
      type: eventType,
      sessionId: this.config.sessionId,
      eventData,
      pageLoadTime: Date.now() - this.pageLoadTime,
      ...this.deviceInfo,
    };

    // Send via WebSocket for real-time updates
    if (this.config.enableWebSocket && this.ws && this.isConnected) {
      try {
        this.ws.send(JSON.stringify({
          type: eventType,
          ...eventData,
        }));
      } catch (error) {
        console.error('[QuoteTracker] Failed to send WebSocket message:', error);
      }
    }

    // Send via HTTP for persistent storage
    if (this.config.enablePersistence) {
      this.persistEvent(eventType, eventData);
    }
  }

  private async persistEvent(eventType: EventType, eventData: Record<string, unknown>): Promise<void> {
    try {
      // Use sendBeacon for page_close to ensure delivery
      if (eventType === 'page_close' && navigator.sendBeacon) {
        const data = JSON.stringify({
          sessionId: this.config.sessionId,
          eventType,
          eventData,
          pageLoadTime: Date.now() - this.pageLoadTime,
          ...this.deviceInfo,
        });

        navigator.sendBeacon(
          `/api/quotes/${this.config.quoteId}/activities`,
          new Blob([data], { type: 'application/json' })
        );
        return;
      }

      // Regular fetch for other events
      await fetch(`/api/quotes/${this.config.quoteId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          eventType,
          eventData,
          pageLoadTime: Date.now() - this.pageLoadTime,
          ...this.deviceInfo,
        }),
      });
    } catch (error) {
      console.error('[QuoteTracker] Failed to persist event:', error);
    }
  }

  private setupScrollTracking(): void {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const now = Date.now();

          // Throttle scroll events
          if (now - this.lastScrollTime < this.config.scrollThrottleMs) {
            ticking = false;
            return;
          }

          this.lastScrollTime = now;

          // Calculate scroll depth
          const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrollDepth = scrollHeight > 0
            ? Math.round((window.scrollY / scrollHeight) * 100)
            : 0;

          // Only track if scroll depth increased
          if (scrollDepth > this.maxScrollDepth) {
            this.maxScrollDepth = scrollDepth;

            // Only send updates at certain thresholds
            if (scrollDepth % 25 === 0 || scrollDepth === 100) {
              this.trackEvent('scroll', { scrollDepth });
            }
          }

          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('tab_blur', {});
      } else {
        this.trackEvent('tab_focus', {});
      }
    });
  }

  private setupIdleTracking(): void {
    const resetIdleTimer = () => {
      if (this.isIdle) {
        this.isIdle = false;
        this.trackEvent('idle_end', {});
      }

      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
      }

      this.idleTimer = setTimeout(() => {
        this.isIdle = true;
        this.trackEvent('idle_start', {});
      }, this.config.idleTimeoutMs);
    };

    // Track activity
    ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach((event) => {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    });

    // Start idle timer
    resetIdleTimer();
  }

  private setupCopyTracking(): void {
    document.addEventListener('copy', () => {
      const selection = window.getSelection()?.toString() || '';
      if (selection.length > 0 && selection.length < 500) {
        this.trackEvent('copy_text', {
          textLength: selection.length,
          // Don't send actual text for privacy
        });
      }
    });
  }

  private setupUnloadTracking(): void {
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });

    window.addEventListener('pagehide', () => {
      this.destroy();
    });
  }
}

// Export a factory function for easy initialization
export function createQuoteTracker(config: TrackerConfig): QuoteTracker {
  return new QuoteTracker(config);
}
