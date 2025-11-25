/**
 * QuotePresence Durable Object
 *
 * Manages real-time presence and activity tracking for quote viewers.
 * Each quote gets its own Durable Object instance identified by quoteId.
 */

interface Session {
  webSocket: WebSocket;
  sessionId: string;
  userType: 'customer' | 'team';
  userId?: string;
  userName?: string;
  connectedAt: number;
  lastActiveAt: number;
  deviceType?: string;
  browserName?: string;
}

interface ActivityEvent {
  type: string;
  sessionId: string;
  userType: 'customer' | 'team';
  userName?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export class QuotePresence {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, Session> = new Map();
  private quoteId: string = '';

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;

    // Restore sessions from hibernation
    this.state.getWebSockets().forEach((ws) => {
      const meta = ws.deserializeAttachment() as Session | null;
      if (meta) {
        this.sessions.set(ws, meta);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extract quote ID from path
    const pathMatch = url.pathname.match(/\/quote\/([^/]+)/);
    if (pathMatch) {
      this.quoteId = pathMatch[1];
    }

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // HTTP endpoints
    if (url.pathname.endsWith('/viewers')) {
      return this.handleGetViewers();
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId') || crypto.randomUUID();
    const userType = (url.searchParams.get('userType') as 'customer' | 'team') || 'customer';
    const userId = url.searchParams.get('userId') || undefined;
    const userName = url.searchParams.get('userName') || undefined;
    const deviceType = url.searchParams.get('deviceType') || undefined;
    const browserName = url.searchParams.get('browserName') || undefined;

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Accept the WebSocket
    this.state.acceptWebSocket(server);

    // Create session
    const session: Session = {
      webSocket: server,
      sessionId,
      userType,
      userId,
      userName,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
      deviceType,
      browserName,
    };

    // Store session metadata for hibernation
    server.serializeAttachment(session);
    this.sessions.set(server, session);

    // Broadcast new viewer to all connected clients
    this.broadcast({
      type: 'viewer_joined',
      sessionId,
      userType,
      userName,
      data: { deviceType, browserName },
      timestamp: Date.now(),
    });

    // Send current viewers to the new connection
    const viewers = this.getViewersList();
    server.send(JSON.stringify({
      type: 'viewers_list',
      viewers,
      timestamp: Date.now(),
    }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session = this.sessions.get(ws);
    if (!session) return;

    // Update last active time
    session.lastActiveAt = Date.now();
    ws.serializeAttachment(session);

    try {
      const data = JSON.parse(message as string);

      // Handle different message types
      switch (data.type) {
        case 'activity':
          // Broadcast activity to team members watching
          this.broadcastToTeam({
            type: 'customer_activity',
            sessionId: session.sessionId,
            userType: session.userType,
            userName: session.userName,
            data: data.payload,
            timestamp: Date.now(),
          });
          break;

        case 'scroll':
          this.broadcastToTeam({
            type: 'customer_scroll',
            sessionId: session.sessionId,
            data: { scrollDepth: data.scrollDepth },
            timestamp: Date.now(),
          });
          break;

        case 'section_view':
          this.broadcastToTeam({
            type: 'customer_section_view',
            sessionId: session.sessionId,
            data: { sectionId: data.sectionId, sectionTitle: data.sectionTitle },
            timestamp: Date.now(),
          });
          break;

        case 'option_toggle':
          this.broadcast({
            type: 'option_toggled',
            sessionId: session.sessionId,
            userType: session.userType,
            data: {
              optionId: data.optionId,
              optionName: data.optionName,
              selected: data.selected,
            },
            timestamp: Date.now(),
          });
          break;

        case 'idle':
          this.broadcastToTeam({
            type: data.isIdle ? 'customer_idle' : 'customer_active',
            sessionId: session.sessionId,
            timestamp: Date.now(),
          });
          break;

        case 'tab_visibility':
          this.broadcastToTeam({
            type: data.visible ? 'customer_tab_focus' : 'customer_tab_blur',
            sessionId: session.sessionId,
            timestamp: Date.now(),
          });
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          // Forward unknown events as generic activity
          this.broadcastToTeam({
            type: 'customer_activity',
            sessionId: session.sessionId,
            data: data,
            timestamp: Date.now(),
          });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const session = this.sessions.get(ws);
    if (session) {
      // Broadcast viewer left
      this.broadcast({
        type: 'viewer_left',
        sessionId: session.sessionId,
        userType: session.userType,
        userName: session.userName,
        timestamp: Date.now(),
      });

      this.sessions.delete(ws);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    const session = this.sessions.get(ws);
    if (session) {
      this.sessions.delete(ws);
    }
  }

  private broadcast(event: ActivityEvent): void {
    const message = JSON.stringify(event);
    for (const [ws, session] of this.sessions) {
      try {
        ws.send(message);
      } catch (error) {
        // WebSocket might be closed
        this.sessions.delete(ws);
      }
    }
  }

  private broadcastToTeam(event: ActivityEvent): void {
    const message = JSON.stringify(event);
    for (const [ws, session] of this.sessions) {
      if (session.userType === 'team') {
        try {
          ws.send(message);
        } catch (error) {
          this.sessions.delete(ws);
        }
      }
    }
  }

  private getViewersList(): Array<{
    sessionId: string;
    userType: string;
    userName?: string;
    deviceType?: string;
    connectedAt: number;
    lastActiveAt: number;
  }> {
    return Array.from(this.sessions.values()).map((session) => ({
      sessionId: session.sessionId,
      userType: session.userType,
      userName: session.userName,
      deviceType: session.deviceType,
      connectedAt: session.connectedAt,
      lastActiveAt: session.lastActiveAt,
    }));
  }

  private handleGetViewers(): Response {
    const viewers = this.getViewersList();
    return new Response(JSON.stringify({ viewers, quoteId: this.quoteId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
