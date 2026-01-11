// src/services/websocket-service.ts
// WebSocket service for real-time messaging

import type { WebSocket } from "ws";

export interface WebSocketClient {
  ws: WebSocket;
  tenantId: number;
  userId: string;
  partyId?: number;
}

// Legacy alias for internal use
type Client = WebSocketClient;

// Map of tenantId -> Set of connected clients
const tenantClients = new Map<number, Set<Client>>();

// Map of partyId -> Set of connected clients (for marketplace users)
const partyClients = new Map<number, Set<Client>>();

/**
 * Register a new WebSocket client
 */
export function registerClient(client: Client): void {
  // Add to tenant clients
  if (!tenantClients.has(client.tenantId)) {
    tenantClients.set(client.tenantId, new Set());
  }
  tenantClients.get(client.tenantId)!.add(client);

  // Add to party clients if partyId is provided
  if (client.partyId) {
    if (!partyClients.has(client.partyId)) {
      partyClients.set(client.partyId, new Set());
    }
    partyClients.get(client.partyId)!.add(client);
  }

  console.log(`[WS] Client registered: tenant=${client.tenantId}, user=${client.userId}, party=${client.partyId}`);
}

/**
 * Unregister a WebSocket client
 */
export function unregisterClient(client: Client): void {
  // Remove from tenant clients
  const tenantSet = tenantClients.get(client.tenantId);
  if (tenantSet) {
    tenantSet.delete(client);
    if (tenantSet.size === 0) {
      tenantClients.delete(client.tenantId);
    }
  }

  // Remove from party clients
  if (client.partyId) {
    const partySet = partyClients.get(client.partyId);
    if (partySet) {
      partySet.delete(client);
      if (partySet.size === 0) {
        partyClients.delete(client.partyId);
      }
    }
  }

  console.log(`[WS] Client unregistered: tenant=${client.tenantId}, user=${client.userId}`);
}

/**
 * Broadcast a message to all clients in a tenant
 */
export function broadcastToTenant(tenantId: number, event: string, payload: any): void {
  const clients = tenantClients.get(tenantId);
  if (!clients || clients.size === 0) {
    return;
  }

  const message = JSON.stringify({ event, payload });
  let sent = 0;

  for (const client of clients) {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(message);
      sent++;
    }
  }

  console.log(`[WS] Broadcast to tenant ${tenantId}: event=${event}, clients=${sent}`);
}

/**
 * Broadcast a message to a specific party (for marketplace users)
 */
export function broadcastToParty(partyId: number, event: string, payload: any): void {
  const clients = partyClients.get(partyId);
  if (!clients || clients.size === 0) {
    return;
  }

  const message = JSON.stringify({ event, payload });
  let sent = 0;

  for (const client of clients) {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(message);
      sent++;
    }
  }

  console.log(`[WS] Broadcast to party ${partyId}: event=${event}, clients=${sent}`);
}

/**
 * Broadcast a new message event to relevant parties
 * - Broadcast to tenant (for staff in Communications Hub)
 * - Broadcast to specific parties involved in the thread
 */
export function broadcastNewMessage(
  tenantId: number,
  threadId: number,
  message: {
    id: number;
    body: string;
    senderPartyId: number;
    createdAt: string;
  },
  participantPartyIds: number[]
): void {
  const payload = {
    threadId,
    message,
  };

  // Broadcast to tenant staff
  broadcastToTenant(tenantId, "new_message", payload);

  // Broadcast to all participants (including marketplace users)
  for (const partyId of participantPartyIds) {
    broadcastToParty(partyId, "new_message", payload);
  }
}

/**
 * Broadcast thread update (read status, flag, archive)
 */
export function broadcastThreadUpdate(
  tenantId: number,
  threadId: number,
  update: {
    isRead?: boolean;
    flagged?: boolean;
    archived?: boolean;
  }
): void {
  broadcastToTenant(tenantId, "thread_update", { threadId, ...update });
}

/**
 * Broadcast new email sent
 */
export function broadcastNewEmail(
  tenantId: number,
  email: {
    id: string;
    type: "partyEmail" | "unlinkedEmail";
    toEmail: string;
    subject: string;
    preview: string;
    sentAt: string;
  }
): void {
  broadcastToTenant(tenantId, "new_email", email);
}

/**
 * Get connection stats (for debugging)
 */
export function getConnectionStats(): { tenants: number; totalClients: number } {
  let totalClients = 0;
  for (const clients of tenantClients.values()) {
    totalClients += clients.size;
  }
  return {
    tenants: tenantClients.size,
    totalClients,
  };
}
