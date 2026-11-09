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
          totalRange: "All-Time",
          current: mCur[1],
          currentRange: "Recent",
          longest: mLong[1],
          longestRange: "Historical",
        };
      }
    } catch {}
    throw err;
  }
}

function row(y, icon, label, value, colors) {
  return `  <g transform="translate(0 ${y})">
    ${icon}
    <text x="56" y="5" fill="${colors.rowLabel}" font-family="${FONT_SERIF}" font-size="12.5">${label}</text>
    <path d="M195 1H355" stroke="${colors.leader}" stroke-width="0.75" stroke-dasharray="2 4" />
    <text x="408" y="5" text-anchor="end" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="16">${value}</text>
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
        ruleMuted: "#E6E0D4",
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
        borderOuter: "#25262D",
        borderInner: "#1A1B20",
        rule: "#25262D",
        ruleThick: "#DDD8CE",
        ruleMuted: "#1F2026",
        folio: "#7E7A72",
        rowLabel: "#A8A398",
        numeral: "#F4F0E8",
        leader: "#25262D",
        iconStroke: "#DDD8CE",
        subNote: "#7E7A72",
        masthead: "#F4F0E8",
        mottoEnglish: "#DDD8CE",
        mottoChinese: "#7E7A72",
      };

  const star = `<path d="M36-6 37.5-2.2 41.5-2 38.3 0.6 39.5 4.6 36 2.2 32.5 4.6 33.7 0.6 30.5-2 34.5-2.2Z" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1" stroke-linejoin="round"/>`;
  const commit = `<circle cx="36" cy="0" r="3.2" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1"/><path d="M28 0h4.8M40 0h4.8" stroke="${colors.iconStroke}" stroke-width="1.1" stroke-linecap="round"/>`;
  const pr = `<g fill="none" stroke="${colors.iconStroke}" stroke-width="1.1"><circle cx="33" cy="-4" r="2"/><circle cx="33" cy="4" r="2"/><circle cx="39" cy="-4" r="2"/><path d="M33-2V2M39-2C39 0.8 33 0 33 2"/></g>`;
  const issue = `<circle cx="36" cy="0" r="4.6" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1"/><circle cx="36" cy="0" r="1.1" fill="${colors.iconStroke}"/>`;
  const repo = `<path d="M31-4H35L37-2H41V4H31Z" fill="none" stroke="${colors.iconStroke}" stroke-width="1.1" stroke-linejoin="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="430" viewBox="0 0 880 430" role="img" aria-labelledby="title desc">
  <title id="title">Ling — The Broadsheet Dispatch</title>
  <desc id="desc">Build useful things. Stay curious. 保持好奇，构建所思。 Stars: ${stats.stars}, Commits: ${stats.commits}, PRs: ${stats.prs}, Issues: ${stats.issues}, Repos: ${stats.repos}. Total contributions: ${streak.total}, Current streak: ${streak.current}, Longest streak: ${streak.longest}. Correspondence: belloshehubz@gmail.com.</desc>

  <defs>
    <clipPath id="paperFrame">
      <rect width="880" height="430" rx="3" />
    </clipPath>
  </defs>

  <!-- Physical Newsprint Paper Surface (Warm Newsprint Cream) -->
  <g clip-path="url(#paperFrame)">
    <rect width="880" height="430" fill="${colors.bg}" />
    <rect width="880" height="430" fill="${colors.bgOverlay}" />
  </g>

  <!-- Broadsheet Outer & Inner Hairline Borders -->
  <rect x="0.5" y="0.5" width="879" height="429" rx="2.5" fill="none" stroke="${colors.borderOuter}" stroke-width="1" />
  <rect x="4.5" y="4.5" width="871" height="421" rx="1.5" fill="none" stroke="${colors.borderInner}" stroke-width="0.75" />

  <!-- SECTION 1: BROADSHEET FOLIO & MASTHEAD -->
  <text x="24" y="24" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="2">VOL. 2026 · ISSUE № 01</text>
  <text x="440" y="24" text-anchor="middle" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="2">AUTONOMOUS SYSTEMS &amp; INTERACTIVE TOOLS</text>
  <text x="856" y="24" text-anchor="end" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="2">GITHUB / ${USER}</text>

  <!-- Top Double Rules -->
  <path d="M20 33H860" stroke="${colors.ruleThick}" stroke-width="1" />
  <path d="M20 36H860" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Newspaper Masthead (Refined Thin Serif) -->
  <text x="448" y="104" text-anchor="middle" fill="${colors.masthead}" font-family="${FONT_SERIF}" font-size="74" font-weight="300" letter-spacing="16">LING</text>

  <!-- Masthead Bottom Double Rules -->
  <path d="M20 124H860" stroke="${colors.rule}" stroke-width="0.75" />
  <path d="M20 127H860" stroke="${colors.ruleThick}" stroke-width="1" />

  <!-- Editorial Motto & Songti SC Companion -->
  <g text-anchor="middle">
    <text x="440" y="153" fill="${colors.mottoEnglish}" font-family="${FONT_SERIF}" font-size="17" font-style="italic" letter-spacing="1">“Build useful things. Stay curious.”</text>
    <text x="440" y="175" fill="${colors.mottoChinese}" font-family="${FONT_CHINESE}" font-size="12" letter-spacing="3">保持好奇，构建所思。</text>
  </g>

  <!-- SECTION 2: TRANSITIONAL BROADSIDE RULE -->
  <path d="M20 195H860" stroke="${colors.ruleThick}" stroke-width="0.75" />
  <path d="M20 198H860" stroke="${colors.ruleMuted}" stroke-width="0.5" />

  <!-- SECTION 3: ACTIVITY INDEX & CONTRIBUTION LEDGER -->
  <text x="24" y="217" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="1.5">PUBLIC RECORD</text>
  <text x="440" y="217" text-anchor="middle" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="2">ACTIVITY INDEX &amp; CONTRIBUTION LEDGER</text>
  <text x="856" y="217" text-anchor="end" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="1.5">SOURCE: GITHUB API</text>

  <!-- Ledger Header Rule -->
  <path d="M20 226H860" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Left Column: Metrics Ledger -->
${row(249, star, "Total Stars", fmt(stats.stars), colors)}
${row(276, commit, "Total Commits", fmt(stats.commits), colors)}
${row(303, pr, "Pull Requests", fmt(stats.prs), colors)}
${row(330, issue, "Issues Filed", fmt(stats.issues), colors)}
${row(357, repo, "Public Repositories", fmt(stats.repos), colors)}

  <!-- Vertical Broadside Divider -->
  <path d="M435 236V368" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Right Column: Contribution Ledger Sub-Dividers -->
  <path d="M578 242V362" stroke="${colors.ruleMuted}" stroke-width="0.5" />
  <path d="M720 242V362" stroke="${colors.ruleMuted}" stroke-width="0.5" />

  <g text-anchor="middle">
    <!-- Total Contributions -->
    <text x="506" y="292" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="34" font-weight="300">${streak.total}</text>
    <text x="506" y="318" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="1.5">TOTAL</text>
    <text x="506" y="338" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="11">All-Time</text>

    <!-- Current Streak -->
    <text x="649" y="292" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="34" font-weight="300">${streak.current}</text>
    <text x="649" y="318" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="1.5">CURRENT</text>
    <text x="649" y="338" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="11">${streak.current === "1" ? "1 Day" : streak.current + " Days"}</text>

    <!-- Longest Streak -->
    <text x="790" y="292" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="34" font-weight="300">${streak.longest}</text>
    <text x="790" y="318" fill="${colors.folio}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="1.5">LONGEST</text>
    <text x="790" y="338" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="11">${streak.longest === "1" ? "1 Day" : streak.longest + " Days"}</text>
  </g>

  <!-- Ledger Bottom Rule -->
  <path d="M20 378H860" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- SECTION 4: INTEGRATED COLOPHON & CORRESPONDENCE STRIP -->
  <!-- Left Side: Correspondence Dispatch -->
  <g transform="translate(24, 395)" fill="none" stroke="${colors.subNote}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
    <rect width="14" height="10" rx="1.5"/>
    <path d="M1.5 2l5.5 4 5.5-4"/>
  </g>
  <text x="46" y="404" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="1.5">CORRESPONDENCE</text>
  <path d="M182 394v13" stroke="${colors.ruleMuted}" stroke-width="0.75" />
  <text x="196" y="404" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="11.5" letter-spacing="0.4">belloshehubz@gmail.com</text>

  <!-- Center Colophon Divider -->
  <path d="M435 391V413" stroke="${colors.rule}" stroke-width="0.75" />

  <!-- Right Side: Sentry Attribution & Patron Colophon -->
  <g transform="translate(454, 393) scale(0.7)">
    <path fill="${colors.numeral}" d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z"/>
  </g>
  <text x="478" y="404" fill="${colors.numeral}" font-family="${FONT_SERIF}" font-size="11" letter-spacing="1.5">SENTRY</text>
  <path d="M542 394v13" stroke="${colors.ruleMuted}" stroke-width="0.75" />
  <text x="556" y="404" fill="${colors.subNote}" font-family="${FONT_SERIF}" font-size="9.5" letter-spacing="1">COLOPHON · SUPPORTED BY PATRONS</text>
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

if (OUT_FILE) {
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, lightSvg);
  console.log(`wrote custom OUT_FILE: ${OUT_FILE}`);
}

console.log(JSON.stringify({ stats, streak }, null, 2));
