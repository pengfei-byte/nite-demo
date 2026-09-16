export function canSpeech() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startSpeech({ lang = "zh-CN", onResult, onEnd, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += piece;
      else interim += piece;
    }
    onResult?.({ interim, finalText });
  };
  rec.onerror = (e) => onError?.(e);
  rec.onend = () => onEnd?.();
  rec.start();
  return rec;
}
