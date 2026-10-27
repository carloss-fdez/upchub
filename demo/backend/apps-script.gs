/**
 * UPCHub · Demo — recollida anònima d'ús, enquestes i comentaris en un Google Sheet.
 *
 * Instal·lació (5 minuts), des del compte de Google de l'equip:
 *  1. Crea un Google Sheet nou (p. ex. «UPCHub demo — resultats»).
 *  2. Extensions → Apps Script. Esborra el codi que hi ha i enganxa aquest fitxer.
 *  3. Desa i prem «Implementa» → «Nova implementació» → tipus «Aplicació web».
 *     - Executa com a: Jo
 *     - Qui hi té accés: Qualsevol persona
 *  4. Autoritza-ho i copia l'URL acabada en /exec.
 *  5. Posa-la a ENDPOINT, al principi de demo/demo.js, i puja el ?v= de demo.js a demo/index.html.
 *
 * Fulls que es creen sols: «esdeveniments», «enquesta», «comentaris» i «resum».
 * No es desa cap dada personal: la demo només envia un identificador aleatori de sessió.
 */

var SHEETS = {
  esdeveniments: ['rebut', 'hora_client', 'sessio', 'vista', 'pantalla', 'tipus', 'detall', 'idioma', 'dispositiu'],
  enquesta: ['rebut', 'hora_client', 'sessio', 'entes', 'claredat', 'que_canviaries', 'tasques', 'idioma', 'dispositiu'],
  comentaris: ['rebut', 'hora_client', 'sessio', 'vista', 'pantalla', 'tipus', 'comentari', 'idioma', 'dispositiu']
};
var MAX_ITEMS = 200, MAX_LEN = 600;

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var now = new Date();
    if (body.kind === 'events' && Array.isArray(body.items)) {
      append('esdeveniments', body.items.slice(0, MAX_ITEMS).map(function (ev) {
        return [now, ev.ts, ev.s, ev.v, ev.sc, ev.ty, ev.d, ev.l, ev.dv];
      }));
    } else if (body.kind === 'survey' && body.item) {
      var a = body.item;
      append('enquesta', [[now, a.ts, a.s, a.understood, Number(a.clarity) || '', a.change, a.tasks, a.lang, a.device]]);
    } else if (body.kind === 'feedback' && body.item) {
      var f = body.item;
      append('comentaris', [[now, f.ts, f.s, f.v, f.sc, f.k, f.txt, f.l, f.dv]]);
    }
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('UPCHub demo: punt de recollida actiu');
}

function append(name, rows) {
  if (!rows.length) return;
  var sh = sheet(name);
  rows = rows.map(function (r) {
    return r.map(function (v) { return typeof v === 'string' ? v.slice(0, MAX_LEN) : (v == null ? '' : v); });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  summary();
}

function sheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold');
  }
  return sh;
}

/* Full «resum» amb fórmules: es crea una sola vegada i s'actualitza sol */
function summary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('resum')) return;
  ['esdeveniments', 'enquesta', 'comentaris'].forEach(sheet);
  var sh = ss.insertSheet('resum', 0);
  sh.getRange('A1:B1').setValues([['Indicador', 'Valor']]).setFontWeight('bold');
  sh.getRange('A2:B12').setFormulas([
    ['="Sessions"', '=IFERROR(COUNTUNIQUE(esdeveniments!C2:C),0)'],
    ['="Esdeveniments"', '=COUNTA(esdeveniments!A2:A)'],
    ['="Tasques acabades · alumne"', '=COUNTIFS(esdeveniments!F2:F,"tasca",esdeveniments!G2:G,"alumne*")'],
    ['="Tasques acabades · professor"', '=COUNTIFS(esdeveniments!F2:F,"tasca",esdeveniments!G2:G,"professor*")'],
    ['="Tasques acabades · tècnic"', '=COUNTIFS(esdeveniments!F2:F,"tasca",esdeveniments!G2:G,"tecnic*")'],
    ['="Errors de formulari"', '=COUNTIF(esdeveniments!F2:F,"error")'],
    ['="Respostes a l\'enquesta"', '=COUNTA(enquesta!A2:A)'],
    ['="Han entès UPCHub (sí)"', '=COUNTIF(enquesta!D2:D,"si")'],
    ['="Claredat mitjana (1-5)"', '=IFERROR(ROUND(AVERAGE(enquesta!E2:E),2),"")'],
    ['="Comentaris"', '=COUNTA(comentaris!A2:A)'],
    ['="Pantalles més vistes"', '=IFERROR(JOIN(", ",ARRAY_CONSTRAIN(QUERY(esdeveniments!E2:F,"select E, count(E) where F=\'pantalla\' group by E order by count(E) desc label count(E) \'\'",0),5,1)),"")']
  ]);
  sh.autoResizeColumns(1, 2);
}
