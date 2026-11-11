// Reads what an email CLAIMS about a case. Deterministic, so it can be tested.
// The LLM (when present) may add claims it read from a screenshot; those are
// passed through `mergeClaims`, which only accepts the same typed fields.

const MONEY = /(?:US\s?)?\$\s?(\d{1,5}(?:[.,]\d{2})?)|(\d{1,5}(?:[.,]\d{2})?)\s?(?:USD|dollars)/i;
const CASE_ID = /\bPP-[A-Z0-9]{1,3}-[A-Z0-9-]{4,20}\b/gi;
const TRACKING = /\b(9[1-5]\d{2}[ ]?(?:\d{4}[ ]?){4}\d{2}|1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2}|(?:YT|LP|UUS|CNG|SF|JD|LB)\d{8,18}|\d{12}|\d{15}|\d{20,22})\b/g;
const LABELLED_TRACKING = /(?:tracking|seguimiento|rastreo)(?:\s*(?:number|no\.?|#|n[uú]mero|code))?\s*(?:is|es)?\s*[:#]?\s*([A-Z]{0,4}\d[A-Z0-9]{8,28})\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+|\bwww\.[^\s<>"')]+/gi;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;

const amountNear = (text, idx) => {
  const window = text.slice(Math.max(0, idx - 80), idx + 120);
  const m = window.match(MONEY);
  return m ? Number((m[1] || m[2]).replace(",", ".")) : null;
};

export function extractClaims(raw = "") {
  const text = String(raw).replace(/\r/g, "");
  const lower = text.toLowerCase();
  const c = emptyClaims();

  const fromLine = text.match(/^\s*from:\s*(.+)$/im);
  if (fromLine) c.sender = fromLine[1].trim().slice(0, 200);

  // Refund claims: "refund has been issued/processed/sent/approved", "we refunded"
  // Spanish wording, so a translated scam isn't invisible.
  const es = {
    refund: /reembolso\s+(?:de\s+[^\n]{0,30}?)?(?:ya\s+)?(?:fue|ha\s+sido|est[aá])\s+(?:procesado|emitido|enviado|aprobado|completado)/i,
    closed: /(caso|disputa|reclamo|reclamaci[oó]n)\s+(?:ya\s+)?(?:fue|ha\s+sido|est[aá])\s+(cerrad[oa]|resuelt[oa])/i,
    noAction: /no\s+(?:necesita|tiene\s+que|debe)\s+hacer\s+nada/i,
    close: /(cierre|cancele|retire|cerrar|cancelar)\s+(?:su|el|la|tu)?\s*(caso|disputa|reclamo)/i,
    secret: /(c[oó]digo|contrase[nñ]a)/i,
    urgent: /(urgente|24\s*horas|inmediatamente|hoy mismo)/i,
  };
  const refundRe = /(refund(?:ed)?\s+(?:of\s+[^\n]{0,40}?)?(?:has\s+been|have\s+been|was|is\s+being|is|are)?\s*(?:issued|processed|sent|approved|completed|initiated|on its way|released|credited))|(issued\s+(?:you\s+)?(?:a\s+)?(?:full\s+|partial\s+)?refund)|(we(?:'ve| have)?\s+refunded)|(seller\s+(?:has\s+)?refunded)|(refund\s+(?:confirmation|confirmed|complete))|((?:agreed|approved)\s+(?:to\s+)?(?:a\s+|your\s+|the\s+)?(?:full\s+)?refund)|(refund\s+(?:is|has been)\s+approved)/i;
  const rm = lower.match(refundRe);
  if (rm) {
    const partial = /partial refund/i.test(text.slice(Math.max(0, rm.index - 40), rm.index + 80));
    c.refundClaimed = { amount: amountNear(text, rm.index), partial };
  }

  if (/(case|dispute|claim)\s+(?:has\s+been\s+|was\s+|is\s+now\s+|is\s+)?(closed|resolved|settled|completed)\b|(?:closed|resolved)\s+(?:your|the|this)\s+(case|dispute)|\b(?:case|dispute)\s+status:\s*(?:closed|resolved)/i.test(text)) c.caseClosedClaimed = true;
  if (/no (?:further )?action (?:is )?(?:required|needed)/i.test(text)) c.noActionNeeded = true;

  if (/(close|cancel|withdraw|end|drop|release|remove)\s+(?:(?:your|the|this|our|that)\s+)?(?:paypal\s+|open\s+)?(case|dispute|claim)|\bclose case\b|(mark\s+(?:the\s+)?(?:case|item|order)\s+as\s+(?:resolved|received|delivered))/i.test(text) || es.close.test(text)) c.asksToCloseCase = true;
  if (es.refund.test(text) && !c.refundClaimed) c.refundClaimed = { amount: amountNear(text, text.search(es.refund)), partial: false };
  if (es.closed.test(text)) c.caseClosedClaimed = true;
  if (es.noAction.test(text)) c.noActionNeeded = true;

  // Stalling: anything that asks her to wait or not escalate. Waiting is how cases lapse.
  if (/(no need to (?:escalate|do anything|take (?:any )?action|contact paypal)|(?:don'?t|do not|please don'?t)\s+(?:need to\s+)?(?:escalate|open a claim|contact paypal|do anything)|hold off|(?:allow|wait|give us|please wait)\s+(?:up to\s+|another\s+|an additional\s+)?\d{1,2}(?:\s*-\s*\d{1,2})?\s+(?:business\s+|working\s+)?days|be patient|you don'?t have to do anything)/i.test(text)) c.asksToWait = true;
  // Intent, sentence by sentence (round 3): reassurance about money or the case, and requests to hold back,
  // however they're worded. A negated sentence ("no refund has been issued") doesn't count.
  for (const sent of text.split(/(?<=[.!?¡¿])\s+|\n+/)) {
    if (/\b(no|not|n't|never|hasn'?t|haven'?t|isn'?t|wasn'?t|aun no|todav[ií]a no)\b/i.test(sent)) continue;
    const aboutMoneyOrCase = /\b(refund|reimburs\w*|credit\w*|money|funds|case|claim|dispute|reembolso|dinero|caso|reclamo|disputa)\b/i.test(sent);
    const resolved = /\b(resolved|settled|sorted|taken care of|all set|fixed|handled|processed|completed|approved|credited|issued|released|returned|reimbursed|covered|compensated|applied|refunded|on (?:its|the) way|arreglad[oa]s?|resuelt[oa]s?|solucionad[oa]s?|reembolsad[oa]s?|acreditad[oa]s?|devuelt[oa]s?|procesad[oa]s?|aprobad[oa]s?)\b/i.test(sent);
    if (aboutMoneyOrCase && resolved) c.outcomeClaimed = true;
    const holdBack = /\b(avoid|refrain|unnecessary|not necessary|no need|please don'?t|do not|would only|may (?:delay|slow|freeze|cancel|close)|could (?:delay|slow|freeze|cancel|close)|might (?:delay|slow|freeze|cancel|close)|duplicate|let us handle|we'?ll handle|leave it with us|no es necesario|evite|no abra|no escale|espere|d[ée]jenos)\b/i.test(sent);
    const aboutEscalating = /\b(claim|case|dispute|escalat\w*|paypal|report\w*|reclamo|caso|disputa|escalar|reportar)\b/i.test(sent);
    if (holdBack && aboutEscalating && !/\bphishing@paypal\.com\b/i.test(sent)) c.asksToWait = true;
  }

  // "Decided in your favor", "money will be returned": an outcome claim, even in the future tense.
  if (/((?:decided|decision\s+(?:was\s+|has\s+been\s+)?made|ruled|resolved|closed)\s+in\s+your\s+fav(?:o|ou)r|(?:will be|is being|has been|was|are being)\s+(?:returned|refunded|reimbursed|credited|sent back)\s+to\s+(?:you|your)|(?:money|funds|payment|refund)\s+(?:will be|is being|has been|was|is)\s+(?:returned|sent back|reimbursed|credited|on (?:its|the) way)|you(?:'ll| will) (?:be refunded|get your money|receive (?:your|a) refund)|(?:processed|sent|returned)\s+your\s+money(?:\s+back)?|money back)/i.test(text)) c.outcomeClaimed = true;

  const offer = text.match(/(?:offer(?:ed|ing)?|propos\w+)\s+(?:you\s+)?(?:a\s+)?(?:partial\s+refund\s+of\s+)?([$]?\s?\d{1,5}(?:[.,]\d{2})?\s?(?:USD|%)?)/i)
    || text.match(/partial refund of\s+([$]?\s?\d{1,5}(?:[.,]\d{2})?)/i);
  if (offer && /offer|partial/i.test(offer[0])) {
    const v = offer[1].trim();
    c.partialOffer = v.endsWith("%") ? { percent: Number(v.replace(/[^\d.]/g, "")) } : { amount: Number(v.replace(/[^\d.]/g, "")) };
  }
  if (/\b(?:you can |you may |please )?keep (?:the|your) (?:item|order|dress|product|package|goods|shoes|coat|bag|jacket|parcel)\b|\bkeep it\b|\byou can keep\b/i.test(text)) c.keepItemOffer = true;
  const sendBack = text.match(/(?:we|i)(?:'ll|'d| will| would| can| could)?\s+(?:send|refund|pay|transfer|zelle|venmo)\s+(?:you\s+)?(?:back\s+)?\$\s?(\d{1,5}(?:[.,]\d{2})?)/i);
  if (sendBack && !c.partialOffer && /back|directly|instead|outside|zelle|venmo|cash app/i.test(text)) c.partialOffer = { amount: Number(sendBack[1].replace(",", ".")), offPayPal: /zelle|venmo|cash app|bank|directly|outside/i.test(text) };

  const reship = /(re-?ship|resen[dt]|replacement|new tracking|shipped (?:again|a new))/i.test(text);
  const labelled = [...text.matchAll(LABELLED_TRACKING)].map((m) => m[1]);
  const tracks = [...new Set([...(text.match(TRACKING) || []), ...labelled].map((t) => t.replace(/\s/g, "").toUpperCase()))].filter((t) => !/^PP-/.test(t));
  if (tracks.length) c.trackingNumbers = tracks;
  if (reship) c.reshipmentClaimed = true;
  if (/(?:has been|was)\s+delivered|delivered\s+(?:to|on)/i.test(text) && !/not\s+(?:been\s+)?delivered/i.test(text)) c.deliveredClaimed = true;

  c.caseIds = [...new Set((text.match(CASE_ID) || []).map((s) => s.toUpperCase()))];
  c.links = [...new Set(text.match(URL_RE) || [])].slice(0, 10);
  c.phones = [...new Set(text.match(PHONE) || [])].slice(0, 5);

  if (/(log ?in|sign ?in|verify (?:your )?account|confirm (?:your )?(?:identity|account|details)|update (?:your )?(?:payment|billing))/i.test(text)) c.asksToSignInOrVerify = true;
  if (/(password|one[- ]time code|verification code|security code|\bOTP\b|PIN\b|card number|social security|\b\d[- ]?digit (?:code|number|pin)|code (?:we|that we|you) (?:sent|texted|received)|reply with (?:the|your|that) code)/i.test(text) || (es.secret.test(text) && /(env[ií]e|responda|comparta|ingrese|d[ée]nos)/i.test(text))) c.asksForSecret = true;
  if (/(gift card|crypto|bitcoin|zelle|wire transfer|western union|venmo|cash app)/i.test(text)) c.asksForOffPlatformPayment = true;
  if (/(within\s+\d{1,2}\s*(?:hours|hrs)|immediately|urgent|final notice|act now|today only|before the end of (?:the )?day|by (?:tonight|end of day)|account (?:will be )?(?:suspended|limited|locked))/i.test(text) || es.urgent.test(text)) c.urgency = true;
  c.aboutCase = /paypal|refund|reembolso|\bcase\b|\bcaso\b|dispute|disputa|claim|reclamo|order|pedido|package|parcel|paquete|tracking|seller|vendedor|shipment|env[ií]o/i.test(text) || c.caseIds.length > 0;

  return c;
}

export function emptyClaims() {
  return {
    sender: null,
    refundClaimed: null,          // { amount, partial }
    caseClosedClaimed: false,
    noActionNeeded: false,
    asksToCloseCase: false,
    partialOffer: null,           // { amount } | { percent }
    keepItemOffer: false,
    reshipmentClaimed: false,
    deliveredClaimed: false,
    trackingNumbers: [],
    caseIds: [],
    links: [],
    phones: [],
    asksToSignInOrVerify: false,
    asksForSecret: false,
    asksForOffPlatformPayment: false,
    urgency: false,
    asksToWait: false,
    outcomeClaimed: false,
    aboutCase: false,
  };
}

// Accept extra claims from the LLM only in the typed shape above (OR-merge).
export function mergeClaims(base, extra) {
  if (!extra || typeof extra !== "object") return base;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    const v = extra[k];
    if (v === undefined || v === null) continue;
    if (typeof base[k] === "boolean") out[k] = base[k] || v === true;
    else if (Array.isArray(base[k])) out[k] = [...new Set([...base[k], ...(Array.isArray(v) ? v.map(String).slice(0, 10) : [])])];
    else if (k === "sender") out[k] = base[k] || String(v).slice(0, 200);
    else if (k === "refundClaimed" && typeof v === "object") out[k] = base[k] || { amount: num(v.amount), partial: v.partial === true };
    else if (k === "partialOffer" && typeof v === "object") out[k] = base[k] || (v.percent != null ? { percent: num(v.percent) } : { amount: num(v.amount) });
  }
  out.trackingNumbers = out.trackingNumbers.map((t) => t.replace(/\s/g, ""));
  out.caseIds = out.caseIds.map((t) => t.toUpperCase());
  return out;
}
const num = (x) => (x == null || isNaN(Number(x)) ? null : Number(x));

export function hasAnyClaim(c) {
  return Boolean(c.refundClaimed || c.caseClosedClaimed || c.noActionNeeded || c.asksToCloseCase || c.partialOffer || c.keepItemOffer
    || c.reshipmentClaimed || c.deliveredClaimed || c.trackingNumbers.length || c.caseIds.length || c.asksToSignInOrVerify
    || c.asksForSecret || c.asksForOffPlatformPayment || c.urgency || c.links.length || c.phones.length || c.asksToWait || c.outcomeClaimed || c.aboutCase);
}
