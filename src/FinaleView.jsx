import { useState, useEffect, useMemo, useRef } from "react";

// ============================================================
// FinaleView - ポスティング大会終了後のフィナーレページ
// 2026-05-01 0:00 JST 以降、またはURL ?preview=finale で表示
// ============================================================

const POEM_LINES = [
  { parts: [{ t: "あなたが配った" }, { t: "100", em: true }, { t: "枚のチラシ。" }] },
  { parts: [{ t: "60", em: true }, { t: "枚は、そのまま捨てられてしまったかもしれない。" }] },
  { parts: [{ t: "25", em: true }, { t: "枚、一瞬目に入っただけかもしれない。それでもいい。" }] },
  { parts: [{ t: "10", em: true }, { t: "枚は「こんな政党あるんだ」と思ってもらったかもしれない。" }] },
  { parts: [{ t: "4", em: true }, { t: "枚は「へー」とちゃんと読んでもらえたかもしれない。" }] },
  { parts: [{ t: "そして、最後の" }, { t: "1", em: true }, { t: "枚は——" }], pause: true },
  { parts: [{ t: "次の選挙の1票になるかもしれない。" }], big: true },
];

const SLOGAN_MAIN = "微力だけど、無力じゃない。";
const SLOGAN_SUB = "未来は明るいと信じられる国へ";

const DISPLAY_STYLES = [
  { key: "monument", label: "🏛️ 碑" },
  { key: "yosegaki", label: "💌 寄せ書き" },
  { key: "credits",  label: "🎬 エンドロール" },
];

// ============================================================
// メイン
// ============================================================
export default function FinaleView({ records, onExit, isPreview }) {
  const [displayStyle, setDisplayStyle] = useState("monument");
  const [bgmOn, setBgmOn] = useState(false);
  const [started, setStarted] = useState(false);

  // メンバー別統計
  const memberData = useMemo(() => {
    const map = {};
    for (const r of records) {
      if (!map[r.memberName]) {
        map[r.memberName] = { name: r.memberName, flyers: 0, munis: new Set(), days: new Set() };
      }
      map[r.memberName].flyers += r.flyerCount;
      map[r.memberName].munis.add(r.municipalityId);
      map[r.memberName].days.add(r.postedDate);
    }
    return Object.values(map)
      .map(m => ({ name: m.name, flyers: m.flyers, munis: m.munis.size, days: m.days.size }))
      .sort((a, b) => b.flyers - a.flyers);
  }, [records]);

  const totalFlyers = memberData.reduce((s, m) => s + m.flyers, 0);
  const totalMembers = memberData.length;
  const totalMunis = new Set(records.map(r => r.municipalityId)).size;
  const totalPersonDays = memberData.reduce((s, m) => s + m.days, 0);

  // BGM（Web Audio APIで生成するアンビエントパッド）
  const audioCtxRef = useRef(null);
  const oscNodesRef = useRef([]);

  useEffect(() => {
    if (!bgmOn) {
      // 停止
      if (oscNodesRef.current.length) {
        const ctx = audioCtxRef.current;
        oscNodesRef.current.forEach(({ osc, gain }) => {
          try {
            gain.gain.cancelScheduledValues(ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
            setTimeout(() => { try { osc.stop(); } catch {} }, 1500);
          } catch {}
        });
        oscNodesRef.current = [];
      }
      return;
    }
    // 再生
    const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    // ゆったりしたコード（Cmaj9 系）
    const freqs = [130.81, 196.00, 261.63, 329.63, 392.00, 493.88]; // C3 G3 C4 E4 G4 B4
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 3);
    master.connect(ctx.destination);
    const nodes = freqs.map((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      // LFOでゆらぎ
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.15;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      osc.connect(gain).connect(master);
      osc.start();
      return { osc, gain, lfo };
    });
    oscNodesRef.current = nodes.map(n => ({ osc: n.osc, gain: master }));
    return () => {};
  }, [bgmOn]);

  if (!started) {
    return <StartScreen onStart={() => setStarted(true)} isPreview={isPreview} />;
  }

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(180deg,#050814 0%,#0a1030 40%,#1a1040 70%,#3d2050 90%,#f59e0b22 100%)",
      color: "#f8fafc", fontFamily: "sans-serif", position: "relative", overflow: "hidden",
    }}>
      <StarBackdrop />
      <AuroraLayer />

      {/* プレビュー用コントロール */}
      {isPreview && (
        <div style={{
          position: "fixed", top: 10, left: 10, right: 10, zIndex: 100,
          display: "flex", flexWrap: "wrap", gap: 6, padding: 10,
          background: "rgba(15,23,42,0.85)", border: "1px solid #334155",
          borderRadius: 10, backdropFilter: "blur(10px)",
        }}>
          <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, alignSelf: "center", marginRight: 8 }}>
            🔒 プレビュー（5/1以降に自動公開）
          </span>
          {DISPLAY_STYLES.map(s => (
            <button key={s.key} onClick={() => setDisplayStyle(s.key)}
              style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 600,
                background: displayStyle === s.key ? "#f59e0b" : "transparent",
                color: displayStyle === s.key ? "#0f172a" : "#94a3b8",
                border: `1px solid ${displayStyle === s.key ? "#f59e0b" : "#475569"}`,
                borderRadius: 6, cursor: "pointer",
              }}>
              {s.label}
            </button>
          ))}
          <button onClick={() => setBgmOn(v => !v)}
            style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 600,
              background: bgmOn ? "#10b981" : "transparent",
              color: bgmOn ? "#0f172a" : "#94a3b8",
              border: `1px solid ${bgmOn ? "#10b981" : "#475569"}`,
              borderRadius: 6, cursor: "pointer", marginLeft: 8,
            }}>
            {bgmOn ? "🔊 BGM ON" : "🔇 BGM OFF"}
          </button>
          {onExit && (
            <button onClick={onExit}
              style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 600,
                background: "transparent", color: "#94a3b8",
                border: "1px solid #475569", borderRadius: 6, cursor: "pointer", marginLeft: "auto",
              }}>
              ✕ 閉じる
            </button>
          )}
        </div>
      )}

      {/* BGMトグル（本番用、右下固定） */}
      {!isPreview && (
        <button onClick={() => setBgmOn(v => !v)}
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 100,
            padding: "10px 14px", fontSize: 13, fontWeight: 600,
            background: bgmOn ? "rgba(16,185,129,0.9)" : "rgba(15,23,42,0.85)",
            color: bgmOn ? "#0f172a" : "#f8fafc",
            border: `1px solid ${bgmOn ? "#10b981" : "#475569"}`,
            borderRadius: 999, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
          {bgmOn ? "🔊 BGM ON" : "🔇 BGM OFF"}
        </button>
      )}

      <div style={{ position: "relative", zIndex: 10, padding: isPreview ? "70px 20px 80px" : "40px 20px 80px", maxWidth: 900, margin: "0 auto" }}>
        <PoemSection />
        <StatsReveal totalFlyers={totalFlyers} totalMembers={totalMembers} totalMunis={totalMunis} totalPersonDays={totalPersonDays} />
        <Slogan />
        <MemberSection displayStyle={displayStyle} memberData={memberData} totalFlyers={totalFlyers} />
        <Footer />
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes softPulse { 0%,100% { opacity: 0.85; text-shadow: 0 0 20px rgba(245,158,11,0.4); } 50% { opacity: 1; text-shadow: 0 0 40px rgba(245,158,11,0.9); } }
        @keyframes twinkle { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes auroraShift { 0%,100% { transform: translateX(-10%) rotate(-2deg); } 50% { transform: translateX(10%) rotate(2deg); } }
        @keyframes scroll { from { transform: translateY(100%); } to { transform: translateY(-${memberData.length * 80}px); } }
        @keyframes petalFall { from { transform: translateY(-20px) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes starPop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

// ============================================================
// 開始画面（音声再生のため1クリック必要）
// ============================================================
function StartScreen({ onStart, isPreview }) {
  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(180deg,#050814 0%,#0a1030 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      color: "#f8fafc", fontFamily: "sans-serif", padding: 20, textAlign: "center",
    }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>📮</div>
      <div style={{ fontSize: 16, color: "#94a3b8", marginBottom: 8 }}>北関東ポスティング大会</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 40, letterSpacing: "0.05em" }}>
        Thanks, Everyone.
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 30, maxWidth: 400, lineHeight: 1.8 }}>
        この画面は、みんなでやり切った一ヶ月の記録です。<br />
        ゆっくり読んでいってください。
      </div>
      <button onClick={onStart}
        style={{
          padding: "14px 36px", fontSize: 16, fontWeight: 700,
          background: "linear-gradient(90deg,#f59e0b,#ec4899)", color: "#0f172a",
          border: "none", borderRadius: 999, cursor: "pointer",
          boxShadow: "0 8px 32px rgba(245,158,11,0.4)",
        }}>
        ▶ はじめる
      </button>
      {isPreview && (
        <div style={{ marginTop: 30, fontSize: 11, color: "#475569" }}>
          🔒 プレビューモード（5/1 0:00以降に自動公開）
        </div>
      )}
    </div>
  );
}

// ============================================================
// 背景：星
// ============================================================
function StarBackdrop() {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      delay: Math.random() * 4,
      duration: Math.random() * 3 + 2,
    }));
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
          animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function AuroraLayer() {
  return (
    <div style={{
      position: "absolute", bottom: "-10%", left: 0, right: 0, height: "60%",
      background: "radial-gradient(ellipse at 50% 100%, rgba(163,230,53,0.18), transparent 60%), radial-gradient(ellipse at 30% 100%, rgba(236,72,153,0.12), transparent 55%), radial-gradient(ellipse at 70% 100%, rgba(59,130,246,0.1), transparent 60%)",
      animation: "auroraShift 18s ease-in-out infinite",
      pointerEvents: "none", filter: "blur(40px)",
    }} />
  );
}

// ============================================================
// ポエム本文
// ============================================================
function PoemSection() {
  return (
    <div style={{
      paddingTop: 24, paddingBottom: 12,
      fontFamily: "'Noto Serif JP', 'Yu Mincho', serif",
    }}>
      {POEM_LINES.map((line, i) => {
        const delay = i * 1.0;
        const baseSize = line.big ? "clamp(14px, 4.2vw, 22px)" : "clamp(14px, 3.8vw, 17px)";
        return (
          <div key={i} style={{
            fontSize: baseSize,
            fontWeight: line.big ? 700 : 400,
            lineHeight: 1.9,
            marginBottom: line.pause ? 22 : 10,
            opacity: 0,
            animation: `fadeInUp 1.4s cubic-bezier(0.16,1,0.3,1) ${delay}s forwards`,
            color: line.big ? "#fde68a" : "#e2e8f0",
            textShadow: line.big ? "0 0 24px rgba(253,230,138,0.5)" : "none",
            letterSpacing: line.big ? "0.02em" : "0.04em",
            textAlign: line.big ? "center" : "left",
            whiteSpace: line.big ? "nowrap" : "normal",
          }}>
            {line.parts.map((p, j) => (
              <span key={j} style={p.em ? {
                fontFamily: "'Oswald', 'Noto Serif JP', serif",
                fontSize: "1.55em",
                fontWeight: 700,
                color: "#fbbf24",
                letterSpacing: "0.02em",
                margin: "0 0.08em",
                textShadow: "0 0 12px rgba(251,191,36,0.55)",
              } : {}}>
                {p.t}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// スローガン
// ============================================================
function Slogan() {
  const base = POEM_LINES.length * 1.0 + 3;
  return (
    <div style={{ textAlign: "center", padding: "60px 10px 40px" }}>
      <div style={{
        fontFamily: "'Noto Serif JP', serif",
        fontSize: "clamp(16px, 5vw, 26px)",
        fontWeight: 800,
        letterSpacing: "0.08em",
        color: "#fde68a",
        whiteSpace: "nowrap",
        opacity: 0,
        animation: `fadeInScale 2s ease-out ${base}s forwards, softPulse 4s ease-in-out ${base + 2}s infinite`,
        marginBottom: 18,
      }}>
        {SLOGAN_MAIN}
      </div>
      <div style={{
        fontFamily: "'Noto Serif JP', serif",
        fontSize: "clamp(13px, 3.8vw, 17px)",
        fontWeight: 600,
        color: "#f8fafc",
        letterSpacing: "0.05em",
        opacity: 0,
        animation: `fadeInUp 2s ease-out ${base + 1.2}s forwards`,
      }}>
        {SLOGAN_SUB}
      </div>
    </div>
  );
}

// ============================================================
// 統計サマリー（ポエムの後に挟む）
// ============================================================
function StatsReveal({ totalFlyers, totalMembers, totalMunis, totalPersonDays }) {
  const base = POEM_LINES.length * 1.0 + 0.5;
  const items = [
    { label: "届けた枚数", value: totalFlyers, unit: "枚", color: "#fde68a" },
    { label: "踏みしめた街", value: totalMunis, unit: "市区町村", color: "#a3e635" },
    { label: "歩いた仲間", value: totalMembers, unit: "人", color: "#f472b6" },
    { label: "延べ活動日数", value: totalPersonDays, unit: "人日", color: "#7dd3fc" },
  ];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
      gap: "18px 16px",
      maxWidth: 520,
      margin: "20px auto",
      padding: "24px 0",
      opacity: 0, animation: `fadeInUp 1.5s ease-out ${base}s forwards`,
    }}>
      {items.map(it => (
        <div key={it.label} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{it.label}</div>
          <div style={{ fontSize: "clamp(26px, 7vw, 34px)", fontWeight: 800, color: it.color, lineHeight: 1 }}>
            <CountUp to={it.value} delay={base * 1000 + 300} />
            <span style={{ fontSize: "clamp(11px, 3vw, 14px)", color: "#94a3b8", marginLeft: 4 }}>{it.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CountUp({ to, delay }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const duration = 2000;
      const start = performance.now();
      let raf;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setV(Math.round(to * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, delay);
    return () => clearTimeout(t);
  }, [to, delay]);
  return <span>{v.toLocaleString()}</span>;
}

// ============================================================
// メンバー表示の切替
// ============================================================
function MemberSection({ displayStyle, memberData, totalFlyers }) {
  const base = POEM_LINES.length * 1.0 + 6;
  return (
    <div style={{ marginTop: 40, opacity: 0, animation: `fadeInUp 2s ease-out ${base}s forwards` }}>
      <div style={{
        textAlign: "center",
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 13, color: "#94a3b8", letterSpacing: "0.3em", marginBottom: 28,
      }}>
        ─ この活動に参加してくれた、すべての人へ ─
      </div>
      {displayStyle === "monument" && <MonumentView members={memberData} />}
      {displayStyle === "yosegaki" && <YosegakiView members={memberData} />}
      {displayStyle === "credits"  && <CreditsView members={memberData} />}
    </div>
  );
}

// ============================================================
// ① 碑（モニュメント）型
// ============================================================
function MonumentView({ members }) {
  return (
    <div style={{
      position: "relative", padding: "40px 20px",
      background: "linear-gradient(180deg, #0a0a0f 0%, #1a1a24 50%, #0a0a0f 100%)",
      borderRadius: 12,
      border: "1px solid #3d3426",
      boxShadow: "inset 0 2px 20px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.5)",
    }}>
      {/* 大理石っぽいテクスチャ */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none",
        background: "radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.02), transparent 40%), radial-gradient(ellipse at 80% 80%, rgba(255,255,255,0.02), transparent 40%)",
      }} />
      <div style={{
        textAlign: "center",
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 11, color: "#c9a961", letterSpacing: "0.5em",
        marginBottom: 6, paddingLeft: "0.5em",
      }}>
        — ARIGATO —
      </div>
      <div style={{
        textAlign: "center",
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 14, color: "#8b7355", letterSpacing: "0.3em",
        marginBottom: 32,
      }}>
        2026年4月 北関東
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "18px 24px",
        padding: "0 8px",
      }}>
        {members.map((m, i) => (
          <div key={m.name} style={{
            textAlign: "center",
            opacity: 0,
            animation: `fadeInUp 1.2s ease-out ${0.04 * i}s forwards`,
          }}>
            <div style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#d4af37",
              letterSpacing: "0.1em",
              textShadow: "0 1px 0 rgba(0,0,0,0.8), 0 0 8px rgba(212,175,55,0.25)",
              marginBottom: 4,
              lineHeight: 1.4,
            }}>
              {m.name}
            </div>
            <div style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: 10,
              color: "#8b7355",
              letterSpacing: "0.05em",
            }}>
              {m.flyers.toLocaleString()}枚・{m.munis}市区町村
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ② 寄せ書き型
// ============================================================
function YosegakiView({ members }) {
  const items = useMemo(() => {
    // 和紙になじむ墨・藍・茶系の落ち着いた色合い
    const colors = ["#2c1810", "#3a2418", "#1e3a5c", "#3a1e2c", "#2d4a20", "#4a2c1a"];
    return members.map((m, i) => ({
      ...m,
      rotate: (Math.random() - 0.5) * 10,
      color: colors[i % colors.length],
    }));
  }, [members]);

  return (
    <div style={{
      position: "relative",
      padding: "30px 20px 40px",
      background: "linear-gradient(135deg, #f5e9d3 0%, #f0dcb4 50%, #e8cf9a 100%)",
      borderRadius: 14,
      boxShadow: "0 10px 40px rgba(0,0,0,0.35), inset 0 0 60px rgba(139,90,43,0.1)",
      overflow: "hidden",
    }}>
      {/* 紙の質感 */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(139,90,43,0.08) 1px, transparent 1px)",
        backgroundSize: "4px 4px",
      }} />
      <div style={{
        textAlign: "center",
        fontFamily: "'Klee One', 'Noto Serif JP', serif",
        fontSize: 18,
        color: "#2c1810",
        marginBottom: 30,
        fontWeight: 700,
        letterSpacing: "0.15em",
      }}>
        おつかれさまでした
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: "14px 20px", padding: "0 10px", position: "relative",
      }}>
        {items.map((m, i) => (
          <div key={m.name} style={{
            transform: `rotate(${m.rotate}deg)`,
            textAlign: "center",
            opacity: 0,
            animation: `fadeInScale 0.8s cubic-bezier(0.34,1.56,0.64,1) ${0.06 * i}s forwards`,
          }}>
            <div style={{
              fontFamily: "'Klee One', 'Yuji Mai', 'Noto Serif JP', serif",
              fontSize: 22,
              fontWeight: 600,
              color: m.color,
              lineHeight: 1.2,
            }}>
              {m.name}
            </div>
            <div style={{
              fontFamily: "'Klee One', 'Noto Serif JP', serif",
              fontSize: 10,
              color: m.color,
              opacity: 0.65,
              marginTop: 2,
            }}>
              {m.flyers.toLocaleString()}枚
            </div>
          </div>
        ))}
      </div>

      {/* Special Thanks */}
      <div style={{
        marginTop: 36,
        paddingTop: 24,
        borderTop: "1px dashed rgba(92,51,23,0.35)",
        textAlign: "center",
        position: "relative",
      }}>
        <div style={{
          fontFamily: "'Klee One', 'Noto Serif JP', serif",
          fontSize: 12,
          color: "#5c3317",
          letterSpacing: "0.35em",
          marginBottom: 12,
          paddingLeft: "0.35em",
          fontWeight: 600,
        }}>
          Special Thanks
        </div>
        <div style={{
          fontFamily: "'Klee One', 'Noto Serif JP', serif",
          fontSize: 13,
          color: "#3a2418",
          lineHeight: 1.9,
          letterSpacing: "0.04em",
        }}>
          武藤かず子 様<br />
          発送等になっていただいた<br />
          チームみらい運営の皆様
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ③ エンドロール型（静的 / 美しく組版）
// ============================================================
function CreditsView({ members }) {
  // 投函枚数で3ティアに分ける（貢献度でグルーピングしつつ、名前は目立たせる）
  const sorted = [...members].sort((a, b) => b.flyers - a.flyers);
  return (
    <div style={{
      padding: "40px 20px",
      background: "linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.7))",
      borderRadius: 14,
      border: "1px solid rgba(253,230,138,0.15)",
    }}>
      <div style={{
        textAlign: "center",
        fontFamily: "'Oswald', sans-serif",
        fontSize: 13, color: "#fde68a", letterSpacing: "0.6em",
        marginBottom: 8, paddingLeft: "0.6em",
      }}>
        CAST
      </div>
      <div style={{
        width: 40, height: 1, background: "rgba(253,230,138,0.4)",
        margin: "0 auto 36px",
      }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {sorted.map((m, i) => (
          <div key={m.name} style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "baseline",
            gap: 20,
            opacity: 0,
            animation: `fadeInUp 0.8s ease-out ${0.05 * i}s forwards`,
          }}>
            <div style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: 11,
              color: "#94a3b8",
              letterSpacing: "0.15em",
              textAlign: "right",
            }}>
              {m.flyers.toLocaleString()}枚 / {m.munis}市区町村 / {m.days}日
            </div>
            <div style={{
              fontFamily: "'Noto Serif JP', serif",
              fontSize: 22,
              fontWeight: 700,
              color: "#fde68a",
              letterSpacing: "0.12em",
              whiteSpace: "nowrap",
              textShadow: "0 0 16px rgba(253,230,138,0.3)",
              textAlign: "center",
            }}>
              {m.name}
            </div>
            <div />
          </div>
        ))}
      </div>
      <div style={{
        width: 40, height: 1, background: "rgba(253,230,138,0.4)",
        margin: "36px auto 8px",
      }} />
    </div>
  );
}

// ============================================================
// フッター
// ============================================================
function Footer() {
  const base = POEM_LINES.length * 0.9 + 8;
  return (
    <div style={{
      textAlign: "center", marginTop: 60, padding: "30px 20px 20px",
      borderTop: "1px solid rgba(100,116,139,0.2)",
      opacity: 0, animation: `fadeInUp 2s ease-out ${base}s forwards`,
    }}>
      <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
        ありがとう。<br />
        あなたたちが歩いた一歩一歩が、未来を近づけている。
      </div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 20 }}>
        — 北関東ポスティング大会 2026.04 —
      </div>
    </div>
  );
}
