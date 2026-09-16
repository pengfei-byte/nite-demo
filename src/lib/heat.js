const CRUDE =
  /操|肏|裸|胸|奶|逼|鸡巴|阴|射|dick|pussy|cock|nude|naked|fuck|sex|脱光|胸罩|内裤|插|舔|高潮/i;
const PATIENT =
  /为什么|你呢|今天|怎么|名字|哪里|工作|喜欢什么|看起来|眼睛|声音|有意思|无聊|睡不着|刚|在干|从哪/;
const COMPLIMENT = /漂亮|好看|美|迷人|声音|气质|特别|有趣/;

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
    if (/^(hi|hey|你好|在吗|哈喽|hello)\s*$/i.test(text.trim())) v -= 0.1;
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
  1: "试探",
  2: "松动",
  3: "调情",
  4: "靠近",
  5: "放开",
};
