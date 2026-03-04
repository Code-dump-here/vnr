import { useState } from "react";
import { supabase } from "../supabaseClient";
import Scoreboard from "./Scoreboard";

const TOTAL_TURNS = 40;

const initialRegions = [
  { name: "Viet Bac", influence: 30, risk: 20, network: 1, planned: null },
  { name: "Red River Delta", influence: 20, risk: 25, network: 1, planned: null },
  { name: "Central", influence: 15, risk: 30, network: 0, planned: null },
  { name: "South", influence: 10, risk: 35, network: 0, planned: null },
  { name: "Northwest", influence: 25, risk: 20, network: 1, planned: null }
];

// Score formula:
//   Victory base: 1000 | Defeat base: 0
//   Per region: influence*5 - risk*2 + network*20
//   Global: momentum*3 + support*2
function calculateScore(regions, momentum, support, result) {
  const regionScore = regions.reduce(
    (sum, r) => sum + r.influence * 5 - r.risk * 2 + r.network * 20,
    0
  );
  const base = result === "Victory" ? 1000 : 0;
  return Math.max(0, base + regionScore + momentum * 3 + support * 2);
}

export default function Game() {
  const [regions, setRegions] = useState(initialRegions);
  const [turn, setTurn] = useState(0);
  const [momentum, setMomentum] = useState(30);
  const [support, setSupport] = useState(50);
  const [gameOver, setGameOver] = useState(null); // { result, score }

  // Scoreboard submission state
  const [playerName, setPlayerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const year = 1945 + Math.floor(turn / 4);
  const quarter = (turn % 4) + 1;
  const clamp = v => Math.max(0, Math.min(100, v));

  // ===============================
  // PREDICTION SYSTEM
  // ===============================

  function predictNextState(currentSupport) {
    let predicted = regions.map(r => ({ ...r }));

    predicted = predicted.map(r => {
      let influenceGain = 0;
      let riskGain = 0;
      let networkGain = 0;

      if (r.planned === "network") { networkGain = 1; riskGain = 2; }
      if (r.planned === "propaganda") { influenceGain = 8; riskGain = 4; }
      if (r.planned === "action") { influenceGain = 12; riskGain = 8; }
      if (r.planned === "cooldown") { riskGain = -10; influenceGain = -3; }

      // Network reduces risk gain (each dot absorbs 0.5 risk)
      riskGain = Math.max(riskGain - r.network * 0.5, riskGain < 0 ? riskGain : 0);

      if (currentSupport > 70) influenceGain += 5;
      if (currentSupport < 30) riskGain += 5;

      return {
        ...r,
        influence: clamp(r.influence + influenceGain),
        risk: clamp(r.risk + riskGain),
        network: Math.min(5, r.network + networkGain)
      };
    });

    // French pressure on highest-influence region
    const highest = predicted.reduce((a, b) =>
      a.influence > b.influence ? a : b
    );
    predicted = predicted.map(r => {
      if (r.name === highest.name) r = { ...r, risk: clamp(r.risk + 6) };
      if (r.risk >= 80) r = { ...r, influence: clamp(r.influence - 5) };
      return r;
    });

    // Risk escalation
    predicted = predicted.map(r => {
      if (r.risk >= 85) r = { ...r, risk: clamp(r.risk + 6) };
      else if (r.risk >= 70) r = { ...r, risk: clamp(r.risk + 4) };
      return r;
    });

    return predicted;
  }

  const predictedRegions = predictNextState(support);

  function getTrend(current, predicted, type) {
    const diff = Math.round(predicted - current);
    if (diff === 0) return <span style={{ color: "#888" }}> – 0</span>;
    const isBad =
      (type === "risk" && diff > 0) ||
      (type !== "risk" && diff < 0);
    const color = isBad ? "#c0392b" : "#27ae60";
    return (
      <span style={{ color }}>
        {diff > 0 ? ` ↑ +${diff}` : ` ↓ ${diff}`}
      </span>
    );
  }

  function planAction(index, type) {
    setRegions(prev =>
      prev.map((r, i) => i === index ? { ...r, planned: type } : r)
    );
  }

  function resolveTurn() {
    if (gameOver) return;

    // Compute new momentum/support synchronously to avoid stale state in checks
    let newMomentum = momentum;
    let newSupport = support;
    regions.forEach(r => {
      if (r.planned === "action") newMomentum = clamp(newMomentum + 5);
      if (r.planned === "cooldown") newSupport = clamp(newSupport + 3);
    });

    // Momentum slowly decays each turn to prevent runaway scores
    newMomentum = clamp(newMomentum - 2);

    const updated = predictNextState(newSupport);
    const nextTurn = turn + 1;

    setMomentum(newMomentum);
    setSupport(newSupport);
    setRegions(updated.map(r => ({ ...r, planned: null })));
    setTurn(nextTurn);

    const highRisk = updated.filter(r => r.risk >= 90).length;
    const strong = updated.filter(r => r.influence >= 60).length;

    if (highRisk >= 3 || newSupport <= 15) {
      const score = calculateScore(updated, newMomentum, newSupport, "Defeat");
      setGameOver({ result: "Defeat", score });
      return;
    }

    if (nextTurn === TOTAL_TURNS) {
      const result = (strong >= 3 && newMomentum >= 60 && newSupport >= 50)
        ? "Victory"
        : "Defeat";
      const score = calculateScore(updated, newMomentum, newSupport, result);
      setGameOver({ result, score });
    }
  }

  async function submitScore() {
    if (!playerName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.from("game_scores").insert({
      player_name: playerName.trim(),
      score: gameOver.score,
      result: gameOver.result,
      momentum,
      support
    });
    if (error) {
      setSubmitError(error.message);
    } else {
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  // ===============================
  // GAME OVER SCREEN
  // ===============================

  if (gameOver) {
    const isVictory = gameOver.result === "Victory";
    return (
      <div style={{ padding: 40, maxWidth: 560, fontFamily: "sans-serif" }}>
        <h1 style={{ color: isVictory ? "#27ae60" : "#c0392b", marginBottom: 4 }}>
          {isVictory ? "Victory" : "Defeat"}
        </h1>
        <p style={{ color: "#555", marginTop: 0 }}>
          {isVictory
            ? "The revolutionary campaign succeeded."
            : "The campaign has failed. France maintains control."}
        </p>

        <div style={styles.scoreBox}>
          <div style={{ fontSize: 28, fontWeight: "bold" }}>{gameOver.score}</div>
          <div style={{ color: "#888", fontSize: 13 }}>Final Score</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, marginBottom: 6, color: "#555" }}>Score breakdown</div>
          {regions.map(r => (
            <div key={r.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
              <span>{r.name}</span>
              <span style={{ color: "#444" }}>
                inf {r.influence}% &nbsp;|&nbsp; risk {r.risk}% &nbsp;|&nbsp; net {r.network}
                &nbsp;&nbsp;
                <strong>{Math.max(0, r.influence * 5 - r.risk * 2 + r.network * 20)}</strong>
              </span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
            <span>Momentum {momentum}% + Support {support}%</span>
            <strong>{momentum * 3 + support * 2}</strong>
          </div>
          {isVictory && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
              <span>Victory bonus</span>
              <strong>1000</strong>
            </div>
          )}
        </div>

        {!submitted ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: "600", marginBottom: 8 }}>Submit your score</div>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitScore()}
              maxLength={32}
              style={styles.input}
            />
            <button
              onClick={submitScore}
              disabled={submitting || !playerName.trim()}
              style={{
                ...styles.actionButton,
                opacity: submitting || !playerName.trim() ? 0.5 : 1
              }}
            >
              {submitting ? "Submitting..." : "Submit Score"}
            </button>
            {submitError && (
              <div style={{ color: "#c0392b", fontSize: 13, marginTop: 6 }}>
                Error: {submitError}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "#27ae60", fontWeight: "600", marginBottom: 24 }}>
            Score submitted!
          </div>
        )}

        <Scoreboard highlightScore={submitted ? gameOver.score : undefined} />

        <button
          onClick={() => window.location.reload()}
          style={{ ...styles.actionButton, marginTop: 24, background: "#444" }}
        >
          Restart Campaign
        </button>
      </div>
    );
  }

  // ===============================
  // MAIN GAME SCREEN
  // ===============================

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>{year} – Q{quarter} (Turn {turn + 1}/{TOTAL_TURNS})</h2>

      <div style={{ maxWidth: 500, marginBottom: 20 }}>
        <div>Momentum {momentum}%</div>
        <div style={styles.barWrap}>
          <div style={{ ...styles.momentumBar, width: `${momentum}%` }} />
        </div>
        <div>Public Support {support}%</div>
        <div style={styles.barWrap}>
          <div style={{ ...styles.supportBar, width: `${support}%` }} />
        </div>
      </div>

      <div style={styles.grid}>
        {regions.map((r, i) => (
          <div
            key={r.name}
            style={{
              ...styles.card,
              background: r.risk >= 90 ? "#ffe5e5" : "#f9f9f9"
            }}
          >
            <strong>{r.name}</strong>

            <div>
              Influence {r.influence}%
              {getTrend(r.influence, predictedRegions[i].influence, "influence")}
            </div>
            <div style={styles.barWrap}>
              <div style={{ ...styles.influenceBar, width: `${r.influence}%` }} />
            </div>

            <div>
              Risk {r.risk}%
              {getTrend(r.risk, predictedRegions[i].risk, "risk")}
            </div>
            <div style={styles.barWrap}>
              <div style={{ ...styles.riskBar, width: `${r.risk}%` }} />
            </div>

            <div>Network: {"●".repeat(r.network)}{"○".repeat(5 - r.network)}</div>

            <div style={{ marginTop: 8 }}>
              {["network", "propaganda", "action", "cooldown"].map(type => (
                <button
                  key={type}
                  style={{
                    ...styles.button,
                    ...(r.planned === type ? styles.plannedButton : {})
                  }}
                  onClick={() => planAction(i, type)}
                >
                  {type === "network" && "Build Network"}
                  {type === "propaganda" && "Propaganda"}
                  {type === "action" && "Organize Action"}
                  {type === "cooldown" && "Lay Low"}
                </button>
              ))}
            </div>

            {r.planned && (
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Planned: {r.planned}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <button style={styles.endButton} onClick={resolveTurn}>
          End Quarter
        </button>
      </div>
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    maxWidth: 700
  },
  card: {
    border: "1px solid #ccc",
    padding: 14,
    background: "#f9f9f9",
    transition: "background 0.3s ease"
  },
  barWrap: {
    height: 8,
    background: "#ddd",
    margin: "4px 0 8px 0"
  },
  influenceBar: { height: "100%", background: "#4a90e2", transition: "width 0.4s ease" },
  riskBar: { height: "100%", background: "#e25c4a", transition: "width 0.4s ease" },
  momentumBar: { height: "100%", background: "#3c78d8", transition: "width 0.4s ease" },
  supportBar: { height: "100%", background: "#4caf50", transition: "width 0.4s ease" },
  button: {
    padding: "6px 10px",
    margin: "4px 4px 0 0",
    borderRadius: 4,
    border: "1px solid #ccc",
    background: "white",
    cursor: "pointer",
    fontSize: 13
  },
  plannedButton: {
    background: "#dbe8ff",
    border: "1px solid #4a90e2"
  },
  endButton: {
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    background: "#222",
    color: "white",
    cursor: "pointer"
  },
  scoreBox: {
    background: "#f0f4ff",
    border: "1px solid #c0d0ff",
    borderRadius: 8,
    padding: "16px 20px",
    marginBottom: 20,
    display: "inline-block",
    minWidth: 120,
    textAlign: "center"
  },
  input: {
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 14,
    marginRight: 8,
    width: 200
  },
  actionButton: {
    padding: "8px 16px",
    borderRadius: 4,
    border: "none",
    background: "#222",
    color: "white",
    cursor: "pointer",
    fontSize: 14
  }
};
