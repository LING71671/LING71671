// Generates assets for the profile "Activity" section as a single authored SVG
// panel in the Signal Workbench design system. Data: GitHub REST (stars,
// commits, PRs, issues, repos) + streak figures parsed from the public
// streak-stats SVG (same numbers the profile already shows).
// Usage: node .github/scripts/build-activity-card.mjs  (writes dist/activity-card.svg)

import { mkdir, writeFile } from "node:fs/promises";

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

function row(y, icon, label, value) {
  return `  <g transform="translate(0 ${y})">
    ${icon}
    <text x="68" y="5" fill="#B9C4BF" font-family="Segoe UI, 'Microsoft YaHei', Arial, sans-serif" font-size="15">${label}</text>
    <text x="404" y="5" text-anchor="end" fill="#FFF4E6" font-family="Trebuchet MS, Arial, sans-serif" font-size="18" font-weight="700">${value}</text>
  </g>`;
}

function statCard({ stats, streak }) {
  const star = `<path d="M40-7 41.8-2.4 46.7-2.2 42.7 0.9 44.2 5.8 40 2.8 35.8 5.8 37.3 0.9 33.3-2.2 38.2-2.4Z" fill="none" stroke="#F4C95D" stroke-width="1.8" stroke-linejoin="round"/>`;
  const commit = `<circle cx="40" cy="0" r="3.4" fill="none" stroke="#4FC1A8" stroke-width="1.8"/><path d="M31 0h5.6M43.4 0H49" stroke="#4FC1A8" stroke-width="1.8" stroke-linecap="round"/>`;
  const pr = `<g fill="none" stroke="#FF8A4C" stroke-width="1.8"><circle cx="36.5" cy="-4.5" r="2.2"/><circle cx="36.5" cy="4.5" r="2.2"/><circle cx="43.5" cy="-4.5" r="2.2"/><path d="M36.5-2.3V2.3M43.5-2.3C43.5 1 36.5 0 36.5 2.3"/></g>`;
  const issue = `<circle cx="40" cy="0" r="5.4" fill="none" stroke="#FFF4E6" stroke-width="1.8"/><circle cx="40" cy="0" r="1.3" fill="#FFF4E6"/>`;
  const repo = `<path d="M34-4H39L41-2H46V5H34Z" fill="none" stroke="#B9C4BF" stroke-width="1.8" stroke-linejoin="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="200" viewBox="0 0 880 200" role="img" aria-labelledby="title desc">
  <title id="title">GitHub activity for ${USER}</title>
  <desc id="desc">Stars ${stats.stars}, commits ${stats.commits}, pull requests ${stats.prs}, issues ${stats.issues}, public repos ${stats.repos}. Total contributions ${streak.total} (${streak.totalRange}), current streak ${streak.current} (${streak.currentRange}), longest streak ${streak.longest} (${streak.longestRange}).</desc>

  <defs>
    <clipPath id="frame"><rect width="880" height="200" rx="16" /></clipPath>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="880" height="200" fill="#111416" />
    <path d="M772 0H880V200H826Z" fill="#17302B" />
    <circle cx="866" cy="14" r="30" fill="#F4C95D" />
    <circle cx="866" cy="14" r="40" fill="none" stroke="#F4C95D" stroke-width="1.5" stroke-opacity="0.4" />
  </g>

  <rect x="1" y="1" width="878" height="198" rx="15" fill="none" stroke="#5E4638" stroke-width="2" />

${row(38, star, "Total Stars", fmt(stats.stars))}
${row(70, commit, "Total Commits", fmt(stats.commits))}
${row(102, pr, "Pull Requests", fmt(stats.prs))}
${row(134, issue, "Issues", fmt(stats.issues))}
${row(166, repo, "Public Repos", fmt(stats.repos))}

  <path d="M440 28V172" stroke="#5E4638" stroke-width="2" />

  <g text-anchor="middle">
    <text x="536" y="94" fill="#FFF4E6" font-family="Trebuchet MS, Arial, sans-serif" font-size="30" font-weight="800">${streak.total}</text>
    <text x="536" y="126" fill="#B9C4BF" font-family="Segoe UI, 'Microsoft YaHei', Arial, sans-serif" font-size="14">Total / 总计</text>
    <text x="536" y="152" fill="#87948F" font-family="Segoe UI, Arial, sans-serif" font-size="12">${streak.totalRange}</text>

    <circle cx="664" cy="84" r="37" fill="none" stroke="#F4C95D" stroke-width="3" />
    <text x="664" y="95" fill="#FF8A4C" font-family="Trebuchet MS, Arial, sans-serif" font-size="30" font-weight="800">${streak.current}</text>
    <text x="664" y="140" fill="#B9C4BF" font-family="Segoe UI, 'Microsoft YaHei', Arial, sans-serif" font-size="14">Current / 当前</text>
    <text x="664" y="164" fill="#87948F" font-family="Segoe UI, Arial, sans-serif" font-size="12">${streak.currentRange}</text>

    <text x="790" y="94" fill="#FFF4E6" font-family="Trebuchet MS, Arial, sans-serif" font-size="30" font-weight="800">${streak.longest}</text>
    <text x="790" y="126" fill="#B9C4BF" font-family="Segoe UI, 'Microsoft YaHei', Arial, sans-serif" font-size="14">Longest / 最长</text>
    <text x="790" y="152" fill="#87948F" font-family="Segoe UI, Arial, sans-serif" font-size="12">${streak.longestRange}</text>
  </g>
</svg>
`;
}

const stats = await getStats();
const streak = await getStreak();
await mkdir("dist", { recursive: true });
await writeFile(OUT, statCard({ stats, streak }));
console.log(`wrote ${OUT}`);
console.log(JSON.stringify({ stats, streak }, null, 2));
