"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const data_1 = require("./data");
const app = (0, express_1.default)();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const DATA_FILE = path_1.default.join(__dirname, "..", "data.json");
// Load from data.json or seed from teams-data.ts
let teams;
if (fs_1.default.existsSync(DATA_FILE)) {
    teams = JSON.parse(fs_1.default.readFileSync(DATA_FILE, "utf-8"));
}
else {
    teams = JSON.parse(JSON.stringify(data_1.teams));
    fs_1.default.writeFileSync(DATA_FILE, JSON.stringify(teams, null, 2));
}
app.use(express_1.default.json());
app.get("/api/data", (_req, res) => {
    res.json((0, data_1.buildTreeData)(teams));
});
app.get("/api/teams", (_req, res) => {
    res.json(teams);
});
app.put("/api/teams", (req, res) => {
    teams = req.body;
    fs_1.default.writeFileSync(DATA_FILE, JSON.stringify(teams, null, 2));
    res.json({ ok: true });
});
app.use(express_1.default.static(path_1.default.join(__dirname, "..", "public")));
app.listen(PORT, () => {
    console.log(`Legal Processes Map running at http://localhost:${PORT}`);
});
