const CRUDE =
  /dick|pussy|cock|nude|naked|fuck|sex|blowjob|boobs|tits|ass\b|horny|cum/i;
const PATIENT =
  /why|what about you|today|how|name|where|work|like|look|eyes|voice|interesting|bored|can't sleep|awake|from/;
const COMPLIMENT = /pretty|beautiful|gorgeous|hot|voice|interesting|cool/;

export function createHeat() {
  return { value: 1, turns: 0 };
}

export function applyUserTurn(heat, text) {
  const next = { ...heat, turns: heat.turns + 1 };
  let v = next.value;
  const crude = CRUDE.test(text);
  if (crude && v < 3) {
    v = Math.max(1, v - 0.4);
  } else if (crude && v >= 3.2) {
    v += 0.28;
  } else {
    v += 0.18;
    if (text.trim().length > 16) v += 0.08;
    if (PATIENT.test(text)) v += 0.12;
    if (COMPLIMENT.test(text)) v += 0.05;
    if (/^(hi|hey|hello|yo|sup)\s*$/i.test(text.trim())) v -= 0.1;
  }
  next.value = Math.min(5, Math.max(1, Number(v.toFixed(2))));
  return next;
}

export function stageOf(heat) {
  return Math.min(5, Math.max(1, Math.round(heat.value)));
}

export function wrapTurn(text, stage) {
  return `[stage ${stage}] ${text}`;
}

export const STAGE_LABEL = {
  1: "testing",
  2: "warming",
  3: "flirting",
  4: "close",
  5: "open",
};
