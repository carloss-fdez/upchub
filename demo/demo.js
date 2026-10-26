/* UPCHub · Demo interactiva — estat compartit, rutes, mesura i recorreguts */
(function(){
  'use strict';
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
  function setLang(l){
    if(SUP.indexOf(l)<0)l='ca';
    applyLang(l);ls('upchub-lang',l);
    try{var u=new URL(location.href);u.searchParams.set('lang',l);history.replaceState(null,'',u)}catch(e){}
  }
  $$('.lang button').forEach(function(b){b.addEventListener('click',function(){setLang(b.dataset.lang)})});

  /* ---------- Dades del cas: aula 205, dilluns 9:00 (fictícies) ---------- */
  var EQ={
    proj:{n:'Projector',i:'i-screen',sym:'No mostra imatge'},
    audio:{n:'Àudio',i:'i-audio',sym:'No se sent'},
    pc:{n:'Ordinador',i:'i-pc',sym:'No arrenca'},
    dock:{n:'Dock USB-C',i:'i-dock',sym:'No detecta el portàtil'},
    plug:{n:'Endoll',i:'i-plug',sym:'No funciona'},
    air:{n:'Climatització',i:'i-wind',sym:'Temperatura incòmoda'},
    light:{n:'Llum',i:'i-bulb',sym:'Llum fosa'},
    other:{n:'Altres',i:'i-more',sym:'Altres problemes'}
  };
  /* P = G × U × I. Crític ≥ 12 · Alt 6–11 · Normal 3–5 · Baix < 3 */
  var LV={crit:{n:'Crític',goal:'15 min'},alt:{n:'Alt',goal:'El mateix dia'},norm:{n:'Normal',goal:'48 h'},low:{n:'Baix',goal:'Revisió setmanal'}};
  var GUI={proj:[3,2,2],pc:[3,2,2],audio:[2,2,2],dock:[2,2,2],plug:[2,1,2],air:[1,2,2],light:[1,1,2],other:[1,1,2]};
  function P(it){return it.g*it.u*it.i}
  function lvl(p){return p>=12?'crit':p>=6?'alt':p>=3?'norm':'low'}

  /* ---------- Estat compartit entre rols (localStorage, o memòria si no n'hi ha) ---------- */
  var KEY='upchub-demo-state',VER=1,subs=[];
  function seed(){return {v:VER,seq:0,
    equip:{proj:'bad',audio:'ok',pc:'ok',dock:'ok'},
    queue:[
      {id:'i205',aula:'205',eq:'proj',g:3,u:2,i:2,sym:'Sense imatge',at:'Dl 8:52',reps:1,news:0,status:'open',tried:[],
        hist:[{t:'Dl 8:52',k:"Detecció automàtica: el projector no rep senyal del dock"},{t:'Fa 12 dies',k:'Làmpada substituïda'}]},
      {id:'i114',aula:'114',eq:'plug',g:2,u:1,i:2,sym:'Endoll de taula trencat',at:'Dv 17:40',reps:1,news:0,status:'open',tried:[],
        hist:[{t:'Dv 17:40',k:"Avís d'un alumne des de l'app"}]},
      {id:'i302',aula:'302',eq:'light',g:1,u:1,i:2,sym:'Llum fosa',at:'Dj 12:15',reps:1,news:0,status:'open',tried:[],
        hist:[{t:'Dj 12:15',k:'Avís del professor des del dashboard'}]}
    ],
    reports:[],metrics:{}}}
  function load(){
    var raw=ls(KEY);
    if(raw){try{var o=JSON.parse(raw);if(o&&o.v===VER&&o.queue&&o.equip)return o}catch(e){}}
    return seed();
  }
  var S=load();
  function emit(){subs.forEach(function(f){f()})}
  function on(f){subs.push(f)}
  function save(){ls(KEY,JSON.stringify(S));emit()}
  window.addEventListener('storage',function(e){if(e.key===KEY||e.key===null){var old=S;S=load();liveNotice(old,S);emit()}});
  function item(id){return S.queue.filter(function(x){return x.id===id})[0]||null}

  /* Un avís nou se suma a la incidència oberta del mateix equip i aula; si no n'hi ha, en crea una */
  function report(o){
    var it=S.queue.filter(function(x){return x.aula===o.aula&&x.eq===o.eq&&x.status!=='done'})[0],merged=!!it;
    if(it){it.reps++;it.news++}
    else{
      var g=GUI[o.eq]||GUI.other;
      it={id:'n'+(++S.seq),aula:o.aula,eq:o.eq,g:g[0],u:g[1],i:g[2],sym:EQ[o.eq].sym,at:'Ara',reps:1,news:1,status:'open',tried:[],hist:[]};
      S.queue.push(it);
    }
    if(o.tried)it.tried=o.tried;
    if(o.photo)it.photo=true;
    it.hist.unshift({t:'Ara',k:o.by==='alumne'?"Avís d'un alumne des de l'app":'Avís del professor des del dashboard'});
    if(o.aula==='205'&&S.equip[o.eq])S.equip[o.eq]='bad';
    S.reports.push({by:o.by,item:it.id,merged:merged});
    save();
    return {item:it,merged:merged};
  }

  /* ---------- Utilitats ---------- */
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function ico(id){return '<svg aria-hidden="true"><use href="icons.svg#'+id+'"/></svg>'}
  function fmtTime(ms){var s=Math.max(1,Math.round(ms/1000));return s<60?s+' s':Math.floor(s/60)+' min '+('0'+s%60).slice(-2)+' s'}
  function statusLabel(st){return st==='done'?T('Resolta'):st==='progress'?T('En curs'):T('Rebuda')}
  function openItem(aula,eq){return S.queue.filter(function(x){return x.aula===aula&&x.eq===eq&&x.status!=='done'})[0]||null}
  /* Botó d'enviar: estat ocupat amb spinner, textos traduïbles a l'HTML */
  function busy(btn,b){
    btn.setAttribute('aria-busy',b);
    $$('.idle',btn).forEach(function(x){x.hidden=b});$$('.busy,.spin',btn).forEach(function(x){x.hidden=!b});
  }
  /* Seguiment d'un avís: rebut → en mans del tècnic → resolt */
  function trackHTML(it){
    var st=it.status,nowSet=false,steps=[
      ['Rebuda','Ara mateix',true],
      ['En mans del tècnic',st==='open'?"Quan l'obri a la cua":'Revisant-la',st!=='open'],
      ['Resolta',"Rebràs un avís a l'app",st==='done']
    ];
    return '<h3 class="sec-h">'+esc(T('Estat'))+'</h3><ol class="track">'+steps.map(function(s){
      var c=s[2]?'done':(!nowSet?(nowSet=true,'now'):'');
      return '<li class="'+c+'"><span class="dot">'+ico('i-check')+'</span><span><b>'+esc(T(s[0]))+'</b><span>'+esc(T(s[1]))+'</span></span></li>';
    }).join('')+'</ol>';
  }
  var toastT,toastEl=$('#toast');
  function toast(msg){toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){toastEl.classList.remove('on')},2600)}

  /* Alçada real de la banda, per a les posicions sticky */
  var band=$('.band');
  function bandH(){document.documentElement.style.setProperty('--band-h',band.offsetHeight+'px')}
  if(window.ResizeObserver)new ResizeObserver(bandH).observe(band);else addEventListener('resize',bandH);
  bandH();

  /* ---------- Mesura local: temps i passos per tasca, sense dades personals ---------- */
  var MIN={alumne:4,professor:5,tecnic:2},run=null;
  function startTask(role){run={role:role,t0:Date.now(),steps:0}}
  document.addEventListener('click',function(e){
    if(!run)return;
    var el=e.target.closest('button,a,input,select');if(!el||el.closest('.tpanel,.band'))return;
    var v=el.closest('[data-role]');if(v&&v.dataset.role===run.role)run.steps++;
  },true);
  function finishTask(min,extra){
    if(!run)return null;
    var m={ms:Date.now()-run.t0,steps:run.steps,min:min||MIN[run.role]};
    if(extra)for(var k in extra)m[k]=extra[k];
    S.metrics[run.role]=m;run=null;save();
    return m;
  }
  var NEXT={alumne:['tecnic','Mira-ho ara com a tècnic'],professor:['tecnic','Mira-ho ara com a tècnic'],tecnic:['professor','Mira-ho ara com a professor']};
  function renderResult(el,role){
    var m=S.metrics[role];if(!m){el.hidden=true;return}
    var nx=NEXT[role];
    el.innerHTML='<h2>'+ico('i-check')+esc(T('Tasca completada'))+'</h2>'+
      '<div class="nums"><div><b>'+fmtTime(m.ms)+'</b><span>'+esc(T('Temps'))+'</span></div>'+
      '<div><b>'+m.steps+'</b><span>'+esc(T('Passos (mínim {n})',{n:m.min}))+'</span></div></div>'+
      (m.first?'<p>'+esc(m.ok?T('Primera tria: la més urgent. Ben vist.'):T('Primera tria: no era la més urgent. Ho era: aula {a} · {e}.',{a:m.top.aula,e:T(EQ[m.top.eq].n)}))+'</p>':'')+
      '<p class="hint">'+esc(T('Només es guarda al teu navegador.'))+'</p>'+
      '<div class="acts"><a class="btn pri" href="#enquesta">'+esc(T('Valorar la demo'))+'</a><a class="btn sec" href="#'+nx[0]+'">'+esc(T(nx[1]))+'</a></div>';
    el.hidden=false;
  }
  function renderDone(){
    $$('[data-done]').forEach(function(p){
      var m=S.metrics[p.dataset.done];p.hidden=!m;
      if(m)p.innerHTML=ico('i-check')+esc(T('Fet · {t} · {n} passos',{t:fmtTime(m.ms),n:m.steps}));
    });
  }

  /* ---------- Pantalles dins d'un mòbil o d'una vista: transició endavant/enrere ---------- */
  function Flow(root,onStep){
    var order=$$('.scr',root).map(function(s){return s.id}),cur=order[0];
    function go(id){
      if(id===cur)return;
      var a=document.getElementById(cur),b=document.getElementById(id),fwd=order.indexOf(id)>order.indexOf(cur);
      b.dataset.pos=fwd?'next':'prev';b.classList.add('on');
      void b.offsetWidth;
      b.removeAttribute('data-pos');
      a.dataset.pos=fwd?'prev':'next';a.classList.remove('on');a.classList.add('leaving');
      setTimeout(function(){a.classList.remove('leaving')},300);
      cur=id;
      var h=$('h2',b);if(h)h.focus({preventScroll:true});
      if(onStep)onStep(id);
    }
    function reset(){
      order.forEach(function(id,i){var s=document.getElementById(id);s.classList.toggle('on',!i);s.classList.remove('leaving');if(i)s.dataset.pos='next';else s.removeAttribute('data-pos')});
      cur=order[0];if(onStep)onStep(cur);
    }
    root.addEventListener('click',function(e){
      var g=e.target.closest('[data-go]'),b=e.target.closest('[data-back]');
      if(g)go(g.dataset.go);else if(b)go(b.dataset.back);
    });
    return {go:go,reset:reset,cur:function(){return cur},size:order.length};
  }

  /* ================= Alumne ================= */
  var A={last:null,step:'a1',photo:false};
  var aFlow=Flow($('[data-view="alumne"] .phone'),function(id){A.step=id;aCount()});
  var aForm=$('#a-form'),aErr=$('#a-err'),aSend=$('#a-send');
  function aCount(){$('#a-count').textContent=T('Pantalla {n} de {t}',{n:A.step.slice(1),t:aFlow.size})}
  function aPhoto(onOff){A.photo=onOff;$('#a-photo').hidden=!onOff;$('#a-photo-add').hidden=onOff;(onOff?$('#a-photo-del'):$('#a-photo-add')).focus()}
  $('#a-photo-add').addEventListener('click',function(){aPhoto(true)});
  $('#a-photo-del').addEventListener('click',function(){aPhoto(false)});
  aForm.addEventListener('change',function(e){if(e.target.name==='a-type')aErr.hidden=true});
  aForm.addEventListener('submit',function(e){
    e.preventDefault();
    var t=$('input[name="a-type"]:checked',aForm);
    if(!t){aErr.hidden=false;$('#at-proj').focus();return}
    if(aSend.getAttribute('aria-busy')==='true')return;
    busy(aSend,true);
    setTimeout(function(){
      var r=report({aula:$('#a-aula').value,eq:t.value,by:'alumne',photo:A.photo});
      A.last=r;busy(aSend,false);
      aFlow.go('a4');
      if(finishTask()){document.body.classList.remove('full');renderResult($('#a-result'),'alumne')}
    },reduce?150:650);
  });
  function aSum(){
    var el=$('#a-sum'),it=A.last&&item(A.last.item.id);
    if(!it){el.innerHTML='';return}
    var l=lvl(P(it));
    el.innerHTML='<div class="card"><dl class="sum">'+
      '<dt>'+esc(T('Aula'))+'</dt><dd>'+esc(it.aula)+'</dd>'+
      '<dt>'+esc(T('Equip'))+'</dt><dd>'+esc(T(EQ[it.eq].n))+'</dd>'+
      '<dt>'+esc(T('Prioritat'))+'</dt><dd><span class="badge '+l+'">'+esc(T(LV[l].n))+'</span></dd>'+
      '<dt>'+esc(T('Objectiu'))+'</dt><dd>'+esc(T(LV[l].goal))+'</dd></dl></div>'+
      (A.last.merged?'<p class="merged">'+esc(T("Ja hi havia una incidència oberta d'aquest equip. Hi hem sumat el teu avís: ara en té {n}.",{n:it.reps}))+'</p>':'')+
      trackHTML(it);
  }
  function aMine(){
    var mine=S.reports.filter(function(r){return r.by==='alumne'}),ul=$('#a-mine'),seen={};
    var rows=mine.reverse().filter(function(r){if(seen[r.item])return false;seen[r.item]=1;return item(r.item)}).map(function(r){
      var it=item(r.item);
      return '<li class="card"><span class="eq">'+ico(EQ[it.eq].i)+'</span><span class="t"><b>'+esc(T(EQ[it.eq].n))+' · '+esc(T('Aula'))+' '+esc(it.aula)+'</b><span>'+esc(statusLabel(it.status))+'</span></span></li>';
    });
    ul.innerHTML=rows.length?rows.join(''):'<li class="empty">'+esc(T('Encara no has enviat cap avís.'))+'</li>';
  }
  function aEnter(){
    aFlow.reset();aForm.reset();aErr.hidden=true;busy(aSend,false);
    A.photo=false;$('#a-photo').hidden=true;$('#a-photo-add').hidden=false;
    A.last=null;$('#a-result').hidden=true;aSum();aMine();
    document.body.classList.add('full');
    startTask('alumne');
  }
  on(function(){aSum();aMine()});
  hooks.push(function(){aCount();aSum();aMine();if(!$('#a-result').hidden)renderResult($('#a-result'),'alumne')});

  /* ================= Professor ================= */
  var B={step:'b1',last:null,prev:{},flash:{},html:''},EQ205=['proj','audio','pc','dock'];
  var TRIED=['Comprova que el projector està encès','Reinicia la sortida de vídeo del dock',"Tria l'entrada HDMI 1"];
  var bFlow=Flow($('[data-view="professor"] .monitor'),function(id){
    B.step=id;bCount();
    if(id==='b2')bBoot();
    if(id==='b5')bFicha();
  });
  var bSend=$('#b-send');
  function bCount(){var n=+B.step.slice(1);$('#b-count').textContent=n>6?T('Pantalla {n} de {t}',{n:5,t:5}):T('Pantalla {n} de {t}',{n:n,t:6})}
  function eqState(k){
    if(S.equip[k]!=='bad')return {c:'',t:'Funciona'};
    var it=openItem('205',k);
    if(it&&it.status==='progress')return {c:'bad warn',t:'Tècnic en camí'};
    if(it&&(it.reps>1||it.tried.length))return {c:'bad',t:'Avisat al tècnic'};
    return {c:'bad',t:k==='proj'?'No rep senyal':'No funciona'};
  }
  function bBoot(){
    var bad=S.equip.proj==='bad',rows=[
      ['Identificació amb el carnet',0],['Aula 205 i horari reconeguts',0],
      ["Àudio, ordinador i dock connectats",0],[bad?'Projector: no rep senyal':'Projector connectat',bad],
      ['Climatització ajustada a 22 °C',0]];
    $('#b-boot').innerHTML=rows.map(function(r){
      return '<li class="'+(r[1]?'bad':'')+'"><span class="mk">'+ico(r[1]?'i-x':'i-check')+'</span>'+esc(T(r[0]))+'</li>';
    }).join('');
  }
  function bDash(){
    var bads=EQ205.filter(function(k){return S.equip[k]==='bad'}),sm=$('#b-summary');
    sm.className='summary '+(bads.length?'bad':'ok');
    sm.innerHTML=bads.length?ico('i-alert')+esc(T('Falla: {e}',{e:bads.map(function(k){return T(EQ[k].n)}).join(', ')})):ico('i-check')+esc(T('Tots els equips funcionen'));
    /* Un equip que passa a verd des d'una altra pestanya fa un destell; la llista només es repinta si canvia */
    var now=Date.now(),html=EQ205.map(function(k){
      if(B.prev[k]==='bad'&&S.equip[k]==='ok')B.flash[k]=now+1200;
      var st=eqState(k);
      return '<li class="'+st.c+(B.flash[k]>now?' ok-new':'')+'">'+ico(EQ[k].i)+'<b>'+esc(T(EQ[k].n))+'</b><span class="st"><i></i>'+esc(T(st.t))+'</span></li>';
    }).join('');
    if(html!==B.html)$('#b-eqs').innerHTML=B.html=html;
    EQ205.forEach(function(k){B.prev[k]=S.equip[k]});
  }
  function bFicha(){
    var it=openItem('205','proj'),g=it?[it.g,it.u,it.i]:GUI.proj,p=g[0]*g[1]*g[2],l=lvl(p);
    var row=function(k,v){return '<dt>'+esc(T(k))+'</dt><dd>'+v+'</dd>'};
    $('#b-ficha').innerHTML='<dl class="ficha">'+
      row('Aula',esc(T('205 · Disseny Bàsic, classe en curs')))+
      row('Equip',esc(T(EQ.proj.n)))+
      row('Símptoma',esc(T('No rep senyal del dock')))+
      row('Passos provats','<ul>'+TRIED.map(function(t){return '<li>'+esc(T(t))+'</li>'}).join('')+'</ul>')+
      row("Estat de l'aula",esc(T('Àudio, ordinador i dock funcionen · 22 °C · CO₂ 640 ppm')))+
      row('Avisos previs',esc(it?T('{n} a la cua',{n:it.reps}):T('Cap')))+
      row('Prioritat','<span class="badge '+l+'">'+esc(T(LV[l].n))+'</span><span class="pf">P = '+g.join(' × ')+' = '+p+'</span>')+
      row('Objectiu',esc(T(LV[l].goal)))+'</dl>';
  }
  function bSent(){
    var it=B.last&&item(B.last.item.id);if(!it)return;
    var l=lvl(P(it));
    $('#b-sent').textContent=T('Prioritat {l}: objectiu {g}.',{l:T(LV[l].n),g:T(LV[l].goal)});
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
    if(it){it.status='done';it.hist.unshift({t:'Ara',k:"Resolt pel professor amb l'assistent IA"})}
    S.equip.proj='ok';save();
    bFlow.go('b7');bFinish(4);
  });
  bSend.addEventListener('click',function(){
    if(bSend.getAttribute('aria-busy')==='true')return;
    busy(bSend,true);
    setTimeout(function(){
      B.last=report({aula:'205',eq:'proj',by:'professor',tried:TRIED.slice()});
      busy(bSend,false);bFlow.go('b6');bSent();bFinish();
    },reduce?150:650);
  });
  function bEnter(){
    bFlow.reset();busy(bSend,false);B.last=null;B.prev={};B.flash={};B.html='';
    $('#b-result').hidden=true;bDash();
    startTask('professor');
  }
  on(function(){bDash();if(B.step==='b2')bBoot();if(B.step==='b5')bFicha();bSent()});
  hooks.push(function(){bCount();bDash();bBoot();bFicha();bSent();if(!$('#b-result').hidden)renderResult($('#b-result'),'professor')});

  /* ================= Tècnic ================= */
  var C={step:'c1',open:null,seen:null,msg:'',flash:{},html:''};
  var cFlow=Flow($('[data-view="tecnic"] .monitor'),function(id){C.step=id;cCount()});
  function cCount(){$('#c-count').textContent=T('Pantalla {n} de {t}',{n:C.step.slice(1),t:3})}
  function openSorted(){return S.queue.filter(function(x){return x.status!=='done'}).sort(function(a,b){return P(b)-P(a)||b.news-a.news})}
  function itLabel(it){return T('Aula')+' '+it.aula+' · '+T(EQ[it.eq].n)}
  function cQueue(){
    var q=openSorted(),done=S.queue.filter(function(x){return x.status==='done'}),prev=C.seen;
    $('#c-open').textContent=T('{n} obertes',{n:q.length});
    var now=Date.now(),html=q.map(function(it){
      if(prev&&(prev[it.id]===undefined||prev[it.id]<it.reps))C.flash[it.id]=now+1400;
      var p=P(it),l=lvl(p),fl=C.flash[it.id]>now;
      return '<li><button type="button" class="qrow '+l+(fl?' flash':'')+'" data-item="'+it.id+'">'+
        '<span class="pv"><b>'+p+'</b><span>P</span></span>'+
        '<span class="main"><b>'+ico(EQ[it.eq].i)+esc(itLabel(it))+'</b><span class="sym">'+esc(T(it.sym))+'</span>'+
        '<span class="meta">'+esc(T(it.at))+' · '+esc(it.reps>1?T('{n} avisos',{n:it.reps}):T('1 avís'))+'</span></span>'+
        '<span class="side"><span class="badge '+l+'">'+esc(T(LV[l].n))+'</span>'+
        (it.news?'<span class="tag-new">'+esc(T('Nou'))+'</span>':'')+
        (it.status==='progress'?'<span class="tag-st">'+esc(T('En curs'))+'</span>':'')+
        '<span class="goal">'+esc(T('Objectiu: {g}',{g:T(LV[l].goal)}))+'</span></span></button></li>';
    }).join('')||'<li class="empty">'+esc(T('Cap incidència oberta.'))+'</li>';
    if(html!==C.html)$('#c-queue').innerHTML=C.html=html;
    C.seen={};q.forEach(function(it){C.seen[it.id]=it.reps});
    $('#c-done').innerHTML=done.map(function(it){return '<li>'+esc(itLabel(it))+' · '+esc(T(it.sym))+'</li>'}).join('')||'<li>'+esc(T('Cap encara.'))+'</li>';
  }
  function cFicha(){
    var it=C.open&&item(C.open);if(!it)return;
    var p=P(it),l=lvl(p),is205=it.aula==='205';
    var row=function(k,v){return '<dt>'+esc(T(k))+'</dt><dd>'+v+'</dd>'};
    $('#c-title').innerHTML='<h2 tabindex="-1">'+esc(itLabel(it))+'</h2><span class="badge '+l+'">'+esc(T(LV[l].n))+'</span>'+
      (it.status==='done'?'<span class="tag-st">'+esc(T('Resolta'))+'</span>':'');
    $('#c-ficha').innerHTML='<dl class="ficha">'+
      row('Símptoma',esc(T(it.sym)))+
      row('Prioritat','<b>P = '+it.g+' × '+it.u+' × '+it.i+' = '+p+'</b><span class="gui">'+esc(T('Gravetat {g} · urgència {u} · impacte {i} (escala 1–3)',{g:it.g,u:it.u,i:it.i}))+'</span>')+
      row('Objectiu',esc(T(LV[l].goal)))+
      row('Classe',esc(is205?T('Disseny Bàsic, classe en curs'):T('Sense classe ara')))+
      row("Estat de l'aula",esc(is205?T('Àudio, ordinador i dock funcionen · 22 °C · CO₂ 640 ppm'):'—'))+
      row('Avisos',esc(String(it.reps)))+
      (it.photo?row('Foto','<span class="thumb" role="img" aria-label="'+esc(T("Foto simulada d'un projector sense imatge"))+'"></span>'):'')+
      row('Passos provats',it.tried.length?'<ul>'+it.tried.map(function(t){return '<li>'+esc(T(t))+'</li>'}).join('')+'</ul>':esc(T('Cap encara')))+
      row('Historial','<ul class="hist">'+it.hist.map(function(h){return '<li><time>'+esc(T(h.t))+'</time><span>'+esc(T(h.k))+'</span></li>'}).join('')+'</ul>')+
      '</dl>';
    $('#c-resolve').hidden=it.status==='done';
  }
  function cMsg(){$('#c-done-msg').textContent=C.msg?T(C.msg):''}
  function cOpen(id){
    var it=item(id);if(!it)return;
    if(run&&run.role==='tecnic'&&!run.first){var top=openSorted()[0];run.first=id;run.top=top?{aula:top.aula,eq:top.eq}:null;run.ok=!!top&&top.id===id}
    C.open=id;it.news=0;
    if(it.status==='open'){it.status='progress';it.hist.unshift({t:'Ara',k:'Obert pel servei tècnic'})}
    save();cFicha();cFlow.go('c2');
  }
  $('#c-queue').addEventListener('click',function(e){var b=e.target.closest('[data-item]');if(b)cOpen(b.dataset.item)});
  $('#c-resolve').addEventListener('click',function(){
    var it=C.open&&item(C.open);if(!it)return;
    it.status='done';it.news=0;it.hist.unshift({t:'Ara',k:'Resolta pel servei tècnic'});
    if(it.aula==='205'&&S.equip[it.eq])S.equip[it.eq]='ok';
    C.msg=it.aula==='205'&&S.equip[it.eq]?"L'equip torna a estar en verd al tauler de l'aula 205, i qui ho va avisar rep la notificació a l'app.":"Qui ho va avisar rep la notificació a l'app.";
    var extra=run&&run.role==='tecnic'?{first:run.first,ok:run.ok,top:run.top}:null;
    save();cMsg();cFlow.go('c3');
    if(finishTask(MIN.tecnic,extra))renderResult($('#c-result'),'tecnic');
  });
  function cEnter(){
    cFlow.reset();C.open=null;C.seen=null;C.msg='';C.flash={};C.html='';
    $('#c-result').hidden=true;cQueue();
    startTask('tecnic');
  }
  on(function(){cQueue();if(C.step==='c2')cFicha()});
  hooks.push(function(){cCount();cQueue();cFicha();cMsg();if(!$('#c-result').hidden)renderResult($('#c-result'),'tecnic')});

  /* ---------- Avisos en directe quan una altra pestanya canvia l'estat ---------- */
  function liveNotice(a,b){
    var find=function(st,id){return st.queue.filter(function(x){return x.id===id})[0]};
    if(b.reports.length>a.reports.length&&cur==='tecnic'){
      var it=find(b,b.reports[b.reports.length-1].item);
      if(it)toast(T('Nou avís: {x}',{x:itLabel(it)}));
    }
    b.queue.forEach(function(it){
      var o=find(a,it.id);
      if(o&&o.status!=='done'&&it.status==='done'&&(cur==='professor'||cur==='alumne'))toast(T('Resolta: {x}',{x:itLabel(it)}));
    });
  }

  /* ---------- Rutes ---------- */
  var cur=null,ENTER={alumne:aEnter,professor:bEnter,tecnic:cEnter};
  function route(){
    var h=(location.hash||'').slice(1)||'home',v=$('.view[data-view="'+h+'"]')||$('.view[data-view="home"]');
    h=v.dataset.view;
    if(h===cur)return;
    var first=cur===null;cur=h;
    $$('.view').forEach(function(x){x.hidden=x!==v});
    document.body.classList.remove('full');run=null;
    if(ENTER[h])ENTER[h]();
    renderDone();
    window.scrollTo(0,0);
    if(!first){var t=$('h1',v);if(t)t.focus({preventScroll:true})}
  }
  addEventListener('hashchange',route);

  /* ---------- Reiniciar ---------- */
  $('#reset').addEventListener('click',function(){
    if(!confirm(T('Vols reiniciar la demo? Es tornaran a posar les dades d\'exemple i s\'esborraran els teus resultats.')))return;
    ls(KEY,null);S=seed();emit();
    cur=null;
    if(location.hash&&location.hash!=='#')location.hash='';else route();
    toast(T('Demo reiniciada'));
  });
  on(renderDone);
  hooks.push(renderDone);

  /* ---------- Idioma inicial: ?lang= > guardat > navegador > català ---------- */
  var q=null;try{q=new URL(location.href).searchParams.get('lang')}catch(e){}
  var saved=ls('upchub-lang'),navL=(navigator.language||'ca').slice(0,2).toLowerCase();
  route();
  setLang(SUP.indexOf(q)>=0?q:SUP.indexOf(saved)>=0?saved:(navL==='es'||navL==='en')?navL:'ca');

  /* Per a les fases següents (professor, tècnic, enquesta) */
  window.UPC_DEMO={S:function(){return S},save:save,on:on,report:report,item:item,P:P,lvl:lvl,EQ:EQ,LV:LV,T:T};
})();
