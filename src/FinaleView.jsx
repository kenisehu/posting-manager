import { useState, useEffect, useMemo } from "react";

// ============================================================
// FinaleView - ポスティング大会終了後のフィナーレページ
// 2026-05-01 0:00 JST 以降、またはURL ?preview=finale で表示
// ============================================================

const POEM_LINES = [
  { parts: [{ t: "あなたが配った" }, { t: "100", em: true }, { t: "枚のチラシ。" }] },
  { parts: [{ t: "60", em: true }, { t: "枚は、そのまま捨てられてしまったかもしれない。" }] },
  { parts: [{ t: "25", em: true }, { t: "枚、一瞬目に入っただけかもしれない。それでもいい。" }] },
  { parts: [{ t: "10", em: true }, { t: "枚は「こんな政党あるんだ」と知ってもらったかもしれない。" }] },
  { parts: [{ t: "4", em: true }, { t: "枚は「へー」と少し読んでもらえたかもしれない。" }] },
  { parts: [{ t: "そして、最後の" }, { t: "1", em: true }, { t: "枚は——" }], pause: true },
  { parts: [{ t: "次の選挙の1票になるかもしれない。" }], big: true },
];

const SLOGAN_MAIN = "微力だけど、無力じゃない。";
const SLOGAN_SUB = "未来は明るいと信じられる国へ";

// ============================================================
// メイン
// ============================================================
export default function FinaleView({ records, onExit, isPreview }) {
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
          borderRadius: 10, backdropFilter: "blur(10px)", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginRight: 8 }}>
            🔒 プレビュー（5/1以降に自動公開）
          </span>
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

      <div style={{ position: "relative", zIndex: 10, padding: isPreview ? "70px 20px 80px" : "40px 20px 80px", maxWidth: 900, margin: "0 auto" }}>
        <PoemSection />
        <StatsReveal totalFlyers={totalFlyers} totalMembers={totalMembers} totalMunis={totalMunis} totalPersonDays={totalPersonDays} />
        <Slogan />
        <MemberSection memberData={memberData} />
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
// メンバー表示（寄せ書き固定）
// ============================================================
function MemberSection({ memberData }) {
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
      <YosegakiView members={memberData} />
    </div>
  );
}

// ============================================================
// 寄せ書き（名前タップで個人メッセージ）
// ============================================================
function YosegakiView({ members }) {
  const [openName, setOpenName] = useState(null);

  const items = useMemo(() => {
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
        ありがとうございました！
      </div>
      <div style={{
        textAlign: "center",
        fontFamily: "'Klee One', 'Noto Serif JP', serif",
        fontSize: 11,
        color: "#8b7355",
        marginBottom: 24,
        letterSpacing: "0.05em",
      }}>
        自分の名前をクリックしてね
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: "14px 20px", padding: "0 10px", position: "relative",
      }}>
        {items.map((m, i) => {
          const isOpen = openName === m.name;
          const aware = Math.ceil(m.flyers * 0.1);
          const voter = Math.ceil(m.flyers * 0.01);
          return (
            <div key={m.name} style={{
              transform: isOpen ? "rotate(0deg)" : `rotate(${m.rotate}deg)`,
              textAlign: "center",
              opacity: 0,
              animation: `fadeInScale 0.8s cubic-bezier(0.34,1.56,0.64,1) ${0.06 * i}s forwards`,
              cursor: "pointer",
              transition: "transform 0.3s ease",
            }}
              onClick={() => setOpenName(isOpen ? null : m.name)}
            >
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
                {m.flyers.toLocaleString()}枚・{m.munis}市区町村
              </div>
              {/* 個人メッセージ吹き出し */}
              {isOpen && (
                <div style={{
                  marginTop: 8,
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.85)",
                  borderRadius: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  transform: `rotate(${-m.rotate}deg)`,
                  textAlign: "left",
                  minWidth: 210,
                  animation: "fadeInScale 0.3s ease-out forwards",
                }}>
                  <div style={{
                    fontFamily: "'Klee One', 'Noto Serif JP', serif",
                    fontSize: 11,
                    color: "#2c1810",
                    lineHeight: 1.7,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12, color: m.color }}>
                      {m.name}さんの{m.flyers.toLocaleString()}枚で…
                    </div>
                    <div>
                      🌱 チームみらいを知ったかもしれない人<br />
                      <span style={{ fontWeight: 700, fontSize: 16, color: "#166534" }}>
                        {aware.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 10, color: "#5c3317" }}> 人</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      🗳️ 次の選挙で1票を投じてくれるかもしれない人<br />
                      <span style={{ fontWeight: 700, fontSize: 16, color: "#1e3a5c" }}>
                        {voter.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 10, color: "#5c3317" }}> 人</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 10, color: "#8b7355", textAlign: "center", fontStyle: "italic" }}>
                      その1票が、未来を変えるかもしれない。
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
          武藤かず子 衆議院議員<br />
          発送など担っていただいた<br />
          チームみらい運営の皆様
        </div>
      </div>
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
      <div style={{ fontSize: 11, color: "#475569" }}>
        — 北関東ポスティング大会 2026.04 —
      </div>
    </div>
  );
}
