const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailHistoryAddition {
  messageId: string;
  threadId: string;
}

interface GmailHistoryRecord {
  messagesAdded?: { message: { id: string; threadId: string; labelIds?: string[] } }[];
}

interface GmailHistoryListResponse {
  history?: GmailHistoryRecord[];
  historyId?: string;
  nextPageToken?: string;
}

/**
 * Pide a Gmail solo lo que cambió desde `startHistoryId` — ni releer el
 * mailbox completo ni el hilo completo, a diferencia del poller anterior.
 * Cada entrada de messagesAdded ya trae labelIds, así que el filtro
 * INBOX-sin-SENT se hace sin llamadas extra. Pagina hasta agotar
 * nextPageToken y devuelve el historyId más reciente para guardar como
 * nuevo baseline.
 *
 * Si Gmail responde 404 es que startHistoryId ya expiró de su ventana de
 * retención (~1 semana, o el watch nunca corrió) — el caller debe tratarlo
 * como "hay que re-sincronizar desde cero" (null) en vez de reventar.
 */
export async function fetchGmailHistoryAdditions(
  accessToken: string,
  startHistoryId: string,
): Promise<{ historyId: string; additions: GmailHistoryAddition[] } | null> {
  const additions: GmailHistoryAddition[] = [];
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;

  do {
    const url = new URL(`${GMAIL_API_BASE}/history`);
    url.searchParams.set('startHistoryId', startHistoryId);
    url.searchParams.set('historyTypes', 'messageAdded');
    url.searchParams.set('labelId', 'INBOX');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Gmail history.list falló (HTTP ${res.status})`);
    }

    const data = (await res.json()) as GmailHistoryListResponse;
    if (data.historyId) latestHistoryId = data.historyId;

    for (const record of data.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        const labelIds = added.message.labelIds ?? [];
        if (labelIds.includes('INBOX') && !labelIds.includes('SENT')) {
          additions.push({ messageId: added.message.id, threadId: added.message.threadId });
        }
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return { historyId: latestHistoryId, additions };
}
