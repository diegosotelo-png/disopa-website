/**
 * DISOPA — receptor del formulario de contacto de la web.
 *
 * Va pegado en una Google Sheet (Extensiones → Apps Script) de la cuenta
 * disopa.pe@gmail.com y se publica como "Aplicación web". Por cada solicitud:
 *   1) la guarda como fila nueva en la hoja "Solicitudes" (estado "Nuevo"),
 *   2) avisa a DISOPA con un correo en español con botones de WhatsApp / llamar / responder,
 *   3) envía al cliente una confirmación de que su solicitud llegó.
 *
 * Pasos de instalación: ver LEEME.md en esta misma carpeta.
 */

const CFG = {
  DESTINO: 'disopa.pe@gmail.com',
  WHATSAPP: '51903522281',
  TELEFONO: '+51 903 522 281',
  WEB: 'https://diegosotelo-png.github.io/disopa-website/',
  HOJA: 'Solicitudes',
  AMBAR: '#F5A623',
  // freno anti-abuso: máximo de solicitudes por hora (la cuota gratis de Gmail es ~100 correos/día)
  MAX_POR_HORA: 30
};

const CAMPOS = ['Servicio', 'Urgencia', 'Ubicación', 'Detalle', 'Nombre', 'Celular', 'email'];
const LARGO_MAX = { Detalle: 2000, otro: 200 };
const ESTADOS = ['Nuevo', 'Llamado', 'Cotizado', 'Cerrado', 'Descartado'];

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p._honey) return respuesta_(true);            // bot que llenó el campo trampa: se descarta en silencio

    const d = {};
    CAMPOS.forEach(k => { d[k] = limpiar_(p[k], LARGO_MAX[k] || LARGO_MAX.otro); });
    if (!d.Nombre || !d.Servicio || !esCorreo_(d.email)) return respuesta_(false, 'datos');
    if (superaLimite_('global', CFG.MAX_POR_HORA, 3600)) return respuesta_(false, 'limite');

    const urgente = d.Urgencia.indexOf('URGENTE') > -1;
    const wa = enlaceWhatsApp_(d.Celular);

    guardar_(d, urgente, wa);
    avisarDisopa_(d, urgente, wa);
    // una sola confirmación por correo cada 6 h: evita usar el formulario para inundar el buzón de un tercero
    if (!superaLimite_('auto:' + d.email.toLowerCase(), 1, 21600)) confirmarCliente_(d);

    return respuesta_(true);
  } catch (err) {
    console.error(err);
    return respuesta_(false, 'error');
  }
}

/* ---------- hoja de solicitudes ---------- */

function guardar_(d, urgente, wa) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = hoja_();
    hoja.appendRow([
      new Date(), urgente ? 'URGENTE' : 'Normal', d.Nombre, d.Celular, d.email,
      d.Servicio, d['Ubicación'], d.Detalle, wa, 'Nuevo'
    ].map(celda_));
    const fila = hoja.getLastRow();
    if (urgente) hoja.getRange(fila, 1, 1, 10).setBackground('#FDECEA');
  } finally {
    lock.releaseLock();
  }
}

function hoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(CFG.HOJA);
  if (hoja) return hoja;
  hoja = libro.insertSheet(CFG.HOJA);
  hoja.appendRow(['Fecha', 'Urgencia', 'Nombre', 'Celular', 'Correo', 'Servicio', 'Ubicación', 'Detalle', 'WhatsApp', 'Estado']);
  hoja.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground(CFG.AMBAR);
  hoja.setFrozenRows(1);
  hoja.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');
  hoja.getRange('J2:J').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build()
  );
  return hoja;
}

/* ---------- correos ---------- */

function avisarDisopa_(d, urgente, wa) {
  const zona = d['Ubicación'];
  const asunto = (urgente ? '🔴 URGENTE · ' : 'Solicitud web · ') + (zona ? zona + ' · ' : '') + d.Nombre + ' — ' + d.Servicio;
  const filas = [
    ['Servicio', d.Servicio], ['Urgencia', d.Urgencia], ['Ubicación', zona], ['Detalle', d.Detalle],
    ['Nombre', d.Nombre], ['Celular', d.Celular], ['Correo', d.email]
  ].filter(f => f[1]).map(f =>
    '<tr><td style="padding:10px 14px;color:#666;width:120px;border-bottom:1px solid #eee">' + esc_(f[0]) +
    '</td><td style="padding:10px 14px;border-bottom:1px solid #eee;white-space:pre-wrap">' + esc_(f[1]) + '</td></tr>'
  ).join('');

  const botones = [
    wa && boton_('Escribir por WhatsApp', wa, '#25D366'),
    d.Celular && boton_('Llamar', 'tel:' + d.Celular.replace(/[^\d+]/g, ''), '#333'),
    boton_('Responder por correo', 'mailto:' + d.email, '#333')
  ].filter(Boolean).join(' ');

  const html = marco_(
    (urgente ? '<p style="margin:0 0 16px;padding:12px 14px;background:#FDECEA;border-left:4px solid #D93025;font-weight:bold">' +
      'URGENTE — el cliente indica que su pozo está detenido. Contáctelo cuanto antes.</p>' : '') +
    '<h2 style="margin:0 0 14px;font-size:20px">Nueva solicitud desde la web</h2>' +
    '<table style="width:100%;border-collapse:collapse;font-size:15px">' + filas + '</table>' +
    '<p style="margin:22px 0 8px">' + botones + '</p>' +
    '<p style="margin:18px 0 0;font-size:13px;color:#888">Todas las solicitudes: <a href="' +
      esc_(SpreadsheetApp.getActiveSpreadsheet().getUrl()) + '">hoja de solicitudes</a></p>'
  );

  MailApp.sendEmail({
    to: CFG.DESTINO, subject: asunto, htmlBody: html, name: 'Web DISOPA', replyTo: d.email
  });
}

function confirmarCliente_(d) {
  const html = marco_(
    '<h2 style="margin:0 0 14px;font-size:20px">Hola ' + esc_(d.Nombre.split(' ')[0]) + ', recibimos su solicitud</h2>' +
    '<p style="margin:0 0 14px;line-height:1.6">Gracias por escribir a DISOPA. Un especialista revisará su caso y lo contactará en <strong>menos de 24 horas hábiles</strong>.</p>' +
    '<p style="margin:0 0 14px;padding:12px 14px;background:#FFF6E5;border-left:4px solid ' + CFG.AMBAR + '">' +
      'Servicio solicitado: <strong>' + esc_(d.Servicio) + '</strong>' + (d['Ubicación'] ? '<br>Ubicación: ' + esc_(d['Ubicación']) : '') + '</p>' +
    '<p style="margin:0 0 18px;line-height:1.6">Si su pozo está detenido o el caso es urgente, no espere: escríbanos o llámenos al <strong>' + CFG.TELEFONO + '</strong>.</p>' +
    '<p style="margin:0">' + boton_('Escribir por WhatsApp', 'https://wa.me/' + CFG.WHATSAPP, '#25D366') + '</p>' +
    '<p style="margin:24px 0 0;line-height:1.6">Atentamente,<br><strong>Equipo DISOPA</strong><br>Hidrogeología · Pozos</p>'
  );
  MailApp.sendEmail({
    to: d.email, subject: 'Recibimos su solicitud — DISOPA', htmlBody: html, name: 'DISOPA', replyTo: CFG.DESTINO
  });
}

function marco_(contenido) {
  return '<div style="background:#f4f4f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#222">' +
    '<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">' +
    '<div style="background:#0A0A0B;padding:18px 24px;color:' + CFG.AMBAR + ';font-weight:bold;font-size:20px;letter-spacing:1px">' +
      'DISOPA <span style="color:#999;font-size:12px;font-weight:normal;letter-spacing:2px">HIDROGEOLOGÍA · POZOS</span></div>' +
    '<div style="padding:24px">' + contenido + '</div>' +
    '<div style="padding:14px 24px;background:#fafafa;font-size:12px;color:#888">' +
      'DISOPA · Ate, Lima, Perú · ' + CFG.TELEFONO + ' · <a href="' + CFG.WEB + '" style="color:#888">' + CFG.WEB.replace('https://', '') + '</a></div>' +
    '</div></div>';
}

function boton_(texto, url, color) {
  return '<a href="' + esc_(url) + '" style="display:inline-block;margin:0 6px 8px 0;padding:11px 18px;background:' + color +
    ';color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px">' + esc_(texto) + '</a>';
}

/* ---------- utilidades ---------- */

function respuesta_(ok, error) {
  return ContentService.createTextOutput(JSON.stringify({ success: ok ? 'true' : 'false', error: error || null }))
    .setMimeType(ContentService.MimeType.JSON);
}

function limpiar_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function esCorreo_(v) {
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(v);
}

function esc_(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* evita que un texto del cliente se ejecute como fórmula en la hoja (=, +, -, @) */
function celda_(v) {
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function enlaceWhatsApp_(cel) {
  let n = String(cel || '').replace(/\D/g, '');
  if (n.length === 9 && n[0] === '9') n = '51' + n;
  return n.length >= 9 ? 'https://wa.me/' + n : '';
}

function superaLimite_(clave, max, segundos) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(clave) || 0);
  if (n >= max) return true;
  cache.put(clave, String(n + 1), segundos);
  return false;
}

/* Ejecútela una vez desde el editor (▶ Ejecutar) para autorizar el envío de correos y crear la hoja. */
function probar() {
  hoja_();
  avisarDisopa_({
    Servicio: 'Video-inspección CCTV', Urgencia: 'URGENTE — pozo detenido', 'Ubicación': 'Ate, Lima',
    Detalle: 'Prueba de instalación del formulario.', Nombre: 'Prueba DISOPA', Celular: '903 522 281', email: CFG.DESTINO
  }, true, enlaceWhatsApp_('903522281'));
}
