import * as d3 from "d3";
import type { AutomationStatus, TreeNode } from "../data";

// ─── Types ─────────────────────────────────────────────────────────────────
export type Mode = "standardization" | "status";
type HierNode = d3.HierarchyRectangularNode<TreeNode>;

// ─── Layout ────────────────────────────────────────────────────────────────
const W = 1280;
const H = 820;
const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };
const innerW = W - MARGIN.left - MARGIN.right;
const innerH = H - MARGIN.top - MARGIN.bottom;

// ─── Color ─────────────────────────────────────────────────────────────────
const gradientScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 100]);

const STATUS_FILL: Record<AutomationStatus, string> = {
  live:    "#16a34a",
  testing: "#2563eb",
  planned: "#9333ea",
  manual:  "#94a3b8",
};

function getCellFill(d: HierNode, mode: Mode): string {
  switch (mode) {
    case "standardization": return gradientScale(d.data.repetitiveness ?? 50);
    case "status":          return STATUS_FILL[d.data.automationStatus ?? "manual"];
  }
}

// All text is always black regardless of cell color
const TEXT_PRIMARY = "#0f172a";
const TEXT_SECONDARY = "#334155";

// ─── Legend config ─────────────────────────────────────────────────────────
const MODE_META: Record<Mode, {
  gradientLeft?: string;
  gradientRight?: string;
  items?: { label: string; color: string }[];
}> = {
  standardization: { gradientLeft: "Requires judgment", gradientRight: "Fully automatable" },
  status: {
    items: [
      { label: "Live",    color: STATUS_FILL.live    },
      { label: "Testing", color: STATUS_FILL.testing },
      { label: "Planned", color: STATUS_FILL.planned },
      { label: "Manual",  color: STATUS_FILL.manual  },
    ],
  },
};

// ─── Tooltip ───────────────────────────────────────────────────────────────
const tooltip = d3.select("body").append("div")
  .style("position", "absolute")
  .style("display", "none")
  .style("background", "rgba(15,23,42,0.95)")
  .style("color", "#f1f5f9")
  .style("padding", "12px 16px")
  .style("border-radius", "10px")
  .style("font-size", "13px")
  .style("line-height", "1.65")
  .style("pointer-events", "none")
  .style("max-width", "320px")
  .style("box-shadow", "0 4px 24px rgba(0,0,0,0.45)");

// ─── SVG ───────────────────────────────────────────────────────────────────
const svg = d3.select<SVGSVGElement, unknown>("#chart")
  .attr("viewBox", `0 0 ${W} ${H}`)
  .attr("width", "100%")
  .attr("height", "100%");

const chartArea = svg.append("g")
  .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

// ── Gradient defs ──────────────────────────────────────────────────────────
const defs = svg.append("defs");
const gradId = "lg";
const lg = defs.append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("x2", "100%");
lg.append("stop").attr("offset", "0%").attr("stop-color",   gradientScale(0));
lg.append("stop").attr("offset", "50%").attr("stop-color",  gradientScale(50));
lg.append("stop").attr("offset", "100%").attr("stop-color", gradientScale(100));

// ── Legend (re-rendered on mode switch) ────────────────────────────────────
const legendG = svg.append("g");

function renderLegend(mode: Mode) {
  legendG.selectAll("*").remove();
  const meta = MODE_META[mode];
  const lw = 200;
  const lx = W - MARGIN.right - lw;
  const ly = 8;

  if (meta.gradientLeft) {
    legendG.append("rect")
      .attr("x", lx).attr("y", ly).attr("width", lw).attr("height", 10).attr("rx", 3)
      .style("fill", `url(#${gradId})`);
    legendG.append("text").attr("x", lx).attr("y", ly + 22)
      .attr("font-size", "10px").attr("fill", "#64748b").text(meta.gradientLeft);
    legendG.append("text").attr("x", lx + lw).attr("y", ly + 22)
      .attr("font-size", "10px").attr("fill", "#64748b").attr("text-anchor", "end").text(meta.gradientRight!);
  } else if (meta.items) {
    meta.items.forEach((item, i) => {
      const ix = lx - 10 + i * 55;
      legendG.append("rect")
        .attr("x", ix).attr("y", ly).attr("width", 13).attr("height", 13).attr("rx", 3)
        .attr("fill", item.color);
      legendG.append("text").attr("x", ix + 17).attr("y", ly + 10)
        .attr("font-size", "11px").attr("fill", "#475569").text(item.label);
    });
  }
}

// ─── Mutable selections ────────────────────────────────────────────────────
let cellFillRects: d3.Selection<SVGRectElement, HierNode, SVGGElement, unknown>;
let nameTexts:     d3.Selection<SVGTextElement, HierNode, SVGGElement, unknown>;
let volTexts:      d3.Selection<SVGTextElement, HierNode, SVGGElement, unknown>;
let descTexts:     d3.Selection<SVGTextElement, HierNode, SVGGElement, unknown>;
let currentMode: Mode = "standardization";

// ─── Main render ───────────────────────────────────────────────────────────
async function render() {
  chartArea.selectAll("*").remove();
  const raw: TreeNode = await d3.json("/api/data");

  const root = d3.hierarchy<TreeNode>(raw)
    .sum((d) => d.value ?? 0);
  // Don't sort — preserve the data order (primary row first, teams already ordered by volume)

  d3.treemap<TreeNode>()
    .size([innerW, innerH])
    .tile((node, x0, y0, x1, y1) => {
      if (node.depth === 0) {
        // Fixed 75 / 25 row split — top for big teams, bottom for smaller ones
        const gap = 10;
        const outerPad = 4;
        const ax0 = x0 + outerPad, ay0 = y0 + outerPad;
        const ax1 = x1 - outerPad, ay1 = y1 - outerPad;
        const split = ay0 + (ay1 - ay0 - gap) * 0.75;
        const kids = node.children!;
        kids[0].x0 = ax0; kids[0].y0 = ay0; kids[0].x1 = ax1; kids[0].y1 = split;
        kids[1].x0 = ax0; kids[1].y0 = split + gap; kids[1].x1 = ax1; kids[1].y1 = ay1;
      } else if (node.depth === 1) {
        // Within each row: teams as vertical columns
        d3.treemapDice(node, x0, y0, x1, y1);
      } else {
        // Within each team: squarify tasks
        d3.treemapSquarify(node, x0, y0, x1, y1);
      }
    })
    .paddingTop((d) => d.depth === 2 ? 22 : 0)
    .paddingInner((d) => d.depth === 1 ? 6 : 2)
    .round(true)(root);

  // depth 1 = row group (_primary / _secondary) — invisible layout nodes
  // depth 2 = teams (Legal Ops, Regional Legal, …)
  // depth 3 = tasks (leaves)
  const allTeams = (root.children ?? []).flatMap((g) => g.children ?? []) as HierNode[];
  const leaves   = root.leaves() as HierNode[];

  // ── Team outlines & headers (depth 2) ─────────────────────────────────
  const teamGs = chartArea.selectAll<SVGGElement, HierNode>("g.team")
    .data(allTeams).join("g").attr("class", "team");

  teamGs.append("rect")
    .attr("x", d => d.x0).attr("y", d => d.y0)
    .attr("width",  d => d.x1 - d.x0)
    .attr("height", d => d.y1 - d.y0)
    .attr("rx", 6).attr("fill", "none")
    .attr("stroke", "#334155").attr("stroke-width", 1.5);

  teamGs.append("text")
    .attr("x", d => d.x0 + 8).attr("y", d => d.y0 + 15)
    .attr("font-size", "12px").attr("font-weight", "700").attr("fill", "#0f172a")
    .text(d => `${d.data.name}  ·  ${d.data.lead ?? ""}`);

  // ── Task cells (depth 3) ───────────────────────────────────────────────
  const cells = chartArea.selectAll<SVGGElement, HierNode>("g.cell")
    .data(leaves).join("g").attr("class", "cell").style("cursor", "pointer");

  // Fill rect — color changes with mode
  cellFillRects = cells.append<SVGRectElement>("rect")
    .attr("x",      d => d.x0 + 1)
    .attr("y",      d => d.y0 + 1)
    .attr("width",  d => Math.max(0, d.x1 - d.x0 - 2))
    .attr("height", d => Math.max(0, d.y1 - d.y0 - 2))
    .attr("rx", 4)
    .attr("fill", d => getCellFill(d, currentMode));

  // Hover
  cells
    .on("mousemove", (event, d) => {
      const status = d.data.automationStatus ?? "manual";
      const statusDotColor: Record<AutomationStatus, string> = {
        live: "#4ade80", testing: "#60a5fa", planned: "#c084fc", manual: "#94a3b8"
      };
      const statusLabel: Record<AutomationStatus, string> = {
        live: "✓ Live", testing: "~ Testing", planned: "◎ Planned", manual: "— Manual"
      };

      // Volume line — honest about what we actually know
      let volLine: string;
      if (d.data.requestsPerYear) {
        const src = d.data.requestsSource ?? "estimate";
        volLine = `<strong>${d.data.requestsPerYear.toLocaleString()}</strong> req/yr — <em>${src}</em>`;
      } else {
        volLine = `<em style="color:#f87171">No volume estimate — not tracked in Jira</em>`;
      }

      tooltip
        .style("display", "block")
        .style("left", `${event.pageX + 14}px`)
        .style("top",  `${event.pageY - 28}px`)
        .html(
          `<strong style="font-size:14px">${d.data.name}</strong>` +
          (d.data.description
            ? `<div style="font-style:italic;color:#94a3b8;font-size:12px;margin:3px 0 7px">${d.data.description}</div>`
            : `<br/>`) +
          `<span style="color:#64748b">Team:</span> ${d.parent?.data.name}<br/>` +
          `<span style="color:#64748b">Time share:</span> <strong>~${d.data.timePercent?.toFixed(0)}%</strong> of ${d.parent?.data.name ?? "team"} time<br/>` +
          `<span style="color:#64748b">Volume:</span> ${volLine}<br/>` +
          `<span style="color:#64748b">Standardization:</span> <strong>${d.data.repetitiveness}%</strong><br/>` +
          `<span style="color:${statusDotColor[status]}">● ${statusLabel[status]}</span>` +
          (d.data.note
            ? `<div style="color:#64748b;font-size:11px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.12)">${d.data.note}</div>`
            : "")
        );
    })
    .on("mouseleave", () => tooltip.style("display", "none"));

  // ── Text labels (always black) ──────────────────────────────────────────
  nameTexts = cells.append<SVGTextElement>("text")
    .attr("x", d => d.x0 + 6)
    .attr("y", d => d.y0 + 14)
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .attr("fill", TEXT_PRIMARY)
    .attr("pointer-events", "none")
    .text(d => {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 40 || h < 16) return "";
      const lbl = d.data.name ?? "";
      if (w < 90  && lbl.length > 11) return lbl.slice(0, 10) + "…";
      if (w < 150 && lbl.length > 18) return lbl.slice(0, 17) + "…";
      return lbl;
    });

  volTexts = cells.append<SVGTextElement>("text")
    .attr("x", d => d.x0 + 6)
    .attr("y", d => d.y0 + 26)
    .attr("font-size", "10px")
    .attr("fill", TEXT_SECONDARY)
    .attr("pointer-events", "none")
    .text(d => {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 50 || h < 30) return "";
      return `~${d.data.timePercent?.toFixed(0)}% of team time`;
    });

  // Description — 3rd line, shown only when there's sufficient space
  descTexts = cells.append<SVGTextElement>("text")
    .attr("x", d => d.x0 + 6)
    .attr("y", d => d.y0 + 38)
    .attr("font-size", "9.5px")
    .attr("font-style", "italic")
    .attr("fill", TEXT_SECONDARY)
    .attr("pointer-events", "none")
    .text(d => {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 130 || h < 46) return "";
      const desc = d.data.description ?? "";
      const maxChars = Math.floor(w / 5.5);  // ~5.5px per char at 9.5px size
      return desc.length > maxChars ? desc.slice(0, maxChars - 1) + "…" : desc;
    });

  renderLegend(currentMode);
}

// ─── Mode switch ───────────────────────────────────────────────────────────
export function setMode(mode: Mode) {
  if (mode === currentMode) return;
  currentMode = mode;

  const t = d3.transition().duration(380).ease(d3.easeCubicOut);
  cellFillRects.transition(t).attr("fill", d => getCellFill(d, mode));
  // text stays black — no color transition needed

  renderLegend(mode);
}

(window as any).setMode   = setMode;
(window as any).render    = render;

render();
