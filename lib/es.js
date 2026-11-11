// Spanish for everything Day 20 computes (verdicts, bottom line, next step, findings).
// Built for Graciela, 71, from the dispute game: the interface alone isn't enough.
import { clock, phase, money } from "./record.js";
import { currentTz } from "./tz.js";

const DAY = 86400000;
const f = (iso) => new Date(iso).toLocaleDateString("es-US", { weekday: "short", day: "numeric", month: "short", timeZone: currentTz() });

export function esComparison(cmp, r, now = new Date()) {
  const ph = phase(r), ck = clock(r, now);
  const refund = r.refund ? `PayPal muestra un reembolso de ${money(r.refund)}.` : "PayPal no muestra ningún reembolso.";
  const state = ph === "open" ? `Tu caso sigue abierto: quedan ${ck.daysLeft} días, se cierra el ${f(ck.closesAt)}. No lo cierres.`
    : ph === "with_paypal" ? "Tu caso está con un revisor de PayPal. No lo cierres."
    : ph === "your_turn" ? "PayPal espera tu respuesta en el caso." : "PayPal muestra tu caso como resuelto.";
  const status = { open: "Abierto", with_paypal: "Con un revisor de PayPal", your_turn: "Esperando tu respuesta", resolved: "Resuelto" }[ph];
  const rec = `${status} · Reembolso: ${r.refund ? money(r.refund) : "ninguno"}`;
  const H = { mismatch: "Este correo dice algo falso sobre tu caso de PayPal.", careful: "Guíate por tu caso de PayPal, no por este correo.", consistent: "Este correo coincide con tu caso de PayPal.", nothing_to_check: "Este correo no dice nada sobre tu caso." };
  const T = {
    refund: ["Dice que te reembolsaron", r.refund ? `Reembolso: ${money(r.refund)}` : "Reembolso: ninguno", "Tu caso en PayPal no muestra reembolso. Un reembolso real aparece en el caso y en tu actividad de PayPal."],
    closed: ["Dice que tu caso está cerrado o que no hay que hacer nada", rec, ph === "open" ? `Tu caso sigue abierto. Si no haces nada, se cierra solo el día 20 (${f(ck.closesAt)}) y no se puede reabrir.` : "Tu caso sigue activo en PayPal."],
    close_request: ["Te pide cerrar o cancelar tu caso", `Un caso cerrado no se puede reabrir. El tuyo: ${rec}`, "No lo cierres. Un reembolso completo por PayPal cierra el caso solo; nunca hace falta cerrarlo para cobrar."],
    partial_offer: ["Ofrece devolverte una parte", "Aceptar cierra el caso", "Aceptar un reembolso parcial cierra el caso para siempre. Puedes rechazarlo o ignorarlo; eso no debilita tu caso."],
    reshipment: ["Dice que lo enviaron de nuevo", "Sin rastreo nuevo en tu transacción", "No hay rastreo nuevo en tu caso. Mantén el caso abierto hasta tener el artículo en la mano."],
    links: ["Tiene enlaces o te pide iniciar sesión", "Abre PayPal tú misma, no desde un correo", "No uses los enlaces ni los teléfonos del correo. Abre la app de PayPal tú misma. Nunca compartas una contraseña ni un código."],
    secret: ["Te pide un código o contraseña", "Nunca lo compartas", "No respondas con ningún código. Con tu código, un estafador puede entrar a tu cuenta y cerrar tu caso."],
    off_platform: ["Menciona tarjetas de regalo, cripto, Zelle o transferencias", "Los reembolsos nunca requieren que pagues", "Un reembolso de PayPal nunca te pide pagar nada. Es señal de estafa."],
    urgency: ["Te presiona para actuar rápido", ph === "open" ? `Tu plazo real: día 20, ${f(ck.closesAt)}` : rec, "Guíate por las fechas de tu caso en PayPal, no las del correo."],
    outcome: ["Dice que el caso se decidió a tu favor o que el dinero viene en camino", rec, `PayPal no muestra reembolso ni decisión. Si esperas por este correo, tu caso se cierra solo el ${f(ck.closesAt)}.`],
    wait: ["Te pide esperar o no escalar", ph === "open" ? `Tu caso se cierra solo el ${f(ck.closesAt)} (día 20)` : rec, ph === "open" ? `Esperar es como se pierden los casos. Ningún correo mueve el plazo de PayPal. Si no se resuelve antes del ${f(new Date(new Date(ck.closesAt) - 2 * DAY))}, escala en PayPal.` : "Tu caso ya está con PayPal."],
    no_action: ["Dice que no hace falta hacer nada", rec, ph === "open" ? `Puede ser cierto mientras PayPal espera al vendedor. Pero tu caso se cierra solo el ${f(ck.closesAt)} si no escalas.` : "Tu caso está con PayPal."],
    full_offer: ["Ofrece un reembolso completo", r.refund ? `Reembolso: ${money(r.refund)}` : "Reembolso: ninguno", "Bien si es real. Un reembolso completo por PayPal cierra tu caso solo. Mantén el caso abierto hasta verlo en tu caso."],
    unverified: ["No dice nada que yo pueda verificar", rec, "Eso no lo hace real. Solo cuenta lo que muestra tu caso en PayPal. Si el correo dice que algo pasó, búscalo tú misma en la app de PayPal."],
    delivered: ["Dice que tu paquete fue entregado", "Revisa el rastreo tú misma", "Un correo no prueba una entrega. Entra al sitio del transportista con el número de rastreo de tu transacción y compara el código postal."],
  };
  const findings = cmp.findings.map((x) => {
    const key = x.id.startsWith("tracking_") ? null : x.id.startsWith("caseid_") ? null : x.id;
    if (x.id.startsWith("tracking_")) return { ...x, says: `Número de rastreo ${x.id.slice(9)}`, advice: x.verdict === "neutral" ? "Es el número que el vendedor agregó en PayPal. Los estafadores también lo conocen; no prueba nada." : "Este número no está en tu transacción de PayPal. Una etiqueta nueva no prueba que se envió nada." };
    if (x.id.startsWith("caseid_")) return { ...x, says: `Menciona el caso ${x.id.slice(7)}`, advice: x.verdict === "neutral" ? "El número de caso es real, pero los estafadores también lo ven." : "Ese no es tu número de caso." };
    const t = T[key];
    return t ? { ...x, says: t[0], record: t[1], advice: t[2] } : x;
  });
  return { ...cmp, headline: H[cmp.overall], bottomLine: `${refund} ${state}`, findings, senderNote: cmp.senderNote ? "Quién lo envía no prueba nada: se han usado direcciones reales de PayPal para enviar estafas." : null };
}

export function esStep(step, r, facts = {}, now = new Date()) {
  const ck = clock(r, now);
  const by = f(new Date(new Date(ck.closesAt) - 2 * DAY));
  const fact = step.decidingFact ? (facts.deliveredZip ? `Tu verificación: la página del transportista dice entregado en el código postal ${facts.deliveredZip}. Registro de PayPal: tu código postal de envío en este pago es ${r.shipTo?.zip}.` : "El rastreo no muestra entrega.") : "";
  const S = {
    resolved: ["Tu caso está resuelto", r.refund ? `PayPal muestra un reembolso de ${money(r.refund)}.` : "PayPal muestra este caso como resuelto."],
    not_covered: ["Es probable que la Protección al Comprador no cubra esto", "Los pagos a Amigos y familiares, o fuera de PayPal, no están cubiertos. Presentarlo como otra cosa sería un reclamo falso."],
    respond: ["PayPal espera tu respuesta", "Responde a la solicitud de PayPal en el caso a tiempo, o el caso puede cerrarse."],
    with_paypal: ["Un revisor de PayPal tiene tu caso", "No hay nada que escalar. Asegúrate de adjuntar tu resumen de una página y responde a PayPal a tiempo. No aceptes tratos del vendedor por correo."],
    snad: ["Este es un caso de 'no es como se describió'", `Toma fotos del artículo, el empaque y la etiqueta. PayPal puede pedirte devolverlo, y el envío puede correr por tu cuenta. Escala antes del ${f(ck.closesAt)}.`],
    no_case: ["Ya tienes el artículo", "Si es lo que pediste, no hay nada que reclamar. Cierra el caso solo cuando estés conforme; un caso cerrado no se puede reabrir."],
    escalate: [`Pide a PayPal que intervenga antes del ${by}`, `${fact} Es el dato decisivo y PayPal puede verificarlo. Es la línea 1 de tu resumen, lo primero que lee la revisora. En PayPal, toca Escalar en tu caso. Si no lo haces antes del día 20 (${f(ck.closesAt)}), se cierra y no se puede reabrir.`],
    wait_to_escalate: [`Puedes escalar desde el ${f(ck.escalateFrom)}`, `${fact} PayPal suele permitir escalar 7 días después del pago. Day 20 te lo recordará.`],
    check_first: ["El rastreo muestra entrega en tu código postal", "Pregunta a vecinos, al edificio y al transportista primero. Cuando la prueba de entrega coincide con tu dirección, PayPal suele darle la razón al vendedor."],
    not_yet: ["Todavía no", `Sigue en camino. Escalar ahora podría perjudicar a un vendedor honesto. Mantén el caso abierto; si no llega, escala antes del ${by}.`],
    need_facts: ["Dile a Day 20 qué dice el rastreo", `Tu caso está abierto: día ${ck.day} de 20. Se cierra solo el ${f(ck.closesAt)} si no escalas. Agrega lo que dice la página de rastreo.`],
  };
  const t = S[step.kind];
  if (!t) return step;
  const labels = { "Escalate in PayPal": "Escalar en PayPal", "Report the scam": "Reportar la estafa", "Open the case in PayPal": "Abrir el caso en PayPal", "Copy my one-page case": "Copiar mi resumen", "Add the reminder": "Agregar recordatorio", "Add reminders": "Agregar recordatorios", "Add tracking details": "Agregar datos de rastreo", "Add a reminder for day 15": "Recordatorio para el día 15" };
  const action = step.action ? { ...step.action, label: labels[step.action.label] || step.action.label, note: step.action.note ? "Lo tocas tú en PayPal. Day 20 nunca presenta nada por ti." : undefined } : null;
  return { ...step, title: t[0], body: t[1], action };
}
