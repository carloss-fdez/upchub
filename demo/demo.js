/* UPCHub · Demo interactiva v3 — tres recorreguts curts: alumne, professor i tècnic */
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
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
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

  /* ---------- Dades del cas (fictícies) ---------- */
  /* Aules: edifici, aforament i classe d'ara (dilluns 9:00) */
  var ROOMS={
    '205':{bld:'A',cap:24,cls:'Disseny Bàsic',until:'11:00'},
    '206':{bld:'A',cap:30,cls:'',free:'Lliure fins a les 12:00'},
    '210':{bld:'A',cap:40,cls:'',free:'Lliure fins a les 10:00'},
    '114':{bld:'B',cap:24,cls:'Electrònica',busy:'Ocupada: Electrònica'},
    '302':{bld:'C',cap:16,cls:'',busy:'Massa petita per a 24 alumnes'}
  };
  /* Categories: nom, icona, gravetat base i si afecta tota l'aula (aforament) */
  var CAT={
    proj:{n:'Projector',i:'i-screen',base:3,whole:1,sym:'No es veu la imatge'},
    audio:{n:'Àudio',i:'i-audio',base:2,whole:1,sym:'No se sent'},
    pc:{n:'Ordinador',i:'i-pc',base:2,whole:1,sym:'No arrenca'},
    dock:{n:'Dock USB-C',i:'i-dock',base:2,whole:1,sym:'No connecta'},
    plug:{n:'Endoll',i:'i-plug',base:2,whole:0,sym:'No dona corrent'},
    light:{n:'Llum',i:'i-bulb',base:1,whole:1,sym:'Llum fosa'},
    furn:{n:'Mobiliari',i:'i-chair',base:1,whole:0,sym:'Mobiliari trencat'},
    temp:{n:'Aire / temperatura',i:'i-temp',base:1,whole:1,sym:''},
    other:{n:'Altres',i:'i-more',base:1,whole:0,sym:''}
  };
  var EQ4=['proj','audio','pc','dock'];
  var SEV={1:'Poc greu',2:'Greu',3:'Molt greu'};
  /* Límits de temperatura d'exemple (no són una norma real) */
  var LIM={min:21,max:25};
  /* Passos de l'assistent per equip: icona i una frase curta */
  var STEPS={
    proj:[['i-screen','Encén el projector'],['i-dock','Reinicia la base (dock): mantén el botó 3 s'],['i-right','Al comandament, tria l\'entrada HDMI 1']],
    audio:[['i-audio','Puja el volum de la base (dock)'],['i-audio','Treu el silenci'],['i-dock','Reinicia la base (dock)']],
    pc:[['i-pc','Mou el ratolí'],['i-pc','Prem el botó d\'engegada'],['i-laptop','Prova el teu portàtil a la base (dock)']],
    dock:[['i-plug','Desendolla i torna a endollar el cable'],['i-dock','Mira que el llum sigui blanc'],['i-plug','Prova l\'altre port USB-C']]
  };
  var RES={
    proj:['Cable HDMI del dock substituït','Entrada del projector reconfigurada'],
    audio:['Controlador d\'àudio del dock reiniciat','Altaveu substituït'],
    pc:['Ordinador reiniciat','Font d\'alimentació substituïda'],
    dock:['Dock substituït','Cable USB-C substituït'],
    plug:['Endoll substituït','Diferencial de la taula rearmat'],
    light:['Fluorescent substituït'],furn:['Peça reparada','Moble substituït'],other:['Revisat i resolt']
  };

  /* ---------- Prioritat: gravetat × urgència × aforament ---------- */
  function gua(it){
    var c=CAT[it.cat],r=ROOMS[it.aula]||{};
    var g=clamp(c.base+((it.sev||2)-2),1,3);
    var u=clamp((r.cls?2:1)+(it.reps>1?1:0),1,3);
    var a=c.whole?(r.cap>=30?3:2):1;
    return {g:g,u:u,a:a,p:g*u*a};
  }
  function P(it){return gua(it).p}
  function lvl(p){return p>=12?'crit':p>=6?'alt':p>=3?'norm':'low'}
  var LV={crit:'Crític',alt:'Alt',norm:'Normal',low:'Baix'};
  /* Temps d'espera estimat: base per nivell + 10 min per cada incidència més urgent a la cua */
  function etaMin(it){
    if(it.status==='done')return 0;
    var p=P(it),base={crit:15,alt:40,norm:120,low:1440}[lvl(p)];
    var ahead=S.queue.filter(function(x){return x!==it&&x.status!=='done'&&P(x)>p}).length;
    var m=base+(base<=40?ahead*10:0);
    if(it.status==='progress')m=Math.min(m,10);
    return m;
  }
  function etaTxt(it){
    var m=etaMin(it);
    if(m>=1440)return T('~1 dia');
    if(m>=60)return T('~{n} h',{n:Math.round(m/60)});
    return T('~{n} min',{n:Math.round(m/5)*5||5});
  }

  /* ---------- Rellotge de la demo: dilluns 9:00 i avança amb el temps real ---------- */
  function nowMin(){return 9*60+Math.min(119,Math.floor((Date.now()-S.t0)/60000))}
  function clock(){var m=nowMin();return Math.floor(m/60)+':'+('0'+m%60).slice(-2)}
  function tick(){$$('.clock').forEach(function(c){c.textContent=clock()})}

  /* ---------- Estat compartit (localStorage; si no n'hi ha, memòria) ---------- */
  var KEY='upchub-demo-state',VER=3,subs=[];
  function okEquip(){return {proj:'ok',audio:'ok',pc:'ok',dock:'ok'}}
  function seed(){return {v:VER,seq:0,ls:0,t0:Date.now(),cur:'205',
    rs:{
      '205':{equip:{proj:'bad',audio:'ok',pc:'ok',dock:'ok'},temp:26,target:22},
      '206':{equip:okEquip(),temp:22,target:22},'210':{equip:okEquip(),temp:22,target:22},
      '114':{equip:{proj:'ok',audio:'bad',pc:'ok',dock:'ok'},temp:22,target:22},'302':{equip:okEquip(),temp:21,target:21}
    },
    queue:[
      {id:'q1',aula:'114',cat:'audio',sym:'No se sent',sev:3,reps:1,news:0,status:'open',by:['professor'],at:'8:45',
        tried:[['Puja el volum de la base (dock)',1],['Treu el silenci',1]],hist:[{t:'8:45',k:'Avís del professor amb l\'assistent'}]},
      {id:'q2',aula:'205',cat:'plug',sym:'No dona corrent',num:'4',sev:2,reps:2,news:0,status:'open',by:['alumne'],at:'8:50',tried:[],
        hist:[{t:'8:58',k:'Un altre alumne hi torna a avisar'},{t:'8:50',k:'Avís d\'un alumne des de l\'app'}]},
      {id:'q3',aula:'302',cat:'light',sym:'Llum fosa',sev:1,reps:1,news:0,status:'open',by:['alumne'],at:'8:10',tried:[],
        hist:[{t:'8:10',k:'Avís d\'un alumne des de l\'app'}]},
      {id:'q4',aula:'206',cat:'furn',sym:'Cadira trencada',sev:1,reps:1,news:0,status:'done',by:['alumne'],at:'7:50',tried:[],res:'Peça reparada',
        hist:[{t:'8:20',k:'Resolta pel servei tècnic',r:'Peça reparada'},{t:'7:50',k:'Avís d\'un alumne des de l\'app'}]}
    ],
    log:[
      {id:1,t:'7:30',aula:'',kind:'auto',k:'Arrencada: aules preparades segons l\'horari'},
      {id:2,t:'7:50',aula:'206',kind:'inc',item:'q4',k:'Avís d\'un alumne: {x}',x:'Cadira trencada'},
      {id:3,t:'8:10',aula:'302',kind:'inc',item:'q3',k:'Avís d\'un alumne: {x}',x:'Llum fosa'},
      {id:4,t:'8:20',aula:'206',kind:'chg',item:'q4',k:'Resolta pel tècnic: {x}',x:'Cadira trencada',r:'Peça reparada'},
      {id:5,t:'8:45',aula:'114',kind:'inc',item:'q1',k:'Avís del professor: {x}',x:'No se sent'},
      {id:6,t:'8:50',aula:'205',kind:'inc',item:'q2',k:'Avís d\'un alumne: {x}',x:'No dona corrent'},
      {id:7,t:'8:52',aula:'205',kind:'auto',k:'Detecció automàtica: el projector no rep senyal'},
      {id:8,t:'8:58',aula:'205',kind:'inc',item:'q2',k:'Reavís: {x}',x:'No dona corrent'}
    ],
    push:[],alerts:[],reports:[],metrics:{},survey:null}}
  function load(){
    var raw=ls(KEY);
    if(raw){try{var o=JSON.parse(raw);if(o&&o.v===VER&&o.queue&&o.rs)return o}catch(e){}}
    return seed();
  }
  var S=load();
  function emit(){subs.forEach(function(f){f()})}
  function on(f){subs.push(f)}
  function save(){ls(KEY,JSON.stringify(S));emit()}
  window.addEventListener('storage',function(e){if(e.key===KEY||e.key===null){var old=S;S=load();liveNotice(old,S);emit()}});
  function item(id){return S.queue.filter(function(x){return x.id===id})[0]||null}
  function symText(it){return it.txt?it.txt:T(it.sym)+(it.num?' · '+T('endoll {n}',{n:it.num}):'')}
  function itLabel(it){return T('Aula')+' '+it.aula+' · '+T(CAT[it.cat].n)}
  function addLog(aula,kind,k,extra){
    var e={id:++S.ls+100,t:clock(),aula:aula,kind:kind,k:k};
    if(extra)for(var x in extra)e[x]=extra[x];
    S.log.push(e);
  }
  function addPush(title,body,vars){S.push.push({id:Date.now()+Math.random(),title:title,body:body,v:vars||null})}
  function openFor(aula,cat){return S.queue.filter(function(x){return x.aula===aula&&x.cat===cat&&x.status!=='done'})[0]||null}

  /* Un avís nou se suma a l'obert de la mateixa aula, categoria i endoll; si no n'hi ha, en crea un */
  function report(o){
    var it=S.queue.filter(function(x){return x.aula===o.aula&&x.cat===o.cat&&(x.num||'')===(o.num||'')&&!x.txt&&!o.txt&&x.status!=='done'})[0],merged=!!it;
    if(it){it.reps++;it.news++;if(o.sev>it.sev)it.sev=o.sev}
    else{
      it={id:'n'+(++S.seq),aula:o.aula,cat:o.cat,sym:CAT[o.cat].sym,txt:o.txt||'',num:o.num||'',sev:o.sev||2,reps:1,news:1,status:'open',by:[],at:clock(),tried:[],hist:[]};
      S.queue.push(it);
    }
    if(o.tried&&o.tried.length)it.tried=o.tried;
    if(o.photo)it.photo=true;
    if(it.by.indexOf(o.by)<0)it.by.push(o.by);
    it.hist.unshift({t:clock(),k:o.by==='alumne'?"Avís d'un alumne des de l'app":o.call?'Trucada del professor':'Avís del professor amb l\'assistent'});
    addLog(o.aula,'inc',merged?'Reavís: {x}':(o.by==='alumne'?"Avís d'un alumne: {x}":'Avís del professor: {x}'),{item:it.id,x:it.txt||it.sym,num:it.num});
    if(S.rs[o.aula]&&S.rs[o.aula].equip[o.cat])S.rs[o.aula].equip[o.cat]='bad';
    S.reports.push({by:o.by,item:it.id,merged:merged});
    save();
    return {item:it,merged:merged};
  }
  function reAvis(it){
    it.reps++;it.news++;
    it.hist.unshift({t:clock(),k:'L\'alumne hi torna a avisar'});
    addLog(it.aula,'inc','Reavís: {x}',{item:it.id,x:it.txt||it.sym,num:it.num});
    save();
  }
  function startItem(it){
    if(it.status!=='open')return;
    it.status='progress';it.news=0;
    it.hist.unshift({t:clock(),k:'El tècnic hi va'});
    addLog(it.aula,'chg','Tècnic en camí: {x}',{item:it.id,x:it.txt||it.sym,num:it.num});
    if(it.by.indexOf('alumne')>=0)addPush('El tècnic ja hi va','{x} · aula {a}',{x:it.txt||it.sym,num:it.num,a:it.aula});
  }
  function resolveItem(it,how,by){
    it.status='done';it.news=0;it.res=how||'';
    it.hist.unshift({t:clock(),k:by==='ia'?"Resolt pel professor amb l'assistent":'Resolta pel servei tècnic',r:how||''});
    addLog(it.aula,'chg',by==='ia'?'Resolta amb l\'assistent: {x}':'Resolta pel tècnic: {x}',{item:it.id,x:it.txt||it.sym,num:it.num,r:how||''});
    if(S.rs[it.aula]&&S.rs[it.aula].equip[it.cat])S.rs[it.aula].equip[it.cat]='ok';
    if(it.by.indexOf('alumne')>=0)addPush('Avís resolt','{x} · aula {a}',{x:it.txt||it.sym,num:it.num,a:it.aula});
  }
  function logText(e){
    var x=e.x?T(e.x)+(e.num?' · '+T('endoll {n}',{n:e.num}):''):'';
    return T(e.k,{x:x,n:e.n,a:e.a})+(e.r?' · '+T(e.r):'');
  }
  function pushText(p){
    var v=p.v||{},x=v.x?T(v.x)+(v.num?' · '+T('endoll {n}',{n:v.num}):''):'';
    return {title:T(p.title),body:T(p.body,{x:x,a:v.a,r:v.r})};
  }
  /* La temperatura s'acosta a l'objectiu poc a poc mentre la demo és oberta */
  setInterval(function(){
    var ch=false;
    Object.keys(S.rs).forEach(function(k){var r=S.rs[k];if(r.temp!==r.target){r.temp+=r.temp>r.target?-1:1;ch=true}});
    if(ch)save();
  },25000);

  /* ================= Registre d'ús (anònim, amb consentiment) ================= */
  var SID=ss('upchub-sid');
  if(!SID){SID=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);ss('upchub-sid',SID)}
  var LOGKEY='upchub-demo-log',pend=[],early=[];
  function consent(){return ls('upchub-demo-consent')}
  function localLog(){try{return JSON.parse(ls(LOGKEY)||'[]')}catch(e){return []}}
  function keepLocal(ev){var a=localLog();a.push(ev);if(a.length>4000)a=a.slice(-4000);ls(LOGKEY,JSON.stringify(a))}
  function curScreen(){return cur==='alumne'?A.step:cur==='professor'?B.step:cur==='tecnic'?C.step:''}
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
  function ctlName(el){
    var t=el.dataset.go||el.dataset.back||el.dataset.ctab||el.dataset.st||el.dataset.lst||el.dataset.eq||el.dataset.item||el.dataset.consent||el.dataset.act||'';
    var txt=(el.getAttribute('aria-label')||el.innerText||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);
    return (el.id?'#'+el.id+' ':'')+(t?'['+t+'] ':'')+txt;
  }
  document.addEventListener('click',function(e){
    var el=e.target.closest('button,a,summary,input[type=radio],input[type=checkbox]');
    if(!el||el.closest('.lang'))return;
    if(el.tagName==='INPUT')track('tria',el.name+'='+el.value);
    else track('clic',ctlName(el));
  },true);
  document.addEventListener('change',function(e){if(e.target.tagName==='SELECT')track('tria',e.target.id+'='+e.target.value)},true);

  /* ---------- Mesura de les tasques ---------- */
  var MIN={alumne:5,professor:5,tecnic:3},run=null;
  function startTask(role){run={role:role,t0:Date.now(),steps:0,hints:0}}
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
  var NEXT={alumne:['professor','Ara prova com a professor'],professor:['tecnic','Ara prova com a tècnic'],tecnic:['enquesta','Valorar la demo']};
  function renderResult(el,role){
    var m=S.metrics[role];if(!m){el.hidden=true;return}
    var nx=NEXT[role],note='';
    if(role==='tecnic'&&m.first)note=m.ok?T('Has obert primer la més urgent. Ben vist.'):T('No era la més urgent. Ho era: aula {a} · {e}.',{a:m.top.aula,e:T(CAT[m.top.cat].n)});
    if(role==='alumne'&&m.ok===false)note=T('Has avisat d\'una altra cosa. La tasca era l\'endoll, però també compta!');
    el.innerHTML='<h2>'+ico('i-check')+esc(T('Tasca completada'))+'</h2>'+
      '<div class="nums"><div><b>'+fmtTime(m.ms)+'</b><span>'+esc(T('Temps'))+'</span></div>'+
      '<div><b>'+m.steps+'</b><span>'+esc(T('Passos (mínim {n})',{n:m.min}))+'</span></div></div>'+
      (note?'<p>'+esc(note)+'</p>':'')+
      '<div class="seq"><p id="seq-'+role+'">'+esc(T('Com de fàcil ha estat?'))+'</p><div class="seqb" role="group" aria-labelledby="seq-'+role+'">'+
      [1,2,3,4,5].map(function(n){return '<button type="button" data-seq="'+n+'" aria-pressed="'+(m.seq===n)+'">'+n+'</button>'}).join('')+
      '</div><p class="ends"><span>'+esc(T('1 · Molt difícil'))+'</span><span>'+esc(T('5 · Molt fàcil'))+'</span></p></div>'+
      '<div class="acts"><a class="btn pri" href="#'+nx[0]+'">'+esc(T(nx[1]))+'</a></div>';
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
      if(m)p.innerHTML=ico('i-check')+esc(T('Fet · {t}',{t:fmtTime(m.ms)}));
    });
    var n=['alumne','professor','tecnic'].filter(function(r){return S.metrics[r]}).length;
    $('#h-prog').innerHTML=ico(n===3?'i-check':'i-list')+'<span>'+esc(T('{n} de 3 fetes',{n:n}))+' · '+esc(n===3?T('Ja pots valorar la demo.'):T('Ordre recomanat: alumne, professor, tècnic.'))+'</span>';
  }

  /* ---------- Pistes segons la pantalla ---------- */
  var HINTS={
    a1:'Prem el botó blau de baix per apropar el mòbil.',a2:'Prem «Avisar d\'un problema».',
    a3:'1: toca «Endoll». 2: tria com de greu és. 3: «Enviar l\'avís».',a4:'Aquí veus quan vindran. Si no ho arreglen, prem «Tornar a avisar».',a5:'Ja està. Torna a l\'inici.',
    b1:'Prem el botó de baix per apropar el mòbil.',b2:'Toca el projector en vermell.',
    b3:'Segueix els passos. Si no s\'arregla, el tècnic vindrà.'
  ,
    c1:'Obre la incidència de dalt: és la més urgent.',c2:'Prem «Resoldre» i tria què has fet.',c3:'Mira l\'historial.',c4:'Les pestanyes filtren per estat.'
  };
  function hintRender(){
    [['a',A.step],['b',B.step],['c',C.step]].forEach(function(x){var box=$('#'+x[0]+'-hint');if(box&&!box.hidden)box.textContent=T(HINTS[x[1]]||'Segueix les indicacions de la pantalla.')});
  }
  function hintsClose(){$$('.hintb').forEach(function(b){b.setAttribute('aria-expanded','false');$('#'+b.getAttribute('aria-controls')).hidden=true})}
  $$('.hintb').forEach(function(b){b.addEventListener('click',function(){
    var open=b.getAttribute('aria-expanded')!=='true';
    b.setAttribute('aria-expanded',open);$('#'+b.getAttribute('aria-controls')).hidden=!open;
    hintRender();
    if(open){track('pista',curScreen());if(run)run.hints++}
  })});

  /* ---------- Navegació entre pantalles ---------- */
  function Flow(root,onStep){
    var order=$$('.scr',root).map(function(s){return s.id}),cur=order[0];
    function go(id,mode){
      if(id===cur||!document.getElementById(id))return;
      var a=document.getElementById(cur),b=document.getElementById(id);
      var pos=mode==='back'?'prev':(order.indexOf(id)>order.indexOf(cur)?'next':'prev');
      b.dataset.pos=pos;b.classList.add('on');
      void b.offsetWidth;
      b.removeAttribute('data-pos');
      a.dataset.pos=pos==='next'?'prev':'next';a.classList.remove('on');a.classList.add('leaving');
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

  /* Barres del càlcul de prioritat (alumne i tècnic) */
  function calcHTML(it){
    var f=gua(it),bar=function(lbl,v,why){return '<li><span class="cl">'+esc(T(lbl))+'</span><span class="bar" aria-hidden="true"><i style="width:'+(v/3*100)+'%"></i></span><b>'+v+'/3</b><span class="why">'+esc(T(why))+'</span></li>'};
    return '<ul class="calc">'+
      bar('Gravetat',f.g,'El que has triat i el tipus d\'equip')+
      bar('Urgència',f.u,it.reps>1?'Hi ha classe ara i més d\'un avís':(ROOMS[it.aula].cls?'Hi ha classe ara':'Ara no hi ha classe'))+
      bar('Aforament',f.a,CAT[it.cat].whole?'Afecta tota l\'aula':'Afecta una persona')+
      '</ul><p class="small">'+esc(T('Prioritat {p}: {l}. Com més alta, abans hi va el tècnic.',{p:f.g+' × '+f.u+' × '+f.a+' = '+f.p,l:lc(T(LV[lvl(f.p)]))}))+'</p>';
  }
  function lc(s){return s.charAt(0).toLowerCase()+s.slice(1)}
  function sevDots(n){return '<span class="dots" data-n="'+n+'" aria-hidden="true"><i></i><i></i><i></i></span>'}

  /* ================= Alumne ================= */
  var A={step:'a1',card:false,last:null,photo:false,auto:null,seenPush:0,pushT:null};
  var aFlow=Flow($('[data-view="alumne"] .phone'),function(id){A.step=id;aCount();if(id==='a3')aFormPrep()});
  var aForm=$('#a-form'),aSend=$('#a-send');
  function aCount(){var n={a1:1,a2:2,a3:3,a4:4,a5:4}[A.step];$('#a-count').textContent=T('Alumne')+(n?' · '+T('Pas {n} de {t}',{n:n,t:4}):'')}
  function aCard(){
    var c=$('#a-card');c.dataset.on=A.card?'1':'0';
    $('#a-cstate').innerHTML=A.card?ico('i-check')+esc(T('Activat')):ico('i-nfc')+esc(T('Sense activar'));
    $('#a-lead').textContent=A.card?T('Carnet activat. Ja pots fer servir l\'app.'):T('Apropa el mòbil al lector');
    $('#a-tap').classList.toggle('done',A.card);
    $('#a-nfc').hidden=A.card;$('#a-open').hidden=!A.card;
  }
  $('#a-nfc').addEventListener('click',function(){
    var btn=this;if(btn.getAttribute('aria-busy')==='true')return;
    btn.setAttribute('aria-busy','true');$('#a-tap').classList.add('tapping');
    setTimeout(function(){
      $('#a-tap').classList.remove('tapping');btn.setAttribute('aria-busy','false');
      A.card=true;aCard();$('#a-open').focus();toast(T('Carnet activat'));
      A.auto=setTimeout(function(){if(A.step==='a1'&&cur==='alumne')aFlow.go('a2')},1800);
    },reduce?200:900);
  });
  $('#a-open').addEventListener('click',function(){clearTimeout(A.auto)});
  function aNums(){
    var v=($('input[name="a-num"]:checked')||{}).value;
    $('#a-nums').innerHTML=['1','2','3','4','5','6','7','8'].map(function(n){return '<input type="radio" name="a-num" id="an-'+n+'" value="'+n+'"'+(v===n?' checked':'')+'><label for="an-'+n+'">'+n+'</label>'}).join('')+
      '<input type="radio" name="a-num" id="an-x" value=""'+(v===''?' checked':'')+'><label for="an-x" class="wide">'+esc(T('No ho sé'))+'</label>';
  }
  function aFormPrep(){$('#a-aula').textContent=T('Aula')+' '+S.cur}
  function aFormReset(){
    aForm.reset();$$('.detail,#a-sevf,#a-photo-wrap',aForm).forEach(function(d){d.hidden=true});
    $$('.err',aForm).forEach(function(e){e.hidden=true});
    A.photo=false;$('#a-photo').hidden=true;$('#a-photo-add').hidden=false;busy(aSend,false);
  }
  aForm.addEventListener('change',function(e){
    if(e.target.name==='a-cat'){
      var c=e.target.value;$('#a-e1').hidden=true;
      $$('.detail',aForm).forEach(function(d){d.hidden=d.dataset.for!==c});
      $('#a-sevf').hidden=c==='temp';
      $('#a-photo-wrap').hidden=!(c==='plug'||c==='furn');
      if(c!=='plug'&&c!=='furn'){A.photo=false;$('#a-photo').hidden=true;$('#a-photo-add').hidden=false}
      var nxt=c==='temp'?$('.detail[data-for="temp"]',aForm):$('#a-sevf');if(nxt)setTimeout(function(){nxt.scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'})},60);
    }
    if(e.target.name==='a-sev')$('#a-e2').hidden=true;
    if(e.target.name==='a-temp')$('#a-e3').hidden=true;
  });
  $('#a-txt').addEventListener('input',function(){$('#a-e4').hidden=true});
  $('#a-photo-add').addEventListener('click',function(){A.photo=true;$('#a-photo').hidden=false;this.hidden=true;$('#a-photo-del').focus()});
  $('#a-photo-del').addEventListener('click',function(){A.photo=false;$('#a-photo').hidden=true;$('#a-photo-add').hidden=false;$('#a-photo-add').focus()});
  aForm.addEventListener('submit',function(e){
    e.preventDefault();
    if(aSend.getAttribute('aria-busy')==='true')return;
    var cat=($('input[name="a-cat"]:checked',aForm)||{}).value,sev=($('input[name="a-sev"]:checked',aForm)||{}).value,
        tmp=($('input[name="a-temp"]:checked',aForm)||{}).value,txt=$('#a-txt').value.trim();
    var bad=null;
    if(!cat)bad=['#a-e1','#ac-proj'];
    else if(cat==='temp'&&!tmp)bad=['#a-e3','#at-cold'];
    else if(cat==='other'&&!txt)bad=['#a-e4','#a-txt'];
    else if(cat!=='temp'&&!sev)bad=['#a-e2','#as-1'];
    if(bad){$(bad[0]).hidden=false;$(bad[1]).focus();track('error','alumne: '+bad[0]);return}
    busy(aSend,true);
    setTimeout(function(){
      if(cat==='temp'){aTemp(tmp)}
      else{
        A.last=report({aula:S.cur,cat:cat,sev:+sev,num:cat==='plug'?(($('input[name="a-num"]:checked')||{}).value||''):'',txt:cat==='other'?txt:'',by:'alumne',photo:A.photo});
        aFollow();aFlow.go('a4');
      }
      aFormReset();
      if(finishTask(MIN.alumne,{ok:cat==='plug'})){document.body.classList.remove('full');renderResult($('#a-result'),'alumne')}
    },reduce?150:600);
  });
  /* Fred o calor: no va al tècnic. L'aula es regula sola si surt dels límits; si no, s'avisa el professor */
  function aTemp(kind){
    var r=S.rs[S.cur],out=kind==='hot'?r.temp>LIM.max:r.temp<LIM.min,to=kind==='hot'?23:22;
    if(out){r.target=to}
    S.alerts.push({id:'al'+Date.now(),aula:S.cur,kind:kind,auto:out,to:to,t:clock(),done:false});
    addLog(S.cur,'auto',out?'Temperatura fora de límits: l\'aula es regula sola a {n} °C':'Avís de l\'alumnat ({x}): enviat al professor',{n:to,x:kind==='hot'?'Fa calor':'Fa fred'});
    save();
    $('#a-temp-h').textContent=out?T('L\'aula es regula sola'):T('Hem avisat el professor');
    $('#a-temp-p').textContent=out?T('Anirà cap a {n} °C en uns minuts. Aquest avís no va al servei tècnic.',{n:to}):T('El professor pot ajustar la temperatura des de l\'aula. Aquest avís no va al servei tècnic.');
    A.tempOut=out;A.tempTo=to;
    aFlow.go('a5');
  }
  function aFollow(){
    var it=A.last&&item(A.last.item?A.last.item.id:A.last);
    var box=$('#a-follow');if(!it){box.innerHTML='';return}
    var st=it.status,steps=[['Rebuda',1],['En curs',st!=='open'],['Resolta',st==='done']],now=false;
    box.innerHTML='<h2 tabindex="-1">'+ico(CAT[it.cat].i)+esc(symText(it))+'</h2>'+
      '<p class="sub">'+esc(T('Aula'))+' '+esc(it.aula)+' · '+esc(it.reps>1?T('{n} avisos',{n:it.reps}):T('1 avís'))+'</p>'+
      '<ol class="hsteps">'+steps.map(function(s){var c=s[1]?'done':'';return '<li class="'+c+'"><span class="dot">'+ico('i-check')+'</span>'+esc(T(s[0]))+'</li>'}).join('')+'</ol>'+
      (st==='done'?'<div class="eta ok">'+ico('i-check')+'<div><b>'+esc(T('Resolta'))+'</b><span>'+esc(it.res?T(it.res):T('El tècnic ja ho ha arreglat.'))+'</span></div></div>'
        :'<div class="eta">'+ico('i-clock')+'<div><span>'+esc(T('Temps d\'espera estimat'))+'</span><b>'+esc(etaTxt(it))+'</b></div></div>')+
      (st!=='done'?'<button type="button" class="btn sec block" id="a-again"><svg aria-hidden="true"><use href="icons.svg#i-reset"/></svg>'+esc(T('Tornar a avisar'))+'</button><p class="small center">'+esc(T('Si encara no està arreglat. Pujarà la prioritat.'))+'</p>':'')+
      '<details class="calcd"><summary>'+esc(T('Com es calcula?'))+'</summary>'+calcHTML(it)+'</details>';
  }
  $('#a-follow').addEventListener('click',function(e){
    if(!e.target.closest('#a-again'))return;
    var it=item(A.last.item?A.last.item.id:A.last);if(!it)return;
    reAvis(it);toast(T('Avís sumat. Nova espera: {e}',{e:etaTxt(it)}));
  });
  function aNow(){
    var moved=S.cur!=='205';
    $('#a-now').innerHTML='<div class="now-h"><span class="pin">'+ico('i-pin')+'</span><div><b>'+esc(T('Disseny Bàsic'))+'</b><span>'+esc(T('Ara · fins a les 11:00'))+'</span></div><span class="room-big">'+esc(S.cur)+'</span></div>'+
      (moved?'<p class="moved-note">'+ico('i-move')+esc(T('Canvi d\'aula: abans era la 205'))+'</p>':'');
  }
  function aMine(){
    var seen={},rows=S.reports.filter(function(r){return r.by==='alumne'}).reverse().filter(function(r){if(seen[r.item])return false;seen[r.item]=1;return item(r.item)}).map(function(r){
      var it=item(r.item),st=it.status==='done'?'Resolta':it.status==='progress'?'En curs':'Rebuda';
      return '<li><button type="button" class="mine-b" data-item="'+it.id+'"><span class="eq">'+ico(CAT[it.cat].i)+'</span><span class="t"><b>'+esc(symText(it))+'</b><span>'+esc(T(st))+(it.status!=='done'?' · '+esc(etaTxt(it)):'')+'</span></span>'+ico('i-right')+'</button></li>';
    });
    $('#a-mine').innerHTML=rows.length?rows.join(''):'<li class="empty">'+esc(T('Quan avisis d\'un problema, el veuràs aquí.'))+'</li>';
  }
  $('#a-mine').addEventListener('click',function(e){var b=e.target.closest('[data-item]');if(b){A.last=b.dataset.item;aFollow();aFlow.go('a4')}});
  function aBanner(p){
    var el=$('#a-push'),tx=pushText(p);
    el.innerHTML='<span class="lk-h">'+ico('i-grid')+'<b>'+esc(T('App del campus'))+'</b><time>'+esc(T('ara'))+'</time></span><b>'+esc(tx.title)+'</b><span>'+esc(tx.body)+'</span>';
    el.hidden=false;clearTimeout(A.pushT);A.pushT=setTimeout(function(){el.hidden=true},6000);
  }
  $('#a-push').addEventListener('click',function(){this.hidden=true});
  function aCheckPush(){
    var last=S.push[S.push.length-1];
    if(cur==='alumne'&&A.card&&last&&String(last.id)!==String(A.seenPush)){A.seenPush=last.id;aBanner(last)}
  }
  function aEnter(){
    aFlow.reset();aFormReset();A.card=false;A.last=null;aCard();aNums();
    clearTimeout(A.auto);$('#a-push').hidden=true;$('#a-result').hidden=true;
    var last=S.push[S.push.length-1];A.seenPush=last?last.id:0;
    aNow();aMine();aFollow();
    document.body.classList.add('full');
    hintsClose();startTask('alumne');
  }
  on(function(){aNow();aMine();if(A.step==='a4')aFollow();aCheckPush()});
  hooks.push(function(){aCount();aCard();aNums();aFormPrep();aNow();aMine();aFollow();
    if(A.step==='a5'){$('#a-temp-h').textContent=A.tempOut?T('L\'aula es regula sola'):T('Hem avisat el professor');$('#a-temp-p').textContent=A.tempOut?T('Anirà cap a {n} °C en uns minuts. Aquest avís no va al servei tècnic.',{n:A.tempTo}):T('El professor pot ajustar la temperatura des de l\'aula. Aquest avís no va al servei tècnic.')}
    if(!$('#a-result').hidden)renderResult($('#a-result'),'alumne')});

  /* ================= Professor ================= */
  var B={step:'b1',chat:null,prev:{},flash:{},ovl:null,opener:null};
  var bPhone=$('[data-view="professor"] .phone');
  var bFlow=Flow(bPhone,function(id){B.step=id;bCount();if(id==='b2')setTimeout(bAlert,500)});
  function bCount(){var n={b1:1,b2:2,b3:3}[B.step];$('#b-count').textContent=T('Professor')+' · '+T('Pas {n} de {t}',{n:n,t:3})}
  $('#b-nfc').addEventListener('click',function(){
    var btn=this;if(btn.getAttribute('aria-busy')==='true')return;
    btn.setAttribute('aria-busy','true');$('#b-tap').classList.add('tapping');
    setTimeout(function(){$('#b-tap').classList.remove('tapping');btn.setAttribute('aria-busy','false');bFlow.go('b2');toast(T('Sessió iniciada'))},reduce?200:900);
  });
  function eqState(aula,k){
    var r=S.rs[aula];if(r.equip[k]!=='bad')return {c:'',t:T('Funciona')};
    var it=openFor(aula,k);
    if(it&&it.status==='progress')return {c:'warn',t:T('Tècnic en camí')};
    if(it)return {c:'warn',t:T('Tècnic en {e}',{e:etaTxt(it)})};
    return {c:'bad',t:T('No funciona')};
  }
  function bDash(){
    var aula=S.cur,R=ROOMS[aula],r=S.rs[aula];
    $('#b-room-l').textContent=T('Aula')+' '+aula;
    $('#b-room').setAttribute('aria-label',T("Aula {a}. Toca per canviar d'aula.",{a:aula}));
    $('.chg',$('#b-room')).firstChild.nodeValue=T('Canviar');
    $('#b-cls').textContent=T('Disseny Bàsic')+' · 9:00–11:00';
    var bads=EQ4.filter(function(k){return r.equip[k]==='bad'}),sm=$('#b-summary');
    sm.className='summary '+(bads.length?'bad':'ok');
    sm.innerHTML=bads.length?ico('i-alert')+esc(bads.length>1?T('{n} equips no funcionen',{n:bads.length}):T('1 equip no funciona')):ico('i-check')+esc(T('Tot funciona'));
    var now=Date.now();
    $('#b-eqs').innerHTML=EQ4.map(function(k){
      var key=aula+k;if(B.prev[key]==='bad'&&r.equip[k]==='ok')B.flash[key]=now+1200;
      var st=eqState(aula,k);
      return '<li><button type="button" class="eqb '+st.c+(B.flash[key]>now?' ok-new':'')+'" data-eq="'+k+'" aria-label="'+esc(T(CAT[k].n)+': '+st.t)+'">'+ico(CAT[k].i)+'<b>'+esc(T(CAT[k].n))+'</b><span class="st"><i></i>'+esc(st.t)+'</span></button></li>';
    }).join('');
    EQ4.forEach(function(k){B.prev[aula+k]=r.equip[k]});
    var cool=r.temp>r.target,warm=r.temp<r.target;
    $('#b-temp').innerHTML='<div class="tval">'+ico('i-temp')+'<div><b>'+r.temp+' °C</b><span>'+esc(T('Objectiu {n} °C',{n:r.target}))+(cool?' · '+esc(T('refredant')):warm?' · '+esc(T('escalfant')):'')+'</span></div></div><button type="button" class="btn sec" id="b-adj">'+esc(T('Ajustar'))+'</button>';
  }
  bPhone.addEventListener('click',function(e){
    var eq=e.target.closest('[data-eq]');if(eq){var k=eq.dataset.eq;bChatOpen(k);return}
    if(e.target.closest('#b-adj'))bOvl('clima',null,e.target.closest('#b-adj'));
  });
  $('#b-help').addEventListener('click',function(){bChatOpen(null)});
  $('#b-room').addEventListener('click',function(){bOvl('room',null,this)});

  /* ---------- Xat amb l'assistent: sempre net en entrar ---------- */
  function bChatOpen(k){
    B.chat={eq:k,step:0,done:[],phase:k?'steps':'pick',txt:''};
    if(k&&S.rs[S.cur].equip[k]==='ok')B.chat.okNote=true;
    if(k&&openFor(S.cur,k))B.chat.phase='known';
    bChat();bFlow.go('b3');
  }
  function bChat(focus){
    var c=B.chat,box=$('#b-chat');if(!c){box.innerHTML='';return}
    var h=[],eqN=c.eq?T(CAT[c.eq].n):'';
    function bub(t,cls){h.push('<p class="bub'+(cls?' '+cls:'')+'">'+esc(t)+'</p>')}
    h.push('<h2 class="sr" tabindex="-1">'+esc(T('Assistent'))+'</h2>');
    if(c.phase==='pick'){
      bub(T('Hola! Què falla?'),'enter');
      h.push('<div class="picks enter">'+EQ4.map(function(k){return '<button type="button" class="pick" data-act="pick" data-eq2="'+k+'">'+ico(CAT[k].i)+'<span>'+esc(T(CAT[k].n))+'</span></button>'}).join('')+
        '<button type="button" class="pick" data-act="pick" data-eq2="other">'+ico('i-more')+'<span>'+esc(T('Altres'))+'</span></button></div>');
    }
    else if(c.phase==='known'){
      var it=openFor(S.cur,c.eq);
      bub(T('{e}: el tècnic ja està avisat.',{e:eqN}),'enter');
      h.push('<div class="eta enter">'+ico('i-clock')+'<div><span>'+esc(T('Arribada estimada'))+'</span><b>'+esc(it?etaTxt(it):'')+'</b></div></div>');
      h.push('<div class="acts col enter"><button type="button" class="btn sec block" data-act="steps">'+esc(T('Provar els passos igualment'))+'</button><button type="button" class="btn ghost block" data-back="b2">'+esc(T('Tornar al tauler'))+'</button></div>');
    }
    else if(c.phase==='other'){
      bub(T('Explica-ho en poques paraules:'),'enter');
      h.push('<div class="enter"><label class="sr" for="b-txt">'+esc(T('Què passa?'))+'</label><input type="text" id="b-txt" maxlength="80" autocomplete="off"><p class="err" id="b-txt-e" hidden>'+ico('i-alert')+esc(T('Escriu què passa.'))+'</p><button type="button" class="btn pri block" data-act="other-go">'+esc(T('Continuar'))+'</button></div>');
    }
    else if(c.phase==='steps'||c.phase==='ask'){
      var st=STEPS[c.eq],n=st.length,doneN=c.done.length;
      bub(c.okNote?T('{e} sembla que funciona. Provem-ho igualment:',{e:eqN}):T('{e}: provem 3 passos.',{e:eqN}),doneN?'':'enter');
      h.push('<div class="prog3"><span>'+esc(T('Pas {n} de {t}',{n:Math.min(doneN+1,n),t:n}))+'</span><span class="pbar" aria-hidden="true"><i style="width:'+(doneN/n*100)+'%"></i></span></div>');
      h.push('<ol class="scards">'+st.map(function(s,i){
        var d=c.done[i];
        if(d!==undefined)return '<li class="sc done'+(d?'':' fail')+'">'+ico(d?'i-check':'i-x')+'<span>'+esc(T(s[1]))+'</span><span class="sr">'+esc(d?T('Fet'):T('No ha funcionat'))+'</span></li>';
        if(i===doneN&&c.phase==='steps')return '<li class="sc now enter"><span class="sci">'+ico(s[0])+'</span><b>'+esc(T(s[1]))+'</b><div class="scb"><button type="button" class="btn pri" data-act="did">'+ico('i-check')+esc(T('Ho he fet'))+'</button><button type="button" class="btn sec" data-act="fail">'+esc(T('No funciona'))+'</button></div></li>';
        return '';
      }).join('')+'</ol>');
      if(c.phase==='ask')h.push('<div class="ask enter"><p>'+esc(T('S\'ha resolt?'))+'</p><div class="yn"><button type="button" class="btn pri" data-act="yes">'+esc(T('Sí'))+'</button><button type="button" class="btn sec" data-act="no">'+esc(T('No'))+'</button></div></div>');
    }
    else if(c.phase==='send'){
      bub(c.call?T('Truquem al tècnic. Com de greu és?'):T('Avisem el tècnic. Com de greu és?'),'enter');
      h.push('<div class="enter"><div class="sev" role="radiogroup" aria-label="'+esc(T('Com de greu és?'))+'">'+[1,2,3].map(function(n){
        return '<input type="radio" name="b-sev" id="bs-'+n+'" value="'+n+'"'+(c.sev===n?' checked':'')+'><label for="bs-'+n+'">'+sevDots(n)+'<b>'+esc(T(SEV[n]))+'</b></label>';
      }).join('')+'</div><p class="err" id="b-sev-e" hidden>'+ico('i-alert')+esc(T('Tria com de greu és.'))+'</p>'+
      '<button type="button" class="btn pri block" data-act="send">'+ico(c.call?'i-call':'i-send')+esc(c.call?T('Trucar ara'):T('Avisar el tècnic'))+'</button></div>');
    }
    else if(c.phase==='sent'){
      var it2=item(c.item);
      h.push('<div class="donebox enter"><span class="okmark">'+ico('i-check')+'</span><h3>'+esc(c.call?T('Trucada feta'):T('Tècnic avisat'))+'</h3>'+
        '<div class="eta">'+ico('i-clock')+'<div><span>'+esc(T('Arribada estimada'))+'</span><b>'+esc(it2?etaTxt(it2):'')+'</b></div></div>'+
        '<p class="small">'+esc(T('Pots seguir la classe. El tauler et mostrarà quan arribi.'))+'</p>'+
        '<button type="button" class="btn sec block" data-back="b2">'+esc(T('Tornar al tauler'))+'</button></div>');
    }
    else if(c.phase==='ok'){
      h.push('<div class="donebox enter"><span class="okmark">'+ico('i-check')+'</span><h3>'+esc(T('Perfecte, resolt!'))+'</h3><p class="small">'+esc(T('Queda anotat perquè el servei tècnic ho sàpiga.'))+'</p><button type="button" class="btn sec block" data-back="b2">'+esc(T('Tornar al tauler'))+'</button></div>');
    }
    box.innerHTML=h.join('');
    if(focus){
      var f=$('.enter input,.enter button',box);if(f)f.focus({preventScroll:true});
      var last=$$('.enter',box).pop();if(last)last.scrollIntoView({block:'nearest',behavior:reduce?'auto':'smooth'});
    }
    $('#b-call').hidden=c.phase==='sent'||c.phase==='ok'||c.phase==='send';
  }
  $('#b-chat').addEventListener('click',function(e){
    var b=e.target.closest('[data-act]');if(!b||!B.chat)return;
    var c=B.chat,a=b.dataset.act;
    if(a==='pick'){var k=b.dataset.eq2;if(k==='other'){c.eq='other';c.phase='other'}else{c.eq=k;c.phase=openFor(S.cur,k)?'known':'steps';c.okNote=S.rs[S.cur].equip[k]==='ok'}}
    else if(a==='steps'){c.phase='steps'}
    else if(a==='other-go'){var t=$('#b-txt').value.trim();if(!t){$('#b-txt-e').hidden=false;$('#b-txt').focus();return}c.txt=t;c.phase='send'}
    else if(a==='did'||a==='fail'){c.done.push(a==='did');if(c.done.length>=STEPS[c.eq].length)c.phase='ask'}
    else if(a==='yes'){
      var it=openFor(S.cur,c.eq);if(it){it.tried=bTried();resolveItem(it,'','ia')}
      if(S.rs[S.cur].equip[c.eq])S.rs[S.cur].equip[c.eq]='ok';
      addLog(S.cur,'chg','Resolta amb l\'assistent: {x}',{x:CAT[c.eq].n});save();
      c.phase='ok';bFinish();
    }
    else if(a==='no'){c.phase='send'}
    else if(a==='send'){
      var sv=($('input[name="b-sev"]:checked')||{}).value;
      if(!sv){$('#b-sev-e').hidden=false;$('#bs-1').focus();return}
      c.sev=+sv;
      var r=report({aula:S.cur,cat:c.eq==='other'?'other':c.eq,txt:c.txt||'',sev:c.sev,by:'professor',tried:bTried(),call:c.call});
      c.item=r.item.id;c.phase='sent';
      if(c.call)toast(T('Trucada simulada al servei tècnic'));
      bFinish();
    }
    bChat(true);
  });
  $('#b-chat').addEventListener('change',function(e){if(e.target.name==='b-sev'){B.chat.sev=+e.target.value;$('#b-sev-e').hidden=true}});
  $('#b-call').addEventListener('click',function(){
    var c=B.chat;if(!c)return;
    c.call=true;if(!c.eq)c.eq='other';if(c.eq==='other'&&!c.txt)c.txt=T('Trucada directa del professor');
    c.phase='send';bChat(true);
  });
  function bTried(){var c=B.chat;if(!c||!STEPS[c.eq])return [];return c.done.map(function(d,i){return [STEPS[c.eq][i][1],d?1:0]})}
  function bFinish(min){if(finishTask(min)){document.body.classList.remove('full');renderResult($('#b-result'),'professor')}}

  /* ---------- Fulls: canvi d'aula, climatització i avisos de l'alumnat ---------- */
  function bOvl(kind,data,opener){
    B.ovl={kind:kind,data:data,target:S.rs[S.cur].target,pick:null};B.opener=opener||null;
    bOvlRender();$('#b-ovl').hidden=false;$('#b-ovl-bg').hidden=false;$('#b-ovl-h').focus();
    track('full',kind);
  }
  function bOvlRender(){
    var o=B.ovl;if(!o)return;
    var h=$('#b-ovl-h'),b=$('#b-ovl-b');
    if(o.kind==='room'){
      h.textContent=T('Canviar d\'aula');
      var ids=Object.keys(ROOMS).sort(function(x,y){var r=function(id){return id===S.cur?0:ROOMS[id].busy?2:1};return r(x)-r(y)||x-y});
      b.innerHTML='<p class="small">'+esc(T('Aules lliures ara. Cal lloc per a 24 alumnes.'))+'</p><div class="rooms">'+ids.map(function(id){
        var R=ROOMS[id],isCur=id===S.cur,dis=!!R.busy&&!isCur;
        var line=isCur?T('Aula actual'):(R.busy?T(R.busy):T(R.free||'Lliure'))+' · '+T('{n} places',{n:R.cap});
        return '<div class="room-o'+(dis?' dis':'')+'"><input type="radio" name="b-rm" id="rm-'+id+'" value="'+id+'"'+(dis?' disabled':'')+(isCur?' checked':'')+'><label for="rm-'+id+'"><b>'+esc(T('Aula'))+' '+id+'</b><span>'+esc(line)+'</span></label></div>';
      }).join('')+'</div><button type="button" class="btn pri block" data-ov="room-go">'+esc(T('Canviar i avisar l\'alumnat'))+'</button>';
    }
    else if(o.kind==='solved'){
      h.textContent=T('Has resolt el problema?');
      b.innerHTML='<p>'+esc(T('A l\'aula {a} hi ha un avís obert. Si no està resolt, el tècnic hi anirà igualment.',{a:S.cur}))+'</p>'+
        '<div class="acts col"><button type="button" class="btn pri block" data-ov="keep">'+esc(T('No, que segueixi obert'))+'</button><button type="button" class="btn sec block" data-ov="solved">'+esc(T('Sí, ja està resolt'))+'</button></div>';
    }
    else if(o.kind==='clima'){
      var r=S.rs[S.cur];
      h.textContent=T('Temperatura');
      b.innerHTML='<p class="tnow">'+ico('i-temp')+'<b>'+r.temp+' °C</b> '+esc(T('ara'))+'</p>'+
        '<div class="stepper" role="group" aria-label="'+esc(T('Temperatura objectiu'))+'"><button type="button" class="ic-btn" data-ov="minus" aria-label="'+esc(T('Baixar un grau'))+'">'+ico('i-minus')+'</button><output id="b-tval" aria-live="polite">'+o.target+' °C</output><button type="button" class="ic-btn" data-ov="plus" aria-label="'+esc(T('Pujar un grau'))+'">'+ico('i-plus')+'</button></div>'+
        '<p class="small">'+esc(T('Entre {a} i {b} °C · límits establerts per Educació (exemple)',{a:LIM.min,b:LIM.max}))+'</p>'+
        '<button type="button" class="btn pri block" data-ov="apply">'+esc(T('Aplicar'))+'</button>';
    }
    else if(o.kind==='alert'){
      var al=o.data,hot=al.kind==='hot';
      h.textContent=T('Avís de l\'alumnat');
      b.innerHTML='<p class="alrt">'+ico(hot?'i-sun':'i-snow')+'<b>'+esc(hot?T('Un alumne diu que fa calor'):T('Un alumne diu que fa fred'))+'</b></p>'+
        (al.auto?'<p>'+esc(T('L\'aula s\'ha regulat sola a {n} °C.',{n:al.to}))+'</p><p class="small">'+esc(T('Fora dels límits establerts per Educació (exemple): {a}–{b} °C.',{a:LIM.min,b:LIM.max}))+'</p><button type="button" class="btn pri block" data-ov="ack">'+esc(T('D\'acord'))+'</button>'
        :'<p class="small">'+esc(T('Ara fa {t} °C, dins dels límits ({a}–{b} °C, exemple).',{t:S.rs[al.aula].temp,a:LIM.min,b:LIM.max}))+'</p><div class="acts col"><button type="button" class="btn pri block" data-ov="adjust">'+esc(T('Ajustar'))+'</button><button type="button" class="btn sec block" data-ov="ack">'+esc(T('Ja ho he fet'))+'</button><button type="button" class="btn ghost block" data-ov="ack">'+esc(T('Ignorar'))+'</button></div>');
    }
  }
  function bOvlClose(silent){
    if(!B.ovl)return;B.ovl=null;$('#b-ovl').hidden=true;$('#b-ovl-bg').hidden=true;
    if(!silent&&B.opener&&document.body.contains(B.opener))B.opener.focus();
  }
  $('#b-ovl-x').addEventListener('click',function(){bOvlClose()});
  $('#b-ovl-bg').addEventListener('click',function(){bOvlClose()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&B.ovl)bOvlClose()});
  $('#b-ovl').addEventListener('change',function(e){if(e.target.name==='b-rm')B.ovl.pick=e.target.value});
  $('#b-ovl').addEventListener('click',function(e){
    var t=e.target.closest('[data-ov]');if(!t||!B.ovl)return;
    var o=B.ovl,a=t.dataset.ov;
    if(a==='room-go'){
      var to=o.pick||S.cur;if(to===S.cur){bOvlClose();return}
      var open=S.queue.some(function(x){return x.aula===S.cur&&x.status!=='done'&&x.by.indexOf('professor')>=0});
      if(open){B.ovl={kind:'solved',to:to};bOvlRender();$('#b-ovl-h').focus();return}
      bMove(to);bOvlClose(true);
    }
    else if(a==='keep'||a==='solved'){
      if(a==='solved')S.queue.forEach(function(x){if(x.aula===S.cur&&x.status!=='done'&&x.by.indexOf('professor')>=0)resolveItem(x,'Resolt pel professor','ia')});
      bMove(o.to);bOvlClose(true);
    }
    else if(a==='minus'||a==='plus'){o.target=clamp(o.target+(a==='plus'?1:-1),LIM.min,LIM.max);$('#b-tval').textContent=o.target+' °C'}
    else if(a==='apply'){
      var r=S.rs[S.cur];if(o.target!==r.target){r.target=o.target;addLog(S.cur,'chg','Professor: objectiu de temperatura a {n} °C',{n:o.target});save()}
      if(o.alert){o.alert.done=true;save()}
      bOvlClose();toast(T('Objectiu: {n} °C',{n:o.target}));
    }
    else if(a==='ack'){o.data.done=true;addLog(o.data.aula,'chg','Professor: avís de temperatura atès');save();bOvlClose();setTimeout(bAlert,400)}
    else if(a==='adjust'){var al=o.data;al.done=true;save();B.ovl={kind:'clima',target:S.rs[S.cur].target,alert:al};bOvlRender();$('#b-ovl-h').focus()}
  });
  function bMove(to){
    var from=S.cur;S.cur=to;
    addPush('Canvi d\'aula','Disseny Bàsic continua a l\'aula {a}.',{a:to});
    addLog(from,'chg','Classe traslladada a l\'aula {a} pel professor',{a:to});
    save();toast(T('Ara ets a l\'aula {a}. Alumnat avisat.',{a:to}));
  }
  /* Avís emergent quan un alumne diu que fa fred o calor */
  function bAlert(){
    if(cur!=='professor'||B.step!=='b2'||B.ovl)return;
    var al=S.alerts.filter(function(x){return !x.done&&x.aula===S.cur})[0];
    if(al)bOvl('alert',al,$('#b-help'));
  }
  function bEnter(){
    bFlow.reset();B.chat=null;B.prev={};B.flash={};bOvlClose(true);
    $('#b-result').hidden=true;bDash();
    document.body.classList.add('full');
    hintsClose();startTask('professor');
  }
  on(function(){bDash();if(B.step==='b3'&&B.chat&&(B.chat.phase==='sent'||B.chat.phase==='known'))bChat();if(B.ovl&&B.ovl.kind!=='clima')bOvlRender();setTimeout(bAlert,300)});
  hooks.push(function(){bCount();bDash();bChat();bOvlRender();if(!$('#b-result').hidden)renderResult($('#b-result'),'professor')});

  /* ================= Tècnic ================= */
  var C={step:'c1',open:null,seen:null,msg:'',flash:{},html:'',st:'open',lst:'all',bld:''};
  var cMon=$('[data-view="tecnic"] .monitor');
  var cFlow=Flow(cMon,function(id){
    C.step=id;cCount();
    $$('[data-ctab]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.ctab===(id==='c4'?'c4':'c1'))});
    if(id==='c4')cLog();
  });
  function cCount(){var n={c1:1,c2:2,c3:3}[C.step];$('#c-count').textContent=T('Tècnic')+(n?' · '+T('Pas {n} de {t}',{n:n,t:3}):' · '+T('Historial'))}
  $$('[data-ctab]').forEach(function(b){b.addEventListener('click',function(){cFlow.go(b.dataset.ctab)})});
  $('#c-bld').addEventListener('change',function(){C.bld=this.value;C.html='';cQueue();cLog()});
  function inBld(aula){return !C.bld||!aula||(ROOMS[aula]&&ROOMS[aula].bld===C.bld)}
  function sorted(){return S.queue.slice().sort(function(a,b){return (a.status==='done')-(b.status==='done')||P(b)-P(a)||b.news-a.news})}
  function cQueue(){
    var all=sorted().filter(function(it){return inBld(it.aula)}),prev=C.seen;
    var nOpen=all.filter(function(x){return x.status!=='done'}).length;
    $('#c-n-open').textContent=nOpen;$('#c-n-done').textContent=all.length-nOpen;
    var q=all.filter(function(it){return C.st==='all'||(C.st==='open'?it.status!=='done':it.status==='done')});
    var now=Date.now(),html=q.map(function(it){
      if(prev&&(prev[it.id]===undefined||prev[it.id]<it.reps))C.flash[it.id]=now+1400;
      var p=P(it),l=lvl(p),done=it.status==='done';
      return '<li><button type="button" class="qrow '+(done?'low':l)+(done?' isdone':'')+(C.flash[it.id]>now?' flash':'')+'" data-item="'+it.id+'">'+
        '<span class="pv"><b>'+(done?ico('i-check'):p)+'</b><span>'+(done?esc(T('Fet')):'P')+'</span></span>'+
        '<span class="main"><b>'+ico(CAT[it.cat].i)+esc(itLabel(it))+'</b><span class="sym">'+esc(symText(it))+'</span>'+
        '<span class="meta">'+ico('i-building')+esc(T('Edifici {b}',{b:ROOMS[it.aula].bld}))+' · '+esc(it.at)+' · '+esc(it.reps>1?T('{n} avisos',{n:it.reps}):T('1 avís'))+'</span></span>'+
        '<span class="side">'+(done?'<span class="tag-st">'+esc(T('Resolta'))+'</span>':
          '<span class="badge '+l+'">'+esc(T(LV[l]))+'</span>'+sevDots(it.sev)+
          (it.news?'<span class="tag-new">'+esc(T('Nou'))+'</span>':'')+
          (it.status==='progress'?'<span class="tag-st">'+esc(T('En curs'))+'</span>':'')+
          '<span class="goal">'+esc(T('Espera {e}',{e:etaTxt(it)}))+'</span>')+'</span></button></li>';
    }).join('')||'<li class="empty">'+esc(T('Res en aquesta pestanya.'))+'</li>';
    if(html!==C.html)$('#c-queue').innerHTML=C.html=html;
    C.seen={};S.queue.forEach(function(it){C.seen[it.id]=it.reps});
  }
  $$('[data-st]').forEach(function(b){b.addEventListener('click',function(){C.st=b.dataset.st;$$('[data-st]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});cQueue()})});
  function cFicha(){
    var it=C.open&&item(C.open);if(!it)return;
    var f=gua(it),l=lvl(f.p),R=ROOMS[it.aula],r=S.rs[it.aula];
    var row=function(k,v){return '<dt>'+esc(T(k))+'</dt><dd>'+v+'</dd>'};
    $('#c-title').innerHTML='<h2 tabindex="-1">'+esc(itLabel(it))+'</h2><span class="badge '+l+'">'+esc(T(LV[l]))+'</span>'+
      (it.status==='done'?'<span class="tag-st">'+esc(T('Resolta'))+'</span>':it.status==='progress'?'<span class="tag-st">'+esc(T('En curs'))+'</span>':'');
    var room=EQ4.map(function(k){return T(CAT[k].n)+': '+T(r.equip[k]==='bad'?'falla':'bé')}).join(' · ')+' · '+r.temp+' °C · CO₂ '+(it.aula==='205'?820:640)+' ppm';
    $('#c-ficha').innerHTML='<dl class="ficha">'+
      row('Símptoma',esc(symText(it))+(it.photo?' · '+esc(T('amb foto')):''))+
      row('Gravetat percebuda',sevDots(it.sev)+' '+esc(T(SEV[it.sev]))+' <span class="small">('+esc(T('segons qui avisa'))+')</span>')+
      row('Avisos',esc(String(it.reps))+(it.reps>1?' · '+esc(T('{n} reavisos',{n:it.reps-1})):'')+(it.by.length?' · '+esc(it.by.map(function(b){return T(b==='alumne'?'alumnat':'professor')}).join(', ')):''))+
      row('Passos provats amb l\'assistent',it.tried.length?'<ul class="tried">'+it.tried.map(function(t){return '<li>'+ico(t[1]?'i-check':'i-x')+esc(T(t[0]))+'</li>'}).join('')+'</ul>':esc(T('Cap')))+
      row('Prioritat',calcHTML(it))+
      row('Espera estimada',esc(etaTxt(it)))+
      row('Aula','<span>'+esc(T('Edifici {b}',{b:R.bld}))+' · '+esc(T('{n} places',{n:R.cap}))+' · '+esc(R.cls?T('classe en curs'):T('sense classe ara'))+'</span><span class="gui">'+esc(room)+'</span>')+
      row('Historial','<ul class="hist">'+it.hist.map(function(h){return '<li><time>'+esc(T(h.t))+'</time><span>'+esc(T(h.k))+(h.r?' · '+esc(T(h.r)):'')+'</span></li>'}).join('')+'</ul>')+
      '</dl>';
    $('#c-start').hidden=it.status!=='open';
    $('#c-resolve').hidden=it.status==='done'||!$('#c-res').hidden;
    $('#c-acts').hidden=it.status==='done';
  }
  function cOpen(id){
    var it=item(id);if(!it)return;
    if(run&&run.role==='tecnic'&&!run.first&&it.status!=='done'){var top=sorted().filter(function(x){return x.status!=='done'})[0];run.first=id;run.top=top?{aula:top.aula,cat:top.cat}:null;run.ok=!!top&&top.id===id}
    C.open=id;it.news=0;$('#c-res').hidden=true;
    save();cFicha();cFlow.go('c2');
  }
  $('#c-queue').addEventListener('click',function(e){var b=e.target.closest('[data-item]');if(b)cOpen(b.dataset.item)});
  $('#c-start').addEventListener('click',function(){var it=item(C.open);if(!it)return;startItem(it);save();cFicha();toast(T('En curs. Qui ho ha avisat ho veu al mòbil.'));$('#c-resolve').focus()});
  $('#c-resolve').addEventListener('click',function(){
    var it=item(C.open);if(!it)return;
    var opts=RES[it.cat]||RES.other;
    $('#c-res-opts').innerHTML=opts.map(function(o,i){return '<label class="opt"><input type="radio" name="c-how" value="'+esc(o)+'"'+(i?'':' checked')+'><span>'+esc(T(o))+'</span></label>'}).join('');
    $('#c-res').hidden=false;this.hidden=true;$('#c-res-opts input').focus();
  });
  $('#c-res-x').addEventListener('click',function(){$('#c-res').hidden=true;$('#c-resolve').hidden=false;$('#c-resolve').focus()});
  $('#c-confirm').addEventListener('click',function(){
    var it=item(C.open);if(!it)return;
    var how=($('input[name="c-how"]:checked')||{}).value||'';
    if(it.status==='open')startItem(it);
    resolveItem(it,how,'tecnic');
    C.msg=S.rs[it.aula]&&S.rs[it.aula].equip[it.cat]?"L'equip torna a estar en verd al tauler del professor.":it.by.indexOf('alumne')>=0?"Qui ho va avisar rep una notificació al mòbil.":"Queda a l'historial.";
    var extra=run&&run.role==='tecnic'?{first:run.first,ok:run.ok,top:run.top}:null;
    $('#c-res').hidden=true;save();cMsg();cFlow.go('c3');
    if(finishTask(MIN.tecnic,extra))renderResult($('#c-result'),'tecnic');
  });
  function cMsg(){$('#c-done-msg').textContent=C.msg?T(C.msg):''}
  var KIND={auto:['i-spark','Automàtic'],inc:['i-alert','Avís'],chg:['i-wrench','Canvi']};
  function cLog(){
    var list=S.log.slice().reverse().filter(function(e){
      if(!inBld(e.aula))return false;
      if(C.lst==='all')return true;
      var it=e.item&&item(e.item);if(!it)return false;
      return C.lst==='open'?it.status!=='done':it.status==='done';
    });
    $('#c-log').innerHTML=list.map(function(e){
      var k=KIND[e.kind];
      return '<li class="lg-'+e.kind+'"><time>'+esc(e.t)+'</time><span class="lk">'+ico(k[0])+'<span class="sr">'+esc(T(k[1]))+'</span></span><span class="lt">'+(e.aula?'<b>'+esc(T('Aula'))+' '+esc(e.aula)+'</b> · ':'')+esc(logText(e))+'</span></li>';
    }).join('')||'<li class="empty">'+esc(T('Res en aquesta pestanya.'))+'</li>';
  }
  $$('[data-lst]').forEach(function(b){b.addEventListener('click',function(){C.lst=b.dataset.lst;$$('[data-lst]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});cLog()})});
  function cEnter(){
    cFlow.reset();C.open=null;C.seen=null;C.msg='';C.flash={};C.html='';$('#c-res').hidden=true;
    $('#c-result').hidden=true;cQueue();
    hintsClose();startTask('tecnic');
  }
  on(function(){cQueue();if(C.step==='c2')cFicha();if(C.step==='c4')cLog()});
  hooks.push(function(){cCount();C.html='';cQueue();cFicha();cMsg();cLog();if(!$('#c-result').hidden)renderResult($('#c-result'),'tecnic')});

  /* ================= Enquesta ================= */
  var ROLES=[['alumne','Alumne','i-phone'],['professor','Professor','i-laptop'],['tecnic','Tècnic','i-wrench']];
  var sForm=$('#s-form'),sSend=$('#s-send');
  var SMSG={sent:'Hem rebut les teves respostes. Moltes gràcies per ajudar-nos.',skip:'No hem enviat res. Gràcies igualment per provar la demo.',local:"Respostes desades en aquest navegador. L'equip les recollirà des d'aquí."};
  function sTasks(){
    $('#s-tasks').innerHTML=ROLES.map(function(r){
      var m=S.metrics[r[0]];
      return '<li class="'+(m?'ok':'')+'"><span class="ic">'+ico(m?'i-check':r[2])+'</span><span class="t"><b>'+esc(T(r[1]))+'</b><span>'+
        esc(m?T('Fet · {t}',{t:fmtTime(m.ms)}):T("Encara no l'has provada"))+'</span></span>'+
        (m?'':'<a class="btn ghost" href="#'+r[0]+'">'+esc(T('Provar'))+'</a>')+'</li>';
    }).join('');
  }
  function sView(){var done=!!S.survey;sForm.hidden=done;$('#s-thanks').hidden=!done;$('#s-thanks-msg').textContent=done?T(SMSG[S.survey.r]):''}
  function sTasksText(){
    return ROLES.map(function(r){
      var m=S.metrics[r[0]];if(!m)return r[0]+':-';
      return r[0]+':'+Math.round(m.ms/1000)+'s,'+m.steps+'p'+(m.ok!==undefined?(m.ok?',ok':',no'):'')+(m.seq?',facil'+m.seq:'')+(m.hints?',pistes'+m.hints:'');
    }).join(';');
  }
  function sDone(r,ans){S.survey={r:r,ans:ans||null};save();busy(sSend,false);sView();var h=$('#s-thanks h2');if(h)h.focus()}
  sForm.addEventListener('change',function(e){if(e.target.name==='s-und')$('#s-e1').hidden=true;if(e.target.name==='s-cla')$('#s-e2').hidden=true});
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
    post({kind:'survey',item:ans}).then(function(){sDone('sent')}).catch(function(){busy(sSend,false);$('#s-e3').hidden=false});
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
    var it={ts:new Date().toISOString(),s:SID,v:cur||'',sc:curScreen(),k:k,txt:t.slice(0,600),l:lang,dv:device()};
    keepLocal({ts:it.ts,s:SID,ty:'comentari',d:JSON.stringify(it)});
    track('comentari',k||'-');
    post({kind:'feedback',item:it});
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
      if(o&&o.status!=='done'&&it.status==='done'&&it.aula===b.cur)toast(T('Resolt: {x}',{x:itLabel(it)}));
    });
    if(cur==='tecnic'&&b.cur!==a.cur)toast(T('Canvi d\'aula: Disseny Bàsic a l\'aula {a}',{a:b.cur}));
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
  $('.skip').addEventListener('click',function(e){e.preventDefault();var t=$('.view:not([hidden]) h1');if(t)t.focus()});

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

  var q=null;try{q=new URL(location.href).searchParams.get('lang')}catch(e){}
  var saved=ls('upchub-lang'),navL=(navigator.language||'ca').slice(0,2).toLowerCase();
  route();
  setLang(SUP.indexOf(q)>=0?q:SUP.indexOf(saved)>=0?saved:(navL==='es'||navL==='en')?navL:'ca');
  track('inici',(navigator.language||'').slice(0,5)+' '+innerWidth+'x'+innerHeight);
})();
