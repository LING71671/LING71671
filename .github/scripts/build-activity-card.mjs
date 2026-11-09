// Generates assets for the profile "Activity" section as authored SVG
// panels in the Newspaper Broadsheet design system.
// Defaults to the light newsprint paper aesthetic (#F4F1EA) per user instruction.
// Data: GitHub REST (stars, commits, PRs, issues, repos) + streak figures.
// Usage: node .github/scripts/build-activity-card.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const USER = process.env.STATS_USER || "LING71671";
const TOKEN = process.env.GITHUB_TOKEN || "";
const OUT = process.env.OUT_FILE || "dist/activity-card.svg";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ling-profile-stat-card",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${path} -> ${res.status}`);
  return res.json();
}

function fmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

async function getStats() {
  const user = await api(`/users/${USER}`);
  let stars = 0;
  for (let page = 1; ; page++) {
    const repos = await api(`/users/${USER}/repos?per_page=100&type=owner&page=${page}`);
    if (!repos.length) break;
    stars += repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    if (repos.length < 100) break;
  }
  const commits = (await api(`/search/commits?q=author:${USER}&per_page=1`)).total_count;
  const prs = (await api(`/search/issues?q=author:${USER}+type:pr&per_page=1`)).total_count;
  const issues = (await api(`/search/issues?q=author:${USER}+type:issue&per_page=1`)).total_count;
  return { stars, commits, prs, issues, repos: user.public_repos };
}

const clean = (s) => String(s).replace(/[<>&"']/g, "").trim();

async function getStreak() {
  const res = await fetch(`https://streak-stats.demolab.com?user=${USER}`);
  if (!res.ok) throw new Error(`streak-stats -> ${res.status}`);
  const svg = await res.text();
  const texts = [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => clean(m[1].replace(/<[^>]+>/g, "")))
    .filter(Boolean);
  const at = (label) => texts.findIndex((t) => t === label);
  const num = (t) => /^[\d,]+$/.test(t || "");
  const iTotal = at("Total Contributions");
  const iCur = at("Current Streak");
  const iLong = at("Longest Streak");
  if (iTotal < 1 || iCur < 0 || iLong < 1) throw new Error("streak labels not found");
  const total = texts[iTotal - 1];
  const totalRange = texts[iTotal + 1];
  const currentRange = texts[iCur + 1];
  const current = texts[iCur + 2];
  const longest = texts[iLong - 1];
  const longestRange = texts[iLong + 1];
  if (!num(total) || !num(current) || !num(longest)) throw new Error("streak values not numeric");
  return { total, totalRange, current, currentRange, longest, longestRange };
}

function row(y, icon, label, value, colors) {
  return `  <g transform="translate(0 ${y})">
    ${icon}
    <text x="56" y="5" fill="${colors.rowLabel}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="12.5">${label}</text>
    <path d="M185 1H350" stroke="${colors.leader}" stroke-width="0.75" stroke-dasharray="2 4" />
    <text x="408" y="5" text-anchor="end" fill="${colors.numeral}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="16">${value}</text>
  </g>`;
}

function statCard({ stats, streak, theme = "light" }) {
  const isLight = theme === "light";
  const colors = isLight
    ? {
        bg: "#F4F1EA",
        bgOverlay: "rgba(0, 0, 0, 0.015)",
        borderOuter: "#D5CFC2",
        borderInner: "#E6E0D4",
        rule: "#D5CFC2",
        ruleMuted: "#E6E0D4",
        folio: "#847E74",
        rowLabel: "#5C5850",
        numeral: "#111215",
        leader: "#D5CFC2",
        iconStroke: "#111215",
        subNote: "#666158",
      }
    : {
        bg: "#111215",
        bgOverlay: "rgba(255, 255, 255, 0.012)",
        borderOuter: "#25262D",
        borderInner: "#1A1B20",
        rule: "#25262D",
        ruleMuted: "#1F2026",
        folio: "#7E7A72",
        rowLabel: "#A8A398",
        numeral: "#F4F0E8",
        leader: "#25262D",
        iconStroke: "#DDD8CE",
        subNote: "#7E7A72",
      };

  const star = `<path d="M36-6 37.5-2.2 41.5-2 38.3 0.6 39.5 4.6 36 2.2 32.5 4.6 33.7 0.6 30.5-2 34.5-2.2Z" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1" stroke-linejoin="round"/>`;
  const commit = `<circle cx="36" cy="0" r="3.2" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1"/><path d="M28 0h4.8M40 0h4.8" stroke="${colors.iconStroke}" stroke-width="1.1" stroke-linecap="round"/>`;
  const pr = `<g fill="none" stroke="${colors.iconStroke}" stroke-width="1.1"><circle cx="33" cy="-4" r="2"/><circle cx="33" cy="4" r="2"/><circle cx="39" cy="-4" r="2"/><path d="M33-2V2M39-2C39 0.8 33 0 33 2"/></g>`;
  const issue = `<circle cx="36" cy="0" r="4.6" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1"/><circle cx="36" cy="0" r="1.1" fill="${colors.iconStroke}"/>`;
  const repo = `<path d="M31-4H35L37-2H41V4H31Z" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1" stroke-linejoin="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="200" viewBox="0 0 880 200" role="img" aria-labelledby="title desc">
  <title id="title">GitHub activity for ${USER}</title>
  <desc id="desc">Stars ${stats.stars}, commits ${stats.commits}, pull requests ${stats.prs}, issues ${stats.issues}, public repos ${stats.repos}. Total contributions ${streak.total}, current streak ${streak.current}, longest streak ${streak.longest}.</desc>

  <defs>
    <clipPath id="frame"><rect width="880" height="200" rx="3" /></clipPath>
  </defs>

  <!-- Physical Newsprint Surface -->
  <g clip-path="url(#frame)">
    <rect width="880" height="200" fill="${colors.bg}" />
    <rect width="880" height="200" fill="${colors.bgOverlay}" />
  </g>

  <!-- Broadsheet Hairline Borders -->
  <rect x="0.5" y="0.5" width="879" height="199" rx="2.5" fill="none" stroke="${colors.borderOuter}" stroke-width="1" />
  <rect x="4" y="4" width="872" height="192" rx="1.5" fill="none" stroke="${colors.borderInner}" stroke-width="0.75" />

  <!-- Integrated Broadsheet Folio Line -->
  <text x="24" y="24" fill="${colors.folio}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="9.5" letter-spacing="1.5">PUBLIC RECORD</text>
  <text x="440" y="24" text-anchor="middle" fill="${colors.folio}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="9.5" letter-spacing="2">ACTIVITY INDEX &amp; CONTRIBUTION LEDGER</text>
  <text x="856" y="24" text-anchor="end" fill="${colors.folio}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="9.5" letter-spacing="1.5">SOURCE: GITHUB API</text>

  <!-- Top Hairline Rule -->
  <path d="M20 32H860" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Left Column: Metrics Ledger -->
${row(56, star, "Total Stars", fmt(stats.stars), colors)}
${row(84, commit, "Total Commits", fmt(stats.commits), colors)}
${row(112, pr, "Pull Requests", fmt(stats.prs), colors)}
${row(140, issue, "Issues Filed", fmt(stats.issues), colors)}
${row(168, repo, "Public Repositories", fmt(stats.repos), colors)}

  <!-- Vertical Broadside Divider -->
  <path d="M435 44V182" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Right Column: Contribution Ledger -->
  <!-- Column Sub-Dividers -->
  <path d="M578 52V174" stroke="${colors.ruleMuted}" stroke-width="0.5" />
  <path d="M720 52V174" stroke="${colors.ruleMuted}" stroke-width="0.5" />

  <g text-anchor="middle">
    <!-- Total Contributions -->
    <text x="506" y="102" fill="${colors.numeral}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="34" font-weight="300">${streak.total}</text>
    <text x="506" y="128" fill="${colors.folio}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="9.5" letter-spacing="1.5">TOTAL</text>
    <text x="506" y="148" fill="${colors.subNote}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="11">All-Time</text>

    <!-- Current Streak -->
    <text x="649" y="102" fill="${colors.numeral}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="34" font-weight="300">${streak.current}</text>
    <text x="649" y="128" fill="${colors.folio}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="9.5" letter-spacing="1.5">CURRENT</text>
    <text x="649" y="148" fill="${colors.subNote}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="11">${streak.current === "1" ? "1 Day" : streak.current + " Days"}</text>

    <!-- Longest Streak -->
    <text x="790" y="102" fill="${colors.numeral}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="34" font-weight="300">${streak.longest}</text>
    <text x="790" y="128" fill="${colors.folio}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="9.5" letter-spacing="1.5">LONGEST</text>
    <text x="790" y="148" fill="${colors.subNote}" font-family="Palatino Linotype, Book Antiqua, Georgia, serif" font-size="11">${streak.longest === "1" ? "1 Day" : streak.longest + " Days"}</text>
  </g>

  <!-- Bottom Hairline Rule -->
  <path d="M20 188H860" stroke="${colors.rule}" stroke-width="0.75" />
</svg>
`;
}

const stats = await getStats();
const streak = await getStreak();
await mkdir(dirname(OUT), { recursive: true });

// Primary default output: Light newsprint broadsheet card
await writeFile(OUT, statCard({ stats, streak, theme: "light" }));
console.log(`wrote primary light card: ${OUT}`);

// Also write dark companion if needed
const outDark = OUT.endsWith(".svg") ? OUT.slice(0, -4) + "-dark.svg" : OUT + "-dark.svg";
await writeFile(outDark, statCard({ stats, streak, theme: "dark" }));
console.log(`wrote dark companion: ${outDark}`);

console.log(JSON.stringify({ stats, streak }, null, 2));
