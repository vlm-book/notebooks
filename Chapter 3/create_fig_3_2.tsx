import { useState, useRef, useCallback } from "react";

const TOKENS = ["the", "a", "cat", "sun", "is", "big", "ran", "to", "red", "it"];
const CORRECT = 3;
const lowLoss = [0.04, 0.02, 0.06, 0.52, 0.04, 0.06, 0.03, 0.05, 0.12, 0.06];
const highLoss = [0.05, 0.03, 0.22, 0.04, 0.06, 0.28, 0.08, 0.05, 0.12, 0.07];
const ce = (dist, c) => -Math.log(Math.max(dist[c], 1e-9));

const SCALE = 2;

function drawChart(ctx, ox, oy, title, dist, subtitle, W, H) {
  const PAD = { top: 100, right: 20, bottom: 64, left: 46 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;
  const n = dist.length;
  const gap = 5;
  const bw = (pw - gap * (n - 1)) / n;
  const maxP = 0.55;
  const loss = ce(dist, CORRECT);
  const isLow = loss < 1;

  ctx.save();
  ctx.translate(ox, oy);

  // Title
  ctx.font = `bold ${15 * SCALE}px Inter, -apple-system, system-ui, sans-serif`;
  ctx.fillStyle = "#222";
  ctx.textAlign = "center";
  ctx.fillText(title, W / 2, 24 * SCALE);

  // Y grid + labels
  ctx.font = `${10 * SCALE}px Inter, -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "right";
  for (const t of [0, 0.1, 0.2, 0.3, 0.4, 0.5]) {
    const y = PAD.top + ph * (1 - t / maxP);
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.fillText(t === 0 ? "0" : `${(t * 100).toFixed(0)}%`, PAD.left - 8, y + 4 * SCALE);
  }

  // Baseline
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top + ph); ctx.lineTo(W - PAD.right, PAD.top + ph); ctx.stroke();

  // Bars
  for (let i = 0; i < n; i++) {
    const p = dist[i];
    const x = PAD.left + i * (bw + gap);
    const barH = (p / maxP) * ph;
    const y = PAD.top + ph - barH;
    const isC = i === CORRECT;

    const r = 4 * SCALE;
    const bx = x, by = y, bww = bw, bhh = barH;

    ctx.fillStyle = isC ? (isLow ? "#22a861" : "#d63031") : "#b0b5bc";
    ctx.globalAlpha = isC ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bww - r, by);
    ctx.quadraticCurveTo(bx + bww, by, bx + bww, by + r);
    ctx.lineTo(bx + bww, by + bhh);
    ctx.lineTo(bx, by + bhh);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Percentage on correct bar
    if (isC) {
      ctx.font = `bold ${10 * SCALE}px Inter, sans-serif`;
      ctx.fillStyle = "#333";
      ctx.textAlign = "center";
      ctx.fillText(`${(p * 100).toFixed(0)}%`, x + bw / 2, y - 14 * SCALE);
    }

    // Token label
    ctx.font = `${isC ? "bold " : ""}${10.5 * SCALE}px 'SF Mono', 'Fira Code', monospace`;
    ctx.fillStyle = isC ? "#222" : "#999";
    ctx.textAlign = "center";
    ctx.fillText(TOKENS[i], x + bw / 2, PAD.top + ph + 18 * SCALE);

    // "correct" marker
    if (isC) {
      ctx.font = `${8 * SCALE}px Inter, sans-serif`;
      ctx.fillStyle = "#777";
      ctx.letterSpacing = "1px";
      ctx.fillText("correct", x + bw / 2, PAD.top + ph + 32 * SCALE);

      // Arrow
      const ax = x + bw / 2;
      const ay1 = PAD.top + ph + 36 * SCALE;
      const ay2 = ay1 + 7 * SCALE;
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ax, ay1); ctx.lineTo(ax, ay2); ctx.stroke();
      ctx.fillStyle = "#aaa";
      ctx.beginPath();
      ctx.moveTo(ax - 4 * SCALE, ay2);
      ctx.lineTo(ax + 4 * SCALE, ay2);
      ctx.lineTo(ax, ay2 + 5 * SCALE);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Pill
  const pillW = 200 * SCALE;
  const pillH = 30 * SCALE;
  const pillX = (W - pillW) / 2;
  const pillY = H - 10 * SCALE;

  ctx.fillStyle = isLow ? "#dff5e8" : "#fce4e4";
  ctx.beginPath();
  const pr = pillH / 2;
  ctx.moveTo(pillX + pr, pillY);
  ctx.lineTo(pillX + pillW - pr, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pr);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pr, pillY + pillH);
  ctx.lineTo(pillX + pr, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pr);
  ctx.quadraticCurveTo(pillX, pillY, pillX + pr, pillY);
  ctx.closePath();
  ctx.fill();

  ctx.font = `bold ${11 * SCALE}px Inter, sans-serif`;
  ctx.fillStyle = isLow ? "#1e8449" : "#b71c1c";
  ctx.textAlign = "center";
  ctx.fillText(`${subtitle}  ·  loss = ${loss.toFixed(2)}`, W / 2, pillY + pillH / 2 + 4 * SCALE);

  ctx.restore();
}

export default function App() {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  const chartW = 320 * SCALE;
  const chartH = 280 * SCALE;
  const totalGap = 50 * SCALE;
  const padX = 30 * SCALE;
  const padTop = 50 * SCALE;
  const padBot = 30 * SCALE;
  const totalW = padX * 2 + chartW * 2 + totalGap;
  const totalH = padTop + chartH + padBot;

  const draw = useCallback((canvas) => {
    if (!canvas || rendered) return;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalW, totalH);

    // Header
    ctx.font = `${13 * SCALE}px Inter, -apple-system, system-ui, sans-serif`;
    ctx.fillStyle = "#222";
    ctx.textAlign = "center";
    ctx.fillText("Predicted probability distribution over vocabulary", totalW / 2, 22 * SCALE);

    ctx.font = `${11 * SCALE}px 'SF Mono', 'Fira Code', monospace`;
    ctx.fillStyle = "#222";
    ctx.fillText('The model predicts the next token after: "the __ rises"', totalW / 2, 38 * SCALE);

    drawChart(ctx, padX, padTop, "Low surprise", lowLoss, "Confident & correct", chartW, chartH);
    drawChart(ctx, padX + chartW + totalGap, padTop, "High surprise", highLoss, "Spread & wrong", chartW, chartH);

    setRendered(true);
  }, [rendered, totalW, totalH]);

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    const link = document.createElement("a");
    link.download = "cross-entropy-loss.png";
    link.href = c.toDataURL("image/png");
    link.click();
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#f5f5f5",
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      padding: 24, gap: 20,
    }}>
      <canvas
        ref={draw}
        width={totalW}
        height={totalH}
        style={{
          width: totalW / SCALE,
          height: totalH / SCALE,
          borderRadius: 8,
          boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
        }}
      />
      <button
        onClick={download}
        style={{
          padding: "10px 28px",
          borderRadius: 8,
          border: "none",
          background: "#222",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          letterSpacing: 0.3,
        }}
      >
        Download PNG
      </button>
    </div>
  );
}
