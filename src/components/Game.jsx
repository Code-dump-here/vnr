import { useState } from "react";

const TOTAL_TURNS = 40;

const initialRegions = [
  { name: "Viet Bac", influence: 30, risk: 20, network: 1, planned: null },
  { name: "Red River Delta", influence: 20, risk: 25, network: 1, planned: null },
  { name: "Central", influence: 15, risk: 30, network: 0, planned: null },
  { name: "South", influence: 10, risk: 35, network: 0, planned: null },
  { name: "Northwest", influence: 25, risk: 20, network: 1, planned: null }
];

export default function Game() {
  const [regions, setRegions] = useState(initialRegions);
  const [turn, setTurn] = useState(0);
  const [momentum, setMomentum] = useState(30);
  const [support, setSupport] = useState(50);
  const [gameOver, setGameOver] = useState(null);

  const year = 1945 + Math.floor(turn / 4);
  const quarter = (turn % 4) + 1;
  const clamp = v => Math.max(0, Math.min(100, v));

  // ===============================
  // PREDICTION SYSTEM (NEW)
  // ===============================

  function predictNextState() {
    let predicted = regions.map(r => ({ ...r }));

    // Apply planned actions first
    predicted = predicted.map(r => {
      let influenceGain = 0;
      let riskGain = 0;
      let networkGain = 0;

      if (r.planned === "network") {
        networkGain = 1;
        riskGain = 2;
      }
      if (r.planned === "propaganda") {
        influenceGain = 8;
        riskGain = 4;
      }
      if (r.planned === "action") {
        influenceGain = 12;
        riskGain = 8;
      }
      if (r.planned === "cooldown") {
        riskGain = -10;
        influenceGain = -3;
      }

      if (support > 70) influenceGain += 5;
      if (support < 30) riskGain += 5;

      return {
        ...r,
        influence: clamp(r.influence + influenceGain),
        risk: clamp(r.risk + riskGain),
        network: Math.min(5, r.network + networkGain)
      };
    });

    // French pressure (predict highest influence after actions)
    const highest = predicted.reduce((a, b) =>
      a.influence > b.influence ? a : b
    );

    predicted = predicted.map(r => {
      if (r.name === highest.name) {
        r = { ...r, risk: clamp(r.risk + 6) };
      }
      if (r.risk >= 80) {
        r = { ...r, influence: clamp(r.influence - 5) };
      }
      return r;
    });

    // Risk escalation
    predicted = predicted.map(r => {
      if (r.risk >= 85) {
        r = { ...r, risk: clamp(r.risk + 6) };
      } else if (r.risk >= 70) {
        r = { ...r, risk: clamp(r.risk + 4) };
      }
      return r;
    });

    return predicted;
  }

  const predictedRegions = predictNextState();
function getTrend(current, predicted, type) {
  const diff = predicted - current;

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
      prev.map((r, i) =>
        i === index ? { ...r, planned: type } : r
      )
    );
  }

  function resolveTurn() {
    if (gameOver) return;

    let updated = predictNextState();

    // Apply momentum/support from actions
    regions.forEach(r => {
      if (r.planned === "action") {
        setMomentum(m => clamp(m + 5));
      }
      if (r.planned === "cooldown") {
        setSupport(s => clamp(s + 3));
      }
    });

    setRegions(updated.map(r => ({ ...r, planned: null })));
    setTurn(t => t + 1);

    const highRisk = updated.filter(r => r.risk >= 90).length;
    const strong = updated.filter(r => r.influence >= 60).length;

    if (highRisk >= 3 || support <= 15) {
      setGameOver("Defeat");
    }

    if (turn === TOTAL_TURNS - 1) {
      if (strong >= 3 && momentum >= 60 && support >= 50) {
        setGameOver("Victory");
      } else {
        setGameOver("Defeat");
      }
    }
  }

  if (gameOver) {
    return (
      <div style={{ padding: 40 }}>
        <h1>{gameOver}</h1>
        <button onClick={() => window.location.reload()}>
          Restart Campaign
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>{year} – Q{quarter} (Turn {turn + 1}/{TOTAL_TURNS})</h2>

      <div style={{ maxWidth: 500, marginBottom: 20 }}>
        <div>
          Momentum {momentum}%
        </div>
        <div style={styles.barWrap}>
          <div style={{ ...styles.momentumBar, width: `${momentum}%` }} />
        </div>

        <div>
          Public Support {support}%
        </div>
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
              <div style={{
                ...styles.influenceBar,
                width: `${r.influence}%`
              }} />
            </div>

            <div>
              Risk {r.risk}%
              {getTrend(r.risk, predictedRegions[i].risk, "risk")}
            </div>
            <div style={styles.barWrap}>
              <div style={{
                ...styles.riskBar,
                width: `${r.risk}%`
              }} />
            </div>

            <div>Network: {"●".repeat(r.network)}</div>

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
        <button
          style={{
            padding: "10px 16px",
            borderRadius: 6,
            border: "none",
            background: "#222",
            color: "white",
            cursor: "pointer"
          }}
          onClick={resolveTurn}
        >
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
  influenceBar: {
    height: "100%",
    background: "#4a90e2",
    transition: "width 0.4s ease"
  },
  riskBar: {
    height: "100%",
    background: "#e25c4a",
    transition: "width 0.4s ease"
  },
  momentumBar: {
    height: "100%",
    background: "#3c78d8",
    transition: "width 0.4s ease"
  },
  supportBar: {
    height: "100%",
    background: "#4caf50",
    transition: "width 0.4s ease"
  },
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
  }
};