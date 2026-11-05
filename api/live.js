// Live football results from multiple sources — MongoDB version
const { DB } = require('./_lib');
const iso = (d) => d.toISOString().slice(0, 10);
const get = async (u, h) => { const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(7000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const LEAGUES = ['tur.1','tur.2','cze.1','bel.1','ned.1','ned.2','por.1','fra.1','fra.2','ger.1','ger.2','ita.1','ita.2','esp.1','esp.2','eng.1','eng.2','eng.3','aut.1','den.1','gre.1','nor.1','pol.1','rou.1','sco.1','srb.1','swe.1','sui.1','irn.1'];

const espnEv = (e) => {
  const comp = e.competitions[0], c = comp.competitors, H = c.find((x) => x.homeAway == 'home'), A = c.find((x) => x.homeAway == 'away'), S = e.status;
  const nm0 = S.type.name || '', bad = /POSTPON|CANCEL|ABANDON|FORFEIT/i.test(nm0) || (S.type.state == 'post' && S.type.completed === false), ext = !bad && (S.period > 2 || /AET|PEN|EXTRA/i.test(nm0));
  const reg = (x) => (x.linescores || []).slice(0, 2).reduce((p, y) => p + (+y.value || 0), 0);
  const use = ext && (H.linescores || []).length >= 2;
  const goals = (comp.details || []).filter((d) => d.scoringPlay).map((d) => ({ m: (d.clock && d.clock.displayValue) || '', n: (d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].displayName) || '', f: d.ownGoal ? 'OG' : d.penaltyKick ? 'P' : '' }));
  return { home: H.team.displayName, away: A.team.displayName, t: e.date, st: bad ? 'pre' : S.type.state, h: use ? reg(H) : +H.score || 0, a: use ? reg(A) : +A.score || 0, clk: bad ? nm0.replace('STATUS_', '') : S.type.shortDetail, pp: bad ? 1 : 0, min: parseInt(S.displayClock) || 0, over: ext ? 1 : 0, aet: ext && S.type.state == 'post' ? 1 : 0, w: H.winner ? 1 : A.winner ? 2 : 0, goals };
};

module.exports = async (q, s) => {
  const days = [-1, 0, 1, 2].map((n) => new Date(Date.now() + n * 864e5));
  const rng = iso(days[0]).replace(/-/g, '') + '-' + iso(days[3]).replace(/-/g, '');
  const B = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';

  const src = {
    espn: async () => {
      const jobs = [...days.map((d) => get(B + 'all/scoreboard?limit=1000&dates=' + iso(d).replace(/-/g, ''))), ...LEAGUES.map((l) => get(B + l + '/scoreboard?limit=300&dates=' + rng).then((j) => ({ ...j, _lg: (j.leagues && j.leagues[0] && j.leagues[0].name) || '' })).catch(() => null))];
      const out = new Map();
      (await Promise.allSettled(jobs)).forEach((r) => { if (r.status == 'fulfilled' && r.value) (r.value.events || []).forEach((e) => { try { const v = espnEv(e); v.lg = r.value._lg || ''; out.set(v.home + '|' + v.away + '|' + v.t, v); } catch (x) {} }); });
      if (!out.size) throw new Error('بدون نتیجه');
      return [...out.values()];
    },
    sofa: async () => {
      const H = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };
      const js = await Promise.all(days.map((d) => get('https://api.sofascore.com/api/v1/sport/football/scheduled-events/' + iso(d), H)));
      return js.flatMap((j) => (j.events || []).map((e) => {
        const T = e.status.type, cp = e.time && e.time.currentPeriodStartTimestamp, hs = e.homeScore || {}, as = e.awayScore || {}, nt = hs.normaltime != null;
        return { home: e.homeTeam.name, away: e.awayTeam.name, t: new Date(e.startTimestamp * 1000).toISOString(), st: T == 'finished' ? 'post' : T == 'inprogress' ? 'in' : 'pre', h: (nt ? hs.normaltime : hs.current) || 0, a: (nt ? as.normaltime : as.current) || 0, clk: e.status.description || '', min: T == 'inprogress' && cp ? Math.floor((Date.now() / 1000 - cp) / 60) + (e.status.code == 7 ? 45 : 0) : 0, over: nt ? 1 : 0, aet: nt && T == 'finished' ? 1 : 0, w: e.winnerCode == 1 ? 1 : e.winnerCode == 2 ? 2 : 0, lg: (e.tournament && e.tournament.name) || '' };
      }));
    },
    fd: async () => {
      if (!process.env.FOOTBALL_DATA_KEY) throw new Error('بدون کلید');
      const j = await get(`https://api.football-data.org/v4/matches?dateFrom=${iso(days[0])}&dateTo=${iso(days[3])}`, { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY });
      return j.matches.map((m) => { const sc = m.score || {}, rt = sc.regularTime, x = sc.duration && sc.duration != 'REGULAR'; return { home: m.homeTeam.name, away: m.awayTeam.name, t: m.utcDate, st: m.status == 'FINISHED' ? 'post' : ['IN_PLAY', 'PAUSED'].includes(m.status) ? 'in' : 'pre', h: (rt ? rt.home : sc.fullTime.home) ?? 0, a: (rt ? rt.away : sc.fullTime.away) ?? 0, clk: m.status == 'PAUSED' ? 'HT' : '', min: 0, over: x ? 1 : 0, aet: x && m.status == 'FINISHED' ? 1 : 0, w: sc.winner == 'HOME_TEAM' ? 1 : sc.winner == 'AWAY_TEAM' ? 2 : 0, lg: (m.competition && m.competition.name) || '' }; });
    },
    apif: async () => {
      const key = process.env.APIFOOTBALL_KEY;
      if (!key) throw new Error('بدون کلید');
      if (!q.query || q.query.apif !== '1') return [];
      // Use MongoDB for caching instead of Redis
      const cached = await DB.Match.find({ source: 'apif', updatedAt: { $gte: Date.now() - (+process.env.APIF_CACHE_SEC || 600) * 1000 } }).lean();
      if (cached.length) return cached.map(m => ({ home: m.home, away: m.away, t: m.startTime, st: m.status, h: m.score.home, a: m.score.away, clk: m.clk || '', min: m.minute, over: m.over, aet: m.aet, w: m.winner, lg: m.league }));
      const js = await Promise.all([days[0], days[1]].map((d) => get('https://v3.football.api-sports.io/fixtures?date=' + iso(d), { 'x-apisports-key': key })));
      js.forEach((j) => { const er = j.errors; if (er && Object.keys(er).length) throw new Error(Object.values(er)[0]); });
      const out = js.flatMap((j) => (j.response || []).map((f) => {
        const S = f.fixture.status.short, x = ['AET', 'PEN', 'ET', 'BT', 'P'].includes(S), ft = f.score && f.score.fulltime;
        return { home: f.teams.home.name, away: f.teams.away.name, t: f.fixture.date, st: ['FT', 'AET', 'PEN'].includes(S) ? 'post' : ['NS', 'TBD', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(S) ? 'pre' : 'in', h: (x && ft && ft.home != null ? ft.home : f.goals.home) ?? 0, a: (x && ft && ft.away != null ? ft.away : f.goals.away) ?? 0, clk: S, min: f.fixture.status.elapsed || 0, over: x ? 1 : 0, aet: ['AET', 'PEN'].includes(S) ? 1 : 0, w: f.teams.home.winner ? 1 : f.teams.away.winner ? 2 : 0, lg: (f.league && f.league.name) || '', source: 'apif' };
      }));
      // Store in MongoDB
      if (out.length) await DB.upsertMatches(out);
      return out;
    },
    tsdb: async () => (await Promise.all(days.map((d) => get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php?s=Soccer&d=' + iso(d))))).flatMap((j) => (j.events || []).map((e) => {
      const S = e.strStatus || '';
      return { home: e.strHomeTeam, away: e.strAwayTeam, t: e.strTimestamp ? e.strTimestamp.replace(/Z?$/, 'Z') : null, st: /^(FT|AET|PEN|Match Finished)/i.test(S) ? 'post' : (!S || /^(NS|TBD)|not started|postpon|cancel|abandon|susp/i.test(S)) ? 'pre' : 'in', h: +e.intHomeScore || 0, a: +e.intAwayScore || 0, clk: S, min: 0 };
    })),
  };

  const names = Object.keys(src), res = await Promise.allSettled(names.map((n) => src[n]()));
  const events = [], sources = [];
  res.forEach((r, i) => {
    const ok = r.status == 'fulfilled';
    sources.push({ n: names[i], ok, c: ok ? r.value.length : 0, e: ok ? '' : String(r.reason.message) });
    if (ok) r.value.forEach((e) => events.push({ ...e, s: names[i], p: i }));
  });

  if (q.query && q.query.q) {
    const k = String(q.query.q).toLowerCase();
    return s.json({ sources, found: events.filter((e) => (e.home + ' ' + e.away).toLowerCase().includes(k)).map(({ goals, ...e }) => e) });
  }
  s.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  s.json({ events, sources, at: Date.now() });
};