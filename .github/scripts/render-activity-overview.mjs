import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const directory = "assets/activity";
const palettes = {
  dark: { foreground: "#e6edf3", muted: "#9198a1", accent: "#3fb950", border: "#30363d" },
  light: { foreground: "#1f2328", muted: "#59636e", accent: "#1a7f37", border: "#d1d9e0" },
};
const layouts = {
  wide: { width: 800, height: 204 },
  compact: { width: 360, height: 338 },
};

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--foreground); font: 15px/1.3 Arial, sans-serif; }
  main { padding: 3px 0 5px; overflow: hidden; }
  dl, dd { margin: 0; }
  .contributions { display: grid; grid-template-columns: 1.35fr 1fr 1fr; gap: 32px; }
  .label { font-size: 15px; font-weight: 600; }
  .number { font-variant-numeric: tabular-nums; font-weight: 700; }
  .total .number { font-size: 60px; letter-spacing: -.03em; }
  .headline { display: flex; align-items: baseline; gap: 6px; margin-top: 3px; line-height: 1; min-height: 60px; }
  .streak .headline { align-items: end; padding-bottom: 4px; }
  .streak .number { font-size: 42px; letter-spacing: -.025em; }
  .current .number { color: var(--accent); }
  .unit { margin-bottom: 3px; color: var(--muted); font-size: 16px; }
  .period { display: block; margin-top: 7px; color: var(--muted); font-size: 14px; }
  .bar { height: 3px; margin-top: 10px; background: var(--border); border-radius: 2px; }
  .bar::before { display: block; content: ''; width: var(--progress); height: 100%; background: var(--accent); border-radius: inherit; }
  .longest .bar::before { background: var(--muted); opacity: .65; }
  .metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
  .metrics div { display: flex; flex-direction: column; }
  .metrics .number { order: -1; font-size: 23px; line-height: 1.15; }
  .metrics .label { display: block; margin-top: 4px; color: var(--muted); font-size: 14px; font-weight: 400; }
  .compact .contributions { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; }
  .compact .total { grid-column: 1 / -1; }
  .compact .total .number { font-size: 49px; }
  .compact .headline { min-height: 0; }
  .compact .streak .number { font-size: 30px; }
  .compact .streak .headline { padding-bottom: 0; }
  .compact .period { margin-top: 5px; font-size: 14px; }
  .compact .bar { margin-top: 7px; }
  .compact .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 12px; margin-top: 14px; padding-top: 11px; }
  .compact .metrics .number { font-size: 20px; }
  .compact .metrics .label { margin-top: 2px; }
  .compact .metrics div:last-child { grid-column: span 2; }
`;

function dateRange(value) {
  const date = value.replace(/-/g, "–");
  return /^[A-Za-z0-9,. –]+$/.test(date) ? date : "";
}

function activityData(stats, streak) {
  const number = new Intl.NumberFormat("en-US");
  const metrics = [
    ["Stars", stats.stars],
    ["Commits", stats.commits],
    ["Pull requests", stats.prs],
    ["Issues filed", stats.issues],
    ["Public repositories", stats.repos],
  ].map(([label, count]) => ({ label, value: number.format(count) }));
  return {
    metrics,
    highlights: [
      { label: "Total contributions", value: streak.total, date: dateRange(streak.totalRange), className: "total" },
      { label: "Current streak", value: streak.current, date: dateRange(streak.currentRange), className: "streak current", unit: streak.current === "1" ? "day" : "days" },
      { label: "Longest streak", value: streak.longest, date: dateRange(streak.longestRange), className: "streak longest", unit: streak.longest === "1" ? "day" : "days" },
    ],
  };
}

function documentHtml({ metrics, highlights }, colors, layout, width) {
  const longest = Number(highlights[2].value.replaceAll(",", ""));
  const highlightMarkup = highlights.map(({ label, value, date, className, unit }) => {
    const progress = Math.min(100, 100 * Number(value.replaceAll(",", "")) / Math.max(1, longest));
    return `<div class="${className}">
      <dt class="label">${label}</dt>
      <dd class="headline"><span class="number">${value}</span>${unit ? `<span class="unit">${unit}</span>` : ""}</dd>
      <dd class="period">${date}</dd>
      ${unit ? `<dd class="bar" style="--progress: ${progress}%"></dd>` : ""}
    </div>`;
  }).join("\n");
  const metricMarkup = metrics.map(({ label, value }) => `<div>
    <dt class="label">${label}</dt>
    <dd class="number">${value}</dd>
  </div>`).join("\n");

  return `<!doctype html>
<html lang="en" style="--foreground: ${colors.foreground}; --muted: ${colors.muted}; --accent: ${colors.accent}; --border: ${colors.border}">
<meta charset="utf-8">
<title>GitHub activity</title>
<style>${styles}</style>
<main class="${layout}" style="width: ${width}px">
  <dl class="contributions">${highlightMarkup}</dl>
  <dl class="metrics">${metricMarkup}</dl>
</main>
</html>`;
}

export async function renderActivityOverview(stats, streak) {
  const data = activityData(stats, streak);
  const browser = process.env.PROFILE_CHROME || "google-chrome";
  const temporary = await mkdtemp(join(tmpdir(), "ling-profile-"));
  const html = join(temporary, "activity.html");
  const png = join(temporary, "activity.png");
  try {
    await mkdir(directory, { recursive: true });
    for (const [theme, colors] of Object.entries(palettes)) {
      for (const [layout, { width, height }] of Object.entries(layouts)) {
        await writeFile(html, documentHtml(data, colors, layout, width));
        await run(browser, [
          "--headless", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
          "--default-background-color=00000000", "--force-device-scale-factor=2",
          `--window-size=${width},${height}`, `--screenshot=${png}`, pathToFileURL(html).href,
        ], { timeout: 15000, windowsHide: true });
        await copyFile(png, resolve(directory, `${layout}-${theme}.png`));
      }
    }
  } finally {
    await rm(html, { force: true });
    await rm(png, { force: true });
    await rmdir(temporary);
  }

  const highlights = data.highlights.map(({ label, value, unit, date }) =>
    `${label} ${value}${unit ? ` ${unit}` : ""}${date ? ` (${date})` : ""}`);
  const metrics = data.metrics.map(({ label, value }) => `${value} ${label.toLowerCase()}`);
  const alt = `${highlights.join(". ")}. ${metrics.join(", ")}.`;
  return Object.keys(palettes).flatMap((theme) => [
    "<picture>",
    `  <source media="(max-width: 767px)" srcset="./${directory}/compact-${theme}.png" width="360" />`,
    `  <img src="./${directory}/wide-${theme}.png#gh-${theme}-mode-only" width="800" alt="${alt}" />`,
    "</picture>",
  ]);
}
