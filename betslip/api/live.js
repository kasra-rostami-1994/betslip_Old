// نتایج را هم‌زمان از چند منبع می‌گیرد و یکدست می‌کند؛ تطبیق و رأی‌گیری در کلاینت انجام می‌شود.
const iso = (d) => d.toISOString().slice(0, 10);
const get = async (u, h) => { const r = await fetch(u, { headers: h }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
module.exports = async (q, s) => {
  const days = [-1, 0, 1, 2].map((n) => new Date(Date.now() + n * 864e5));
  const src = {
    espn: async () => (await Promise.all(days.map((d) => get('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?limit=1000&dates=' + iso(d).replace(/-/g, ''))))).flatMap((j) => (j.events || []).map((e) => {
      const c = e.competitions[0].competitors, H = c.find((x) => x.homeAway == 'home'), A = c.find((x) => x.homeAway == 'away');
      return { home: H.team.displayName, away: A.team.displayName, t: e.date, st: e.status.type.state, h: +H.score || 0, a: +A.score || 0, clk: e.status.type.shortDetail, min: parseInt(e.status.displayClock) || 0 };
    })),
    fd: async () => { // اختیاری: football-data.org (کلید رایگان)
      if (!process.env.FOOTBALL_DATA_KEY) throw new Error('بدون کلید');
      const j = await get(`https://api.football-data.org/v4/matches?dateFrom=${iso(days[0])}&dateTo=${iso(days[3])}`, { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY });
      return j.matches.map((m) => ({ home: m.homeTeam.name, away: m.awayTeam.name, t: m.utcDate, st: m.status == 'FINISHED' ? 'post' : ['IN_PLAY', 'PAUSED'].includes(m.status) ? 'in' : 'pre', h: m.score.fullTime.home ?? 0, a: m.score.fullTime.away ?? 0, clk: m.status == 'PAUSED' ? 'HT' : '', min: 0 }));
    },
    tsdb: async () => (await Promise.all(days.map((d) => get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php?s=Soccer&d=' + iso(d))))).flatMap((j) => (j.events || []).map((e) => {
      const S = e.strStatus || '';
      return { home: e.strHomeTeam, away: e.strAwayTeam, t: e.strTimestamp ? e.strTimestamp.replace(/Z?$/, 'Z') : null, st: /^(FT|AET|PEN|Match Finished)/i.test(S) ? 'post' : (!S || /^(NS|Not Started|Postponed)/i.test(S)) ? 'pre' : 'in', h: +e.intHomeScore || 0, a: +e.intAwayScore || 0, clk: S, min: 0 };
    })),
  };
  const names = Object.keys(src);
  const res = await Promise.allSettled(names.map((n) => src[n]()));
  const events = [], sources = [];
  res.forEach((r, i) => {
    const ok = r.status == 'fulfilled';
    sources.push({ n: names[i], ok, c: ok ? r.value.length : 0, e: ok ? '' : String(r.reason.message) });
    if (ok) r.value.forEach((e) => events.push({ ...e, s: names[i], p: i }));
  });
  s.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  s.json({ events, sources, at: Date.now() });
};
