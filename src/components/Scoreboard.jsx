import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const RESULT_DISPLAY = {
  Victory: "Chiến thắng",
  Defeat:  "Thất bại",
};

export default function Scoreboard({ highlightScore }) {
  const [scores, setScores]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

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

  if (loading)
    return <p style={{ color: "#888", fontSize: 12, fontStyle: "italic" }}>Đang tải bảng xếp hạng...</p>;
  if (error)
    return <p style={{ color: "#8a1a1a", fontSize: 12 }}>Không thể tải điểm số: {error}</p>;
  if (scores.length === 0)
    return <p style={{ color: "#888", fontSize: 12, fontStyle: "italic" }}>Chưa có điểm nào. Hãy là người đầu tiên!</p>;

  return (
    <div style={{ borderTop: "1px solid #c4af7a", paddingTop: 14, marginTop: 4 }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: 16, color: "#16100a" }}>
        Bảng xếp hạng
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, fontFamily: "Georgia, serif" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #c4af7a" }}>
            <th style={th}>#</th>
            <th style={th}>Người chơi</th>
            <th style={th}>Điểm số</th>
            <th style={th}>Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s, i) => {
            const isHighlight = highlightScore !== undefined && s.score === highlightScore;
            const isVictory   = s.result === "Victory";
            return (
              <tr
                key={i}
                style={{
                  background: isHighlight ? "#fffbcc" : i % 2 === 0 ? "rgba(0,0,0,0.03)" : "transparent",
                  borderBottom: "1px solid #ddd0a0",
                }}
              >
                <td style={{ ...td, color: i < 3 ? "#8a6010" : "#888", fontWeight: i < 3 ? "bold" : "normal" }}>
                  {i === 0 ? "★" : i === 1 ? "✦" : i === 2 ? "·" : i + 1}
                </td>
                <td style={td}>{s.player_name}</td>
                <td style={{ ...td, fontWeight: "bold" }}>{s.score}</td>
                <td style={{ ...td, color: isVictory ? "#2a5a1f" : "#7a1a1a", fontStyle: "italic" }}>
                  {RESULT_DISPLAY[s.result] ?? s.result}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "6px 10px",
  fontWeight: "700",
  color: "#444",
  fontSize: 13,
};

const td = {
  padding: "6px 10px",
  color: "#16100a",
};
