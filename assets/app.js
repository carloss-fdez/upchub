/* UPCHub · v0.3 — interaccions */
(function(){
  window.UPC_READY=true;
  var $=function(s,c){return (c||document).querySelector(s)},$$=function(s,c){return [].slice.call((c||document).querySelectorAll(s))};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- i18n (ca = idioma base del HTML) ---------- */
  var DICT=window.UPC_I18N||{es:{},en:{}},lang='ca',hooks=[],SUP=['ca','es','en'];
  function norm(s){return s.replace(/\s+/g,' ').trim()}
  function T(s){var d=DICT[lang];return (d&&d[s])||s}
  function store(v,key){try{return v?localStorage.setItem(key,v):localStorage.getItem(key)}catch(e){return null}}
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
    applyLang(l);store(l,'upchub-lang');
    try{var u=new URL(location.href);u.searchParams.set('lang',l);history.replaceState(null,'',u)}catch(e){}
  }
  $$('.lang button').forEach(function(b){b.addEventListener('click',function(){setLang(b.dataset.lang)})});

  /* ---------- Capçalera: ombra, menú mòbil, secció activa ---------- */
  var top=$('.top'),nav=$('#nav'),mb=$('.menu-btn');
  function onScroll(){top.classList.toggle('scrolled',scrollY>8)}
  addEventListener('scroll',onScroll,{passive:true});onScroll();
  function closeMenu(){nav.classList.remove('open');mb.setAttribute('aria-expanded','false')}
  mb.addEventListener('click',function(){var o=!nav.classList.contains('open');nav.classList.toggle('open',o);mb.setAttribute('aria-expanded',o)});
  $$('a',nav).forEach(function(a){a.addEventListener('click',closeMenu)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu()});
  if('IntersectionObserver' in window){
    var links={};$$('a',nav).forEach(function(a){links[a.getAttribute('href').slice(1)]=a});
    var spy=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){$$('a',nav).forEach(function(a){a.classList.remove('act')});var a=links[e.target.id];if(a)a.classList.add('act')}
    })},{rootMargin:'-45% 0px -50% 0px'});
    Object.keys(links).forEach(function(id){var s=document.getElementById(id);if(s)spy.observe(s)});

    /* aparició en fer scroll */
    var rv=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');rv.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
    $$('.rv').forEach(function(el){rv.observe(el)});
  } else $$('.rv').forEach(function(el){el.classList.add('in')});

  /* ---------- Hero: avisos que van apareixent ---------- */
  var toasts=[
    {ic:'i-nfc',t:'Carnet detectat',s:'Lector NFC · 8:59'},
    {ic:'i-check',t:'Sessió llesta',s:'Aula 205 · 9:00'},
    {ic:'i-screen',t:'Projector i àudio',s:'Encesos pel dock'},
    {ic:'i-bell',t:'Incidència rebuda',s:'#205-0412 · dilluns 9:04'}
  ],ti=0,toast=$('#toast');
  function drawToast(){var c=toasts[ti];toast.innerHTML='<span class="ti"><svg><use href="#'+c.ic+'"/></svg></span><span><b>'+T(c.t)+'</b><small>'+T(c.s)+'</small></span>'}
  hooks.push(drawToast);
  if(!reduce)setInterval(function(){toast.classList.add('out');setTimeout(function(){ti=(ti+1)%toasts.length;drawToast();toast.classList.remove('out')},400)},3200);

  /* ---------- Demo de l'app ---------- */
  var flows=$$('#app .flow'),dsteps=$$('#dsteps li'),opts=$$('#opts .opt'),send=$('#send'),chat=$('#chat'),aiAct=$('#ai-actions');
  var timers=[],choice=null,state=0,chatLog=[],trackStep=0;
  var TRIES={
    'Projector':['Prem Font al comandament i tria HDMI 1','Reinicio la sortida de vídeo del PC','Comprova que el cable del dock està ben encaixat'],
    'Àudio':['Comprovo el volum i la sortida del PC','Reinicio el controlador d\'àudio del dock','Prova el micròfon sense fil'],
    'Ordinador':['Reinicio la teva sessió al PC de l\'aula','Comprovo la connexió de xarxa','Prova amb el teu portàtil al dock'],
    'Aire':['Llegeixo els sensors de l\'aula','Ajusto la consigna a 22 °C','Comprovo que les finestres estan tancades'],
    'Endoll':['Comprovo el circuit del lloc','Rearmo el diferencial de l\'aula','Prova l\'endoll del costat'],
    'Altres':['Recullo l\'estat de tots els equips','Reviso els avisos recents de l\'aula','Preparo la fitxa per al tècnic']
  };
  var TRACK=[['Rebuda','Ara · l\'avís ja és a la cua del tècnic'],['En revisió','El tècnic veu els passos ja provats'],['Tècnic en camí','Arribada estimada: 10 min'],['Resolta','Et notificarem a l\'app']];
  function clearT(){timers.forEach(clearTimeout);timers=[]}
  function later(f,ms){timers.push(setTimeout(f,reduce?0:ms))}
  function show(i){
    state=i;flows.forEach(function(f){f.classList.toggle('on',+f.dataset.i===i)});
    var s=i===3?1:i;
    dsteps.forEach(function(d,k){d.classList.toggle('on',k===s);d.classList.toggle('past',k<s||(i===3&&k===1))});
  }
  function taps(n){$$('.taps span').forEach(function(s,k){s.classList.toggle('on',k<n)})}
  opts.forEach(function(o){o.addEventListener('click',function(){
    choice=o.dataset.o;opts.forEach(function(x){x.setAttribute('aria-pressed',x===o)});send.disabled=false;taps(2);
  })});
  function renderChat(){
    chat.innerHTML='';
    chatLog.forEach(function(m){
      var el;
      if(m.k==='tries'){
        el=document.createElement('div');el.className='tries';
        el.innerHTML=TRIES[choice].map(function(t,k){var st=m.st[k];return '<div class="'+(st===2?'ok':st===1?'run':'')+'"><span class="n">'+(k+1)+'</span><span>'+T(t)+'</span><span class="s">'+(st===2?T('Fet'):st===1?T('Provant'):'')+'</span></div>'}).join('');
      } else {
        el=document.createElement('div');el.className='msg '+m.k;
        el.innerHTML=m.typing?'<span class="typing"><i></i><i></i><i></i></span>':m.html();
      }
      chat.appendChild(el);
    });
    chat.scrollTop=chat.scrollHeight;
  }
  function runAI(){
    var eq=T(choice).toLowerCase();
    chatLog=[{k:'me',html:function(){return T('No funciona:')+' '+T(choice).toLowerCase()}}];aiAct.hidden=true;renderChat();
    later(function(){chatLog.push({k:'ai',typing:true});renderChat()},500);
    later(function(){chatLog[1]={k:'ai',html:function(){return T("He revisat l'aula 205. Provem 3 passos senzills:")}};var tr={k:'tries',st:[1,0,0]};chatLog.push(tr);renderChat();
      later(function(){tr.st=[2,1,0];renderChat()},1100);
      later(function(){tr.st=[2,2,1];renderChat()},2200);
      later(function(){tr.st=[2,2,2];renderChat();
        later(function(){chatLog.push({k:'ai',html:function(){return T('Ha funcionat? Si no, aviso el tècnic amb la fitxa ja omplerta.')}});renderChat();aiAct.hidden=false},500);
      },3300);
    },1300);
  }
  function drawTrack(){$('#track').innerHTML=TRACK.map(function(s,k){return '<li class="'+(k<=trackStep?'on':'')+(k===trackStep&&k<3?' now':'')+'"><i></i><span><b>'+T(s[0])+'</b>'+(k===trackStep?'<span>'+T(s[1])+'</span>':'')+'</span></li>'}).join('')}
  function runTrack(){
    trackStep=0;drawTrack();
    [1,2].forEach(function(k){later(function(){trackStep=k;drawTrack()},k*2200)});
    $('#ticket').textContent='#205-0412 · '+T('dilluns')+' 9:04';
    $('#grouped').innerHTML='<b>'+T('Aula 205')+' · '+T(choice)+'<em>'+T('Crítica')+'</em></b>'+T("Ja hi havia un avís igual en aquesta aula: s'han agrupat (2 avisos). T'avisarem quan canviï l'estat.");
  }
  send.addEventListener('click',function(){if(!choice)return;taps(3);show(1);runAI()});
  $('#ai-ok').addEventListener('click',function(){clearT();show(3)});
  $('#ai-esc').addEventListener('click',function(){clearT();show(2);runTrack()});
  function restart(){clearT();choice=null;chatLog=[];opts.forEach(function(x){x.setAttribute('aria-pressed','false')});send.disabled=true;taps(0);show(0)}
  $('#restart').addEventListener('click',restart);
  hooks.push(function(){if(state===1)renderChat();if(state===2&&choice){drawTrack();$('#ticket').textContent='#205-0412 · '+T('dilluns')+' 9:04';$('#grouped').innerHTML='<b>'+T('Aula 205')+' · '+T(choice)+'<em>'+T('Crítica')+'</em></b>'+T("Ja hi havia un avís igual en aquesta aula: s'han agrupat (2 avisos). T'avisarem quan canviï l'estat.")}});
  restart();

  /* ---------- Preu: calculadora per centre ---------- */
  var range=$('#aules'),HW=1250,SW=150;
  function eur(n){var s=n.toLocaleString(lang==='en'?'en-GB':'es-ES',{maximumFractionDigits:0,useGrouping:'always'});return lang==='en'?'€'+s:s+' €'}
  function calc(){
    var n=+range.value;
    $('#aules-n').textContent=n+' '+T(n===1?'aula':'aules');
    $('#c-hw').textContent=eur(n*HW);$('#c-sw').textContent=eur(n*SW);$('#c-y1').textContent=eur(n*(HW+SW));
    range.style.setProperty('--p',((n-range.min)/(range.max-range.min)*100)+'%');
  }
  range.addEventListener('input',calc);hooks.push(calc);

  /* ---------- Idioma inicial: ?lang= > guardat > navegador > català ---------- */
  var q=null;try{q=new URL(location.href).searchParams.get('lang')}catch(e){}
  var saved=store(null,'upchub-lang'),navL=(navigator.language||'ca').slice(0,2).toLowerCase();
  applyLang(SUP.indexOf(q)>-1?q:(SUP.indexOf(saved)>-1?saved:(SUP.indexOf(navL)>-1?navL:'ca')));
})();
