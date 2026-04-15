import { useState, useEffect, useMemo, useRef } from "react";

// ============================================================
// FinaleView - ポスティング大会終了後のフィナーレページ
// 2026-05-01 0:00 JST 以降、またはURL ?preview=finale で表示
// ============================================================

const POEM_LINES = [
  { text: "あなたが投函してくれた100枚のチラシ。", emphasis: "100" },
  { text: "60枚は、読まれずに捨てられたかもしれない。", emphasis: "60" },
  { text: "それが現実だ。", pause: true },
  { text: "でも残りの40枚は、誰かの手に渡った。", emphasis: "40" },
  { text: "そのうち30枚は、チラ見だけだったかもしれない。", emphasis: "30" },
  { text: "それでもいい。目に入ったということだから。", pause: true },
  { text: "残る10枚のうち——", emphasis: "10" },
  { text: "7枚は「そういや、こんな政党あるんだ」と、", emphasis: "7" },
  { text: "誰かの記憶に小さく灯をともしたかもしれない。" },
  { text: "2枚は、少し立ち止まって読んでくれた人がいたかもしれない。", emphasis: "2" },
  { text: "1枚は、「この近くにもサポーターがいるんだ」と、", emphasis: "1" },
  { text: "誰かをひそかに勇気づけたかもしれない。" },
  { text: "そして——もしかしたら最後の1枚が、", emphasis: "1", pause: true },
  { text: "次の選挙の1票になっているかもしれない。", big: true },
];

const SLOGAN_MAIN = "微力だけど、無力じゃない。";
const SLOGAN_SUB = "未来は明るいと信じられる国へ";

const DISPLAY_STYLES = [
  { key: "constellation", label: "🌌 星座型" },
  { key: "credits",       label: "🎬 エンドロール型" },
  { key: "petals",        label: "🌸 花びら型" },
  { key: "map",           label: "🗾 地図オーバーレイ型" },
];

// ============================================================
// メイン
// ============================================================
export default function FinaleView({ records, onExit, isPreview }) {
  const [displayStyle, setDisplayStyle] = useState("credits");
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
  const reachPeople = Math.round(totalFlyers * 2.1); // 平均世帯人数 2.1

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
        <StatsReveal totalFlyers={totalFlyers} totalMembers={totalMembers} reachPeople={reachPeople} />
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
    <div style={{ paddingTop: 40, paddingBottom: 20 }}>
      {POEM_LINES.map((line, i) => {
        const delay = i * 0.9;
        return (
          <div key={i} style={{
            fontSize: line.big ? 22 : 17, fontWeight: line.big ? 700 : 400,
            lineHeight: 2.0, marginBottom: line.pause ? 32 : 14,
            opacity: 0, animation: `fadeInUp 1.2s ease-out ${delay}s forwards`,
            color: line.big ? "#fde68a" : "#e2e8f0",
            textShadow: line.big ? "0 0 30px rgba(253,230,138,0.4)" : "none",
            letterSpacing: "0.02em",
          }}>
            {line.text}
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
  const base = POEM_LINES.length * 0.9 + 3;
  return (
    <div style={{ textAlign: "center", padding: "60px 20px 40px" }}>
      <div style={{
        fontSize: 28, fontWeight: 800, letterSpacing: "0.1em", color: "#fde68a",
        opacity: 0, animation: `fadeInScale 2s ease-out ${base}s forwards, softPulse 4s ease-in-out ${base + 2}s infinite`,
        marginBottom: 18,
      }}>
        {SLOGAN_MAIN}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 600, color: "#f8fafc", letterSpacing: "0.05em",
        opacity: 0, animation: `fadeInUp 2s ease-out ${base + 1.2}s forwards`,
      }}>
        {SLOGAN_SUB}
      </div>
    </div>
  );
}

// ============================================================
// 統計サマリー（ポエムの後に挟む）
// ============================================================
function StatsReveal({ totalFlyers, totalMembers, reachPeople }) {
  const base = POEM_LINES.length * 0.9 + 0.5;
  const items = [
    { label: "私たちが届けた", value: totalFlyers, unit: "枚", color: "#f59e0b" },
    { label: "届いた可能性のある", value: reachPeople, unit: "人", color: "#ec4899" },
    { label: "届けた仲間", value: totalMembers, unit: "人", color: "#a3e635" },
  ];
  return (
    <div style={{
      display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap",
      padding: "30px 0", margin: "20px 0",
      opacity: 0, animation: `fadeInUp 1.5s ease-out ${base}s forwards`,
    }}>
      {items.map(it => (
        <div key={it.label} style={{ textAlign: "center", minWidth: 140 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{it.label}</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: it.color, lineHeight: 1 }}>
            <CountUp to={it.value} delay={base * 1000 + 300} />
            <span style={{ fontSize: 14, color: "#94a3b8", marginLeft: 4 }}>{it.unit}</span>
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
  const base = POEM_LINES.length * 0.9 + 6;
  return (
    <div style={{ marginTop: 40, opacity: 0, animation: `fadeInUp 2s ease-out ${base}s forwards` }}>
      <div style={{
        textAlign: "center", fontSize: 13, color: "#94a3b8", letterSpacing: "0.3em", marginBottom: 28,
      }}>
        ─ この活動に参加してくれた、すべての人へ ─
      </div>
      {displayStyle === "constellation" && <ConstellationView members={memberData} maxFlyers={memberData[0]?.flyers || 1} />}
      {displayStyle === "credits" && <CreditsView members={memberData} totalFlyers={totalFlyers} />}
      {displayStyle === "petals" && <PetalsView members={memberData} maxFlyers={memberData[0]?.flyers || 1} />}
      {displayStyle === "map" && <MapOverlayView members={memberData} maxFlyers={memberData[0]?.flyers || 1} />}
    </div>
  );
}

// ============================================================
// ① 星座型
// ============================================================
function ConstellationView({ members, maxFlyers }) {
  const positions = useMemo(() => {
    // 重ならないように格子+ジッターで配置
    const cols = Math.ceil(Math.sqrt(members.length * 1.6));
    const rows = Math.ceil(members.length / cols);
    return members.map((m, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = (c + 0.5) / cols * 90 + 5 + (Math.random() - 0.5) * (70 / cols);
      const y = (r + 0.5) / rows * 90 + 5 + (Math.random() - 0.5) * (60 / rows);
      return { x, y };
    });
  }, [members]);

  return (
    <div style={{
      position: "relative", width: "100%", height: 520,
      background: "radial-gradient(ellipse at center, rgba(30,41,59,0.5), transparent 70%)",
      borderRadius: 20, overflow: "hidden",
    }}>
      {/* 線で繋ぐ（ランダムな星座感） */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {positions.slice(0, -1).map((p, i) => {
          const next = positions[i + 1];
          return <line key={i} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${next.x}%`} y2={`${next.y}%`}
            stroke="rgba(245,158,11,0.15)" strokeWidth={1} />;
        })}
      </svg>
      {members.map((m, i) => {
        const pos = positions[i];
        const scale = 0.5 + (m.flyers / maxFlyers) * 0.9;
        return (
          <div key={m.name} style={{
            position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`,
            transform: "translate(-50%,-50%)", textAlign: "center",
            animation: `starPop 0.8s ease-out ${0.02 * i}s backwards`,
          }}>
            <div style={{
              width: 10 * scale + 4, height: 10 * scale + 4, borderRadius: "50%",
              background: "radial-gradient(circle,#fde68a,#f59e0b 60%,transparent)",
              boxShadow: `0 0 ${12 * scale}px rgba(253,230,138,0.9)`,
              margin: "0 auto 6px",
            }} />
            <div style={{
              fontSize: 10 + scale * 2, fontWeight: 600, color: "#fde68a",
              textShadow: "0 0 6px rgba(0,0,0,0.9)", whiteSpace: "nowrap",
            }}>
              {m.name}
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", textShadow: "0 0 4px rgba(0,0,0,0.9)" }}>
              {m.flyers.toLocaleString()}枚
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ② エンドロール型
// ============================================================
function CreditsView({ members, totalFlyers }) {
  return (
    <div style={{
      position: "relative", height: 460, overflow: "hidden",
      background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.4) 20%, rgba(0,0,0,0.4) 80%, transparent)",
      borderRadius: 16, mask: "linear-gradient(180deg, transparent, black 15%, black 85%, transparent)",
      WebkitMask: "linear-gradient(180deg, transparent, black 15%, black 85%, transparent)",
    }}>
      <div style={{
        position: "absolute", left: 0, right: 0, top: 0,
        animation: `scroll ${members.length * 2.2 + 10}s linear infinite`,
        padding: "100% 0 50%",
      }}>
        {members.map((m, i) => {
          const pct = m.flyers / totalFlyers * 100;
          // 文章の実数を計算（100枚のうち各比率に応じて）
          const breakdown = {
            discard: Math.round(m.flyers * 0.6),
            glimpse: Math.round(m.flyers * 0.3),
            memory: Math.round(m.flyers * 0.07),
            read: Math.round(m.flyers * 0.02),
            vote: Math.max(1, Math.round(m.flyers * 0.01)),
          };
          return (
            <div key={m.name} style={{
              display: "flex", justifyContent: "center", alignItems: "baseline",
              gap: 16, padding: "18px 0", textAlign: "center",
            }}>
              <div style={{
                fontSize: 20, fontWeight: 700, color: "#fde68a",
                letterSpacing: "0.05em", minWidth: 160, textAlign: "right",
              }}>
                {m.name}
              </div>
              <div style={{ color: "#64748b", fontSize: 14 }}>—</div>
              <div style={{ minWidth: 260, textAlign: "left" }}>
                <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600 }}>
                  {m.flyers.toLocaleString()}枚 / {m.munis}市区町村 / {m.days}日
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  うち約{breakdown.vote}票が未来へ
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ③ 花びら型
// ============================================================
function PetalsView({ members, maxFlyers }) {
  const petals = useMemo(() => {
    return members.map((m, i) => ({
      ...m,
      x: Math.random() * 90 + 5,
      delay: Math.random() * 12,
      duration: 14 + Math.random() * 8,
      size: 0.5 + (m.flyers / maxFlyers) * 1.2,
      hue: [330, 45, 160, 200][i % 4],
    }));
  }, [members, maxFlyers]);

  return (
    <div>
      <div style={{
        position: "relative", width: "100%", height: 380, overflow: "hidden",
        background: "radial-gradient(ellipse at center, rgba(236,72,153,0.08), transparent 60%)",
        borderRadius: 20, marginBottom: 20,
      }}>
        {petals.map((p, i) => (
          <div key={i} style={{
            position: "absolute", left: `${p.x}%`, top: 0,
            animation: `petalFall ${p.duration}s linear ${p.delay}s infinite`,
            pointerEvents: "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 14 * p.size, height: 14 * p.size,
                background: `radial-gradient(circle, hsl(${p.hue},80%,75%), hsl(${p.hue},70%,55%))`,
                borderRadius: "50% 10% 50% 10%", transform: "rotate(45deg)",
                boxShadow: `0 0 12px hsl(${p.hue},80%,60%,0.6)`,
              }} />
              <span style={{
                fontSize: 11, color: `hsl(${p.hue},50%,85%)`, fontWeight: 600,
                textShadow: "0 0 6px rgba(0,0,0,0.9)", whiteSpace: "nowrap",
              }}>
                {p.name}
              </span>
            </div>
          </div>
        ))}
      </div>
      {/* リスト部分 */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 8, padding: "0 10px",
      }}>
        {members.map((m, i) => (
          <div key={m.name} style={{
            padding: "8px 12px", background: "rgba(236,72,153,0.08)",
            border: "1px solid rgba(236,72,153,0.2)", borderRadius: 10,
            fontSize: 12, color: "#f8fafc",
          }}>
            <div style={{ fontWeight: 700 }}>🌸 {m.name}</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>
              {m.flyers.toLocaleString()}枚・{m.munis}市区町村
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ④ 地図オーバーレイ型
// ============================================================
function MapOverlayView({ members, maxFlyers }) {
  // 疑似的に4県の枠を描画し、メンバーを配置
  const prefBoxes = [
    { name: "埼玉", x: 10, y: 55, w: 30, h: 35 },
    { name: "栃木", x: 42, y: 10, w: 28, h: 40 },
    { name: "茨城", x: 72, y: 15, w: 25, h: 50 },
    { name: "群馬", x: 10, y: 12, w: 30, h: 35 },
  ];
  const placed = useMemo(() => {
    return members.map((m, i) => {
      const box = prefBoxes[i % prefBoxes.length];
      const x = box.x + Math.random() * (box.w - 5) + 2;
      const y = box.y + Math.random() * (box.h - 5) + 2;
      return { ...m, x, y };
    });
  }, [members]);
  return (
    <div style={{
      position: "relative", width: "100%", height: 460,
      background: "rgba(30,41,59,0.4)", borderRadius: 20, overflow: "hidden",
      border: "1px solid #334155",
    }}>
      {/* 県枠 */}
      {prefBoxes.map(p => (
        <div key={p.name} style={{
          position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
          width: `${p.w}%`, height: `${p.h}%`,
          border: "1px dashed rgba(163,230,53,0.3)", borderRadius: 8,
        }}>
          <div style={{
            position: "absolute", top: 4, left: 6, fontSize: 10,
            color: "rgba(163,230,53,0.6)", fontWeight: 700, letterSpacing: "0.2em",
          }}>
            {p.name}
          </div>
        </div>
      ))}
      {/* メンバー点 */}
      {placed.map((m, i) => {
        const scale = 0.5 + (m.flyers / maxFlyers) * 1.2;
        return (
          <div key={m.name} style={{
            position: "absolute", left: `${m.x}%`, top: `${m.y}%`,
            transform: "translate(-50%,-50%)", textAlign: "center",
            animation: `starPop 0.6s ease-out ${0.03 * i}s backwards`,
          }}>
            <div style={{
              width: 8 + scale * 6, height: 8 + scale * 6, borderRadius: "50%",
              background: "radial-gradient(circle,#a3e635,#65a30d 70%)",
              boxShadow: `0 0 ${10 * scale}px rgba(163,230,53,0.9)`,
              margin: "0 auto 4px",
            }} />
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#fff",
              textShadow: "0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)",
              whiteSpace: "nowrap",
            }}>
              {m.name}
            </div>
          </div>
        );
      })}
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
