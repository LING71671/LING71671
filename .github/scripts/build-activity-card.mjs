// Generates the unified Newspaper Broadsheet for Ling's GitHub Profile.
// Consolidates Masthead, Editorial Motto, Activity Index Ledger, and
// Colophon / Correspondence strip into ONE continuous, authentic newsprint page.
// Usage: node .github/scripts/build-activity-card.mjs

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";

const USER = process.env.STATS_USER || "LING71671";
const TOKEN = process.env.GITHUB_TOKEN || "";
const OUT_FILE = process.env.OUT_FILE || "";

const FONT_SERIF = "Palatino Linotype, Book Antiqua, Didot, Georgia, serif";
const FONT_CHINESE = "SimSun, Songti SC, Source Han Serif SC, Noto Serif SC, Microsoft YaHei, serif";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ling-profile-broadsheet",
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
  try {
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
  } catch (err) {
    console.warn(`Warning: GitHub API error (${err.message}). Attempting fallback from assets/profile.svg...`);
    try {
      const existing = await readFile("assets/profile.svg", "utf8");
      const m = existing.match(/Stars:\s*(\d+),\s*Commits:\s*(\d+),\s*PRs:\s*(\d+),\s*Issues:\s*(\d+),\s*Repos:\s*(\d+)/);
      if (m) {
        return {
          stars: Number(m[1]),
          commits: Number(m[2]),
          prs: Number(m[3]),
          issues: Number(m[4]),
          repos: Number(m[5]),
        };
      }
    } catch {}
    throw err;
  }
}

const clean = (s) => String(s).replace(/[<>&"']/g, "").trim();

async function getStreak() {
  try {
    const res = await fetch(`https://streak-stats.demolab.com?user=${USER}`, { signal: AbortSignal.timeout(8000) });
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
    const totalRange = texts[iTotal + 1] || "";
    const currentRange = texts[iCur + 1] || "";
    const current = texts[iCur + 2];
    const longest = texts[iLong - 1];
    const longestRange = texts[iLong + 1] || "";
    if (!num(total) || !num(current) || !num(longest)) throw new Error("streak values not numeric");
    return { total, totalRange, current, currentRange, longest, longestRange };
  } catch (err) {
    console.warn(`Warning: failed to fetch streak (${err.message}). Attempting fallback from assets/profile.svg...`);
    try {
      const existing = await readFile("assets/profile.svg", "utf8");
      const mTotal = existing.match(/Total contributions:\s*([\d,]+)/);
      const mCur = existing.match(/Current streak:\s*([\d,]+)/);
      const mLong = existing.match(/Longest streak:\s*([\d,]+)/);
      if (mTotal && mCur && mLong) {
        return {
          total: mTotal[1],
          totalRange: "All-Time Record",
          current: mCur[1],
          currentRange: "Recent Period",
          longest: mLong[1],
          longestRange: "Historical Record",
        };
      }
    } catch {}
    throw err;
  }
}

function row(y, icon, label, value, colors) {
  return `  <g transform="translate(0 ${y})">
    ${icon}
    <text x="76" y="8" fill="${colors.rowLabel}" font-family="${FONT_SERIF}" font-size="17" letter-spacing="0.5">${label}</text>
    <path d="M252 1H348" stroke="${colors.leader}" stroke-width="0.75" stroke-dasharray="2 4" />
    <text x="408" y="8" text-anchor="end" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="28" font-weight="300">${value}</text>
  </g>`;
}

function broadsheetSvg({ stats, streak, theme = "light" }) {
  const isLight = theme === "light";
  const colors = isLight
    ? {
        bg: "#F4F1EA",
        bgOverlay: "rgba(0, 0, 0, 0.015)",
        borderOuter: "#D5CFC2",
        borderInner: "#E6E0D4",
        rule: "#D5CFC2",
        ruleThick: "#16171A",
        ruleMuted: "#DDD8CE",
        folio: "#847E74",
        rowLabel: "#5C5850",
        numeral: "#111215",
        leader: "#D5CFC2",
        iconStroke: "#111215",
        subNote: "#666158",
        masthead: "#111215",
        mottoEnglish: "#1A1B1F",
        mottoChinese: "#666158",
      }
    : {
        bg: "#111215",
        bgOverlay: "rgba(255, 255, 255, 0.012)",
        borderOuter: "#2A2B33",
        borderInner: "#1C1D24",
        rule: "#2A2B33",
        ruleThick: "#DDD8CE",
        ruleMuted: "#23242C",
        folio: "#8E8980",
        rowLabel: "#B0ABA0",
        numeral: "#F4F0E8",
        leader: "#2A2B33",
        iconStroke: "#DDD8CE",
        subNote: "#8E8980",
        masthead: "#F4F0E8",
        mottoEnglish: "#DDD8CE",
        mottoChinese: "#8E8980",
      };

  const star = `<path d="M40-5 41.8-1.5 45.8-1.2 42.8 1.5 43.8 5.5 40 3 36.2 5.5 37.2 1.5 34.2-1.2 38.2-1.5Z" fill="none" stroke="${colors.iconStroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const commit = `<circle cx="40" cy="1" r="3.8" fill="none" stroke="${colors.iconStroke}" stroke-width="1.2"/><path d="M30 1h6M44 1h6" stroke="${colors.iconStroke}" stroke-width="1.2" stroke-linecap="round"/>`;
  const pr = `<g fill="none" stroke="${colors.iconStroke}" stroke-width="1.2"><circle cx="36" cy="-3.5" r="2.4"/><circle cx="36" cy="5.5" r="2.4"/><circle cx="44" cy="-3.5" r="2.4"/><path d="M36-1.1V3.1M44-1.1C44 2.2 36 1.1 36 3.1"/></g>`;
  const issue = `<circle cx="40" cy="1" r="5.5" fill="none" stroke="${colors.iconStroke}" stroke-width="1.2"/><circle cx="40" cy="1" r="1.4" fill="${colors.iconStroke}"/>`;
  const repo = `<path d="M34-3.5H39L41.5-1H46V6H34Z" fill="none" stroke="${colors.iconStroke}" stroke-width="1.2" stroke-linejoin="round"/>`;

  const totalRange = (streak.totalRange || "All-Time Record").replace(/-/g, "–");
  const currentRange = (streak.currentRange || "Recent Period").replace(/-/g, "–");
  const longestRange = (streak.longestRange || "Historical Record").replace(/-/g, "–");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="960" viewBox="0 0 880 960" role="img" aria-labelledby="title desc">
  <title id="title">Ling — The Broadsheet Dispatch</title>
  <desc id="desc">Build useful things. Stay curious. 保持好奇，构建所思。 Stars: ${stats.stars}, Commits: ${stats.commits}, PRs: ${stats.prs}, Issues: ${stats.issues}, Repos: ${stats.repos}. Total contributions: ${streak.total}, Current streak: ${streak.current}, Longest streak: ${streak.longest}. Correspondence: belloshehubz@gmail.com.</desc>

  <defs>
    <clipPath id="paperFrame">
      <rect width="880" height="960" rx="3" />
    </clipPath>
  </defs>

  <!-- Physical Newsprint Paper Surface -->
  <g clip-path="url(#paperFrame)">
    <rect width="880" height="960" fill="${colors.bg}" />
    <rect width="880" height="960" fill="${colors.bgOverlay}" />
  </g>

  <!-- Broadsheet Outer & Inner Hairline Borders -->
  <rect x="0.5" y="0.5" width="879" height="959" rx="2.5" fill="none" stroke="${colors.borderOuter}" stroke-width="1" />
  <rect x="5.5" y="5.5" width="869" height="949" rx="1.5" fill="none" stroke="${colors.borderInner}" stroke-width="0.75" />

  <!-- SECTION 1: BROADSHEET FOLIO & MASTHEAD -->
  <text x="24" y="32" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="12.5" letter-spacing="2.5">VOL. 2026 · ISSUE № 01</text>
  <text x="440" y="32" text-anchor="middle" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="12.5" letter-spacing="2.5">AUTONOMOUS SYSTEMS &amp; INTERACTIVE TOOLS</text>
  <text x="856" y="32" text-anchor="end" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="12.5" letter-spacing="2.5">GITHUB / ${USER}</text>

  <!-- Top Double Rules -->
  <path d="M20 46H860" stroke="${colors.ruleThick}" stroke-width="1.2" />
  <path d="M20 50H860" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Newspaper Masthead (Stately Thin Serif, Height 118px) -->
  <text x="440" y="186" text-anchor="middle" fill="${colors.masthead}" font-family="${FONT_SERIF}" font-size="118" font-weight="300" letter-spacing="24">LING</text>

  <!-- Masthead Bottom Double Rules -->
  <path d="M20 224H860" stroke="${colors.rule}" stroke-width="0.75" />
  <path d="M20 228H860" stroke="${colors.ruleThick}" stroke-width="1.2" />

  <!-- Editorial Motto & Songti SC Companion -->
  <g text-anchor="middle">
    <text x="440" y="276" fill="${colors.mottoEnglish}" font-family="${FONT_SERIF}" font-size="26" font-style="italic" letter-spacing="1.5">“Build useful things. Stay curious.”</text>
    <text x="440" y="316" fill="${colors.mottoChinese}" font-family="${FONT_CHINESE}" font-size="17.5" letter-spacing="5">保持好奇，构建所思。</text>
  </g>

  <!-- SECTION 2: TRANSITIONAL BROADSIDE RULE -->
  <path d="M20 356H860" stroke="${colors.ruleThick}" stroke-width="1" />
  <path d="M20 360H860" stroke="${colors.ruleMuted}" stroke-width="0.5" />

  <!-- SECTION 3: ACTIVITY INDEX & CONTRIBUTION LEDGER -->
  <text x="24" y="390" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="12.5" letter-spacing="2">PUBLIC RECORD</text>
  <text x="440" y="390" text-anchor="middle" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="13" letter-spacing="2.5">ACTIVITY INDEX &amp; CONTRIBUTION LEDGER</text>
  <text x="856" y="390" text-anchor="end" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="12.5" letter-spacing="2">SOURCE: GITHUB API</text>

  <!-- Ledger Header Rule -->
  <path d="M20 406H860" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Left Column: Metrics Ledger (Pitch: 64px) -->
${row(464, star, "Total Stars", fmt(stats.stars), colors)}
${row(528, commit, "Total Commits", fmt(stats.commits), colors)}
${row(592, pr, "Pull Requests", fmt(stats.prs), colors)}
${row(656, issue, "Issues Filed", fmt(stats.issues), colors)}
${row(720, repo, "Public Repositories", fmt(stats.repos), colors)}

  <!-- Vertical Broadside Divider -->
  <path d="M435 422V794" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Right Column: Contribution Ledger (Hierarchical Editorial Layout) -->
  <!-- Top Hero: Total Contributions -->
  <g text-anchor="middle">
    <text x="648" y="520" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="66" font-weight="300">${streak.total}</text>
    <text x="648" y="554" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="13.5" letter-spacing="2.5">TOTAL CONTRIBUTIONS</text>
    <text x="648" y="580" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="13.5">${totalRange}</text>
  </g>

  <!-- Horizontal Sub-Divider in Right Column -->
  <path d="M460 626H836" stroke="${colors.ruleMuted}" stroke-width="0.75" />

  <!-- Vertical Sub-divider between Current and Longest Streaks -->
  <path d="M648 642V788" stroke="${colors.ruleMuted}" stroke-width="0.5" />

  <!-- Bottom Streaks: Current & Longest -->
  <g text-anchor="middle">
    <!-- Current Streak -->
    <text x="546" y="710" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="54" font-weight="300">${streak.current}</text>
    <text x="546" y="742" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="12.5" letter-spacing="2">CURRENT STREAK</text>
    <text x="546" y="766" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="13">${streak.current === "1" ? "1 Day" : streak.current + " Days"}</text>
    <text x="546" y="786" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="11.5">${currentRange}</text>

    <!-- Longest Streak -->
    <text x="750" y="710" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="54" font-weight="300">${streak.longest}</text>
    <text x="750" y="742" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="12.5" letter-spacing="2">LONGEST STREAK</text>
    <text x="750" y="766" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="13">${streak.longest === "1" ? "1 Day" : streak.longest + " Days"}</text>
    <text x="750" y="786" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="11.5">${longestRange}</text>
  </g>

  <!-- Ledger Bottom Double Rules -->
  <path d="M20 814H860" stroke="${colors.rule}" stroke-width="0.75" />
  <path d="M20 818H860" stroke="${colors.ruleThick}" stroke-width="1" />

  <!-- SECTION 4: INTEGRATED COLOPHON & CORRESPONDENCE STRIP -->
  <!-- Left Side: Correspondence Dispatch -->
  <g transform="translate(26, 876)" fill="none" stroke="${colors.subNote}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="20" height="14" rx="2"/>
    <path d="M2 3.5l8 5.5 8-5.5"/>
  </g>
  <text x="56" y="888" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="13" letter-spacing="2">CORRESPONDENCE</text>
  <path d="M224 874v18" stroke="${colors.rule}" stroke-width="0.75" />
  <text x="240" y="888" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="16">belloshehubz@gmail.com</text>

  <!-- Center Colophon Divider -->
  <path d="M435 868V904" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Right Side: Sentry Attribution & Patron Colophon -->
  <g transform="translate(456, 873) scale(0.95)">
    <path fill="${colors.numeral}" d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z"/>
  </g>
  <text x="490" y="888" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="14.5" letter-spacing="2">SENTRY</text>
  <path d="M574 874v18" stroke="${colors.rule}" stroke-width="0.75" />
  <text x="590" y="888" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="12" letter-spacing="1.5">COLOPHON · SUPPORTED BY PATRONS</text>
</svg>
`;
}

const stats = await getStats();
const streak = await getStreak();

// 1. Primary BroadSheet outputs for assets/
await mkdir("assets", { recursive: true });
const lightSvg = broadsheetSvg({ stats, streak, theme: "light" });
const darkSvg = broadsheetSvg({ stats, streak, theme: "dark" });

await writeFile("assets/profile.svg", lightSvg);
await writeFile("assets/profile-light.svg", lightSvg);
await writeFile("assets/profile-dark.svg", darkSvg);
console.log("wrote assets/profile.svg (unified light broadsheet)");
console.log("wrote assets/profile-dark.svg (unified dark broadsheet)");

// 2. Also write to dist/ for CI deployment to output branch
await mkdir("dist/stats", { recursive: true });
await writeFile("dist/stats/activity-card.svg", lightSvg);
await writeFile("dist/stats/activity-card-light.svg", lightSvg);
await writeFile("dist/stats/activity-card-dark.svg", darkSvg);
await writeFile("dist/profile.svg", lightSvg);
await writeFile("dist/profile-light.svg", lightSvg);
await writeFile("dist/profile-dark.svg", darkSvg);
await writeFile("dist/activity-card.svg", lightSvg);
await writeFile("dist/activity-card-light.svg", lightSvg);
await writeFile("dist/activity-card-dark.svg", darkSvg);

if (OUT_FILE) {
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, lightSvg);
  console.log(`wrote custom OUT_FILE: ${OUT_FILE}`);
}

console.log(JSON.stringify({ stats, streak }, null, 2));
