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

// Sentence-level reading (round 4). A genuine-email game showed whole-text patterns flag honest mail:
// "I haven't issued a refund yet" read as a refund, "Once a case is closed..." as a closed case,
// "PayPal will never ask for your password" as a request for one. So most claims are now read one
// sentence at a time, and only from sentences that assert something: not negated, not conditional,
// not a generic statement about "a case".
const NEG = /\b(no|not|never|nunca|cannot|aun no|todav[ií]a no)\b|n['’]t\b/i;
const COND = /\b(if|once|unless|whether|would|should|could|might|can|may|in case|after|before|by the time|si|cuando|una vez|despu[eé]s|puede)\b/i;
const GENERIC = /\b(?:a|any|every|un|cualquier)\s+(?:case|dispute|claim|caso|disputa|reclamo)\b|\b(?:requests|orders|refunds|claims|cases) (?:are|get|will be)\b/i;
// Whose case? Someone else's dispute ("my claim", "the dispute on our side", "el reclamo que abrimos") isn't hers.
const OTHERS = /\b(my|our|mi|nuestro)\s+(?:own\s+)?(?:case|claim|dispute|refund|reclamo|caso|disputa)\b|\bon our (?:side|end)\b|\bwe (?:opened|filed|started)\b|que abrimos|abrimos con/i;
const CARRIER = /\b(search|missing mail|ticket|inquiry|usps|ups|fedex|dhl|carrier|courier|post office|correo postal)\b/i;

export function extractClaims(raw = "") {
  const text = String(raw).replace(/\r/g, "");
  const c = emptyClaims();

  const fromLine = text.match(/^\s*from:\s*(.+)$/im);
  if (fromLine) c.sender = fromLine[1].trim().slice(0, 200);

  // Sentences, each knowing whether it sits under a conditional heading ("What happens if you accept").
  const sentences = [];
  for (const para of text.split(/\n\s*\n/)) {
    const lines = para.split(/\n/);
    const condBlock = /^\s*(?:what happens\s+)?(?:if|when|once|si|qu[eé] pasa si)\b/i.test(lines[0] || "") && !/[.!?]\s*$/.test(lines[0]);
    for (const x of para.split(/(?<=[.!?¡¿])\s+|\n+/).map((y) => y.trim()).filter(Boolean)) sentences.push(condBlock ? `if: ${x}` : x);
  }
  const refundRe = /(refund(?:ed)?\s+(?:of\s+[^\n]{0,40}?)?(?:has\s+been|have\s+been|was|is\s+being|is|are)?\s*(?:issued|processed|sent|approved|completed|initiated|on its way|released|credited))|(issued\s+(?:you\s+)?(?:a\s+)?(?:full\s+|partial\s+)?refund)|(we(?:'ve| have)?\s+refunded)|(seller\s+(?:has\s+)?refunded)|(refund\s+(?:confirmation|confirmed|complete))|((?:agreed|approved)\s+(?:to\s+)?(?:a\s+|your\s+|the\s+)?(?:full\s+)?refund)|(refund\s+(?:is|has been)\s+approved)|(reembolso\s+(?:de\s+[^\n]{0,30}?)?(?:ya\s+)?(?:fue|ha\s+sido|est[aá])\s+(?:procesado|emitido|enviado|aprobado|completado))/i;
  const closedRe = /(case|dispute|claim|caso|disputa|reclamo|reclamaci[oó]n)\s+(?:has\s+been\s+|was\s+|is\s+now\s+|is\s+|ya\s+fue\s+|fue\s+|ha\s+sido\s+|est[aá]\s+)?(closed|resolved|settled|completed|cerrad[oa]|resuelt[oa])\b|(?:closed|resolved)\s+(?:your|the|this)\s+(case|dispute)|\b(?:case|dispute)\s+status:\s*(?:closed|resolved)/i;
  const closeReq = /(close|cancel|withdraw|end|drop|release|remove)\s+(?:(?:your|the|this|our|that)\s+)?(?:paypal\s+|open\s+)?(case|dispute|claim)|\bclose case\b|(mark\s+(?:the\s+)?(?:case|item|order)\s+as\s+(?:resolved|received|delivered))|(cierre|cancele|retire|cerrar|cancelar)\s+(?:su|el|la|tu)?\s*(caso|disputa|reclamo)/i;
  const outcomeRe = /((?:decided|decision\s+(?:was\s+|has\s+been\s+)?made|ruled|resolved|closed)\s+in\s+your\s+fav(?:o|ou)r|(?:will be|is being|has been|was|are being)\s+(?:returned|refunded|reimbursed|credited|sent back)\s+to\s+(?:you|your)|(?:money|funds|refund)\s+(?:will be|is being|has been|was|is)\s+(?:returned|sent back|reimbursed|credited|on (?:its|the) way)|you(?:'ll| will) (?:be refunded|get your money|receive (?:your|a) refund)|(?:processed|sent|returned)\s+your\s+money(?:\s+back)?)/i;
  const moneyOrCase = /\b(refund|reimburs\w*|credit(?:ed)?|money|funds|case|claim|dispute|reembolso|dinero|caso|reclamo|disputa)\b/i;
  const resolvedWord = /\b(resolved|settled|sorted|taken care of|all set|fixed|handled|processed|approved|credited|issued|released|returned|reimbursed|compensated|refunded|on (?:its|the) way|arreglad[oa]s?|resuelt[oa]s?|solucionad[oa]s?|reembolsad[oa]s?|acreditad[oa]s?|devuelt[oa]s?|procesad[oa]s?|aprobad[oa]s?)\b/i;
  const stallRe = /(no need to (?:escalate|do anything|take (?:any )?action|contact paypal|open|file|report)|(?:please\s+)?(?:don'?t|do not)\s+(?:need to\s+)?(?:escalate|open a claim|file a claim|contact paypal)|hold off|(?:allow|wait|give us|please wait)\s+(?:up to\s+|another\s+|an additional\s+)?\d{1,2}(?:\s*-\s*\d{1,2})?\s+(?:more\s+)?(?:business\s+|working\s+)?days|be patient|you don'?t have to do anything)/i;
  const holdBack = /\b(avoid|refrain|unnecessary|not necessary|no need to|please don'?t|would only|(?:may|could|might|will) (?:delay|slow|freeze|cancel)|duplicate|let us handle|we'?ll handle|leave it with us|no es necesario|evite|no abra|no escale|espere|d[ée]jenos)\b/i;
  const aboutEscalating = /\b(claim|case|dispute|escalat\w*|report\w*|reclamo|caso|disputa|escalar|reportar)\b/i;

  // A carrier's own email ("your case has been closed" about a mail search) isn't about her PayPal case.
  const head = text.split(/\n\s*\n/)[0] || "";
  const carrierEmail = CARRIER.test(head) && !/paypal/i.test(head);
  for (const sent of sentences) {
    const neg = NEG.test(sent), cond = COND.test(sent);
    const notPayPalCase = (carrierEmail && !/paypal|dispute|PP-[A-Z0-9]/i.test(sent)) || OTHERS.test(sent);
    const asserts = !neg && !cond;
    const urging = /^\s*(?:if|si)\s+(?:you\s+)?(?:don'?t|do not|no)\b/i.test(sent);

    if (asserts && !notPayPalCase) {
      const m = sent.match(refundRe);
      if (m) {
        const amount = amountNear(sent, m.index);
        if (!c.refundClaimed) c.refundClaimed = { amount, partial: /partial|parcial/i.test(sent) };
        else if (c.refundClaimed.amount == null && amount != null) c.refundClaimed.amount = amount; // e.g. subject line first, amount in the body
      }
    }
    if (asserts && !notPayPalCase && !GENERIC.test(sent) && !CARRIER.test(sent) && closedRe.test(sent)) c.caseClosedClaimed = true;
    if (/no (?:further )?action (?:is )?(?:required|needed)|no\s+(?:necesita|tiene\s+que|debe)\s+hacer\s+nada/i.test(sent)) c.noActionNeeded = true;
    if (!neg && !/^\s*(?:if|once|when|si|cuando)\b/i.test(sent) && !/\bif you (?:accept|agree|close)\b/i.test(sent) && closeReq.test(sent)) c.asksToCloseCase = true;
    if (asserts && !notPayPalCase && !GENERIC.test(sent) && !/money[- ]back guarantee/i.test(sent) && (outcomeRe.test(sent) || (moneyOrCase.test(sent) && resolvedWord.test(sent) && !CARRIER.test(sent)))) c.outcomeClaimed = true;
    const stallByNegation = /(?:don'?t|do not|no need to)\s+(?:need to\s+)?(?:escalate|open|file|contact|report|do anything)/i.test(sent);
    if (!urging && (!neg || stallByNegation) && !/phishing@paypal\.com/i.test(sent) && (stallRe.test(sent) || (holdBack.test(sent) && aboutEscalating.test(sent)))) c.asksToWait = true;
    if (!neg && !CARRIER.test(sent) && /(within\s+\d{1,2}\s*(?:hours|hrs)|immediately|urgent|final notice|act now|today only|before the end of (?:the )?day|by (?:tonight|end of day)|account (?:will be )?(?:suspended|limited|locked)|urgente|24\s*horas|inmediatamente|hoy mismo)/i.test(sent)) c.urgency = true;

    // Offers need a real amount or percent, and aren't a "money-back guarantee".
    if (!c.partialOffer && !neg && !/guarantee/i.test(sent)) {
      const o = sent.match(/(?:offer(?:ed|ing)?|propos\w+|can do|happy to (?:send|refund))\s+(?:you\s+)?(?:a\s+)?(?:partial\s+refund\s+of\s+)?(\$\s?\d{1,5}(?:[.,]\d{2})?|\d{1,5}(?:[.,]\d{2})?\s?(?:USD|%))/i) || sent.match(/partial refund of\s+(\$\s?\d{1,5}(?:[.,]\d{2})?)/i);
      if (o) { const v = o[1].trim(); c.partialOffer = v.endsWith("%") ? { percent: Number(v.replace(/[^\d.]/g, "")) } : { amount: Number(v.replace(/[^\d.]/g, "")) }; }
      const back = sent.match(/(?:we|i)(?:'ll|'d| will| would| can| could)?\s+(?:send|refund|pay|transfer|zelle|venmo)\s+(?:you\s+)?(?:back\s+)?\$\s?(\d{1,5}(?:[.,]\d{2})?)/i);
      if (!c.partialOffer && back && /back|directly|instead|outside|zelle|venmo|cash app/i.test(sent)) c.partialOffer = { amount: Number(back[1].replace(",", ".")), offPayPal: /zelle|venmo|cash app|bank|directly|outside/i.test(sent) };
      if (c.partialOffer && /zelle|venmo|cash app|directly|outside (?:of )?paypal/i.test(sent)) c.partialOffer.offPayPal = true;
    }
    if (!neg && /\byou can keep (?:it|the|your)\b|\bkeep (?:the|your) (?:item|order|dress|product|package|goods|shoes|coat|bag|jacket|parcel)\b/i.test(sent)) c.keepItemOffer = true;
    if (asserts && /(?:has been|was|been)\s+delivered|\bdelivered\s+(?:to|on|at)\b/i.test(sent) && !/(?:will|to|should|expected to)\s+be\s+delivered|scheduled|estimated|expected/i.test(sent)) c.deliveredClaimed = true;

    // Asking for a secret: a request verb and a secret, in a sentence that isn't a warning ("never share...").
    if (!neg && /(password|one[- ]time code|verification code|security code|\bOTP\b|\bPIN\b|card number|social security|\b\d[- ]?digit (?:code|number|pin)|code (?:we|that we|you) (?:sent|texted|received)|c[oó]digo|contrase[nñ]a)/i.test(sent)
      && /\b(reply|send|enter|provide|share|confirm|give|tell|read|type|text|env[ií]e|responda|comparta|ingrese|d[ée]nos)\b/i.test(sent)) c.asksForSecret = true;
    // Off-platform payment: only a request aimed at her (a fee, "to release", "pay us"), not a warning or a bank's promo line.
    if (asserts && /(gift card|crypto|bitcoin|zelle|wire transfer|western union|venmo|cash app|tarjeta de regalo)/i.test(sent) && /\b(fee|to release|to receive|to unlock|to process|pay us|send us|you (?:need|must|have) to (?:pay|send|buy)|please (?:pay|send|buy)|pague|env[ií]enos|compre)\b/i.test(sent)) c.asksForOffPlatformPayment = true;
    if (!neg && /(log ?in|sign ?in|verify (?:your )?account|confirm (?:your )?(?:identity|account|details)|update (?:your )?(?:payment|billing)|inicie sesi[oó]n|verifique)/i.test(sent)) c.asksToSignInOrVerify = true;
  }

  const reship = /(re-?ship|resen[dt]|replacement|new tracking|shipped (?:again|a new))/i.test(text);
  const labelled = [...text.matchAll(LABELLED_TRACKING)].map((m) => m[1]);
  const tracks = [...new Set([...(text.match(TRACKING) || []), ...labelled].map((t) => t.replace(/\s/g, "").toUpperCase()))].filter((t) => !/^PP-/.test(t));
  if (tracks.length) c.trackingNumbers = tracks;
  if (reship) c.reshipmentClaimed = true;

  c.caseIds = [...new Set((text.match(CASE_ID) || []).map((s) => s.toUpperCase()))];
  c.links = [...new Set((text.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?]+$/, "")))].slice(0, 10);
  c.phones = [...new Set(text.match(PHONE) || [])].slice(0, 5);
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
