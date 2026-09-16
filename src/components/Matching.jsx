import { useEffect, useState } from "react";

export default function Matching({ roster }) {
  const names = (roster.characters || []).map((c) => c.name);
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 280);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="panel matching">
      <p className="eyebrow">looking</p>
      <h1 className="wordmark">NITE</h1>
      <div className="pulse" />
      <p className="scan">
        {names.length ? names[i % names.length] : "……"}
      </p>
      <p className="lede dim">不要催。她也在看你。</p>
    </section>
  );
}
