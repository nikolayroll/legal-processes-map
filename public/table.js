"use strict";
(() => {
  // src/client/table.ts
  var state = [];
  var initialized = false;
  var dragSrc = null;
  var STATUS_OPTIONS = ["live", "testing", "planned", "manual"];
  var STATUS_COLORS = {
    live: "#16a34a",
    testing: "#2563eb",
    planned: "#9333ea",
    manual: "#64748b"
  };
  async function initTable() {
    if (!initialized) {
      const raw = await fetch("/api/teams").then((r) => r.json());
      state = JSON.parse(JSON.stringify(raw));
      initialized = true;
      injectStyles();
    }
    renderTable();
  }
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function numInput(val, ti, taski, key, opts = "") {
    return `<input type="number" value="${val ?? ""}" data-ti="${ti}" data-taski="${taski}" data-key="${key}" ${opts} />`;
  }
  function textInput(val, ti, taski, key, placeholder = "") {
    return `<input type="text" value="${esc(val ?? "")}" placeholder="${esc(placeholder)}" data-ti="${ti}" data-taski="${taski}" data-key="${key}" />`;
  }
  function statusSelect(val, ti, taski) {
    const opts = STATUS_OPTIONS.map(
      (s) => `<option value="${s}"${s === val ? " selected" : ""}>${s}</option>`
    ).join("");
    return `<select data-ti="${ti}" data-taski="${taski}" data-key="automationStatus"
    style="color:${STATUS_COLORS[val]}">${opts}</select>`;
  }
  function renderTable() {
    const container = document.getElementById("table-container");
    let html = `
    <div class="tbl-toolbar">
      <span class="tbl-hint">Edit cells, then click Save to persist to <code>data.json</code> and refresh the map.</span>
      <div class="tbl-btns">
        <button class="tbl-btn tbl-btn-secondary" onclick="window.tableAddTeam()">+ Add team</button>
        <button class="tbl-btn tbl-btn-primary" id="tbl-save-btn" onclick="window.tableSave()">\u2191 Save</button>
      </div>
    </div>
    <div class="tbl-scroll">
    <table class="tbl">
      <thead>
        <tr>
          <th class="col-drag"></th>
          <th class="col-name">Task</th>
          <th class="col-desc">Description</th>
          <th class="col-num" title="% of this team's time">Time&nbsp;%</th>
          <th class="col-num" title="Standardization / automation potential 0\u2013100">Std&nbsp;%</th>
          <th class="col-status">Status</th>
          <th class="col-num">Req/yr</th>
          <th class="col-src">Source</th>
          <th class="col-note">Note</th>
          <th class="col-del"></th>
        </tr>
      </thead>
      <tbody>
  `;
    state.forEach((team, ti) => {
      html += `
      <tr class="tbl-team-row" data-ti="${ti}">
        <td colspan="6" class="tbl-team-info">
          <input class="tbl-team-name" type="text" value="${esc(team.name)}"
            data-ti="${ti}" data-field="name" placeholder="Team name" />
          <span class="tbl-sep">\xB7</span>
          <input class="tbl-team-lead" type="text" value="${esc(team.lead)}"
            data-ti="${ti}" data-field="lead" placeholder="Lead" />
          <span class="tbl-sep">\xB7</span>
          <span class="tbl-fte-label">FTE</span>
          <input class="tbl-team-fte" type="number" min="1" value="${team.teamFteWeight}"
            data-ti="${ti}" data-field="teamFteWeight" />
        </td>
        <td colspan="3"></td>
        <td class="tbl-team-actions">
          <button class="tbl-add-task-btn" onclick="window.tableAddTask(${ti})">+ task</button>
          <button class="tbl-del-btn" onclick="window.tableDeleteTeam(${ti})" title="Delete team">\u2715</button>
        </td>
      </tr>
    `;
      team.tasks.forEach((task, taski) => {
        html += `
        <tr class="tbl-task-row" data-ti="${ti}" data-taski="${taski}">
          <td class="col-drag" draggable="true" data-ti="${ti}" data-taski="${taski}"><span class="drag-handle">\u283F</span></td>
          <td>${textInput(task.name, ti, taski, "name")}</td>
          <td>${textInput(task.description, ti, taski, "description")}</td>
          <td>${numInput(task.timePercent, ti, taski, "timePercent", "min=0 max=100")}</td>
          <td>${numInput(task.repetitiveness, ti, taski, "repetitiveness", "min=0 max=100")}</td>
          <td>${statusSelect(task.automationStatus, ti, taski)}</td>
          <td>${numInput(task.requestsPerYear, ti, taski, "requestsPerYear", "min=0")}</td>
          <td>${textInput(task.requestsSource, ti, taski, "requestsSource")}</td>
          <td>${textInput(task.note, ti, taski, "note")}</td>
          <td><button class="tbl-del-btn" onclick="window.tableDeleteTask(${ti}, ${taski})" title="Delete task">\u2715</button></td>
        </tr>
      `;
      });
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    attachListeners(container);
  }
  function attachListeners(container) {
    container.querySelectorAll(
      "input[data-key], select[data-key]"
    ).forEach((el) => {
      el.addEventListener("change", handleTaskChange);
    });
    container.querySelectorAll("select[data-key='automationStatus']").forEach((sel) => {
      sel.addEventListener("input", () => {
        sel.style.color = STATUS_COLORS[sel.value] ?? STATUS_COLORS.manual;
      });
    });
    container.querySelectorAll("input[data-field]").forEach((el) => {
      el.addEventListener("change", handleTeamChange);
    });
    container.querySelectorAll("td.col-drag[draggable]").forEach((handle) => {
      handle.addEventListener("dragstart", (e) => {
        dragSrc = { ti: parseInt(handle.dataset.ti), taski: parseInt(handle.dataset.taski) };
        e.dataTransfer.effectAllowed = "move";
        handle.closest("tr").classList.add("tbl-dragging");
      });
      handle.addEventListener("dragend", () => {
        dragSrc = null;
        container.querySelectorAll(".tbl-dragging, .tbl-drag-over").forEach((el) => {
          el.classList.remove("tbl-dragging", "tbl-drag-over");
        });
      });
    });
    container.querySelectorAll("tr.tbl-task-row").forEach((row) => {
      row.addEventListener("dragover", (e) => {
        if (!dragSrc) return;
        const ti = parseInt(row.dataset.ti);
        const taski = parseInt(row.dataset.taski);
        if (dragSrc.ti !== ti || dragSrc.taski === taski) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        container.querySelectorAll(".tbl-drag-over").forEach((el) => el.classList.remove("tbl-drag-over"));
        row.classList.add("tbl-drag-over");
      });
      row.addEventListener("dragleave", () => row.classList.remove("tbl-drag-over"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("tbl-drag-over");
        if (!dragSrc) return;
        const ti = parseInt(row.dataset.ti);
        const taski = parseInt(row.dataset.taski);
        if (dragSrc.ti !== ti || dragSrc.taski === taski) return;
        const tasks = state[ti].tasks;
        const [moved] = tasks.splice(dragSrc.taski, 1);
        tasks.splice(taski, 0, moved);
        renderTable();
      });
    });
  }
  function handleTaskChange(e) {
    const el = e.target;
    const ti = parseInt(el.dataset.ti);
    const taski = parseInt(el.dataset.taski);
    const key = el.dataset.key;
    const task = state[ti]?.tasks[taski];
    if (!task) return;
    const v = el.value;
    if (key === "timePercent" || key === "repetitiveness") {
      task[key] = parseFloat(v) || 0;
    } else if (key === "requestsPerYear") {
      task[key] = v === "" ? void 0 : parseInt(v);
    } else if (key === "requestsSource" || key === "note") {
      task[key] = v === "" ? void 0 : v;
    } else {
      task[key] = v;
    }
  }
  function handleTeamChange(e) {
    const el = e.target;
    const ti = parseInt(el.dataset.ti);
    const field = el.dataset.field;
    const team = state[ti];
    if (!team) return;
    team[field] = field === "teamFteWeight" ? parseFloat(el.value) || 0 : el.value;
  }
  function tableAddTask(ti) {
    state[ti].tasks.push({
      name: "New task",
      description: "",
      timePercent: 0,
      repetitiveness: 50,
      automationStatus: "manual"
    });
    renderTable();
  }
  function tableAddTeam() {
    state.push({
      name: "New Team",
      lead: "",
      teamFteWeight: 5,
      tasks: []
    });
    renderTable();
  }
  function tableDeleteTask(ti, taski) {
    state[ti].tasks.splice(taski, 1);
    renderTable();
  }
  function tableDeleteTeam(ti) {
    if (!confirm(`Delete team "${state[ti].name}" and all ${state[ti].tasks.length} tasks?`)) return;
    state.splice(ti, 1);
    renderTable();
  }
  async function tableSave() {
    const btn = document.getElementById("tbl-save-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving\u2026";
    }
    try {
      const res = await fetch("/api/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      if (window.render) await window.render();
    } catch (err) {
      alert(`Save failed: ${err}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "\u2191 Save";
      }
    }
  }
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
    #table-container {
      width: 100%;
    }

    .tbl-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 4px 12px;
      gap: 12px;
      flex-wrap: wrap;
    }

    .tbl-hint {
      font-size: 12px;
      color: #94a3b8;
    }

    .tbl-hint code {
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 11px;
      color: #475569;
    }

    .tbl-btns { display: flex; gap: 8px; }

    .tbl-btn {
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1.5px solid transparent;
      transition: opacity 0.15s;
    }
    .tbl-btn:hover { opacity: 0.85; }
    .tbl-btn-primary  { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    .tbl-btn-secondary { background: #fff; color: #475569; border-color: #e2e8f0; }

    .tbl-scroll {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }

    .tbl {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }

    .tbl thead tr {
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
    }

    .tbl th {
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      color: #64748b;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .tbl td {
      padding: 3px 4px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }

    .tbl input, .tbl select {
      width: 100%;
      border: none;
      background: transparent;
      font: inherit;
      color: inherit;
      padding: 4px 6px;
      border-radius: 4px;
      outline: none;
    }
    .tbl input:focus, .tbl select:focus {
      background: #eff6ff;
      box-shadow: 0 0 0 1.5px #93c5fd;
    }

    .tbl input[type="number"] { -moz-appearance: textfield; text-align: right; }
    .tbl input[type="number"]::-webkit-inner-spin-button { display: none; }

    /* Column widths */
    .col-drag   { width: 14px; min-width: 14px; padding: 0 2px !important; text-align: center; cursor: grab; }
    .col-drag:active { cursor: grabbing; }
    .drag-handle { font-size: 11px; color: #cbd5e1; user-select: none; display: block; line-height: 1; }
    .tbl-task-row:hover .drag-handle { color: #94a3b8; }
    .tbl-dragging { opacity: 0.4; }
    .tbl-drag-over td { background: #eff6ff !important; border-top: 2px solid #3b82f6; }
    .col-name   { width: 150px; min-width: 120px; }
    .col-desc   { min-width: 200px; }
    .col-num    { width: 64px;  min-width: 50px; }
    .col-status { width: 100px; min-width: 90px; }
    .col-src    { width: 160px; min-width: 100px; }
    .col-note   { min-width: 160px; }
    .col-del    { width: 32px; }

    /* Team header row */
    .tbl-team-row {
      background: #1e293b;
    }
    .tbl-team-row td {
      border-bottom: 1px solid #334155;
      padding: 6px 8px;
    }
    .tbl-team-info {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tbl-team-info input {
      color: #f1f5f9 !important;
      font-weight: 600;
    }
    .tbl-team-info input:focus {
      background: rgba(255,255,255,0.1) !important;
      box-shadow: 0 0 0 1.5px #60a5fa !important;
    }
    .tbl-team-name { font-size: 13px; min-width: 120px; }
    .tbl-team-lead { min-width: 100px; font-weight: 400; color: #94a3b8 !important; font-size: 12px; }
    .tbl-team-fte  { width: 48px; font-weight: 400; color: #94a3b8 !important; font-size: 12px; text-align: right; }
    .tbl-sep       { color: #475569; }
    .tbl-fte-label { font-size: 11px; color: #64748b; white-space: nowrap; }

    .tbl-team-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: flex-end;
    }

    .tbl-add-task-btn {
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      background: transparent;
      color: #60a5fa;
      border: 1px solid #334155;
      transition: background 0.12s;
    }
    .tbl-add-task-btn:hover { background: rgba(96,165,250,0.12); }

    .tbl-del-btn {
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #94a3b8;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.12s, color 0.12s;
    }
    .tbl-del-btn:hover { background: #fee2e2; color: #ef4444; }

    .tbl-task-row:hover td { background: #f8fafc; }

    .tbl select {
      cursor: pointer;
      font-weight: 600;
    }
  `;
    document.head.appendChild(style);
  }
  window.initTable = initTable;
  window.tableSave = tableSave;
  window.tableAddTask = tableAddTask;
  window.tableAddTeam = tableAddTeam;
  window.tableDeleteTask = tableDeleteTask;
  window.tableDeleteTeam = tableDeleteTeam;
})();
