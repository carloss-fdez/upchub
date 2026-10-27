/* UPCHub · Demo interactiva — estat compartit, registre d'ús, rutes i recorreguts */
(function(){
  'use strict';

  /* Punt de recollida de dades (Google Apps Script desplegat com a aplicació web → URL acabada en /exec).
     Mentre sigui buit, tot es queda en aquest navegador i es pot descarregar des de #dades.
     Com desplegar-lo: demo/README.md i demo/backend/apps-script.gs */
  var ENDPOINT='';

  var $=function(s,c){return (c||document).querySelector(s)},$$=function(s,c){return [].slice.call((c||document).querySelectorAll(s))};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- i18n: el mateix sistema que la web (clau = text català) ---------- */
  var DICT=window.UPC_DEMO_I18N||{es:{},en:{}},lang='ca',hooks=[],SUP=['ca','es','en'];
  function norm(s){return s.replace(/\s+/g,' ').trim()}
  function T(s,vars){
    var d=lang==='ca'?null:DICT[lang],r=(d&&d[s])||s;
    return vars?r.replace(/\{(\w+)\}/g,function(m,k){return vars[k]!=null?vars[k]:m}):r;
  }
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){return null}}
  function ss(k,v){try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v)}catch(e){return null}}
  function applyLang(l){
    lang=l;document.documentElement.lang=l;
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
      var p=n.parentNode;if(!p||/^(SCRIPT|STYLE)$/i.test(p.nodeName)||(p.closest&&p.closest('[data-dyn]')))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT}});
    var n;while((n=w.nextNode())){
      if(n.__o===undefined)n.__o=n.nodeValue;
      var k=norm(n.__o);if(!k)continue;
      var tr=l==='ca'?null:(DICT[l]||{})[k];
      n.nodeValue=tr?(/^\s/.test(n.__o)?' ':'')+tr+(/\s$/.test(n.__o)?' ':''):n.__o;
    }
    $$('[aria-label],[alt]').forEach(function(el){
      ['aria-label','alt'].forEach(function(a){
        if(!el.hasAttribute(a)||el.closest('[data-dyn]'))return;
        if(el['__o_'+a]===undefined)el['__o_'+a]=el.getAttribute(a);
        el.setAttribute(a,l==='ca'?el['__o_'+a]:((DICT[l]||{})[norm(el['__o_'+a])]||el['__o_'+a]));
      });
    });
    if(document.__oTitle===undefined)document.__oTitle=document.title;
    document.title=l==='ca'?document.__oTitle:((DICT[l]||{})[document.__oTitle]||document.__oTitle);
    var m=$('meta[name="description"]');
    if(m){if(m.__o===undefined)m.__o=m.getAttribute('content');m.setAttribute('content',l==='ca'?m.__o:((DICT[l]||{})[m.__o]||m.__o))}
    $$('.lang button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.lang===l)});
    hooks.forEach(function(f){f()});
  }
  function setLang(l,user){
    if(SUP.indexOf(l)<0)l='ca';
    applyLang(l);ls('upchub-lang',l);
    try{var u=new URL(location.href);u.searchParams.set('lang',l);history.replaceState(null,'',u)}catch(e){}
    if(user)track('idioma',l);
  }
  $$('.lang button').forEach(function(b){b.addEventListener('click',function(){setLang(b.dataset.lang,true)})});

  /* ---------- Utilitats ---------- */
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function ico(id){return '<svg aria-hidden="true"><use href="icons.svg#'+id+'"/></svg>'}
  function lc(s){return s.charAt(0).toLowerCase()+s.slice(1)}
  function fmtTime(ms){var s=Math.max(1,Math.round(ms/1000));return s<60?s+' s':Math.floor(s/60)+' min '+('0'+s%60).slice(-2)+' s'}
  function device(){return window.matchMedia&&matchMedia('(max-width: 599px)').matches?'mobil':'ordinador'}
  var toastT,toastEl=$('#toast');
  function toast(msg){toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){toastEl.classList.remove('on')},3200)}
  function busy(btn,b){
    btn.setAttribute('aria-busy',b);
    $$('.idle',btn).forEach(function(x){x.hidden=b});$$('.busy,.spin',btn).forEach(function(x){x.hidden=!b});
  }
  var band=$('.band');
  function bandH(){document.documentElement.style.setProperty('--band-h',band.offsetHeight+'px')}
  if(window.ResizeObserver)new ResizeObserver(bandH).observe(band);else addEventListener('resize',bandH);
  bandH();

  /* ---------- Dades del cas (fictícies): dilluns, Disseny Bàsic, aula 205 ---------- */
  var EQ={
    proj:{n:'Projector',i:'i-screen'},audio:{n:'Àudio',i:'i-audio'},pc:{n:'Ordinador',i:'i-pc'},dock:{n:'Dock USB-C',i:'i-dock'},
    plug:{n:'Endoll',i:'i-plug'},air:{n:'Climatització',i:'i-temp'},light:{n:'Llum',i:'i-bulb'},furn:{n:'Mobiliari',i:'i-chair'}
  };
  var EQ205=['proj','audio','pc','dock'];
  /* Símptomes que pot triar l'alumne i la seva puntuació G × U × I */
  var SYM={
    'plug':'Endoll sense corrent','air:hot':'Fa massa calor','air:cold':'Fa massa fred','air:stale':'Aire carregat','air':'Problema de climatització',
    'light:off':'Llum que no s\'encén','light:flick':'Llum que parpelleja','light':'Problema de llum',
    'furn:chair':'Cadira trencada','furn:desk':'Taula trencada','furn:blind':'Persiana espatllada','furn':'Mobiliari malmès',
    'proj':'No rep senyal del dock'
  };
  var GUI={'plug':[2,1,2],'air:hot':[1,2,3],'air:cold':[1,2,3],'air:stale':[2,1,3],'air':[1,2,2],'light:off':[1,1,2],'light:flick':[1,1,2],'light':[1,1,2],'furn:chair':[1,1,1],'furn:desk':[1,1,1],'furn:blind':[1,1,1],'furn':[1,1,1],'proj':[3,2,2]};
  /* P = G × U × I. Crític ≥ 12 · Alt 6–11 · Normal 3–5 · Baix < 3 */
  var LV={crit:{n:'Crític',goal:'15 min'},alt:{n:'Alt',goal:'El mateix dia'},norm:{n:'Normal',goal:'48 h'},low:{n:'Baix',goal:'Revisió setmanal'}};
  function P(it){return it.g*it.u*it.i}
  function lvl(p){return p>=12?'crit':p>=6?'alt':p>=3?'norm':'low'}
  var RES={
    proj:['Cable HDMI del dock substituït','Entrada del projector reconfigurada','Projector reiniciat'],
    air:['Consigna de climatització corregida','Filtre de l\'aire netejat','Sensor de temperatura recalibrat'],
    plug:['Endoll substituït','Diferencial de la taula rearmat'],
    light:['Fluorescent substituït','Reactància substituïda'],
    furn:['Peça reparada','Moble substituït']
  };
  var ROOMS=[
    {id:'206',cap:30,st:'Lliure fins a les 12:00',ok:'Tots els equips funcionen'},
    {id:'210',cap:40,st:'Lliure fins a les 10:00',warn:'S\'ocupa a les 10:00: hauríeu de tornar a canviar'},
    {id:'114',cap:24,busy:'Ocupada: Electrònica fins a les 11:00'},
    {id:'302',cap:16,busy:'Massa petita per a 24 alumnes'}
  ];

  /* ---------- Rellotge de la demo: comença dilluns a les 9:00 i avança amb el temps real ---------- */
  function clock(){var m=9*60+Math.min(119,Math.floor((Date.now()-S.t0)/60000));return Math.floor(m/60)+':'+('0'+m%60).slice(-2)}
  function clockIn(min){var m=9*60+Math.min(119,Math.floor((Date.now()-S.t0)/60000))+min;m=Math.ceil(m/5)*5;return Math.floor(m/60)+':'+('0'+m%60).slice(-2)}
  function tick(){$$('.clock').forEach(function(c){c.textContent=clock()})}

  /* ---------- Estat compartit (localStorage; si no n'hi ha, memòria) ---------- */
  var KEY='upchub-demo-state',VER=2,subs=[];
  function seed(){return {v:VER,seq:0,ls:0,t0:Date.now(),
    equip:{proj:'bad',audio:'ok',pc:'ok',dock:'ok'},
    env:{temp:25,target:22,co2:820},
    room:{cur:'205',at:null},
    queue:[
      {id:'i205',aula:'205',eq:'proj',key:'proj',sym:'Sense imatge',g:3,u:2,i:2,at:'Dl 8:52',reps:1,news:0,status:'open',tried:[],by:[],
        hist:[{t:'8:52',k:'Detecció automàtica: el projector no rep senyal del dock'},{t:'Fa 12 dies',k:'Làmpada substituïda'}]},
      {id:'i205b',aula:'205',eq:'air',key:'air:hot',sym:'Fa massa calor',g:1,u:2,i:3,at:'Dl 8:58',reps:2,news:0,status:'open',tried:[],by:['alumne'],
        hist:[{t:'9:00',k:'Climatització: refrigeració activada (objectiu 22 °C)'},{t:'8:58',k:'Avís d\'un alumne des de l\'app'}]},
      {id:'i114',aula:'114',eq:'plug',key:'plug',sym:'Endoll de taula trencat',sx:'4',g:2,u:1,i:2,at:'Dv 17:40',reps:1,news:0,status:'open',tried:[],by:[],
        hist:[{t:'8:30',k:'Revisat: cal un recanvi'},{t:'Dv 17:40',k:'Avís d\'un alumne des de l\'app'}]},
      {id:'i302',aula:'302',eq:'light',key:'light:off',sym:'Llum fosa',g:1,u:1,i:2,at:'Dj 12:15',reps:1,news:0,status:'open',tried:[],by:[],
        hist:[{t:'Dj 12:15',k:'Avís del professor des del tauler'}]}
    ],
    log:[
      {id:1,t:'7:30',aula:'',kind:'auto',k:'Arrencada: aules de la planta 2 preparades segons l\'horari'},
      {id:2,t:'7:55',aula:'302',kind:'auto',k:'CO₂ alt (1.150 ppm): ventilació activada automàticament'},
      {id:3,t:'8:10',aula:'302',kind:'auto',k:'CO₂ normalitzat (640 ppm)'},
      {id:4,t:'8:30',aula:'114',kind:'chg',k:'Tècnic: endoll de taula revisat, pendent de recanvi'},
      {id:5,t:'8:52',aula:'205',kind:'auto',k:'Detecció automàtica: el projector no rep senyal del dock'},
      {id:6,t:'8:58',aula:'205',kind:'inc',k:'Avís d\'un alumne: {x}',x:'air:hot'},
      {id:7,t:'9:00',aula:'205',kind:'auto',k:'Climatització: refrigeració activada (objectiu 22 °C)'}
    ],
    push:[{id:1,t:'8:40',title:'Recordatori',body:'Disseny Bàsic a les 9:00 · Aula 205',read:true}],
    reports:[],metrics:{},survey:null}}
  function load(){
    var raw=ls(KEY);
    if(raw){try{var o=JSON.parse(raw);if(o&&o.v===VER&&o.queue&&o.log)return o}catch(e){}}
    return seed();
  }
  var S=load();
  function emit(){subs.forEach(function(f){f()})}
  function on(f){subs.push(f)}
  function save(){ls(KEY,JSON.stringify(S));emit()}
  window.addEventListener('storage',function(e){if(e.key===KEY||e.key===null){var old=S;S=load();liveNotice(old,S);emit()}});
  function item(id){return S.queue.filter(function(x){return x.id===id})[0]||null}
  function openItem(aula,eq){return S.queue.filter(function(x){return x.aula===aula&&x.eq===eq&&x.status!=='done'})[0]||null}
  function symText(it){return T(it.sym)+(it.sx?' · '+T('lloc {n}',{n:it.sx}):'')}
  function itLabel(it){return T('Aula')+' '+it.aula+' · '+T(EQ[it.eq].n)}

  /* Historial del dia (el que veu el tècnic) i notificacions de l'app de l'alumnat */
  function addLog(aula,kind,k,extra){
    var e={id:++S.ls+100,t:clock(),aula:aula,kind:kind,k:k};
    if(extra)for(var x in extra)e[x]=extra[x];
    S.log.push(e);
  }
  function addPush(title,body,vars,go){S.push.push({id:Date.now()+Math.random(),t:clock(),title:title,body:body,v:vars||null,go:go||'',read:false})}

  /* Un avís nou se suma a l'obert del mateix equip, símptoma i lloc; si no n'hi ha, en crea un */
  function report(o){
    var it=S.queue.filter(function(x){return x.aula===o.aula&&x.key===o.key&&(x.sx||'')===(o.sx||'')&&x.status!=='done'})[0],merged=!!it;
    if(it){it.reps++;it.news++}
    else{
      var g=GUI[o.key]||[1,1,1];
      it={id:'n'+(++S.seq),aula:o.aula,eq:o.eq,key:o.key,sym:SYM[o.key]||SYM[o.eq],sx:o.sx||'',g:g[0],u:g[1],i:g[2],at:clock(),reps:1,news:1,status:'open',tried:[],by:[],hist:[]};
      S.queue.push(it);
    }
    if(o.tried&&o.tried.length)it.tried=o.tried;
    if(o.photo)it.photo=true;
    if(it.by.indexOf(o.by)<0)it.by.push(o.by);
    it.hist.unshift({t:clock(),k:o.by==='alumne'?"Avís d'un alumne des de l'app":'Avís del professor des del tauler'});
    addLog(o.aula,'inc',o.by==='alumne'?"Avís d'un alumne: {x}":'Avís del professor: {x}',{x:it.key,sx:it.sx});
    if(o.aula==='205'&&S.equip[o.eq])S.equip[o.eq]='bad';
    S.reports.push({by:o.by,item:it.id,merged:merged});
    save();
    return {item:it,merged:merged};
  }
  function startItem(it){
    if(it.status!=='open')return;
    it.status='progress';it.news=0;
    it.hist.unshift({t:clock(),k:'El tècnic hi va'});
    addLog(it.aula,'chg','Tècnic en camí: {x}',{x:it.key,sx:it.sx});
    if(it.by.indexOf('alumne')>=0)addPush('El tècnic ja hi va','{x} · aula {a}',{x:it.key,sx:it.sx,a:it.aula},'a7:'+it.id);
  }
  function resolveItem(it,how,by){
    it.status='done';it.news=0;it.res=how||'';
    it.hist.unshift({t:clock(),k:by==='ia'?"Resolt pel professor amb l'assistent IA":'Resolta pel servei tècnic',r:how||''});
    addLog(it.aula,'chg',by==='ia'?'Resolta amb l\'assistent IA: {x}':'Resolta pel tècnic: {x}',{x:it.key,sx:it.sx,r:how||''});
    if(it.aula==='205'&&S.equip[it.eq])S.equip[it.eq]='ok';
    if(it.aula==='205'&&it.eq==='air'){S.env.temp=22}
    if(it.by.indexOf('alumne')>=0)addPush('Avís resolt','{x} · aula {a}',{x:it.key,sx:it.sx,a:it.aula},'a7:'+it.id);
  }
  /* Text d'una entrada del registre, traduït en el moment de pintar-la */
  function logText(e){
    var x=e.x?T(SYM[e.x]||e.x)+(e.sx?' · '+T('lloc {n}',{n:e.sx}):''):'';
    return T(e.k,{x:x,n:e.n,r:e.r?T(e.r):'',a:e.a})+(e.r&&e.k.indexOf('{r}')<0?' · '+T(e.r):'');
  }
  function pushText(p){
    var v=p.v||{},x=v.x?T(SYM[v.x]||v.x)+(v.sx?' · '+T('lloc {n}',{n:v.sx}):''):'';
    return {title:T(p.title),body:T(p.body,{x:x,a:v.a,r:v.r,h:v.h})};
  }

  /* ================= Registre d'ús (anònim, amb consentiment) ================= */
  var SID=ss('upchub-sid');
  if(!SID){SID=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);ss('upchub-sid',SID)}
  var LOGKEY='upchub-demo-log',pend=[],early=[];
  function consent(){return ls('upchub-demo-consent')}
  function localLog(){try{return JSON.parse(ls(LOGKEY)||'[]')}catch(e){return []}}
  function keepLocal(ev){var a=localLog();a.push(ev);if(a.length>4000)a=a.slice(-4000);ls(LOGKEY,JSON.stringify(a))}
  function curScreen(){return cur==='alumne'?A.step:cur==='professor'?B.step+'/'+B.dev:cur==='tecnic'?C.step:''}
  function track(type,d){
    var c=consent();if(c==='no')return;
    var ev={ts:new Date().toISOString(),s:SID,v:cur||'',sc:curScreen(),ty:type,d:d==null?'':String(d).slice(0,160),l:lang,dv:device()};
    if(c==='yes'){keepLocal(ev);pend.push(ev)}
    else if(early.length<400)early.push(ev);
  }
  function post(body,beacon){
    if(!ENDPOINT)return Promise.resolve(false);
    var data=JSON.stringify(body);
    if(beacon&&navigator.sendBeacon)return Promise.resolve(navigator.sendBeacon(ENDPOINT,new Blob([data],{type:'text/plain'})));
    return fetch(ENDPOINT,{method:'POST',mode:'no-cors',body:data,headers:{'Content-Type':'text/plain'},keepalive:data.length<60000,credentials:'omit',referrerPolicy:'no-referrer'}).then(function(){return true});
  }
  function flush(beacon){
    if(!ENDPOINT||!pend.length||consent()!=='yes')return;
    var items=pend.splice(0,200);
    post({kind:'events',items:items},beacon).catch(function(){pend=items.concat(pend)});
  }
  setInterval(flush,8000);
  addEventListener('pagehide',function(){flush(true)});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flush(true)});
  function setConsent(v){
    ls('upchub-demo-consent',v);
    if(v==='yes'){early.forEach(function(ev){keepLocal(ev);pend.push(ev)});track('consentiment','si')}
    early=[];
    $('#consent').hidden=true;document.body.classList.remove('consenting');
    dRender();
  }
  $$('[data-consent]').forEach(function(b){b.addEventListener('click',function(){setConsent(b.dataset.consent);toast(b.dataset.consent==='yes'?T('Gràcies! El registre és anònim.'):T('D\'acord, no registrarem res.'))})});
  /* Clics i canvis: es guarda quin control (no el que s'escriu) */
  function ctlName(el){
    var t=el.dataset.go||el.dataset.back||el.dataset.tab||el.dataset.ctab||el.dataset.qf||el.dataset.lf||el.dataset.dev||el.dataset.eq||el.dataset.item||el.dataset.consent||'';
    var txt=(el.getAttribute('aria-label')||el.innerText||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);
    return (el.id?'#'+el.id+' ':'')+(t?'['+t+'] ':'')+txt;
  }
  document.addEventListener('click',function(e){
    var el=e.target.closest('button,a,summary,input[type=radio],input[type=checkbox]');
    if(!el||el.closest('.lang'))return;
    if(el.tagName==='INPUT')track('tria',el.name+'='+el.value+(el.type==='checkbox'?(el.checked?' ✓':' ✗'):''));
    else track('clic',ctlName(el));
  },true);
  document.addEventListener('change',function(e){if(e.target.tagName==='SELECT')track('tria',e.target.id+'='+e.target.value)},true);

  /* ---------- Mesura de les tasques ---------- */
  var MIN={alumne:4,professor:5,tecnic:3},run=null;
  function startTask(role){run={role:role,t0:Date.now(),steps:0}}
  document.addEventListener('click',function(e){
    if(!run)return;
    var el=e.target.closest('button,a,input,select');if(!el||el.closest('.tpanel,.band'))return;
    var v=el.closest('[data-role]');if(v&&v.dataset.role===run.role)run.steps++;
  },true);
  function finishTask(min,extra){
    if(!run)return null;
    var m={ms:Date.now()-run.t0,steps:run.steps,min:min||MIN[run.role],hints:run.hints||0};
    if(extra)for(var k in extra)m[k]=extra[k];
    S.metrics[run.role]=m;
    track('tasca',run.role+' '+Math.round(m.ms/1000)+'s '+m.steps+'p'+(m.ok!==undefined?(m.ok?' encert':' error'):''));
    run=null;save();
    return m;
  }
  var NEXT={alumne:['tecnic','Mira-ho ara com a tècnic'],professor:['tecnic','Mira-ho ara com a tècnic'],tecnic:['alumne','Mira-ho ara com a alumne']};
  function renderResult(el,role){
    var m=S.metrics[role];if(!m){el.hidden=true;return}
    var nx=NEXT[role],note='';
    if(role==='tecnic'&&m.first)note=m.ok?T('Primera tria: la més urgent. Ben vist.'):T('Primera tria: no era la més urgent. Ho era: aula {a} · {e}.',{a:m.top.aula,e:T(EQ[m.top.eq].n)});
    if(role==='alumne'&&m.ok===false)note=T('Has avisat d\'un altre problema. La tasca era l\'endoll del teu lloc, però també compta!');
    el.innerHTML='<h2>'+ico('i-check')+esc(T('Tasca completada'))+'</h2>'+
      '<div class="nums"><div><b>'+fmtTime(m.ms)+'</b><span>'+esc(T('Temps'))+'</span></div>'+
      '<div><b>'+m.steps+'</b><span>'+esc(T('Passos (mínim {n})',{n:m.min}))+'</span></div></div>'+
      (note?'<p>'+esc(note)+'</p>':'')+
      (m.hints?'<p class="small">'+esc(m.hints>1?T('Has fet servir {n} pistes.',{n:m.hints}):T('Has fet servir 1 pista.'))+'</p>':'')+
      '<div class="seq"><p id="seq-'+role+'">'+esc(T('Com de fàcil ha estat?'))+'</p><div class="seqb" role="group" aria-labelledby="seq-'+role+'">'+
      [1,2,3,4,5].map(function(n){return '<button type="button" data-seq="'+n+'" aria-pressed="'+(m.seq===n)+'">'+n+'</button>'}).join('')+
      '</div><p class="ends"><span>'+esc(T('1 · Molt difícil'))+'</span><span>'+esc(T('5 · Molt fàcil'))+'</span></p></div>'+
      '<div class="acts"><a class="btn pri" href="#enquesta">'+esc(T('Valorar la demo'))+'</a><a class="btn sec" href="#'+nx[0]+'">'+esc(T(nx[1]))+'</a></div>';
    el.dataset.role=role;el.hidden=false;
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-seq]');if(!b)return;
    var role=b.closest('.result').dataset.role,m=S.metrics[role];if(!m)return;
    m.seq=+b.dataset.seq;track('facilitat',role+'='+m.seq);save();
    $$('[data-seq]',b.parentNode).forEach(function(x){x.setAttribute('aria-pressed',x===b)});
    toast(T('Gràcies! Ens ajuda molt.'));
  });
  function renderDone(){
    $$('[data-done]').forEach(function(p){
      var m=S.metrics[p.dataset.done];p.hidden=!m;
      if(m)p.innerHTML=ico('i-check')+esc(T('Fet · {t} · {n} passos',{t:fmtTime(m.ms),n:m.steps}));
    });
    var n=ROLES.filter(function(r){return S.metrics[r[0]]}).length;
    $('#h-prog').innerHTML=ico(n===3?'i-check':'i-list')+'<span>'+esc(T('{n} de 3 tasques fetes',{n:n}))+' · '+esc(n===3?T('Ja pots valorar la demo.'):T('Ordre recomanat: alumne, professor i tècnic.'))+'</span>';
  }

  /* ---------- Pistes: ajuda segons la pantalla, comptades a la mesura ---------- */
  var HINTS={
    a1:"Obre l'app del campus amb el botó de baix.",a2:"Toca «Avisar d'un problema».",
    a3:"Tria «Endoll» i, si el saps, el número del teu lloc. Després prem «Enviar avís».",a4:"Ja està! Pots tornar a l'inici o mirar les altres pestanyes.",
    a5:"Torna a la pestanya «Aula» per avisar d'un problema.",a6:"Toca una notificació per veure'n el detall.",a7:"Aquí veus l'estat del teu avís.",
    b1:"Prem «Simular toc NFC».",b2:"Prem «Obrir el tauler de l'aula».",
    b3:"Mira els equips: el que està en vermell és el que falla. Si vols ajuda, prem «Tinc un problema».",
    b4:"Fes els passos, marca'ls i respon si funciona.",b5:"Revisa la fitxa i prem «Avisar el tècnic».",
    b6:"Ja has acabat la tasca. Si vols, prova a canviar d'aula.",b7:"Ja has acabat la tasca.",
    b8:"Tria una aula lliure amb prou places i prem «Continuar».",b9:"Revisa el missatge i prem «Enviar la notificació».",b10:"Torna al tauler: veuràs el canvi d'aula.",
    c1:"Obre l'avís amb la P més alta: és el més urgent.",c2:"Prem «Marcar com a resolta» i indica què has fet.",
    c3:"Mira què ha canviat a «Historial del dia».",c4:"Filtra per aula o per tipus per veure què ha passat avui."
  };
  function hintRender(){
    [['a',A.step],['b',B.step],['c',C.step]].forEach(function(x){var box=$('#'+x[0]+'-hint');if(box&&!box.hidden)box.textContent=T(HINTS[x[1]]||'Segueix les indicacions de la pantalla.')});
  }
  function hintsClose(){$$('.hintb').forEach(function(b){b.setAttribute('aria-expanded','false');$('#'+b.getAttribute('aria-controls')).hidden=true})}
  $$('.hintb').forEach(function(b){b.addEventListener('click',function(){
    var open=b.getAttribute('aria-expanded')!=='true';
    b.setAttribute('aria-expanded',open);$('#'+b.getAttribute('aria-controls')).hidden=!open;
    hintRender();
    if(open){track('pista',curScreen());if(run)run.hints=(run.hints||0)+1}
  })});

  /* ---------- Navegació entre pantalles: endavant, enrere o pestanya ---------- */
  function Flow(root,onStep){
    var order=$$('.scr',root).map(function(s){return s.id}),cur=order[0];
    function go(id,mode){
      if(id===cur||!document.getElementById(id))return;
      var a=document.getElementById(cur),b=document.getElementById(id);
      var pos=mode==='tab'?'fade':mode==='back'?'prev':(order.indexOf(id)>order.indexOf(cur)?'next':'prev');
      var out=pos==='fade'?'fade':pos==='next'?'prev':'next';
      b.dataset.pos=pos;b.classList.add('on');
      void b.offsetWidth;
      b.removeAttribute('data-pos');
      a.dataset.pos=out;a.classList.remove('on');a.classList.add('leaving');
      setTimeout(function(){a.classList.remove('leaving')},300);
      cur=id;
      var h=$('h2[tabindex],h2',b);if(h)h.focus({preventScroll:true});
      if(onStep)onStep(id);
      hintRender();
      track('pantalla',id);
    }
    function reset(){
      order.forEach(function(id,i){var s=document.getElementById(id);s.classList.toggle('on',!i);s.classList.remove('leaving');if(i)s.dataset.pos='next';else s.removeAttribute('data-pos')});
      cur=order[0];if(onStep)onStep(cur);
    }
    root.addEventListener('click',function(e){
      var g=e.target.closest('[data-go]'),b=e.target.closest('[data-back]');
      if(g&&root.contains(g))go(g.dataset.go);else if(b&&root.contains(b))go(b.dataset.back,'back');
    });
    return {go:go,reset:reset,cur:function(){return cur}};
  }

  /* ================= Alumne ================= */
  var A={step:'a1',last:null,photo:false,det:null,pushT:null,seenPush:0};
  var TABS=['a2','a5','a6'];
  var aFlow=Flow($('[data-view="alumne"] .phone'),function(id){
    A.step=id;aCount();
    $('#a-tabbar').hidden=TABS.indexOf(id)<0;
    $$('#a-tabbar [data-tab]').forEach(function(b){if(b.dataset.tab===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
    if(id==='a6')setTimeout(function(){var ch=false;S.push.forEach(function(p){if(!p.read){p.read=true;ch=true}});if(ch)save()},900);
    if(id==='a3')aFormReset();
  });
  var aForm=$('#a-form'),aErr=$('#a-err'),aSend=$('#a-send');
  function aCount(){
    var n={a1:1,a2:2,a3:3,a4:4}[A.step];
    $('#a-count').textContent=T('Alumne')+(n?' · '+T('Pantalla {n} de {t}',{n:n,t:4}):'');
  }
  $('#a-seat').innerHTML='<option value="">'+esc(T('No ho sé'))+'</option>'+Array.from({length:28},function(_,i){return '<option value="'+(i+1)+'">'+esc(T('Lloc {n}',{n:i+1}))+'</option>'}).join('');
  function aSeats(){var v=$('#a-seat').value;$('#a-seat').innerHTML='<option value="">'+esc(T('No ho sé'))+'</option>'+Array.from({length:28},function(_,i){return '<option value="'+(i+1)+'">'+esc(T('Lloc {n}',{n:i+1}))+'</option>'}).join('');$('#a-seat').value=v}
  function aFormReset(){
    if(A.step!=='a3'||aForm.dataset.dirty)return;
    $('#a-aula').value=S.room.cur;
  }
  $('#a-card').addEventListener('click',function(){var on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);this.classList.toggle('flip',on)});
  $$('#a-tabbar [data-tab]').forEach(function(b){b.addEventListener('click',function(){aFlow.go(b.dataset.tab,'tab')})});
  $('#a-photo-add').addEventListener('click',function(){A.photo=true;$('#a-photo').hidden=false;this.hidden=true;$('#a-photo-del').focus()});
  $('#a-photo-del').addEventListener('click',function(){A.photo=false;$('#a-photo').hidden=true;$('#a-photo-add').hidden=false;$('#a-photo-add').focus()});
  aForm.addEventListener('change',function(e){
    aForm.dataset.dirty='1';
    if(e.target.name==='a-type'){aErr.hidden=true;$$('.detail',aForm).forEach(function(d){d.hidden=d.dataset.for!==e.target.value})}
  });
  aForm.addEventListener('submit',function(e){
    e.preventDefault();
    var t=$('input[name="a-type"]:checked',aForm);
    if(!t){aErr.hidden=false;$('#at-plug').focus();track('error','alumne: sense tipus');return}
    if(aSend.getAttribute('aria-busy')==='true')return;
    var sub=t.value==='plug'?'':($('input[name="a-'+t.value+'"]:checked',aForm)||{}).value;
    var key=t.value+(sub?':'+sub:''),sx=t.value==='plug'?$('#a-seat').value:'';
    busy(aSend,true);
    setTimeout(function(){
      A.last=report({aula:$('#a-aula').value,eq:t.value,key:key,sx:sx,by:'alumne',photo:A.photo});
      busy(aSend,false);
      aFlow.go('a4');
      aForm.reset();delete aForm.dataset.dirty;$$('.detail',aForm).forEach(function(d){d.hidden=true});
      A.photo=false;$('#a-photo').hidden=true;$('#a-photo-add').hidden=false;
      if(finishTask(MIN.alumne,{ok:t.value==='plug'})){document.body.classList.remove('full');renderResult($('#a-result'),'alumne')}
    },reduce?150:650);
  });
  function sumHTML(it,merged){
    var l=lvl(P(it));
    return '<div class="card"><dl class="sum">'+
      '<dt>'+esc(T('Aula'))+'</dt><dd>'+esc(it.aula)+'</dd>'+
      '<dt>'+esc(T('Problema'))+'</dt><dd>'+esc(symText(it))+'</dd>'+
      '<dt>'+esc(T('Prioritat'))+'</dt><dd><span class="badge '+l+'">'+esc(T(LV[l].n))+'</span></dd>'+
      '<dt>'+esc(T('Objectiu'))+'</dt><dd>'+esc(T(LV[l].goal))+'</dd></dl></div>'+
      (merged?'<p class="merged">'+esc(T("Ja hi havia un avís igual obert. Hi hem sumat el teu: ara en té {n}.",{n:it.reps}))+'</p>':'')+
      trackHTML(it);
  }
  function trackHTML(it){
    var st=it.status,nowSet=false,steps=[
      ['Rebuda',it.at,true],
      ['En mans del tècnic',st==='open'?"Quan l'obri a la cua":'El tècnic hi va',st!=='open'],
      ['Resolta',st==='done'?(it.res||'Feta'):"Rebràs una notificació",st==='done']
    ];
    return '<h3 class="sec-h">'+esc(T('Estat'))+'</h3><ol class="track">'+steps.map(function(s){
      var c=s[2]?'done':(!nowSet?(nowSet=true,'now'):'');
      return '<li class="'+c+'"><span class="dot">'+ico('i-check')+'</span><span><b>'+esc(T(s[0]))+'</b><span>'+esc(T(s[1]))+'</span></span></li>';
    }).join('')+'</ol>';
  }
  function aSum(){var it=A.last&&item(A.last.item.id);$('#a-sum').innerHTML=it?sumHTML(it,A.last.merged):''}
  function aNow(){
    var moved=S.room.cur!=='205';
    $('#a-now').innerHTML='<div class="now-h"><span class="pin">'+ico('i-pin')+'</span><div><b>'+esc(T('Disseny Bàsic'))+'</b><span>'+esc(T('Ara · 9:00–11:00'))+'</span></div><span class="room-big">'+esc(S.room.cur)+'</span></div>'+
      (moved?'<p class="moved-note">'+ico('i-move')+esc(T('Canvi d\'aula: abans era la 205'))+'</p>':'')+
      '<p class="envline">'+ico('i-temp')+esc(T('A l\'aula: {t} °C · CO₂ {c} ppm',{t:S.room.cur==='205'?S.env.temp:22,c:S.room.cur==='205'?S.env.co2:610}))+'</p>';
  }
  function aMine(){
    var seen={},ul=$('#a-mine');
    var rows=S.reports.filter(function(r){return r.by==='alumne'}).reverse().filter(function(r){if(seen[r.item])return false;seen[r.item]=1;return item(r.item)}).map(function(r){
      var it=item(r.item),st=it.status==='done'?'Resolta':it.status==='progress'?'El tècnic hi va':'Rebuda';
      return '<li><button type="button" class="mine-b" data-det="'+it.id+'"><span class="eq">'+ico(EQ[it.eq].i)+'</span><span class="t"><b>'+esc(symText(it))+'</b><span>'+esc(T('Aula'))+' '+esc(it.aula)+' · '+esc(T(st))+'</span></span>'+ico('i-right')+'</button></li>';
    });
    ul.innerHTML=rows.length?rows.join(''):'<li class="empty">'+esc(T('Encara no has enviat cap avís.'))+'</li>';
  }
  $('#a-mine').addEventListener('click',function(e){var b=e.target.closest('[data-det]');if(b){A.det=b.dataset.det;aDet();aFlow.go('a7')}});
  function aDet(){var it=A.det&&item(A.det);$('#a-det').innerHTML=it?'<h2 tabindex="-1">'+esc(symText(it))+'</h2>'+sumHTML(it,false):''}
  function aSched(){
    var rows=[['9:00–11:00','Disseny Bàsic',S.room.cur,S.room.cur!=='205'?'205':''],['11:30–13:30','Expressió Gràfica','114',''],['15:00–17:00','Matemàtiques II','302','']];
    $('#a-sched').innerHTML=rows.map(function(r,i){
      return '<li class="'+(i===0?'now':'')+'"><span class="tm">'+r[0]+'</span><span class="cl"><b>'+esc(T(r[1]))+'</b><span>'+esc(T('Aula'))+' '+(r[3]?'<s>'+r[3]+'</s> ':'')+esc(r[2])+(r[3]?' · '+esc(T('canvi d\'aula')):'')+'</span></span>'+(i===0?'<span class="chip">'+esc(T('Ara'))+'</span>':'')+'</li>';
    }).join('');
  }
  function aNotes(){
    var list=S.push.slice().reverse();
    $('#a-notes').innerHTML=list.map(function(p){
      var tx=pushText(p);
      return '<li><button type="button" class="note-b'+(p.read?'':' unread')+'" data-push="'+p.id+'"><span class="nt"><b>'+esc(tx.title)+'</b><time>'+esc(p.t)+'</time></span><span>'+esc(tx.body)+'</span></button></li>';
    }).join('')||'<li class="empty">'+esc(T('Cap notificació.'))+'</li>';
    var unread=S.push.filter(function(p){return !p.read}).length,b=$('#a-bdg');
    b.hidden=!unread;b.textContent=unread;
    $('#a-tabbar [data-tab="a6"]').setAttribute('aria-label',T('Avisos')+(unread?' · '+T('{n} sense llegir',{n:unread}):''));
    var lock=S.push.filter(function(p){return !p.read}).slice(-2).reverse();
    $('#a-lock').innerHTML=lock.map(function(p){var tx=pushText(p);return '<button type="button" class="lockn" data-push="'+p.id+'"><span class="lk-h">'+ico('i-grid')+'<b>'+esc(T('App del campus'))+'</b><time>'+esc(p.t)+'</time></span><b>'+esc(tx.title)+'</b><span>'+esc(tx.body)+'</span></button>'}).join('');
  }
  function openPush(id){
    var p=S.push.filter(function(x){return String(x.id)===String(id)})[0];if(!p)return;
    p.read=true;save();
    if(p.go&&p.go.indexOf('a7:')===0){A.det=p.go.slice(3);aDet();aFlow.go('a7')}
    else aFlow.go(p.go||'a6',A.step==='a1'?undefined:'tab');
  }
  $('[data-view="alumne"] .phone').addEventListener('click',function(e){var b=e.target.closest('[data-push]');if(b){$('#a-push').hidden=true;openPush(b.dataset.push)}});
  $('#a-readall').addEventListener('click',function(){S.push.forEach(function(p){p.read=true});save();toast(T('Totes llegides'))});
  /* Bàner de notificació a la part de dalt del mòbil */
  function aBanner(p){
    var el=$('#a-push'),tx=pushText(p);
    el.dataset.push=p.id;
    el.innerHTML='<span class="lk-h">'+ico('i-grid')+'<b>'+esc(T('App del campus'))+'</b><time>'+esc(T('ara'))+'</time></span><b>'+esc(tx.title)+'</b><span>'+esc(tx.body)+'</span>';
    el.hidden=false;
    clearTimeout(A.pushT);A.pushT=setTimeout(function(){el.hidden=true},6500);
  }
  function aCheckPush(){
    var last=S.push[S.push.length-1];
    if(cur==='alumne'&&last&&!last.read&&String(last.id)!==String(A.seenPush)){A.seenPush=last.id;aBanner(last)}
  }
  function aEnter(){
    aFlow.reset();aForm.reset();delete aForm.dataset.dirty;aErr.hidden=true;busy(aSend,false);
    $$('.detail',aForm).forEach(function(d){d.hidden=true});
    A.photo=false;$('#a-photo').hidden=true;$('#a-photo-add').hidden=false;$('#a-push').hidden=true;
    A.last=null;$('#a-result').hidden=true;
    aSum();aMine();aNow();aSched();aNotes();
    document.body.classList.add('full');
    hintsClose();startTask('alumne');
    A.seenPush=0;setTimeout(aCheckPush,900);
  }
  on(function(){aSum();aMine();aNow();aSched();aNotes();if(A.step==='a7')aDet();aCheckPush()});
  hooks.push(function(){aCount();aSeats();aSum();aMine();aNow();aSched();aNotes();aDet();if(!$('#a-result').hidden)renderResult($('#a-result'),'alumne')});

  /* ================= Professor ================= */
  var B={step:'b1',last:null,prev:{},flash:{},html:'',dev:'desk',room:null,sheet:null,opener:null};
  var STEPS=['Comprova que el projector està encès','Reinicia la sortida de vídeo del dock',"Tria l'entrada HDMI 1"];
  var bMon=$('[data-view="professor"] .monitor');
  var bFlow=Flow(bMon,function(id){
    B.step=id;bCount();
    if(id==='b2')bBoot();
    if(id==='b5')bFicha();
    if(id==='b8')bRooms();
    if(id==='b9')bPushPrev();
    bSheetClose(true);
  });
  var bSend=$('#b-send');
  function bCount(){
    var n={b1:1,b2:2,b3:3,b4:4,b5:5,b6:6}[B.step];
    $('#b-count').textContent=T('Professor')+(n?' · '+T('Pantalla {n} de {t}',{n:n,t:6}):'');
  }
  $$('.devsw [data-dev]').forEach(function(b){b.addEventListener('click',function(){bDev(b.dataset.dev)})});
  function bDev(d){
    B.dev=d;$('#b-rolev').dataset.dev=d;
    $$('.devsw [data-dev]').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.dev===d)});
    ls('upchub-demo-dev',d);
  }
  function eqState(k){
    if(S.equip[k]!=='bad')return {c:'',t:'Funciona'};
    var it=openItem('205',k);
    if(it&&it.status==='progress')return {c:'bad warn',t:'Tècnic en camí'};
    if(it&&it.by.indexOf('professor')>=0)return {c:'bad',t:'Avisat al tècnic'};
    return {c:'bad',t:k==='proj'?'No rep senyal':'No funciona'};
  }
  function bBoot(){
    var bad=S.equip.proj==='bad',hot=S.env.temp>S.env.target+1,rows=[
      ['Identificació amb el carnet',0],['Aula 205 i horari reconeguts',0],
      ["Àudio, ordinador i dock connectats",0],[bad?'Projector: no rep senyal':'Projector connectat',bad],
      [hot?'Climatització: refredant fins a {n} °C':'Climatització a {n} °C',0,{n:S.env.target}]];
    $('#b-boot').innerHTML=rows.map(function(r){
      return '<li class="'+(r[1]?'bad':'')+'"><span class="mk">'+ico(r[1]?'i-x':'i-check')+'</span>'+esc(T(r[0],r[2]))+'</li>';
    }).join('');
  }
  function bDash(){
    var bads=EQ205.filter(function(k){return S.equip[k]==='bad'}),sm=$('#b-summary');
    sm.className='summary '+(bads.length?'bad':'ok');
    sm.innerHTML=bads.length?ico('i-alert')+esc(T('Falla: {e}',{e:bads.map(function(k){return T(EQ[k].n)}).join(', ')})):ico('i-check')+esc(T('Tots els equips funcionen'));
    var now=Date.now(),html=EQ205.map(function(k){
      if(B.prev[k]==='bad'&&S.equip[k]==='ok')B.flash[k]=now+1200;
      var st=eqState(k);
      return '<li><button type="button" class="eqb '+st.c+(B.flash[k]>now?' ok-new':'')+'" data-eq="'+k+'">'+ico(EQ[k].i)+'<b>'+esc(T(EQ[k].n))+'</b><span class="st"><i></i>'+esc(T(st.t))+'</span></button></li>';
    }).join('');
    if(html!==B.html)$('#b-eqs').innerHTML=B.html=html;
    EQ205.forEach(function(k){B.prev[k]=S.equip[k]});
    var e=S.env,cool=e.temp>e.target+0.5;
    $('#b-env').innerHTML='<div class="env">'+ico('i-temp')+'<b>'+e.temp+' °C</b><span>'+esc(T('Temperatura · objectiu {n} °C',{n:e.target}))+(cool?' · '+esc(T('refredant')):'')+'</span></div>'+
      '<div class="env">'+ico('i-wind')+'<b>'+e.co2+' ppm</b><span>'+esc(T('CO₂ · {q}',{q:e.co2<800?T('aire bo'):T('acceptable, ventilant')}))+'</span></div>';
    var reps=S.queue.filter(function(x){return x.aula==='205'&&x.by.indexOf('alumne')>=0});
    $('#b-reps').innerHTML=reps.length?reps.map(function(it){
      var st=it.status==='done'?'Resolta':it.status==='progress'?'Tècnic en camí':'Pendent';
      return '<li>'+ico(EQ[it.eq].i)+'<span><b>'+esc(symText(it))+'</b><span>'+esc(it.reps>1?T('{n} avisos',{n:it.reps}):T('1 avís'))+' · '+esc(T(st))+'</span></span></li>';
    }).join(''):'<li class="empty">'+esc(T('Cap avís de l\'alumnat.'))+'</li>';
    var moved=S.room.cur!=='205',mv=$('#b-moved');
    mv.hidden=!moved;
    if(moved)mv.innerHTML=ico('i-move')+'<span>'+esc(T('Classe traslladada a l\'aula {r} a les {h}. Alumnat avisat.',{r:S.room.cur,h:S.room.at}))+'</span><button type="button" class="btn ghost" id="b-undo">'+esc(T('Desfer el canvi'))+'</button>';
    $('#b-room-h').textContent=moved?T('Aula 205 → {r}',{r:S.room.cur}):T('Aula')+' 205';
  }
  bMon.addEventListener('click',function(e){
    var eq=e.target.closest('[data-eq]');if(eq)bSheet('eq',eq.dataset.eq,eq);
    if(e.target.closest('#b-undo'))bUndo();
  });
  $('#b-clima').addEventListener('click',function(){bSheet('clima',null,this)});
  $('#b-logout').addEventListener('click',function(){bFlow.go('b1','back');toast(T('Sessió tancada'))});

  /* Full lateral: detall d'un equip o climatització */
  function bSheet(kind,key,opener){
    B.sheet={kind:kind,key:key,target:S.env.target};B.opener=opener||null;
    bSheetRender();
    $('#b-sheet').hidden=false;$('#b-sheet-bg').hidden=false;
    $('#b-sheet-h').focus({preventScroll:true});
    if(innerWidth<600)$('#b-sheet').scrollIntoView({block:'end',behavior:reduce?'auto':'smooth'});
    track('full',kind+(key?':'+key:''));
  }
  function bSheetRender(){
    var s=B.sheet;if(!s)return;
    var h=$('#b-sheet-h'),b=$('#b-sheet-b');
    if(s.kind==='clima'){
      h.textContent=T('Climatització');
      b.innerHTML='<p>'+esc(T('Ara fa {t} °C a l\'aula. El sistema regula sol segons l\'ocupació i l\'horari, però pots canviar l\'objectiu per a aquesta classe.',{t:S.env.temp}))+'</p>'+
        '<div class="stepper" role="group" aria-label="'+esc(T('Temperatura objectiu'))+'"><button type="button" class="ic-btn" id="b-tminus" aria-label="'+esc(T('Baixar un grau'))+'">'+ico('i-minus')+'</button><output id="b-tval" aria-live="polite">'+s.target+' °C</output><button type="button" class="ic-btn" id="b-tplus" aria-label="'+esc(T('Pujar un grau'))+'">'+ico('i-plus')+'</button></div>'+
        '<p class="small">'+esc(T('Entre 19 i 25 °C, per estalviar energia.'))+'</p>'+
        '<div class="acts"><button type="button" class="btn pri" id="b-tapply">'+esc(T('Aplicar'))+'</button></div>';
      return;
    }
    var k=s.key,st=eqState(k),bad=S.equip[k]==='bad';
    h.textContent=T(EQ[k].n);
    var info={proj:'Projector del sostre, entrada HDMI 1 connectada al dock.',audio:'Altaveus de l\'aula connectats al dock.',pc:'Ordinador fix de l\'aula, amb el programari de l\'assignatura.',dock:'Un sol cable USB-C per a projector, so, xarxa i càrrega del teu portàtil.'}[k];
    var act={proj:bad?['b-ia','Obrir l\'assistent']:null,audio:['b-snd','Provar el so'],pc:['b-pcr','Reiniciar l\'ordinador'],dock:['b-dkr','Reconnectar el dock']}[k];
    b.innerHTML='<p class="st big"><i class="'+(bad?'bad':'')+'"></i>'+esc(T(st.t))+'</p>'+
      '<p>'+esc(T(info))+'</p><p class="small">'+esc(T('Última revisió: divendres a les 17:00.'))+'</p>'+
      (act?'<div class="acts"><button type="button" class="btn '+(bad?'pri':'sec')+'" id="'+act[0]+'"><span class="spin" aria-hidden="true" hidden></span><span class="idle">'+esc(T(act[1]))+'</span><span class="busy" hidden>'+esc(T('Un moment…'))+'</span></button></div>':'');
  }
  function bSheetClose(silent){
    if(!B.sheet)return;
    B.sheet=null;$('#b-sheet').hidden=true;$('#b-sheet-bg').hidden=true;
    if(!silent&&B.opener&&document.body.contains(B.opener))B.opener.focus();
  }
  $('#b-sheet-x').addEventListener('click',function(){bSheetClose()});
  $('#b-sheet-bg').addEventListener('click',function(){bSheetClose()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&B.sheet)bSheetClose()});
  $('#b-sheet').addEventListener('click',function(e){
    var t=e.target.closest('button');if(!t||!B.sheet)return;
    var s=B.sheet;
    if(t.id==='b-tminus'||t.id==='b-tplus'){s.target=Math.max(19,Math.min(25,s.target+(t.id==='b-tplus'?1:-1)));$('#b-tval').textContent=s.target+' °C'}
    else if(t.id==='b-tapply'){
      if(s.target!==S.env.target){S.env.target=s.target;addLog('205','chg','Professor: objectiu de climatització a {n} °C',{n:s.target});save()}
      bSheetClose();toast(T('Objectiu de climatització: {n} °C',{n:s.target}));
    }
    else if(t.id==='b-ia'){bSheetClose(true);bFlow.go('b4')}
    else if(t.id==='b-snd'){toast(T('S\'ha reproduït un so de prova (simulat)'))}
    else if(t.id==='b-pcr'||t.id==='b-dkr'){
      busy(t,true);
      setTimeout(function(){
        busy(t,false);
        addLog('205','chg',t.id==='b-pcr'?'Professor: ordinador reiniciat des del tauler':'Professor: dock reconnectat des del tauler');save();
        toast(T(t.id==='b-pcr'?'Ordinador reiniciat':'Dock reconnectat'));
      },reduce?200:1400);
    }
  });

  function bFicha(){
    var it=openItem('205','proj'),g=it?[it.g,it.u,it.i]:GUI.proj,p=g[0]*g[1]*g[2],l=lvl(p);
    var tried=bTried(),row=function(k,v){return '<dt>'+esc(T(k))+'</dt><dd>'+v+'</dd>'};
    $('#b-ficha').innerHTML='<dl class="ficha">'+
      row('Aula',esc(T('205 · Disseny Bàsic, classe en curs')))+
      row('Equip',esc(T(EQ.proj.n)))+
      row('Símptoma',esc(T('No rep senyal del dock')))+
      row('Passos provats',tried.length?'<ul>'+tried.map(function(t){return '<li>'+esc(T(t))+'</li>'}).join('')+'</ul>':esc(T('Cap pas marcat')))+
      row("Estat de l'aula",esc(T('Àudio, ordinador i dock funcionen · {t} °C · CO₂ {c} ppm',{t:S.env.temp,c:S.env.co2})))+
      row('Avisos previs',esc(it?T('{n} a la cua',{n:it.reps}):T('Cap')))+
      row('Prioritat','<span class="badge '+l+'">'+esc(T(LV[l].n))+'</span><span class="pf">P = '+g.join(' × ')+' = '+p+'</span>')+
      row('Objectiu',esc(T(LV[l].goal)))+'</dl>';
  }
  function bTried(){return $$('#b-steps input:checked').map(function(c){return STEPS[+c.value]})}
  function bSent(){
    var it=B.last&&item(B.last.item.id);if(!it)return;
    var l=lvl(P(it));
    $('#b-sent').textContent=T('{l} · objectiu: {g}',{l:T(LV[l].n),g:lc(T(LV[l].goal))});
    $('#b-track').innerHTML=trackHTML(it);
  }
  function bFinish(min){if(finishTask(min))renderResult($('#b-result'),'professor')}
  $('#b-nfc').addEventListener('click',function(){
    var r=$('#b-reader'),btn=this;
    if(btn.getAttribute('aria-busy')==='true')return;
    btn.setAttribute('aria-busy','true');r.classList.add('tapping');
    setTimeout(function(){r.classList.add('ok')},reduce?50:650);
    setTimeout(function(){bFlow.go('b2');r.classList.remove('tapping','ok');btn.setAttribute('aria-busy','false')},reduce?250:1150);
  });
  $('#b-yes').addEventListener('click',function(){
    var it=openItem('205','proj');
    if(it){it.tried=bTried();resolveItem(it,'',  'ia')}
    S.equip.proj='ok';save();
    bFlow.go('b7');bFinish(4);
  });
  bSend.addEventListener('click',function(){
    if(bSend.getAttribute('aria-busy')==='true')return;
    busy(bSend,true);
    setTimeout(function(){
      B.last=report({aula:'205',eq:'proj',key:'proj',by:'professor',tried:bTried()});
      busy(bSend,false);bFlow.go('b6');bSent();bFinish();
    },reduce?150:650);
  });
  /* Canvi d'aula amb notificació a l'alumnat */
  function bRooms(){
    $('#b-rooms').innerHTML=ROOMS.map(function(r){
      var dis=!!r.busy;
      return '<div class="room-o'+(dis?' dis':'')+'"><input type="radio" name="b-room" id="br-'+r.id+'" value="'+r.id+'"'+(dis?' disabled':'')+(B.room===r.id?' checked':'')+'><label for="br-'+r.id+'"><b>'+esc(T('Aula'))+' '+r.id+'</b><span>'+esc(T('{n} places',{n:r.cap}))+' · '+esc(T(r.busy||r.st))+'</span>'+(r.ok?'<span class="okline">'+ico('i-check')+esc(T(r.ok))+'</span>':'')+(r.warn?'<span class="warnline">'+ico('i-alert')+esc(T(r.warn))+'</span>':'')+'</label></div>';
    }).join('');
  }
  $('#b-rooms').addEventListener('change',function(e){B.room=e.target.value;$('#b-room-err').hidden=true});
  $('#b-room-next').addEventListener('click',function(){
    if(!B.room){$('#b-room-err').hidden=false;var f=$('#b-rooms input:not([disabled])');if(f)f.focus();track('error','professor: sense aula');return}
    bFlow.go('b9');
  });
  function bPushPrev(){
    B.h=clockIn(10);
    $('#b-pushprev').innerHTML='<div class="lockn static"><span class="lk-h">'+ico('i-grid')+'<b>'+esc(T('App del campus'))+'</b><time>'+esc(T('ara'))+'</time></span><b>'+esc(T('Canvi d\'aula'))+'</b><span>'+esc(T('Disseny Bàsic continua a l\'aula {r} a partir de les {h}.',{r:B.room,h:B.h}))+'</span></div>';
  }
  $('#b-move-send').addEventListener('click',function(){
    var btn=this;if(btn.getAttribute('aria-busy')==='true')return;
    busy(btn,true);
    setTimeout(function(){
      busy(btn,false);
      S.room={cur:B.room,at:clock()};
      addPush('Canvi d\'aula','Disseny Bàsic continua a l\'aula {r} a partir de les {h}.',{r:B.room,h:B.h},'a5');
      addLog('205','chg','Classe traslladada a l\'aula {a} pel professor · 24 alumnes avisats',{a:B.room});
      addLog(B.room,'chg','Aula reservada per a Disseny Bàsic fins a les 11:00');
      save();
      $('#b-moved-msg').textContent=T('24 alumnes han rebut la notificació: Disseny Bàsic continua a l\'aula {r} a partir de les {h}.',{r:B.room,h:B.h});
      bFlow.go('b10');
    },reduce?150:700);
  });
  function bUndo(){
    var r=S.room.cur;
    S.room={cur:'205',at:null};
    addPush('Canvi d\'aula anul·lat','Disseny Bàsic continua a l\'aula 205.',null,'a5');
    addLog('205','chg','Canvi d\'aula anul·lat: la classe torna a la 205');
    addLog(r,'chg','Reserva anul·lada');
    save();toast(T('Canvi anul·lat. Alumnat avisat.'));
  }
  function bEnter(){
    bFlow.reset();busy(bSend,false);B.last=null;B.prev={};B.flash={};B.html='';B.room=null;
    $$('#b-steps input').forEach(function(c){c.checked=false});
    $('#b-result').hidden=true;bDash();bDev(ls('upchub-demo-dev')||'desk');
    hintsClose();startTask('professor');
  }
  on(function(){bDash();if(B.step==='b2')bBoot();if(B.step==='b5')bFicha();bSent();bSheetRender()});
  hooks.push(function(){bCount();bDash();bBoot();bFicha();bSent();bRooms();if(B.step==='b9')bPushPrev();bSheetRender();if(!$('#b-result').hidden)renderResult($('#b-result'),'professor')});

  /* ================= Tècnic ================= */
  var C={step:'c1',open:null,seen:null,msg:'',flash:{},html:'',qf:'all',lf:'all',la:'',logSeen:null};
  var cMon=$('[data-view="tecnic"] .monitor');
  var cFlow=Flow(cMon,function(id){
    C.step=id;cCount();
    var tab=id==='c4'?'c4':'c1';
    $$('[data-ctab]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.ctab===tab)});
    if(id==='c4')cLog();
  });
  function cCount(){var n={c1:1,c2:2,c3:3}[C.step];$('#c-count').textContent=T('Tècnic')+(n?' · '+T('Pantalla {n} de {t}',{n:n,t:3}):' · '+T('Historial del dia'))}
  $$('[data-ctab]').forEach(function(b){b.addEventListener('click',function(){cFlow.go(b.dataset.ctab,'tab')})});
  function openSorted(){return S.queue.filter(function(x){return x.status!=='done'}).sort(function(a,b){return P(b)-P(a)||b.news-a.news})}
  function cQueue(){
    var all=openSorted(),prev=C.seen,q=all.filter(function(it){
      return C.qf==='all'||(C.qf==='crit'&&P(it)>=6)||(C.qf==='new'&&it.news>0)||(C.qf==='mine'&&it.status==='progress');
    }),done=S.queue.filter(function(x){return x.status==='done'});
    $('#c-open').textContent=all.length;
    var now=Date.now(),html=q.map(function(it){
      if(prev&&(prev[it.id]===undefined||prev[it.id]<it.reps))C.flash[it.id]=now+1400;
      var p=P(it),l=lvl(p),fl=C.flash[it.id]>now;
      return '<li><button type="button" class="qrow '+l+(fl?' flash':'')+'" data-item="'+it.id+'">'+
        '<span class="pv"><b>'+p+'</b><span>P</span></span>'+
        '<span class="main"><b>'+ico(EQ[it.eq].i)+esc(itLabel(it))+'</b><span class="sym">'+esc(symText(it))+'</span>'+
        '<span class="meta">'+esc(T(it.at))+' · '+esc(it.reps>1?T('{n} avisos',{n:it.reps}):T('1 avís'))+'</span></span>'+
        '<span class="side"><span class="badge '+l+'">'+esc(T(LV[l].n))+'</span>'+
        (it.news?'<span class="tag-new">'+esc(T('Nou'))+'</span>':'')+
        (it.status==='progress'?'<span class="tag-st">'+esc(T('En curs'))+'</span>':'')+
        '<span class="goal">'+esc(T('Objectiu: {g}',{g:lc(T(LV[l].goal))}))+'</span></span></button></li>';
    }).join('')||'<li class="empty">'+esc(T('Cap incidència amb aquest filtre.'))+'</li>';
    if(html!==C.html)$('#c-queue').innerHTML=C.html=html;
    C.seen={};all.forEach(function(it){C.seen[it.id]=it.reps});
    $('#c-done').innerHTML=done.map(function(it){return '<li>'+esc(itLabel(it))+' · '+esc(symText(it))+(it.res?' · '+esc(T(it.res)):'')+'</li>'}).join('')||'<li>'+esc(T('Cap encara.'))+'</li>';
  }
  $$('[data-qf]').forEach(function(b){b.addEventListener('click',function(){C.qf=b.dataset.qf;$$('[data-qf]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});cQueue()})});
  function cFicha(){
    var it=C.open&&item(C.open);if(!it)return;
    var p=P(it),l=lvl(p),is205=it.aula==='205';
    var row=function(k,v){return '<dt>'+esc(T(k))+'</dt><dd>'+v+'</dd>'};
    $('#c-title').innerHTML='<h2 tabindex="-1">'+esc(itLabel(it))+'</h2><span class="badge '+l+'">'+esc(T(LV[l].n))+'</span>'+
      (it.status==='done'?'<span class="tag-st">'+esc(T('Resolta'))+'</span>':it.status==='progress'?'<span class="tag-st">'+esc(T('En curs'))+'</span>':'');
    var room=is205?EQ205.map(function(k){return T(EQ[k].n)+': '+T(S.equip[k]==='bad'?'falla':'bé')}).join(' · ')+' · '+S.env.temp+' °C':'—';
    $('#c-ficha').innerHTML='<dl class="ficha">'+
      row('Símptoma',esc(symText(it)))+
      row('Prioritat','<b>P = '+it.g+' × '+it.u+' × '+it.i+' = '+p+'</b><span class="gui">'+esc(T('Gravetat {g} · urgència {u} · impacte {i} (escala 1–3)',{g:it.g,u:it.u,i:it.i}))+'</span>')+
      row('Objectiu',esc(T(LV[l].goal)))+
      row('Classe',esc(is205?T('Disseny Bàsic, classe en curs')+(S.room.cur!=='205'?' · '+T('traslladada a la {r}',{r:S.room.cur}):''):T('Sense classe ara')))+
      row("Estat de l'aula",esc(room))+
      row('Avisos',esc(String(it.reps))+(it.by.length?' · '+esc(it.by.map(function(b){return T(b==='alumne'?'alumnat':'professor')}).join(', ')):''))+
      (it.photo?row('Foto','<span class="thumb" role="img" aria-label="'+esc(T('Foto simulada de l\'avís'))+'"></span>'):'')+
      row('Passos provats',it.tried.length?'<ul>'+it.tried.map(function(t){return '<li>'+esc(T(t))+'</li>'}).join('')+'</ul>':esc(T('Cap encara')))+
      row('Historial','<ul class="hist">'+it.hist.map(function(h){return '<li><time>'+esc(T(h.t))+'</time><span>'+esc(T(h.k))+(h.r?' · '+esc(T(h.r)):'')+'</span></li>'}).join('')+'</ul>')+
      '</dl>';
    $('#c-start').hidden=it.status!=='open';
    $('#c-resolve').hidden=it.status==='done'||!$('#c-res').hidden;
    $('#c-acts').hidden=it.status==='done';
  }
  function cOpen(id){
    var it=item(id);if(!it)return;
    if(run&&run.role==='tecnic'&&!run.first){var top=openSorted()[0];run.first=id;run.top=top?{aula:top.aula,eq:top.eq}:null;run.ok=!!top&&top.id===id}
    C.open=id;it.news=0;$('#c-res').hidden=true;
    save();cFicha();cFlow.go('c2');
  }
  $('#c-queue').addEventListener('click',function(e){var b=e.target.closest('[data-item]');if(b)cOpen(b.dataset.item)});
  $('#c-start').addEventListener('click',function(){var it=item(C.open);if(!it)return;startItem(it);save();cFicha();toast(T('Marcada com a en curs. L\'alumnat ho veu a l\'app.'));$('#c-resolve').focus()});
  $('#c-resolve').addEventListener('click',function(){
    var it=item(C.open);if(!it)return;
    var opts=RES[it.eq]||['Revisat i resolt'];
    $('#c-res-opts').innerHTML=opts.map(function(o,i){return '<label class="opt"><input type="radio" name="c-how" value="'+esc(o)+'"'+(i?'':' checked')+'><span>'+esc(T(o))+'</span></label>'}).join('');
    $('#c-res').hidden=false;this.hidden=true;
    $('#c-res-opts input').focus();
  });
  $('#c-res-x').addEventListener('click',function(){$('#c-res').hidden=true;$('#c-resolve').hidden=false;$('#c-resolve').focus()});
  $('#c-confirm').addEventListener('click',function(){
    var it=item(C.open);if(!it)return;
    var how=($('input[name="c-how"]:checked')||{}).value||'';
    if(it.status==='open')startItem(it);
    resolveItem(it,how,'tecnic');
    C.msg=it.aula==='205'&&S.equip[it.eq]?"L'equip torna a estar en verd al tauler de l'aula 205.":it.by.indexOf('alumne')>=0?"L'alumne que ho va avisar rep una notificació al mòbil.":"Queda registrada a l'historial del dia.";
    var extra=run&&run.role==='tecnic'?{first:run.first,ok:run.ok,top:run.top}:null;
    $('#c-res').hidden=true;save();cMsg();cFlow.go('c3');
    if(finishTask(MIN.tecnic,extra))renderResult($('#c-result'),'tecnic');
  });
  function cMsg(){$('#c-done-msg').textContent=C.msg?T(C.msg):''}
  var KIND={auto:['i-spark','Automàtic'],inc:['i-alert','Avís'],chg:['i-wrench','Canvi']};
  function cLog(){
    var aula=$('#c-lf-aula').value,list=S.log.slice().reverse().filter(function(e){return (!aula||e.aula===aula)&&(C.lf==='all'||e.kind===C.lf)});
    var seen=C.logSeen||{};
    $('#c-log').innerHTML=list.map(function(e){
      var k=KIND[e.kind];
      return '<li class="lg-'+e.kind+(C.logSeen&&!seen[e.id]?' flash':'')+'"><time>'+esc(e.t)+'</time><span class="lk">'+ico(k[0])+'<span class="sr">'+esc(T(k[1]))+'</span></span><span class="lt">'+(e.aula?'<b>'+esc(T('Aula'))+' '+esc(e.aula)+'</b> · ':'')+esc(logText(e))+'</span></li>';
    }).join('')||'<li class="empty">'+esc(T('Res amb aquest filtre.'))+'</li>';
    C.logSeen={};S.log.forEach(function(e){C.logSeen[e.id]=1});
  }
  $('#c-lf-aula').addEventListener('change',cLog);
  $$('[data-lf]').forEach(function(b){b.addEventListener('click',function(){C.lf=b.dataset.lf;$$('[data-lf]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});cLog()})});
  function cEnter(){
    cFlow.reset();C.open=null;C.seen=null;C.msg='';C.flash={};C.html='';C.logSeen=null;$('#c-res').hidden=true;
    $('#c-result').hidden=true;cQueue();
    hintsClose();startTask('tecnic');
  }
  on(function(){cQueue();if(C.step==='c2')cFicha();if(C.step==='c4')cLog()});
  hooks.push(function(){cCount();cQueue();cFicha();cMsg();cLog();if(!$('#c-result').hidden)renderResult($('#c-result'),'tecnic')});

  /* ================= Enquesta ================= */
  var ROLES=[['alumne','Alumne','i-phone'],['professor','Professor','i-laptop'],['tecnic','Tècnic','i-wrench']];
  var sForm=$('#s-form'),sSend=$('#s-send');
  var SMSG={sent:'Hem rebut les teves respostes. Moltes gràcies per ajudar-nos.',skip:'No hem enviat res. Gràcies igualment per provar la demo.',local:"Respostes desades en aquest navegador. L'equip les recollirà des d'aquí."};
  function sTasks(){
    $('#s-tasks').innerHTML=ROLES.map(function(r){
      var m=S.metrics[r[0]];
      return '<li class="'+(m?'ok':'')+'"><span class="ic">'+ico(m?'i-check':r[2])+'</span><span class="t"><b>'+esc(T(r[1]))+'</b><span>'+
        esc(m?T('Fet · {t} · {n} passos',{t:fmtTime(m.ms),n:m.steps}):T("Encara no l'has provada"))+'</span></span>'+
        (m?'':'<a class="btn ghost" href="#'+r[0]+'">'+esc(T('Provar'))+'</a>')+'</li>';
    }).join('');
  }
  function sView(){
    var done=!!S.survey;
    sForm.hidden=done;$('#s-thanks').hidden=!done;
    $('#s-thanks-msg').textContent=done?T(SMSG[S.survey.r]):'';
  }
  function sTasksText(){
    return ROLES.map(function(r){
      var m=S.metrics[r[0]];if(!m)return r[0]+':-';
      return r[0]+':'+Math.round(m.ms/1000)+'s,'+m.steps+'p'+(m.ok!==undefined?(m.ok?',ok':',no'):'')+(m.seq?',facil'+m.seq:'')+(m.hints?',pistes'+m.hints:'');
    }).join(';');
  }
  function sDone(r,ans){
    S.survey={r:r,ans:ans||null};save();busy(sSend,false);sView();
    var h=$('#s-thanks h2');if(h)h.focus();
  }
  sForm.addEventListener('change',function(e){
    if(e.target.name==='s-und')$('#s-e1').hidden=true;
    if(e.target.name==='s-cla')$('#s-e2').hidden=true;
  });
  sForm.addEventListener('submit',function(e){
    e.preventDefault();
    if(sSend.getAttribute('aria-busy')==='true')return;
    var und=$('input[name="s-und"]:checked',sForm),cla=$('input[name="s-cla"]:checked',sForm);
    $('#s-e1').hidden=!!und;$('#s-e2').hidden=!!cla;$('#s-e3').hidden=true;
    if(!und||!cla){$(!und?'#su-yes':'#sc-1').focus();track('error','enquesta incompleta');return}
    var ans={ts:new Date().toISOString(),s:SID,understood:und.value,clarity:cla.value,change:$('#s-open').value.trim().slice(0,500),tasks:sTasksText(),lang:lang,device:device()};
    keepLocal({ts:ans.ts,s:SID,ty:'enquesta',d:JSON.stringify(ans)});
    track('enquesta','enviada');
    if(!ENDPOINT){sDone('local',ans);return}
    busy(sSend,true);
    post({kind:'survey',item:ans})
      .then(function(){sDone('sent')})
      .catch(function(){busy(sSend,false);$('#s-e3').hidden=false});
  });
  $('#s-skip').addEventListener('click',function(){track('enquesta','no enviada');sDone('skip')});
  $('#s-again').addEventListener('click',function(){S.survey=null;save();sView();$('#su-yes').focus()});
  function sEnter(){sTasks();sView();busy(sSend,false);$('#s-e3').hidden=true}
  on(function(){if(cur==='enquesta'){sTasks();sView()}});
  hooks.push(function(){sTasks();sView()});

  /* ================= Comentari ràpid ================= */
  var fb=$('#fb'),fbOpener=null;
  function fbCtx(){var names={home:'Inici',alumne:'Alumne',professor:'Professor',tecnic:'Tècnic',enquesta:'Enquesta',dades:'Privacitat i dades'};return T(names[cur]||'Inici')+(curScreen()?' · '+curScreen():'')}
  $('#fb-open').addEventListener('click',function(){
    fbOpener=this;$('#fb-ctx').textContent=T('Ho veurem amb la pantalla on ets: {p}.',{p:fbCtx()});
    $('#fb-err').hidden=true;
    if(fb.showModal)fb.showModal();else fb.setAttribute('open','');
    $('#fb-t').focus();
  });
  function fbClose(){if(fb.close)fb.close();else fb.removeAttribute('open');if(fbOpener)fbOpener.focus()}
  $('#fb-x').addEventListener('click',fbClose);$('#fb-cancel').addEventListener('click',fbClose);
  fb.addEventListener('click',function(e){if(e.target===fb)fbClose()});
  $('#fb-form').addEventListener('submit',function(e){
    e.preventDefault();
    var t=$('#fb-t').value.trim();
    if(!t){$('#fb-err').hidden=false;$('#fb-t').focus();return}
    var k=($('input[name="fb-k"]:checked')||{}).value||'';
    var item={ts:new Date().toISOString(),s:SID,v:cur||'',sc:curScreen(),k:k,txt:t.slice(0,600),l:lang,dv:device()};
    keepLocal({ts:item.ts,s:SID,ty:'comentari',d:JSON.stringify(item)});
    track('comentari',k||'-');
    post({kind:'feedback',item:item});
    $('#fb-form').reset();fbClose();toast(T('Gràcies pel comentari!'));dRender();
  });

  /* ================= Privacitat i dades ================= */
  function dRender(){
    var c=consent();
    $('#d-state').textContent=c==='yes'?T('Has acceptat el registre anònim. Pots retirar-lo quan vulguis.'):c==='no'?T('No registrem res de la teva sessió. Si canvies d\'opinió, ho pots acceptar.'):T('Encara no has triat.');
    var a=localLog(),ev=a.filter(function(x){return x.ty!=='enquesta'&&x.ty!=='comentari'}).length,ot=a.length-ev;
    $('#d-local').textContent=T('{e} esdeveniments i {o} respostes o comentaris desats en aquest navegador.',{e:ev,o:ot})+(ENDPOINT?' '+T('També s\'envien al full de càlcul de l\'equip.'):' '+T('Encara no hi ha cap full de càlcul connectat: descarrega-les per analitzar-les.'));
  }
  $('#d-dl').addEventListener('click',function(){
    var data={exportat:new Date().toISOString(),sessio:SID,estat_demo:{metrics:S.metrics,survey:S.survey},registre:localLog()};
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download='upchub-demo-registre-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
  });
  $('#d-clear').addEventListener('click',function(){if(confirm(T('Vols esborrar el registre desat en aquest navegador?'))){ls(LOGKEY,null);dRender();toast(T('Registre esborrat'))}});
  hooks.push(dRender);

  /* ---------- Avisos en directe quan una altra pestanya canvia l'estat ---------- */
  function liveNotice(a,b){
    var find=function(st,id){return st.queue.filter(function(x){return x.id===id})[0]};
    if(b.reports.length>a.reports.length&&cur==='tecnic'){
      var it=find(b,b.reports[b.reports.length-1].item);
      if(it)toast(T('Nou avís: {x}',{x:itLabel(it)}));
    }
    if(cur==='professor')b.queue.forEach(function(it){
      var o=find(a,it.id);
      if(o&&o.status!=='done'&&it.status==='done'&&it.aula==='205')toast(T('Resolta: {x}',{x:itLabel(it)}));
    });
    if(cur==='tecnic'&&b.room.cur!==a.room.cur)toast(T('Canvi d\'aula: Disseny Bàsic a l\'aula {r}',{r:b.room.cur}));
  }

  /* ---------- Rutes ---------- */
  var cur=null,ENTER={alumne:aEnter,professor:bEnter,tecnic:cEnter,enquesta:sEnter,dades:dRender};
  function route(){
    var h=(location.hash||'').slice(1)||'home',v=$('.view[data-view="'+h+'"]')||$('.view[data-view="home"]');
    h=v.dataset.view;
    if(h===cur)return;
    var first=cur===null;cur=h;
    $$('.view').forEach(function(x){x.hidden=x!==v});
    document.body.classList.remove('full');run=null;
    if(ENTER[h])ENTER[h]();
    renderDone();
    $('#consent').hidden=!!consent()||['home','enquesta','dades'].indexOf(h)<0;
    document.body.classList.toggle('consenting',!$('#consent').hidden);
    window.scrollTo(0,0);
    if(!first){var t=$('h1',v);if(t)t.focus({preventScroll:true})}
    track('vista',h);
  }
  addEventListener('hashchange',route);
  /* L'enllaç de salt no ha de canviar la ruta: porta el focus al títol de la vista */
  $('.skip').addEventListener('click',function(e){
    e.preventDefault();
    var t=$('.view:not([hidden]) h1');if(t)t.focus();
  });

  /* ---------- Reiniciar ---------- */
  $('#reset').addEventListener('click',function(){
    if(!confirm(T('Vols reiniciar la demo? Es tornaran a posar les dades d\'exemple i s\'esborraran els teus resultats.')))return;
    ls(KEY,null);S=seed();save();
    cur=null;
    if(location.hash&&location.hash!=='#')location.hash='';else route();
    toast(T('Demo reiniciada'));
  });
  on(renderDone);
  hooks.push(renderDone);
  hooks.push(hintRender);
  hooks.push(tick);
  setInterval(tick,15000);

  /* ---------- Idioma inicial: ?lang= > guardat > navegador > català ---------- */
  var q=null;try{q=new URL(location.href).searchParams.get('lang')}catch(e){}
  var saved=ls('upchub-lang'),navL=(navigator.language||'ca').slice(0,2).toLowerCase();
  route();
  setLang(SUP.indexOf(q)>=0?q:SUP.indexOf(saved)>=0?saved:(navL==='es'||navL==='en')?navL:'ca');
  track('inici',(navigator.language||'').slice(0,5)+' '+innerWidth+'x'+innerHeight);
})();
