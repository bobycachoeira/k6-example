import { BASE_URL, PROFILE, RESULTS_DIR } from '../config/env.js';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const fmt = (value, digits = 2) =>
  value === undefined || value === null ? '—' : Number(value).toFixed(digits);

function thresholdRows(data) {
  const rows = [];

  for (const [name, metric] of Object.entries(data.metrics)) {
    for (const [expression, result] of Object.entries(metric.thresholds || {})) {
      const ok = result.ok;
      rows.push(`
        <tr>
          <td>${escapeHtml(name)}</td>
          <td><code>${escapeHtml(expression)}</code></td>
          <td><span class="pill ${ok ? 'ok' : 'fail'}">${ok ? 'OK' : 'VIOLADO'}</span></td>
        </tr>`);
    }
  }

  if (rows.length === 0) {
    rows.push('<tr><td colspan="3">Nenhum threshold configurado.</td></tr>');
  }
  return rows.join('');
}

function metricRows(data) {
  return Object.entries(data.metrics)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, metric]) => {
      const v = metric.values || {};
      return `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(metric.type)}</td>
          <td>${fmt(v.count, 0)}</td>
          <td>${fmt(v.rate)}</td>
          <td>${fmt(v.avg, 1)}</td>
          <td>${fmt(v['p(95)'], 1)}</td>
          <td>${fmt(v['p(99)'], 1)}</td>
          <td>${fmt(v.max, 1)}</td>
        </tr>`;
    })
    .join('');
}

function buildHtml(data, profile) {
  const failed = Object.values(data.metrics).some((metric) =>
    Object.values(metric.thresholds || {}).some((result) => !result.ok),
  );
  const statusText = failed ? 'Thresholds violados' : 'Todos os thresholds atendidos';
  const statusClass = failed ? 'fail' : 'ok';
  const generatedAt = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório k6 — ${escapeHtml(profile)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; padding: 24px; background: #f6f5f1; color: #17181c; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
  h1 { font-size: 20px; margin: 0; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin: 28px 0 10px; }
  .meta { color: #6b6f76; font-size: 12px; line-height: 1.7; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .pill.ok { background: #d3f9d8; color: #237032; }
  .pill.fail { background: #ffe3e3; color: #b02525; }
  table { width: 100%; border-collapse: collapse; background: #fffdf8; border: 1px solid #ddd7ca; font-size: 12.5px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eee9dd; }
  th { background: #17181c; color: #fbf9f4; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  tr:last-child td { border-bottom: none; }
  code { background: #f0ede4; padding: 1px 6px; border-radius: 4px; }
</style>
</head>
<body>
<header>
  <h1>Relatório de execução — perfil <code>${escapeHtml(profile)}</code></h1>
  <span class="pill ${statusClass}">${statusText}</span>
</header>
<div class="meta">
  Alvo: <code>${escapeHtml(BASE_URL)}</code><br>
  Gerado em: ${escapeHtml(generatedAt)} &nbsp;|&nbsp; Diretório: <code>${escapeHtml(RESULTS_DIR)}</code>
</div>

<h2>Thresholds</h2>
<table>
  <thead><tr><th>Métrica</th><th>Condição</th><th>Status</th></tr></thead>
  <tbody>${thresholdRows(data)}</tbody>
</table>

<h2>Métricas</h2>
<table>
  <thead>
    <tr><th>Métrica</th><th>Tipo</th><th>count</th><th>rate</th><th>avg</th><th>p95</th><th>p99</th><th>max</th></tr>
  </thead>
  <tbody>${metricRows(data)}</tbody>
</table>
</body>
</html>`;
}

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const MATCHERS = [
  { title: 'HTTP', match: (name) => name.startsWith('http_') },
  {
    title: 'EXECUTION',
    match: (name) => /^(iterations|iteration_duration|dropped_iterations|vus|vus_max)$/.test(name),
  },
  { title: 'NETWORK', match: (name) => name.startsWith('data_') },
];

const DISPLAY_ORDER = ['CUSTOM', 'HTTP', 'EXECUTION', 'NETWORK'];

function sectionOf(name) {
  for (const { title, match } of MATCHERS) {
    if (match(name)) {
      return title;
    }
  }
  return 'CUSTOM';
}

function fmtDuration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(2)}ms`;
}

function fmtBytes(value) {
  const units = ['B', 'kB', 'MB', 'GB'];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1000 && unit < units.length - 1) {
    scaled /= 1000;
    unit += 1;
  }
  return `${scaled.toFixed(2)} ${units[unit]}`;
}

function fmtValue(name, metric, values) {
  if (name.startsWith('data_') && metric.type === 'counter') {
    return `${fmtBytes(values.count)} ${fmtBytes(values.rate)}/s`;
  }

  switch (metric.type) {
    case 'trend': {
      const parts = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)']
        .filter((key) => values[key] !== undefined)
        .map((key) => `${key}=${fmtDuration(values[key])}`);
      return parts.join(' ');
    }
    case 'counter':
      return `${values.count} (${values.rate.toFixed(2)}/s)`;
    case 'gauge':
      return values.value !== undefined
        ? `${values.value} min=${values.min} max=${values.max}`
        : `${values.min} min=${values.min} max=${values.max}`;
    case 'rate': {
      const pct = `${(values.rate * 100).toFixed(2)}%`;
      if (values.passes !== undefined && values.fails !== undefined) {
        return `${pct} ${ANSI.green}✓ ${values.passes}${ANSI.reset} ${ANSI.red}✗ ${values.fails}${ANSI.reset}`;
      }
      return pct;
    }
    default:
      return JSON.stringify(values);
  }
}

function textSummary(data, profile) {
  const lines = ['', `  ${ANSI.bold}Resultado da execução — perfil ${profile}${ANSI.reset}`, ''];

  lines.push(`  ${ANSI.bold}THRESHOLDS${ANSI.reset}`);
  for (const [name, metric] of Object.entries(data.metrics).sort()) {
    for (const [expression, result] of Object.entries(metric.thresholds || {})) {
      const status = result.ok
        ? `${ANSI.green}ok${ANSI.reset}`
        : `${ANSI.red}VIOLADO${ANSI.reset}`;
      lines.push(`    ${(name + ' ').padEnd(30, '.')}: ${expression} — ${status}`);
    }
  }
  lines.push('');

  const grouped = {};
  for (const [name, metric] of Object.entries(data.metrics)) {
    const section = sectionOf(name);
    grouped[section] = grouped[section] || [];
    grouped[section].push([name, metric]);
  }

  for (const title of DISPLAY_ORDER) {
    const metrics = (grouped[title] || []).sort(([a], [b]) => a.localeCompare(b));
    if (metrics.length === 0) {
      continue;
    }
    lines.push(`  ${ANSI.bold}${title}${ANSI.reset}`);
    for (const [name, metric] of metrics) {
      const label = `${name} `;
      lines.push(`    ${label.padEnd(38, '.')}: ${ANSI.cyan}${fmtValue(name, metric, metric.values)}${ANSI.reset}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function makeHandleSummary(profile = PROFILE) {
  return function handleSummary(data) {
    return {
      stdout: textSummary(data, profile),
      [`${RESULTS_DIR}/summary.json`]: JSON.stringify(data, null, 2),
      [`${RESULTS_DIR}/summary.html`]: buildHtml(data, profile),
    };
  };
}
