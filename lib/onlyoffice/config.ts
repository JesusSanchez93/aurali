/**
 * config.ts
 *
 * Builds the config object consumed by ONLYOFFICE's client-side
 * `DocsAPI.DocEditor` and signs it, per the ONLYOFFICE JWT integration spec
 * (the whole config is signed and the token is attached at the top level).
 */

import { signOnlyOfficeToken, signFileAccessToken, signPluginDataToken } from './jwt';

/** GUID of the "Variables" ONLYOFFICE plugin — must match public/onlyoffice-plugin/variables. */
const VARIABLES_PLUGIN_GUID = 'asc.{6C63FA0A-D0A7-4B5A-9F6A-000000000001}';

/** Reachable by the ONLYOFFICE Document Server container (document.url, callbackUrl — fetched server-side). */
export function getCallbackBaseUrl(): string {
  const base = process.env.ONLYOFFICE_CALLBACK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    throw new Error('Missing ONLYOFFICE_CALLBACK_BASE_URL (or NEXT_PUBLIC_APP_URL) env var.');
  }
  return base.replace(/\/$/, '');
}

/**
 * Reachable by the end user's browser — used for URLs the editor's
 * client-side JS fetches itself (plugin manifest + UI), as opposed to
 * `getCallbackBaseUrl()`'s URLs, which the Document Server container fetches
 * server-side (e.g. via Docker's `host.docker.internal`, unresolvable from a
 * normal browser).
 */
export function getBrowserBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL env var.');
  }
  return base.replace(/\/$/, '');
}

export interface BuildEditorConfigInput {
  /** Path segment identifying the resource, e.g. `templates/{id}` or `documents/{id}` */
  resourcePath: string;
  documentKey: string;
  fileName: string;
  mode: 'edit' | 'view';
  userId: string;
  userName: string;
  /** When set, loads the "Variables" plugin (docked right panel) scoped to this org. Template editor only. */
  organizationId?: string;
}

export interface OnlyOfficeEditorConfig {
  document: {
    fileType: 'docx';
    key: string;
    title: string;
    url: string;
  };
  documentType: 'word';
  editorConfig: {
    callbackUrl: string;
    lang: string;
    mode: 'edit' | 'view';
    user: { id: string; name: string };
    plugins?: { pluginsData: string[]; autostart: string[] };
  };
  token: string;
}

export function buildEditorConfig(input: BuildEditorConfigInput): OnlyOfficeEditorConfig {
  const base = getCallbackBaseUrl();

  const fileToken = signFileAccessToken(input.resourcePath);

  const config = {
    document: {
      fileType: 'docx' as const,
      key: input.documentKey,
      title: input.fileName,
      url: `${base}/api/onlyoffice/${input.resourcePath}/file?token=${fileToken}`,
    },
    documentType: 'word' as const,
    editorConfig: {
      callbackUrl: `${base}/api/onlyoffice/${input.resourcePath}/callback`,
      lang: 'es',
      mode: input.mode,
      user: { id: input.userId, name: input.userName },
      ...(input.organizationId
        ? {
            plugins: {
              pluginsData: [
                `${getBrowserBaseUrl()}/onlyoffice-plugin/variables/config.json?token=${signPluginDataToken(input.organizationId)}`,
              ],
              autostart: [VARIABLES_PLUGIN_GUID],
            },
          }
        : {}),
    },
  };

  const token = signOnlyOfficeToken(config);
  return { ...config, token };
}
