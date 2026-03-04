import { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import Scoreboard from "./Scoreboard";

const TOTAL_TURNS = 40;
const MAX_SCORE = 4500;

// ── Colour palette ──────────────────────────────────────────────────────────
const C = {
  bg:            "#171a10",   // very dark olive
  panel:         "#1e2215",   // slightly lighter panel bg
  sidebar:       "#1a1d12",   // sidebar bg
  parchment:     "#f0e6c8",   // aged paper
  parchmentMid:  "#ddd0a0",
  parchmentDark: "#c4af7a",
  ink:           "#16100a",   // dark brown ink
  gold:          "#c8a035",
  goldLight:     "#e8c55a",
  red:           "#7a1a1a",
  green:         "#2a4a1f",
  greenLight:    "#3d6b2e",
  border:        "#3a4020",
  cardBorder:    "#b09555",
  muted:         "#7a8050",
  mutedLight:    "#a0a870",
};

// ── Static data ─────────────────────────────────────────────────────────────
const ACTION_LABELS = {
  network:    "Xây dựng mạng lưới",
  propaganda: "Tuyên truyền",
  action:     "Tổ chức hành động",
  cooldown:   "Ẩn náu",
};

const ACTION_TOOLTIPS = {
  network:
    "Xây dựng cơ sở bí mật (+1 nút mạng, +2 rủi ro). Mỗi nút giảm 0.5 rủi ro cho mọi hành động trong vùng. Tối đa 5 nút.",
  propaganda:
    "Phát triển ảnh hưởng chính trị (+8 ảnh hưởng, +4 rủi ro). Hiệu quả tăng khi sự ủng hộ công chúng vượt 70%.",
  action:
    "Tổ chức biểu tình và đình công (+12 ảnh hưởng, +8 rủi ro). Đóng góp tối đa +5 động lực mỗi quý — chỉ 2 vùng tính.",
  cooldown:
    "Ẩn tổ chức để tránh đàn áp (−10 rủi ro, −3 ảnh hưởng). Hiệu quả giảm còn −4 sau 2 quý liên tiếp (!)",
};

const ERA_CONTEXT = [
  {
    era: "Khởi đầu kháng chiến (1945–1947)",
    quote:
      "\"Chúng ta thà hy sinh tất cả, chứ nhất định không chịu mất nước, nhất định không chịu làm nô lệ.\"",
    author: "— Hồ Chí Minh, Lời kêu gọi Toàn quốc kháng chiến, 19/12/1946",
    context:
      "Pháp tái chiếm Đông Dương sau Thế chiến II. Việt Minh vừa tuyên bố độc lập nhưng đang đối mặt với áp lực quân sự ngày càng tăng tại các đô thị lớn.",
  },
  {
    era: "Leo thang chiến tranh (1948–1950)",
    quote: "\"Kháng chiến trường kỳ, nhất định thắng lợi.\"",
    author: "— Hồ Chí Minh",
    context:
      "Pháp kiểm soát các đô thị lớn; Việt Minh củng cố vùng nông thôn. Năm 1949, Trung Quốc cộng sản hóa — cục diện viện trợ quốc tế thay đổi căn bản.",
  },
  {
    era: "Quốc tế hoá cuộc chiến (1951–1952)",
    quote: "\"Lực lượng ta đã lớn mạnh hơn trước nhiều.\"",
    author: "— Đại tướng Võ Nguyên Giáp",
    context:
      "Mỹ tài trợ 80% chi phí chiến tranh cho Pháp. Viện trợ Trung Quốc giúp Việt Minh hiện đại hoá. Đây là cuộc chiến ủy nhiệm trong Chiến tranh Lạnh.",
  },
  {
    era: "Giai đoạn quyết định (1953–1954)",
    quote: "\"Trận Điện Biên Phủ sẽ là trận quyết chiến chiến lược.\"",
    author: "— Bộ Tổng tư lệnh Việt Minh",
    context:
      "Kháng chiến bước vào hồi kết. Ảnh hưởng của phong trào, sự ủng hộ nhân dân và động lực cách mạng tại các vùng chiến lược sẽ quyết định số phận của toàn cuộc kháng chiến.",
  },
];

const initialRegions = [
  { name: "Việt Bắc",            influence: 30, risk: 20, network: 1, planned: null, layLowStreak: 0 },
  { name: "Đồng bằng sông Hồng", influence: 20, risk: 25, network: 1, planned: null, layLowStreak: 0 },
  { name: "Miền Trung",          influence: 15, risk: 30, network: 0, planned: null, layLowStreak: 0 },
  { name: "Miền Nam",            influence: 10, risk: 35, network: 0, planned: null, layLowStreak: 0 },
  { name: "Tây Bắc",             influence: 25, risk: 20, network: 1, planned: null, layLowStreak: 0 },
];

function calculateScore(regions, momentum, support, result) {
  const regionScore = regions.reduce(
    (sum, r) => sum + r.influence * 5 - r.risk * 2 + r.network * 20,
    0
  );
  const base = result === "Victory" ? 1000 : 0;
  return Math.max(0, Math.min(MAX_SCORE, base + regionScore + momentum * 3 + support * 2));
}

// ── Shared micro-components ─────────────────────────────────────────────────

function StatBar({ value, color, warn }) {
  return (
    <div style={{ height: 6, background: "#2a2a20", borderRadius: 1 }}>
      <div
        style={{
          height: "100%",
          width: `${value}%`,
          background: warn ? "#c04040" : color,
          transition: "width 0.4s ease",
          borderRadius: 1,
        }}
      />
    </div>
  );
}

function SidebarTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 4px",
        border: "none",
        cursor: "pointer",
        background: active ? C.bg : "transparent",
        color: active ? C.gold : C.muted,
        fontFamily: "'Be Vietnam Pro', sans-serif",
        fontSize: 13,
        borderBottom: `2px solid ${active ? C.gold : "transparent"}`,
        transition: "color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Game() {
  const [regions, setRegions]     = useState(initialRegions);
  const [turn, setTurn]           = useState(0);
  const [momentum, setMomentum]   = useState(30);
  const [support, setSupport]     = useState(50);
  const [gameOver, setGameOver]   = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [tooltip, setTooltip]     = useState(null); // { key, top, left }
  const seenTooltips = useRef(new Set()); // each action key shown at most once
  const [eventLog, setEventLog]   = useState([]);
  const [activeTab, setActiveTab] = useState("guide");

  const year    = 1945 + Math.floor(turn / 4);
  const quarter = (turn % 4) + 1;
  const clamp   = v => Math.max(0, Math.min(100, v));
  const era     = ERA_CONTEXT[Math.min(3, Math.floor(turn / 10))];

  // ── Prediction ─────────────────────────────────────────────────────────────
  function predictNextState(currentSupport) {
    let predicted = regions.map(r => ({ ...r }));

    predicted = predicted.map(r => {
      let influenceGain = 0, riskGain = 0, networkGain = 0;

      if (!r.planned) {
        influenceGain = -1; // idle decay
      } else if (r.planned === "network") {
        networkGain = 1; riskGain = 2;
      } else if (r.planned === "propaganda") {
        influenceGain = 8; riskGain = 4;
      } else if (r.planned === "action") {
        influenceGain = 12; riskGain = 8;
      } else if (r.planned === "cooldown") {
        riskGain      = r.layLowStreak >= 2 ? -4 : -10; // diminishing returns
        influenceGain = -3;
      }

      riskGain = Math.max(riskGain - r.network * 0.5, riskGain < 0 ? riskGain : 0);
      if (currentSupport > 70) influenceGain += 5;
      if (currentSupport < 30) riskGain      += 5;

      return {
        ...r,
        influence: clamp(r.influence + influenceGain),
        risk:      clamp(r.risk      + riskGain),
        network:   Math.min(5, r.network + networkGain),
      };
    });

    // French pressure on highest-influence region
    const highest = predicted.reduce((a, b) => a.influence > b.influence ? a : b);
    predicted = predicted.map(r => {
      if (r.name === highest.name) r = { ...r, risk: clamp(r.risk + 6) };
      if (r.risk >= 80)            r = { ...r, influence: clamp(r.influence - 5) };
      return r;
    });

    // Risk escalation
    predicted = predicted.map(r => {
      if      (r.risk >= 85) r = { ...r, risk: clamp(r.risk + 6) };
      else if (r.risk >= 70) r = { ...r, risk: clamp(r.risk + 4) };
      return r;
    });

    return predicted;
  }

  const predictedRegions = predictNextState(support);

  function getTrend(current, predicted, type) {
    const diff = Math.round(predicted - current);
    if (diff === 0) return <span style={{ color: C.muted }}> ±0</span>;
    const bad   = (type === "risk" && diff > 0) || (type !== "risk" && diff < 0);
    return (
      <span style={{ color: bad ? "#c04040" : "#5aaa50", fontSize: 11 }}>
        {diff > 0 ? ` ↑+${diff}` : ` ↓${diff}`}
      </span>
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function planAction(index, type) {
    setRegions(prev => prev.map((r, i) => i === index ? { ...r, planned: type } : r));
  }

  function resolveTurn() {
    if (gameOver) return;

    let newMomentum = momentum;
    let newSupport  = support;
    let momentumGain = 0;
    const logEvents = [];

    regions.forEach(r => {
      if (r.planned === "action")   momentumGain = Math.min(momentumGain + 5, 10); // cap at +10
      if (r.planned === "cooldown") newSupport   = clamp(newSupport + 3);
    });
    newMomentum = clamp(newMomentum + momentumGain - 2); // -2 natural decay

    const updated  = predictNextState(newSupport);
    const nextTurn = turn + 1;

    // Build log entry
    regions.forEach((r, i) => {
      if (r.planned) logEvents.push(`${r.name}: ${ACTION_LABELS[r.planned]}`);
    });
    updated.forEach(r => {
      if (r.risk >= 85) logEvents.push(`⚠ ${r.name} — rủi ro nguy hiểm`);
    });

    const withStreaks = updated.map((r, i) => ({
      ...r,
      layLowStreak: regions[i].planned === "cooldown" ? regions[i].layLowStreak + 1 : 0,
      planned: null,
    }));

    setEventLog(prev =>
      [{ label: `${year} – Quý ${quarter}`, events: logEvents }, ...prev].slice(0, 8)
    );
    setMomentum(newMomentum);
    setSupport(newSupport);
    setRegions(withStreaks);
    setTurn(nextTurn);

    const highRisk = updated.filter(r => r.risk >= 90).length;
    const strong   = updated.filter(r => r.influence >= 60).length;

    if (highRisk >= 3 || newSupport <= 15) {
      setGameOver({ result: "Defeat", score: calculateScore(updated, newMomentum, newSupport, "Defeat") });
      return;
    }
    if (nextTurn === TOTAL_TURNS) {
      const result = (strong >= 3 && newMomentum >= 60 && newSupport >= 50) ? "Victory" : "Defeat";
      setGameOver({ result, score: calculateScore(updated, newMomentum, newSupport, result) });
    }
  }

  async function submitScore() {
    if (!playerName.trim()) return;
    const safeName    = playerName.trim().replace(/<[^>]*>/g, "").slice(0, 32);
    if (!safeName) return;
    const recalcScore = calculateScore(regions, momentum, support, gameOver.result);

    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.from("game_scores").insert({
      player_name: safeName,
      score:       recalcScore,
      result:      gameOver.result,
      momentum,
      support,
    });
    if (error) setSubmitError(error.message);
    else       setSubmitted(true);
    setSubmitting(false);
  }

  function handleTooltipShow(e, key) {
    if (seenTooltips.current.has(key)) return; // already shown once — skip
    seenTooltips.current.add(key);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ key, top: rect.top, left: rect.left });
  }

  // ── GAME OVER SCREEN ────────────────────────────────────────────────────────
  if (gameOver) {
    const isVictory = gameOver.result === "Victory";
    return (
      <div style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Be Vietnam Pro', sans-serif",
      }}>
        <div style={{
          background: C.parchment,
          maxWidth: 580,
          width: "100%",
          padding: "40px 48px",
          border: `3px double ${C.gold}`,
          boxShadow: "0 0 60px rgba(0,0,0,0.7), inset 0 0 40px rgba(0,0,0,0.05)",
        }}>
          {/* Title */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 52, marginBottom: 4, lineHeight: 1 }}>
              {isVictory ? "★" : "✖"}
            </div>
            <h1 style={{
              color: isVictory ? C.green : C.red,
              margin: 0,
              fontSize: 34,
              fontFamily: "'Crimson Pro', 'Be Vietnam Pro', serif",
              fontWeight: "600",
            }}>
              {isVictory ? "Chiến Thắng" : "Thất Bại"}
            </h1>
            <p style={{ color: "#777", marginTop: 8, fontStyle: "italic", fontSize: 15 }}>
              {isVictory
                ? "Chiến dịch cách mạng đã thành công. Nhân dân đứng lên."
                : "Chiến dịch đã thất bại. Pháp vẫn duy trì quyền kiểm soát."}
            </p>
            <div style={{ borderTop: `1px solid ${C.parchmentDark}`, margin: "16px 0 0" }} />
          </div>

          {/* Score */}
          <div style={{
            textAlign: "center",
            background: isVictory ? "#e8f0e0" : "#f0e0e0",
            border: `2px solid ${isVictory ? "#4a8a40" : C.red}`,
            padding: "14px 20px",
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 40, fontWeight: "bold", color: C.ink }}>{gameOver.score}</div>
            <div style={{ fontSize: 14, color: "#888" }}>
              Điểm cuối cùng
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#999", marginBottom: 8 }}>
              Chi tiết điểm số
            </div>
            {regions.map(r => (
              <div key={r.name} style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 4,
                color: C.ink,
              }}>
                <span>{r.name}</span>
                <span style={{ color: "#555" }}>
                  {r.influence * 5}−{r.risk * 2}+{r.network * 20} =&nbsp;
                  <strong>{Math.max(0, r.influence * 5 - r.risk * 2 + r.network * 20)}</strong>
                </span>
              </div>
            ))}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${C.parchmentDark}`,
              color: C.ink,
            }}>
              <span>Động lực {momentum}% + Sự ủng hộ {support}%</span>
              <strong>{momentum * 3 + support * 2}</strong>
            </div>
            {isVictory && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                marginTop: 4,
                color: C.green,
                fontWeight: "bold",
              }}>
                <span>Thưởng chiến thắng</span>
                <span>+1000</span>
              </div>
            )}
          </div>

          {/* Submit */}
          {!submitted ? (
            <div style={{ marginBottom: 24, borderTop: `1px solid ${C.parchmentDark}`, paddingTop: 16 }}>
              <div style={{ fontWeight: "bold", marginBottom: 8, fontSize: 15, color: C.ink }}>
                Gửi điểm số của bạn
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Nhập tên của bạn"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitScore()}
                  maxLength={32}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: `1px solid ${C.cardBorder}`,
                    background: "white",
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                    fontSize: 15,
                    color: C.ink,
                  }}
                />
                <button
                  onClick={submitScore}
                  disabled={submitting || !playerName.trim()}
                  style={{
                    padding: "8px 16px",
                    background: submitting || !playerName.trim() ? "#aaa" : C.green,
                    color: "white",
                    border: "none",
                    cursor: submitting || !playerName.trim() ? "default" : "pointer",
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                    fontSize: 15,
                  }}
                >
                  {submitting ? "Đang gửi..." : "Gửi điểm"}
                </button>
              </div>
              {submitError && (
                <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>Lỗi: {submitError}</div>
              )}
            </div>
          ) : (
            <div style={{
              color: C.green,
              fontWeight: "bold",
              marginBottom: 24,
              textAlign: "center",
              fontSize: 14,
            }}>
              ✓ Đã gửi điểm thành công!
            </div>
          )}

          <Scoreboard highlightScore={submitted ? gameOver.score : undefined} />

          <button
            onClick={() => window.location.reload()}
            style={{
              width: "100%",
              marginTop: 20,
              padding: "12px 0",
              background: C.ink,
              color: C.gold,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Be Vietnam Pro', sans-serif",
              fontSize: 15,
            }}
          >
            Khởi động lại chiến dịch
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN GAME SCREEN ────────────────────────────────────────────────────────
  const strong   = regions.filter(r => r.influence >= 60).length;
  const planned  = regions.filter(r => r.planned).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Be Vietnam Pro', sans-serif", color: C.parchment, display: "flex", flexDirection: "column" }}>

      {/* ── Floating tooltip ── */}
      {tooltip && (
        <div style={{
          position: "fixed",
          top:  Math.max(10, tooltip.top - 95),
          left: Math.max(10, Math.min(tooltip.left, window.innerWidth - 260)),
          background: "#0e0c08",
          color: C.parchment,
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.6,
          maxWidth: 240,
          zIndex: 9999,
          border: `1px solid ${C.gold}`,
          boxShadow: "3px 4px 16px rgba(0,0,0,0.8)",
          pointerEvents: "none",
        }}>
          <strong style={{ color: C.gold, display: "block", marginBottom: 4 }}>
            {ACTION_LABELS[tooltip.key]}
          </strong>
          {ACTION_TOOLTIPS[tooltip.key]}
        </div>
      )}

      {/* ── Header banner ── */}
      <div style={{
        background: `linear-gradient(180deg, #1a2810 0%, #243018 100%)`,
        borderBottom: `3px solid ${C.gold}`,
        padding: "14px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <span style={{
            fontSize: 28,
            fontWeight: "600",
            color: C.gold,
            fontFamily: "'Crimson Pro', 'Be Vietnam Pro', serif",
          }}>
            Kháng Chiến
          </span>
          <span style={{
            color: C.mutedLight,
            marginLeft: 20,
            fontSize: 14,
            fontStyle: "italic",
          }}>
            Chiến lược giải phóng dân tộc Việt Nam, 1945–1954
          </span>
        </div>
        <div style={{
          color: C.goldLight,
          fontSize: 15,
          fontWeight: "bold",
          background: "rgba(0,0,0,0.3)",
          padding: "6px 14px",
          border: `1px solid ${C.border}`,
        }}>
          {year} &mdash; Quý {quarter} &nbsp;·&nbsp; Lượt {turn + 1}/{TOTAL_TURNS}
        </div>
      </div>

      {/* ── Body: main + sidebar ── */}
      <div style={{ display: "flex", flex: 1, alignItems: "stretch" }}>

        {/* ── LEFT: Game content ── */}
        <div style={{ flex: 1, padding: "18px 22px 24px", minWidth: 0 }}>

          {/* Global stats row */}
          <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
            {[
              { label: "Động lực cách mạng",  value: momentum, color: "#4a8ad9", warn: momentum < 40 },
              { label: "Sự ủng hộ nhân dân",  value: support,  color: "#50a848", warn: support  < 30 },
            ].map(stat => (
              <div key={stat.label} style={{
                flex: 1,
                background: C.panel,
                border: `1px solid ${stat.warn ? "#6a3030" : C.border}`,
                padding: "10px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14 }}>
                  <span style={{ color: C.muted }}>{stat.label}</span>
                  <span style={{
                    color: stat.warn ? "#e06040" : C.goldLight,
                    fontWeight: "bold",
                    fontSize: 15,
                  }}>
                    {stat.value}%
                  </span>
                </div>
                <StatBar value={stat.value} color={stat.color} warn={stat.warn} />
              </div>
            ))}
          </div>

          {/* Region grid — 3 columns so all 5 fill naturally */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}>
            {regions.map((r, i) => {
              const pred   = predictedRegions[i];
              const danger = r.risk >= 80;
              const secure = r.influence >= 60;
              return (
                <div key={r.name} style={{
                  background:   C.parchment,
                  border:       `2px solid ${danger ? C.red : secure ? C.greenLight : C.cardBorder}`,
                  padding:      "12px 14px",
                  color:        C.ink,
                  boxShadow:    danger
                    ? `0 0 14px rgba(120,30,30,0.45)`
                    : secure
                    ? `0 0 8px rgba(40,80,30,0.25)`
                    : "none",
                  transition: "border-color 0.3s, box-shadow 0.3s",
                  position: "relative",
                }}>
                  {/* Card header */}
                  <div style={{
                    fontWeight: "bold",
                    fontSize: 15,
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: `1px solid ${C.parchmentMid}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}>
                    {danger && <span style={{ color: C.red, fontSize: 15 }}>⚠</span>}
                    {secure && !danger && <span style={{ color: C.greenLight, fontSize: 13 }}>★</span>}
                    {r.name}
                  </div>

                  {/* Influence */}
                  <div style={{ fontSize: 13, marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#666" }}>Ảnh hưởng</span>
                    <span style={{ fontWeight: "bold", fontSize: 13 }}>
                      {r.influence}%{getTrend(r.influence, pred.influence, "influence")}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#d8d0b8", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${r.influence}%`, background: "#4a80c8", transition: "width 0.4s" }} />
                  </div>

                  {/* Risk */}
                  <div style={{ fontSize: 13, marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#666" }}>Rủi ro</span>
                    <span style={{ fontWeight: "bold", fontSize: 13 }}>
                      {r.risk}%{getTrend(r.risk, pred.risk, "risk")}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#d8d0b8", marginBottom: 8 }}>
                    <div style={{
                      height: "100%",
                      width: `${r.risk}%`,
                      background: r.risk >= 70 ? "#b83030" : "#d06030",
                      transition: "width 0.4s",
                    }} />
                  </div>

                  {/* Network nodes */}
                  <div style={{ fontSize: 13, color: "#777", marginBottom: 10 }}>
                    Mạng lưới:&nbsp;
                    {Array.from({ length: 5 }, (_, j) => (
                      <span key={j} style={{
                        color: j < r.network ? C.greenLight : "#ccc",
                        fontSize: 14,
                        lineHeight: 1,
                      }}>●</span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {["network", "propaganda", "action", "cooldown"].map(type => {
                      const active = r.planned === type;
                      const streak = type === "cooldown" && r.layLowStreak >= 2;
                      return (
                        <button
                          key={type}
                          onClick={() => planAction(i, type)}
                          onMouseEnter={e => handleTooltipShow(e, type)}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            padding: "5px 9px",
                            fontSize: 12,
                            border:  `1px solid ${active ? C.greenLight : C.parchmentDark}`,
                            background: active ? C.greenLight : "rgba(255,255,255,0.7)",
                            color:   active ? "white" : C.ink,
                            cursor:  "pointer",
                            fontFamily: "'Be Vietnam Pro', sans-serif",
                            transition: "all 0.15s",
                          }}
                        >
                          {ACTION_LABELS[type]}
                          {streak && (
                            <span style={{ color: active ? "#ffcc88" : "#c06010", marginLeft: 2 }}>!</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Planned indicator */}
                  {r.planned && (
                    <div style={{
                      marginTop: 7,
                      fontSize: 12,
                      color: C.greenLight,
                      fontStyle: "italic",
                    }}>
                      → {ACTION_LABELS[r.planned]}
                      {r.planned === "cooldown" && r.layLowStreak >= 2 && (
                        <span style={{ color: "#c06010" }}> (hiệu quả giảm)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* End-turn footer */}
          <div style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 18,
            borderTop: `1px solid ${C.border}`,
            paddingTop: 16,
          }}>
            <button
              onClick={resolveTurn}
              style={{
                padding: "12px 36px",
                background: `linear-gradient(180deg, #c8a840 0%, #a08020 100%)`,
                color: C.ink,
                border: `1px solid #806010`,
                cursor: "pointer",
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontSize: 16,
                fontWeight: "bold",
                boxShadow: "2px 3px 8px rgba(0,0,0,0.5)",
              }}
            >
              Kết thúc quý →
            </button>
            <span style={{ color: C.muted, fontSize: 13, fontStyle: "italic" }}>
              {planned}/{regions.length} vùng đã lên kế hoạch
            </span>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div style={{
          width: 290,
          flexShrink: 0,
          background: C.sidebar,
          borderLeft: `2px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Tabs */}
          <div style={{
            display: "flex",
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}>
            {[["guide", "Hướng dẫn"], ["objectives", "Mục tiêu"], ["log", "Nhật ký"]].map(
              ([tab, label]) => (
                <SidebarTab
                  key={tab}
                  label={label}
                  active={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                />
              )
            )}
          </div>

          {/* Tab body */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            fontSize: 13,
            lineHeight: 1.7,
            color: C.parchment,
          }}>

            {/* ── GUIDE tab ── */}
            {activeTab === "guide" && (
              <div>
                <h4 style={{ color: C.gold, margin: "0 0 10px 0", fontSize: 15 }}>
                  Cách chơi
                </h4>
                <p style={{ color: C.muted, fontSize: 13, marginTop: 0 }}>
                  Bạn lãnh đạo phong trào kháng chiến tại 5 vùng chiến lược.
                  Mỗi quý, chọn một hành động cho từng vùng, rồi nhấn <em>Kết thúc quý</em>.
                </p>

                {[
                  ["Xây dựng mạng lưới", "Tạo cơ sở bí mật. Mỗi nút giảm rủi ro cho các hành động sau. Đầu tư sớm sẽ có lợi lâu dài.", "#4a8ad9"],
                  ["Tuyên truyền",        "Tăng ảnh hưởng ổn định với rủi ro vừa phải. Tốt khi công chúng ủng hộ cao.",           "#78b838"],
                  ["Tổ chức hành động",  "Tăng ảnh hưởng mạnh nhưng rủi ro cao. Đóng góp vào động lực cách mạng (tối đa 2 vùng tính).", "#e09030"],
                  ["Ẩn náu",             "Giảm rủi ro khẩn cấp. Không dùng liên tiếp quá 2 quý — hiệu quả sẽ giảm mạnh!",       "#c05050"],
                ].map(([name, desc, color]) => (
                  <div key={name} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ color, fontWeight: "bold", fontSize: 13, marginBottom: 2 }}>{name}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{desc}</div>
                  </div>
                ))}

                <div style={{ background: "rgba(200,160,50,0.08)", border: `1px solid #5a4a10`, padding: "10px 12px", marginTop: 4 }}>
                  <div style={{ color: C.gold, fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>Lưu ý quan trọng</div>
                  <ul style={{ color: C.muted, fontSize: 12, paddingLeft: 14, margin: 0, lineHeight: 2 }}>
                    <li>Di chuột lần đầu lên mỗi nút để xem mô tả (chỉ hiện một lần)</li>
                    <li>Pháp tấn công vùng có ảnh hưởng <em>cao nhất</em></li>
                    <li>Vùng không lên kế hoạch mất 1% ảnh hưởng/quý</li>
                    <li>Mũi tên ↑↓ trên mỗi chỉ số dự báo lượt tới</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ── OBJECTIVES tab ── */}
            {activeTab === "objectives" && (
              <div>
                <h4 style={{ color: C.gold, margin: "0 0 10px 0", fontSize: 15 }}>
                  Điều kiện chiến thắng
                </h4>
                <p style={{ color: C.muted, fontSize: 13, marginTop: 0 }}>
                  Đạt đủ 3 điều kiện sau khi kết thúc lượt 40:
                </p>

                {[
                  { label: "Vùng kiểm soát (≥ 60% ảnh hưởng)", current: strong,   target: 3,  unit: "/5 vùng", ok: strong   >= 3  },
                  { label: "Động lực cách mạng",                 current: momentum, target: 60, unit: "%",      ok: momentum >= 60 },
                  { label: "Sự ủng hộ nhân dân",                 current: support,  target: 50, unit: "%",      ok: support  >= 50 },
                ].map(obj => (
                  <div key={obj.label} style={{
                    marginBottom: 10,
                    background: obj.ok ? "rgba(40,90,30,0.2)" : "rgba(90,30,30,0.15)",
                    border: `1px solid ${obj.ok ? "#3a7030" : "#6a2020"}`,
                    padding: "8px 10px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, color: C.muted }}>{obj.label}</span>
                      <span style={{
                        fontSize: 13,
                        fontWeight: "bold",
                        color: obj.ok ? "#60b850" : "#d05050",
                      }}>
                        {obj.ok ? "✓" : "✗"} {obj.current}{obj.unit}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#5a5a40", fontStyle: "italic" }}>
                      Cần đạt: {obj.target}{obj.unit}
                    </div>
                  </div>
                ))}

                <div style={{
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 12,
                  marginTop: 6,
                }}>
                  <div style={{ color: "#d05050", fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>
                    Thất bại ngay nếu:
                  </div>
                  <ul style={{ color: C.muted, fontSize: 12, paddingLeft: 14, margin: 0, lineHeight: 2 }}>
                    <li>≥ 3 vùng có rủi ro ≥ 90%</li>
                    <li>Sự ủng hộ nhân dân ≤ 15%</li>
                  </ul>
                </div>

                {/* Historical quote — changes by era */}
                <div style={{
                  marginTop: 16,
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 14,
                }}>
                  <div style={{ color: C.gold, fontSize: 12, fontWeight: "bold", marginBottom: 8 }}>
                    {era.era}
                  </div>
                  <p style={{ color: C.parchmentMid, fontSize: 14, fontStyle: "italic", margin: "0 0 4px", lineHeight: 1.7, fontFamily: "'Crimson Pro', 'Be Vietnam Pro', serif" }}>
                    {era.quote}
                  </p>
                  <p style={{ color: C.muted, fontSize: 12, margin: "0 0 10px" }}>{era.author}</p>
                  <p style={{ color: C.muted, fontSize: 12, margin: 0, lineHeight: 1.7 }}>{era.context}</p>
                </div>
              </div>
            )}

            {/* ── LOG tab ── */}
            {activeTab === "log" && (
              <div>
                <h4 style={{ color: C.gold, margin: "0 0 10px 0", fontSize: 15 }}>
                  Nhật ký chiến dịch
                </h4>
                {eventLog.length === 0 ? (
                  <p style={{ color: C.muted, fontSize: 13, fontStyle: "italic" }}>
                    Chưa có sự kiện nào được ghi lại. Hoàn thành một quý để bắt đầu.
                  </p>
                ) : (
                  eventLog.map((entry, idx) => (
                    <div key={idx} style={{
                      marginBottom: 14,
                      borderLeft: `2px solid ${idx === 0 ? C.gold : C.border}`,
                      paddingLeft: 10,
                      opacity: idx === 0 ? 1 : 0.7,
                    }}>
                      <div style={{
                        color: idx === 0 ? C.gold : C.muted,
                        fontSize: 12,
                        fontWeight: "bold",
                        marginBottom: 4,
                      }}>
                        {entry.label}
                      </div>
                      {entry.events.map((ev, j) => (
                        <div key={j} style={{
                          color: ev.startsWith("⚠") ? "#d05050" : C.parchmentMid,
                          fontSize: 13,
                          lineHeight: 1.6,
                        }}>
                          {ev}
                        </div>
                      ))}
                      {entry.events.length === 0 && (
                        <div style={{ color: C.muted, fontSize: 12, fontStyle: "italic" }}>
                          Không có hành động nào.
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
