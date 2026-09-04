/**
 * GET /onlyoffice-plugin/variables/[token]
 *
 * The "Variables" ONLYOFFICE plugin's UI. The token is a path segment, not a
 * query param — ONLYOFFICE appends its own `?lang=..&theme-type=..` to the
 * `variations[].url` from config.json by naive string concatenation, which
 * corrupts a URL that already carries a `?token=...` query string.
 */

import { type NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Variables</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    height: 100%;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    color: #1f2328;
    background: #fff;
  }
  #root { padding: 8px; height: 100%; overflow-y: auto; }
  .hint { color: #6b7280; font-size: 11px; margin: 0 0 10px; line-height: 1.5; }
  .group { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
  .group-header {
    width: 100%; text-align: left; background: #f9fafb; border: none; cursor: pointer;
    padding: 8px 10px; font-size: 11px; font-weight: 600; color: #4b5563;
  }
  .group-header.ai { color: #7c3aed; }
  .group-body { padding: 6px; display: none; }
  .group-body.open { display: block; }
  .var-btn {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    width: 100%; text-align: left; background: none; border: none; cursor: pointer;
    padding: 6px 6px; border-radius: 4px; font-size: 12px; color: #1f2328;
  }
  .var-btn:hover { background: #f3f4f6; }
  .var-btn .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .var-btn .badge {
    flex-shrink: 0; font-family: ui-monospace, monospace; font-size: 10px;
    background: #eef0f2; color: #374151; border-radius: 4px; padding: 2px 5px;
  }
  .var-btn.ai .badge { background: #ede9fe; color: #6d28d9; }
  .empty { color: #9ca3af; padding: 8px; }
</style>
</head>
<body>
<div id="root"><p class="empty">Cargando variables…</p></div>

<script src="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js"></script>
<script>
  var TOKEN = ${JSON.stringify(token)};

  function insertVariable(fullKey) {
    window.Asc.plugin.executeMethod('PasteText', ['{' + fullKey + '}']);
  }

  function render(data) {
    var root = document.getElementById('root');
    root.innerHTML = '';

    var hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Haz clic en una variable para insertarla en la posición del cursor.';
    root.appendChild(hint);

    (data.groups || []).forEach(function (group) {
      root.appendChild(buildGroup(group.label, group.variables.map(function (v) {
        return { fullKey: group.key.toUpperCase() + '.' + v.key, label: v.label };
      }), false));
    });

    if (data.aiVariables && data.aiVariables.length > 0) {
      root.appendChild(buildGroup('Variables IA', data.aiVariables.map(function (v) {
        return { fullKey: v.key, label: v.name || v.key, description: v.description };
      }), true));
    }
  }

  function buildGroup(label, vars, isAi) {
    var wrap = document.createElement('div');
    wrap.className = 'group';

    var header = document.createElement('button');
    header.type = 'button';
    header.className = 'group-header' + (isAi ? ' ai' : '');
    header.textContent = label;

    var body = document.createElement('div');
    body.className = 'group-body';

    header.addEventListener('click', function () {
      body.classList.toggle('open');
    });

    vars.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'var-btn' + (isAi ? ' ai' : '');
      btn.title = v.description || '';

      var labelSpan = document.createElement('span');
      labelSpan.className = 'label';
      labelSpan.textContent = v.label;

      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '{' + v.fullKey + '}';

      btn.appendChild(labelSpan);
      btn.appendChild(badge);
      btn.addEventListener('click', function () { insertVariable(v.fullKey); });
      body.appendChild(btn);
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    return wrap;
  }

  window.Asc.plugin.init = function () {
    fetch('/api/onlyoffice/plugin/variables/data?token=' + encodeURIComponent(TOKEN))
      .then(function (res) {
        if (!res.ok) throw new Error('request failed');
        return res.json();
      })
      .then(render)
      .catch(function () {
        document.getElementById('root').innerHTML =
          '<p class="empty">No se pudieron cargar las variables.</p>';
      });
  };

  window.Asc.plugin.button = function () {};
</script>
</body>
</html>
`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
