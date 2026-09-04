'use client';

import { useEffect, useId, useRef, useState } from 'react';

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (placeholderId: string, config: unknown) => { destroyEditor?: () => void };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadOnlyOfficeScript(): Promise<void> {
  if (window.DocsAPI) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const src = `${process.env.NEXT_PUBLIC_ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`;
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar el editor de ONLYOFFICE'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

interface Props {
  /** URL that returns a signed ONLYOFFICE editor config (GET, JSON) */
  configUrl: string;
  className?: string;
}

export function OnlyOfficeEditor({ configUrl, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = `onlyoffice-${useId().replace(/:/g, '')}`;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let editor: any;

    async function init() {
      setError(null);
      try {
        const res = await fetch(configUrl);
        const config = await res.json();
        if (!res.ok) throw new Error(config?.error ?? 'No se pudo cargar la configuración del editor');

        await loadOnlyOfficeScript();
        if (cancelled || !window.DocsAPI) return;

        editor = new window.DocsAPI.DocEditor(containerId, config);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar el editor');
      }
    }

    init();

    return () => {
      cancelled = true;
      editor?.destroyEditor?.();
    };
  }, [configUrl, containerId]);

  if (error) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} id={containerId} className={className} />;
}
