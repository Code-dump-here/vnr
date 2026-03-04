import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Scoreboard({ highlightScore }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("game_scores")
      .select("player_name, score, result, created_at")
      .order("score", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setScores(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p style={{ color: "#888" }}>Loading leaderboard...</p>;
  if (error) return <p style={{ color: "#c0392b" }}>Failed to load scores: {error}</p>;
  if (scores.length === 0) return <p style={{ color: "#888" }}>No scores yet. Be the first!</p>;

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Leaderboard</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>#</th>
            <th style={styles.th}>Player</th>
            <th style={styles.th}>Score</th>
            <th style={styles.th}>Result</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s, i) => {
            const isHighlight = highlightScore !== undefined && s.score === highlightScore;
            return (
              <tr key={i} style={isHighlight ? styles.highlight : {}}>
                <td style={styles.td}>{i + 1}</td>
                <td style={styles.td}>{s.player_name}</td>
                <td style={{ ...styles.td, fontWeight: "bold" }}>{s.score}</td>
                <td style={{ ...styles.td, color: s.result === "Victory" ? "#27ae60" : "#c0392b" }}>
                  {s.result}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14
  },
  th: {
    textAlign: "left",
    padding: "6px 10px",
    borderBottom: "2px solid #ccc",
    fontWeight: "600"
  },
  td: {
    padding: "6px 10px",
    borderBottom: "1px solid #eee"
  },
  highlight: {
    background: "#fffbcc"
  }
};
