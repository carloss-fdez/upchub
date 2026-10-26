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
    $$('.rv').forEach(function(el,i){el.style.transitionDelay=(el.classList.contains('fcard')?(i%3)*80:0)+'ms';rv.observe(el)});
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

  /* ---------- Com funciona: recorregut amb autoplay ---------- */
  var steps=$$('.jstep'),frames=$$('.frame'),stage=$('#jstage'),cnt=$('#jcount'),playBtn=$('#jplay');
  var cur=0,DUR=6500,t0=0,elapsed=0,playing=!reduce,raf=null,visible=false,userPaused=false;
  function go(i,fromUser){
    cur=(i+steps.length)%steps.length;
    steps.forEach(function(s,k){
      s.toggleAttribute('aria-current',false);if(k===cur)s.setAttribute('aria-current','step');
      s.classList.toggle('past',k<cur);$('.bar i',s).style.width=k<cur?'100%':'0';
    });
    frames.forEach(function(f,k){f.classList.toggle('on',k===cur)});
    stage.classList.toggle('blue',frames[cur].dataset.bg==='blue');
    cnt.textContent=(cur+1)+' / '+steps.length;
    elapsed=0;t0=performance.now();
    if(fromUser&&matchMedia('(max-width:959px)').matches){var li=steps[cur].parentNode,ol=li.parentNode;ol.scrollTo({left:li.offsetLeft-ol.offsetLeft,behavior:reduce?'auto':'smooth'})}
  }
  function tick(now){
    if(!visible){raf=null;return}
    if(playing){
      elapsed+=now-t0;
      var p=Math.min(1,elapsed/DUR);$('.bar i',steps[cur]).style.width=(p*100)+'%';
      if(p>=1)go(cur+1);
    }
    t0=now;raf=requestAnimationFrame(tick);
  }
  function setPlay(p){
    playing=p;
    playBtn.innerHTML='<svg><use href="#'+(p?'i-pause':'i-play')+'"/></svg>';
    playBtn.setAttribute('aria-label',T(p?'Pausa':'Reprodueix'));
  }
  steps.forEach(function(s,k){s.addEventListener('click',function(){go(k,true);userPaused=true;setPlay(false)})});
  $('#jprev').addEventListener('click',function(){go(cur-1,true)});
  $('#jnext').addEventListener('click',function(){go(cur+1,true)});
  playBtn.addEventListener('click',function(){userPaused=playing;setPlay(!playing)});
  stage.addEventListener('mouseenter',function(){if(playing){stage.dataset.hold=1;setPlay(false)}});
  stage.addEventListener('mouseleave',function(){if(stage.dataset.hold){delete stage.dataset.hold;if(!userPaused)setPlay(true)}});
  var sx=null;
  stage.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});
  stage.addEventListener('touchend',function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){go(cur+(dx<0?1:-1),true);userPaused=true;setPlay(false)}sx=null});
  stage.addEventListener('keydown',function(e){if(e.key==='ArrowRight')go(cur+1,true);if(e.key==='ArrowLeft')go(cur-1,true)});
  function wake(){if(visible&&!raf)raf=requestAnimationFrame(function(n){t0=n;tick(n)})}
  if('IntersectionObserver' in window)new IntersectionObserver(function(es){visible=es[0].isIntersecting;wake()},{threshold:.35}).observe(stage);else visible=true;
  go(0);setPlay(playing);hooks.push(function(){cnt.textContent=(cur+1)+' / '+steps.length;setPlay(playing)});
  wake();

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

  /* ---------- Cua del servei tècnic ---------- */
  var Q=[
    {id:'205-0412',a:'205',t:'Projector sense senyal',g:4,u:4,i:1,iL:'+20 alumnes',av:2,when:'fa 2 min',cls:'Teoria · 28 places · Disseny Bàsic fins a les 11:00',sym:'Encès, sense senyal de vídeo a HDMI 1',src:['9:03 · Professora, des del dashboard','9:04 · Alumna, des de l\'appUPC'],tried:['Font canviada a HDMI 1 des del comandament','Sortida de vídeo del PC reiniciada en remot','Cable del dock revisat i encaixat'],rep:'Fallada repetida: 12 oct · mateix equip i símptoma · es va canviar el cable HDMI. Revisar l\'entrada del projector.'},
    {id:'112-0409',a:'112',t:'Àudio amb soroll',g:3,u:3,i:1,iL:'+20 alumnes',av:1,when:'fa 18 min',cls:'Laboratori · 24 places · Electrònica fins a les 12:00',sym:'Brunzit constant als altaveus quan el dock està connectat',src:['8:47 · Professor, des de l\'appUPC'],tried:['Volum i sortida del PC revisats','Controlador d\'àudio del dock reiniciat']},
    {id:'301-0398',a:'301',t:"L'aire no refreda",g:2,u:2,i:1,iL:'+20 alumnes',av:1,when:'ahir',cls:'Teoria · 40 places · lliure fins a les 15:00',sym:"26 °C amb l'AC encès des de fa una hora",src:['Ahir 16:10 · Sensor de l\'aula'],tried:['Consigna ajustada a 22 °C','Lectura dels sensors validada']},
    {id:'018-0401',a:'18',t:'Endoll del lloc 4 sense corrent',g:2,u:1,i:1,iL:'1 lloc',av:1,when:'fa 2 h',cls:'Taller · 16 places · sense classe ara',sym:'Un sol endoll del lloc 4 no dona corrent',src:['7:58 · Alumne, des de l\'appUPC'],tried:['Diferencial de l\'aula comprovat']}
  ];
  Q.forEach(function(q){q.p=q.g*q.u*q.i;q.s='open';q.mine=false});
  function lc(s){return s.charAt(0).toLowerCase()+s.slice(1)}
  function lv(p){return p>=12?['lv-c','Crític','15 min']:p>=6?['lv-a','Alt','El mateix dia']:p>=3?['lv-n','Normal','48 h']:['lv-b','Baix','Setmanal']}
  var qf='open',sel=Q[0].id,qi=$('#qitems'),qd=$('#qdetail');
  function renderQ(){
    var list=Q.filter(function(q){return q.s===qf}).sort(function(a,b){return b.p-a.p});
    $('#qt-open').textContent=T('Obertes')+' · '+Q.filter(function(q){return q.s==='open'}).length;
    $('#qt-done').textContent=T('Resoltes')+' · '+Q.filter(function(q){return q.s==='done'}).length;
    $$('.qtab').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.f===qf)});
    qi.innerHTML='';
    if(!list.length){qi.innerHTML='<div class="qempty">'+T(qf==='open'?'Cap incidència oberta. Bona feina!':'Encara no n\'has resolt cap.')+'</div>'}
    if(list.length&&!list.some(function(q){return q.id===sel}))sel=list[0].id;
    list.forEach(function(q){
      var L=lv(q.p),b=document.createElement('button');b.type='button';b.className='qi';b.setAttribute('aria-pressed',q.id===sel);
      b.innerHTML='<span class="pscore '+L[0]+'">'+q.p+'<small>'+T(L[1])+'</small></span><span><b>'+T('Aula')+' '+q.a+' · '+T(q.t)+'</b><span class="meta"><svg><use href="#i-clock"/></svg>'+T(q.when)+' · '+T('objectiu')+' '+lc(T(L[2]))+'</span></span>'+
        (q.s==='done'?'<span class="tag">'+T('Resolta')+'</span>':q.mine?'<span class="tag me">'+T('Teva')+'</span>':'<span class="tag">'+q.av+' '+T(q.av>1?'avisos':'avís')+'</span>');
      b.addEventListener('click',function(){sel=q.id;renderQ()});
      qi.appendChild(b);
    });
    renderD(list.filter(function(q){return q.id===sel})[0]);
  }
  function renderD(q){
    if(!q){qd.innerHTML='<div class="qempty" style="margin:auto">'+T('Selecciona una incidència per veure-la.')+'</div>';return}
    var L=lv(q.p);
    qd.innerHTML='<div class="qd-top"><div><small>'+T('FITXA')+' #'+q.id+'</small><h3>'+T('Aula')+' '+q.a+' · '+T(q.t)+'</h3><p>'+T(q.cls)+'</p></div><span class="lvl '+L[0]+'">'+T(L[1])+' · '+T(L[2])+'</span></div>'+
      '<div class="formula"><div class="f"><b>'+q.g+'</b><span>'+T('Gravetat')+'</span></div><span class="op">×</span><div class="f"><b>'+q.u+'</b><span>'+T('Urgència')+'</span></div><span class="op">×</span><div class="f"><b>'+q.i+'</b><span>'+T('Impacte')+' · '+T(q.iL)+'</span></div><span class="op">=</span><div class="f res '+L[0]+'"><b>'+q.p+'</b><span>'+T('Prioritat')+'</span></div></div>'+
      '<div class="box"><span class="cap2">'+T('Símptoma')+'</span>'+T(q.sym)+'<br><span class="small">'+q.src.map(T).join(' · ')+'</span></div>'+
      '<div class="box"><span class="cap2">'+T("Passos ja provats (IA de l'aula)")+'</span><ul>'+q.tried.map(function(t){return '<li><svg><use href="#i-check"/></svg>'+T(t)+'</li>'}).join('')+'</ul></div>'+
      (q.rep?'<div class="repeat">'+T(q.rep)+'</div>':'')+
      '<div class="qd-actions">'+(q.s==='open'?'<button type="button" class="btn" data-a="mine">'+T(q.mine?'Assignada a tu ✓':"M'ho assigno")+'</button><button type="button" class="btn done-btn" data-a="done">'+T('Marcar resolta')+'</button>':'<button type="button" class="btn sec" data-a="reopen">'+T('Reobrir')+'</button>')+'</div>';
    $$('[data-a]',qd).forEach(function(b){b.addEventListener('click',function(){
      var a=b.dataset.a;
      if(a==='mine')q.mine=!q.mine;
      if(a==='done'){q.s='done';q.mine=false}
      if(a==='reopen'){q.s='open'}
      renderQ();
    })});
  }
  $$('.qtab').forEach(function(b){b.addEventListener('click',function(){qf=b.dataset.f;renderQ()})});
  hooks.push(renderQ);

  /* ---------- Idioma inicial: ?lang= > guardat > navegador > català ---------- */
  var q=null;try{q=new URL(location.href).searchParams.get('lang')}catch(e){}
  var saved=store(null,'upchub-lang'),navL=(navigator.language||'ca').slice(0,2).toLowerCase();
  applyLang(SUP.indexOf(q)>-1?q:(SUP.indexOf(saved)>-1?saved:(SUP.indexOf(navL)>-1?navL:'ca')));
})();
