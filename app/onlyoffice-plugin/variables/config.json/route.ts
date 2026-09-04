/**
 * GET /onlyoffice-plugin/variables/config.json
 *
 * ONLYOFFICE plugin manifest for the "Variables" panel, loaded dynamically
 * via editorConfig.plugins.pluginsData (no Document Server image changes
 * needed). Lives next to the plugin UI route (not under /api) because
 * ONLYOFFICE resolves `variations[].url` as a path *relative to this file*
 * rather than as an absolute URL — same directory lets `url` stay relative.
 *
 * `url` carries the token as a path segment, not a query param: ONLYOFFICE
 * appends its own `?lang=..&theme-type=..` to this URL by naive string
 * concatenation, which corrupts a URL that already has a `?token=...` query.
 */

import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';

  return NextResponse.json(
    {
      guid: 'asc.{6C63FA0A-D0A7-4B5A-9F6A-000000000001}',
      name: 'Variables',
      version: '1.0.0',
      variations: [
        {
          description: 'Variables de la plantilla',
          url: token,
          // Without an icon, ONLYOFFICE gives the panel no toolbar button —
          // once closed there is nothing left to click to reopen it.
          icons: ['icon.svg'],
          EditorsSupport: ['word'],
          type: 'panelRight',
          initDataType: 'none',
          // [width, height] in px — width is what matters for a panelRight dock.
          size: [450, 600],
        },
      ],
    },
    {
      // Fetched by the Document Server's own Plugins.js, running under its
      // own origin (e.g. http://localhost:8081) — a genuine cross-origin
      // fetch that the browser blocks without this header, even though the
      // request itself succeeds server-side.
      headers: { 'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_ONLYOFFICE_URL ?? '*' },
    },
  );
}
