/* Betslip core: منطق مشترک مرورگر و سرور (این فایل در api/_core.js و public/core.js یکسان است) */
(function (root, factory) { var m = factory(); if (typeof module !== 'undefined' && module.exports) module.exports = m; else root.Core = m; })(typeof self !== 'undefined' ? self : this, function () {
const fold=s=>s.toLowerCase().replace(/æ/g,'ae').replace(/[øö]/g,'o').replace(/ß/g,'ss').replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ');
const STOP=new Set('fc afc cf sc ac as fk sk bk if real club the city united cd rc ad us kaa krc rsc'.split(' '));
const AL=[['crvena zvezda','red star'],['inter milan','internazionale'],['athletic bilbao','athletic club'],['olympiacos','olympiakos'],['ofk belgrade','ofk beograd'],['heart of midlothian','hearts'],['prague','praha']];
const TC={};const tk=s=>TC[s]||(TC[s]=(f=>(f+' '+AL.filter(a=>f.includes(a[0])).map(a=>a[1]).join(' ')).split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)))(fold(s)));
const same=(a,b)=>{const x=tk(a),y=tk(b);return x.some(w=>y.some(v=>v==w||(w.length>4&&v.length>4&&w.slice(0,5)==v.slice(0,5))))};


const YB=/\b(u\d{2}|ii|iii|b|w|women|reserves?|youth|juniors?|academy)\b/;
const yb=n=>YB.test(fold(n));
const mt=(l,e)=>l.map?(e.home==l.map.h&&e.away==l.map.a):(same(l.home,e.home)&&same(l.away,e.away)&&yb(e.home)==yb(l.home)&&yb(e.away)==yb(l.away));

// ---------- ارزیابی پیش‌بینی ----------
// کد هر شرط: 1 2 X 1X X2 12 | O2.5 U2.5 HO1.5 AU0.5 | BY BN | T3 | S2-1 | AH1-1.5  ؛ ترکیب با & (مثل 1&O2.5)
const gr=d=>d>1e-9?'W':d<-1e-9?'L':'P';
const comb=a=>{const w=a.filter(x=>x=='W').length,l=a.filter(x=>x=='L').length;return w==a.length?'W':l==a.length?'L':w+l==0?'P':l?'HL':'HW'};
const subs=L=>(Math.abs(L)*4)%2==1?[L-.25,L+.25]:[L];
function chk(p,h,a){const g=h+a,d=h-a;let m;
 if(p=='1')return[d>0,1-d,0];if(p=='2')return[d<0,1+d,0];if(p=='X')return[d==0,Math.abs(d),0];
 if(p=='1X')return[d>=0,-d,0];if(p=='X2')return[d<=0,d,0];if(p=='12')return[d!=0,d?0:1,0];
 if(p=='BY')return[h>0&&a>0,(h==0)+(a==0),'up'];if(p=='BN')return[!(h>0&&a>0),0,'down'];
 if(m=p.match(/^([HA]?)([OU])([\d.]+)$/)){const v=m[1]=='H'?h:m[1]=='A'?a:g,S=subs(+m[3]),O=m[2]=='O',oc=comb(S.map(l=>gr(O?v-l:l-v)));
  return[oc=='W',O?Math.floor(Math.max(...S))+1-v:0,O?'up':'down',oc]}
 if(m=p.match(/^T(\d+)$/)){const N=+m[1];return[g==N,Math.abs(N-g),g>N?'down':0]}
 if(m=p.match(/^S(\d+)-(\d+)$/)){const x=+m[1],y=+m[2];return[h==x&&a==y,Math.max(0,x-h)+Math.max(0,y-a),h>x||a>y?'down':0]}
 if(m=p.match(/^AH([12])([+-][\d.]+)$/)){const S=subs(+m[2]),e=s=>(m[1]=='1'?d:-d)+s,oc=comb(S.map(s=>gr(e(s)))),em=Math.min(...S.map(e));
  return[oc=='W',em>0?0:Math.floor(-em)+1,0,oc]}
 return[false,9,0]}
function ev1(p,x){const Q=p[0]=='Q',fin=x.st=='post'||(x.over&&!Q);
 const r=Q?(x.st=='post'&&x.w?[x.w==(p=='Q1'?1:2),1,0]:chk(p=='Q1'?'1':'2',x.h,x.a)):chk(p,x.h,x.a),ok=r[0],need=r[1],mono=r[2],oc=r[3],rec=need<=1||need*25<=90-(x.min||0);
 if(oc){
  if(fin)return oc=='L'?['r',1]:['g',0];
  if(mono=='up')return oc=='W'?['g',0]:oc=='L'?[rec?'o':'r',0]:oc=='HW'?['b',0]:['o',0];
  if(mono=='down')return oc=='L'?['r',1]:oc=='W'?['b',0]:['o',0];
  return oc=='W'||oc=='HW'?['b',0]:oc=='L'?[rec?'o':'r',0]:['o',0]}
 if(fin)return ok?['g',0]:['r',1];
 if(mono=='up'&&ok)return['g',0];if(mono=='down'&&!ok)return['r',1];
 if(ok)return['b',0];
 return[rec?'o':'r',0]}
function ev(p,x){
 if(!x||x.st=='pre')return['n',0];
 const R=p.split('&').map(q=>ev1(q,x)),C=R.map(r=>r[0]);
 if(R.some(r=>r[1]))return['r',1];
 if(C.every(c=>c=='g'))return['g',0];
 if(C.every(c=>c=='g'||c=='b'))return['b',0];
 return[C.includes('r')?'r':'o',0]}
const pt1=(p,l)=>{let m;const H=l.home,A=l.away,F={1:'برد '+H,2:'برد '+A,X:'مساوی','1X':H+' یا مساوی',X2:'مساوی یا '+A,12:'بدون مساوی',BY:'هر دو تیم گل می‌زنند',BN:'حداقل یک تیم گل نمی‌زند',Q1:'صعود '+H+' (کل بازی)',Q2:'صعود '+A+' (کل بازی)'};
 if(F[p])return F[p];
 if(m=p.match(/^([HA]?)([OU])([\d.]+)$/))return(m[1]=='H'?'گل‌های '+H+' ':m[1]=='A'?'گل‌های '+A+' ':'مجموع گل ')+(m[2]=='O'?'بالای ':'زیر ')+m[3];
 if(m=p.match(/^T(\d+)$/))return'دقیقاً '+m[1]+' گل';
 if(m=p.match(/^S(\d+)-(\d+)$/))return'نتیجهٔ دقیق '+m[1]+'-'+m[2];
 if(m=p.match(/^AH([12])(.+)$/))return'هندیکپ '+(m[1]==1?H:A)+' ('+m[2]+')';return p};
const pickTxt=(p,l)=>p.split('&').map(q=>pt1(q,l)).join(' + ');


const OCL={HW:'نیم‌برد',P:'بازگشت وجه',HL:'نیم‌باخت'};
const lbl=(p,x)=>{if(!x||p.includes('&')||p[0]=='Q'||!(x.st=='post'||x.over))return'';const o=chk(p,x.h,x.a)[3];return OCL[o]?' · '+OCL[o]:''};
const fac=(l,x)=>{if(!x||l.pick.includes('&')||l.pick[0]=='Q'||!(x.st=='post'||x.over))return 1;const o=chk(l.pick,x.h,x.a)[3],O=+l.odds;return o=='HW'?(O+1)/2/O:o=='P'?1/O:o=='HL'?.5/O:1};

const SN = { espn: 'ESPN', sofa: 'Sofascore', fd: 'football-data', apif: 'API-Football', tsdb: 'TheSportsDB' };
const gk = (l) => fold(l.home) + '|' + fold(l.away);
// نتیجهٔ یک پا: ورود دستی > نتیجهٔ ذخیره‌شده > رأی‌گیری بین منابع زنده
function cons(l, LV, now) {
  now = now || Date.now();
  if (l.ov) return { h: l.ov.h, a: l.ov.a, w: l.ov.w, st: l.ov.f ? 'post' : 'in', min: l.ov.m || 45, man: 1, clk: l.ov.f ? 'پایان (دستی)' : 'زنده (دستی)' };
  if (l.fin && !(l.fin.t && new Date(l.fin.t) > now)) return { h: l.fin.h, a: l.fin.a, w: l.fin.w, st: 'post', t: l.fin.t ? new Date(l.fin.t) : null, clk: 'پایان', fin: 1, lg: l.fin.lg || l.lg };
  const H0 = (LV || []).filter((e) => mt(l, e));
  if (!H0.length) return null;
  const bs = {};
  H0.forEach((e) => { const d = Math.abs(new Date(e.t) - now) || 0; if (!bs[e.s] || d < bs[e.s].d) bs[e.s] = { e, d }; });
  const H = Object.values(bs).map((v) => v.e), g = {};
  H.forEach((e) => (g[e.h + '-' + e.a] = g[e.h + '-' + e.a] || []).push(e));
  const G = Object.values(g).sort((a, b) => b.length - a.length || a[0].p - b[0].p), r = G[0][0];
  const fut = r.st == 'post' && r.t && new Date(r.t) > now + 6e4;
  return { h: r.h, a: r.a, st: fut ? 'pre' : r.st, clk: r.pp ? 'تعویق/لغو' : r.clk, min: r.min, t: r.t ? new Date(r.t) : null, over: r.over, w: r.w, aet: r.aet, pp: r.pp, lg: r.lg || (H.find((e) => e.lg) || {}).lg || l.lg, goals: r.goals, ref: r.home + ' – ' + r.away,
    src: G.map((q) => [[...new Set(q.map((e) => SN[e.s] || e.s))].join('+'), q[0].h + '-' + q[0].a]), cf: G.length > 1 };
}
// وضعیت کامل یک بلیت (هم در سایت و هم در سرور/ربات یکسان)
function betState(b, LV, now) {
  now = now || Date.now();
  const L = b.legs.map((l) => { const x = cons(l, LV, now), r = ev(l.pick, x); return { l, x, c: r[0], d: r[1], fin: !!(x && (x.st == 'post' || x.over)) }; });
  const cnt = { g: 0, b: 0, o: 0, r: 0, n: 0 };
  let dead = 0, all = 1, wr = 0, near = 0, live = 0, wl = 0, pr = 1, fa = 1, s = 0, finLoss = 0;
  L.forEach((z) => {
    cnt[z.c]++;
    if (z.d) { dead = 1; if (z.fin) finLoss = 1; }
    if (z.c != 'g') { all = 0; pr /= z.l.odds; }
    const el = z.x && z.x.st == 'in' ? Math.min(1, (z.x.over ? 90 : z.x.min || 45) / 90) : 0;
    if (z.c == 'r' && !z.d) { wr++; wl += el; }
    if (z.c == 'o') near++;
    if (z.x && z.x.st == 'in') live++;
    fa *= fac(z.l, z.x);
    s += z.c == 'r' && !z.d ? 3 * (1 + el) : z.c == 'o' ? 2 * (1 + el) : z.c == 'n' ? (z.x && z.x.t && z.x.t - now < 3 * 36e5 && z.x.t - now > -36e5 ? .5 : .2) : z.c == 'b' ? .2 : 0;
  });
  return { b, L, cnt, lost: !!dead, won: !!all, wr, near, live, finLoss: !!finLoss, fa, pr: dead ? 0 : all ? 1 : pr,
    risk: dead ? -1 : all ? -.5 : wr ? 1000 + wr * 100 + wl * 10 + s : s, cls: dead ? 'lost' : all ? 'won' : wr ? 'wr' : near ? 'near' : live ? 'ok' : 'wait' };
}
// امتیاز: برد = ۱۰×ln(ضریب)، باخت = ۵- (فرمول را اینجا تغییر دهید)
const pts = (b) => (b.res == 'won' ? Math.round(10 * Math.log(b.odds)) : -5);
const settled = (recs) => recs.filter((b) => b.arch && !b.del && (b.res == 'won' || b.res == 'lost'));
function summary(recs) {
  const H = settled(recs), W = H.filter((b) => b.res == 'won'), st = H.reduce((s, b) => s + +b.stake, 0), ret = W.reduce((s, b) => s + b.stake * b.odds, 0);
  return { n: H.length, won: W.length, lost: H.length - W.length, staked: st, ret, profit: ret - st, roi: st ? (ret - st) / st : 0, score: H.reduce((s, b) => s + pts(b), 0) };
}

return { fold, same, mt, chk, ev, pt1, pickTxt, lbl, fac, OCL, SN, gk, cons, betState, pts, settled, summary };
});
