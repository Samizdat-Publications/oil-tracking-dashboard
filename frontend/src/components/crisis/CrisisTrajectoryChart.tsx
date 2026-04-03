import { useEffect, useRef } from 'react';
import type { CrisisTrajectoryPoint } from '../../types';

interface Props {
  /** Historical crisis trajectory */
  historicalTrajectory: CrisisTrajectoryPoint[];
  historicalName: string;
  historicalColor: string;
  /** Current (2026) crisis trajectory */
  currentTrajectory: CrisisTrajectoryPoint[];
}

/**
 * Small dual-line chart comparing a historical crisis trajectory
 * against the current 2026 Iran War, both normalized to % change from Day 0.
 *
 * Uses canvas for lightweight rendering (no Plotly overhead).
 */
export function CrisisTrajectoryChart({
  historicalTrajectory,
  historicalName,
  historicalColor,
  currentTrajectory,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 20, right: 16, bottom: 28, left: 48 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Find data bounds
    const allPoints = [...historicalTrajectory, ...currentTrajectory];
    if (allPoints.length === 0) return;

    const maxDay = Math.max(...allPoints.map((p) => p.day), 1);
    const allPcts = allPoints.map((p) => p.pct_change);
    const minPct = Math.min(...allPcts, 0);
    const maxPct = Math.max(...allPcts, 10);
    const pctRange = maxPct - minPct || 1;

    const xScale = (day: number) => pad.left + (day / maxDay) * plotW;
    const yScale = (pct: number) => pad.top + plotH - ((pct - minPct) / pctRange) * plotH;

    // Grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 0.5;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = pad.top + (plotH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Zero line
    const zeroY = yScale(0);
    ctx.strokeStyle = 'rgba(232, 232, 232, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(W - pad.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw line helper
    function drawLine(points: CrisisTrajectoryPoint[], color: string, lineWidth: number, dashed = false) {
      if (points.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (dashed) ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = xScale(points[i].day);
        const y = yScale(points[i].pct_change);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (dashed) ctx.setLineDash([]);
    }

    // Historical line (dashed)
    drawLine(historicalTrajectory, historicalColor, 2, true);

    // Current line (solid, thicker)
    drawLine(currentTrajectory, '#00F0FF', 2.5);

    // Y-axis labels
    ctx.fillStyle = '#8A8F98';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridSteps; i++) {
      const pct = maxPct - (pctRange / gridSteps) * i;
      const y = pad.top + (plotH / gridSteps) * i;
      ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, pad.left - 6, y + 3);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8A8F98';
    const dayLabels = [0, Math.round(maxDay * 0.25), Math.round(maxDay * 0.5), Math.round(maxDay * 0.75), maxDay];
    for (const d of dayLabels) {
      ctx.fillText(`${d}d`, xScale(d), H - pad.bottom + 16);
    }

    // Legend
    ctx.font = '10px "IBM Plex Mono", monospace';
    const legendY = 12;

    // Historical legend
    ctx.strokeStyle = historicalColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, legendY);
    ctx.lineTo(pad.left + 20, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = historicalColor;
    ctx.textAlign = 'left';
    ctx.fillText(historicalName, pad.left + 24, legendY + 3);

    // Current legend
    const currentLegendX = pad.left + 24 + ctx.measureText(historicalName).width + 20;
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(currentLegendX, legendY);
    ctx.lineTo(currentLegendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = '#00F0FF';
    ctx.fillText('2026 Iran War', currentLegendX + 24, legendY + 3);
  }, [historicalTrajectory, historicalName, historicalColor, currentTrajectory]);

  const hasData = historicalTrajectory.length >= 2 || currentTrajectory.length >= 2;

  if (!hasData) {
    return (
      <div className="h-40 flex items-center justify-center text-text-secondary text-xs font-[family-name:var(--font-mono)]">
        Trajectory data unavailable
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 160 }}
    />
  );
}
