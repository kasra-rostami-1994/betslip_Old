// نتایج را هم‌زمان از چند منبع می‌گیرد و یکدست می‌کند؛ تطبیق و رأی‌گیری در کلاینت انجام می‌شود.
const { kv } = require('./_lib');
const iso = (d) => d.toISOString().slice(0, 10);
const get = async (u, h) => { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(7000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const LEAGUES = ['tur.1','tur.2','cze.1','bel.1','ned.1','ned.2','por.1','fra.1','fra.2','ger.1','ger.2','ita.1','ita.2','esp.1','esp.2','eng.1','eng.2','eng.3','aut.1','den.1','gre.1','nor.1','pol.1','rou.1','sco.1','srb.1','swe.1','sui.1','irn.1'];
const espnEv = (e) => {
  const c = e.competitions[0].competitors, H = c.find((x) => x.homeAway == 'home'), A = c.find((x) => x.homeAway == 'away');
  return { home: H.team.displayName, away: A.team.displayName, t: e.date, st: e.status.type.state, h: +H.score || 0, a: +A.score || 0, clk: e.status.type.shortDetail, min: parseInt(e.status.displayClock) || 0 };
};
module.exports = async (q, s) => {
  const days = [-1, 0, 1, 2].map((n) => new Date(Date.now() + n * 864e5));
  const rng = iso(days[0]).replace(/-/g, '') + '-' + iso(days[3]).replace(/-/g, '');
  const B = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  const src = {
    espn: async () => {
      const jobs = [...days.map((d) => get(B + 'all/scoreboard?limit=1000&dates=' + iso(d).replace(/-/g, ''))),
        ...LEAGUES.map((l) => get(B + l + '/scoreboard?limit=300&dates=' + rng).catch(() => null))];
      const out = new Map();
      (await Promise.allSettled(jobs)).forEach((r) => { if (r.status == 'fulfilled' && r.value) (r.value.events || []).forEach((e) => { try { const v = espnEv(e); out.set(v.home + '|' + v.away + '|' + v.t, v); } catch (x) {} }); });
      if (!out.size) throw new Error('بدون نتیجه');
      return [...out.values()];
    },
    sofa: async () => { // غیررسمی؛ ممکن است از سرور مسدود شود
      const H = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
      const js = await Promise.all(days.map((d) => get('https://api.sofascore.com/api/v1/sport/football/scheduled-events/' + iso(d), H)));
      return js.flatMap((j) => (j.events || []).map((e) => {
        const T = e.status.type, cp = e.time && e.time.currentPeriodStartTimestamp;
        return { home: e.homeTeam.name, away: e.awayTeam.name, t: new Date(e.startTimestamp * 1000).toISOString(), st: T == 'finished' ? 'post' : T == 'inprogress' ? 'in' : 'pre', h: (e.homeScore && e.homeScore.current) || 0, a: (e.awayScore && e.awayScore.current) || 0, clk: e.status.description || '', min: T == 'inprogress' && cp ? Math.floor((Date.now() / 1000 - cp) / 60) + (e.status.code == 7 ? 45 : 0) : 0 };
      }));
    },
    fd: async () => { // اختیاری: football-data.org (کلید رایگان)
      if (!process.env.FOOTBALL_DATA_KEY) throw new Error('بدون کلید');
      const j = await get(`https://api.football-data.org/v4/matches?dateFrom=${iso(days[0])}&dateTo=${iso(days[3])}`, { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY });
      return j.matches.map((m) => ({ home: m.homeTeam.name, away: m.awayTeam.name, t: m.utcDate, st: m.status == 'FINISHED' ? 'post' : ['IN_PLAY', 'PAUSED'].includes(m.status) ? 'in' : 'pre', h: m.score.fullTime.home ?? 0, a: m.score.fullTime.away ?? 0, clk: m.status == 'PAUSED' ? 'HT' : '', min: 0 }));
    },
    apif: async () => { // اختیاری: API-Football (پوشش گسترده). فقط وقتی کلاینت بازی پیدانشده دارد صدا زده می‌شود و در Redis کش می‌شود.
      const key = process.env.APIFOOTBALL_KEY;
      if (!key) throw new Error('بدون کلید');
      if (!q.query || q.query.apif !== '1') return [];
      const ck = 'betslip:apif';
      try { const c = await kv(['GET', ck]); if (c) return JSON.parse(c); } catch (x) {}
      const js = await Promise.all([days[0], days[1]].map((d) => get('https://v3.football.api-sports.io/fixtures?date=' + iso(d), { 'x-apisports-key': key })));
      js.forEach((j) => { const er = j.errors; if (er && Object.keys(er).length) throw new Error(Object.values(er)[0]); });
      const out = js.flatMap((j) => (j.response || []).map((f) => {
        const S = f.fixture.status.short;
        return { home: f.teams.home.name, away: f.teams.away.name, t: f.fixture.date, st: ['FT', 'AET', 'PEN'].includes(S) ? 'post' : ['NS', 'TBD', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(S) ? 'pre' : 'in', h: f.goals.home ?? 0, a: f.goals.away ?? 0, clk: S, min: f.fixture.status.elapsed || 0 };
      }));
      try { await kv(['SET', ck, JSON.stringify(out), 'EX', String(+process.env.APIF_CACHE_SEC || 600)]); } catch (x) {}
      return out;
    },
    tsdb: async () => (await Promise.all(days.map((d) => get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php?s=Soccer&d=' + iso(d))))).flatMap((j) => (j.events || []).map((e) => {
      const S = e.strStatus || '';
      return { home: e.strHomeTeam, away: e.strAwayTeam, t: e.strTimestamp ? e.strTimestamp.replace(/Z?$/, 'Z') : null, st: /^(FT|AET|PEN|Match Finished)/i.test(S) ? 'post' : (!S || /^(NS|Not Started|Postponed)/i.test(S)) ? 'pre' : 'in', h: +e.intHomeScore || 0, a: +e.intAwayScore || 0, clk: S, min: 0 };
    })),
  };
  const names = Object.keys(src);
  const res = await Promise.allSettled(names.map((n) => src[n]()));
  let events = [];
  const sources = [];
  res.forEach((r, i) => {
    const ok = r.status == 'fulfilled';
    sources.push({ n: names[i], ok, c: ok ? r.value.length : 0, e: ok ? '' : String(r.reason.message) });
    if (ok) r.value.forEach((e) => events.push({ ...e, s: names[i], p: i }));
  });
  // تشخیص: /api/live?q=pendik همهٔ بازی‌هایی را که اسمشان این متن را دارد نشان می‌دهد
  if (q.query && q.query.q) {
    const k = String(q.query.q).toLowerCase();
    return s.json({ sources, found: events.filter((e) => (e.home + ' ' + e.away).toLowerCase().includes(k)) });
  }
  s.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  s.json({ events, sources, at: Date.now() });
};
