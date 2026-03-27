import express from "express";
import path from "path";
import fs from "fs";
import { buildTreeData, teams as defaultTeams } from "./data";
import type { Team } from "./data";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const DATA_FILE = path.join(__dirname, "..", "data.json");

// Load from data.json or seed from teams-data.ts
let teams: Team[];
if (fs.existsSync(DATA_FILE)) {
  teams = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
} else {
  teams = JSON.parse(JSON.stringify(defaultTeams));
  fs.writeFileSync(DATA_FILE, JSON.stringify(teams, null, 2));
}

app.use(express.json());

app.get("/api/data", (_req, res) => {
  res.json(buildTreeData(teams));
});

app.get("/api/teams", (_req, res) => {
  res.json(teams);
});

app.put("/api/teams", (req, res) => {
  teams = req.body;
  fs.writeFileSync(DATA_FILE, JSON.stringify(teams, null, 2));
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, () => {
  console.log(`Legal Processes Map running at http://localhost:${PORT}`);
});
