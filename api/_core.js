// AUTO-GENERATED from public/index.html (matching + evaluation logic shared with the notifier)
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

module.exports = { same, mt, ev, pickTxt };
