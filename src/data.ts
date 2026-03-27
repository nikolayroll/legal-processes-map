// Legal department workload data — updated from feedback-session transcripts (March 2026)
//
// timePercent     = estimated % of THIS TEAM's time spent on this task.
//                   Each team's tasks sum to 100%.
//                   Rectangle size = timePercent × teamFteWeight (preserves team proportions).
//
// teamFteWeight   = rough team size (FTE-based). Sum = 100 across teams.
//                   Drives each team's box size relative to other teams.
//
// requestsPerYear = raw request/ticket count — only set where a real source exists.
//                   Tooltip shows source; where missing, says "no estimate".
//
// repetitiveness  = 0–100 how templated/automatable the task is (drives color in tab 1)
// automationStatus: live | testing | planned | manual (drives color in tab 2)

export type AutomationStatus = "live" | "testing" | "planned" | "manual";

export interface Task {
  name: string;
  description: string;
  timePercent: number;          // % of THIS TEAM's time — drives rectangle SIZE (scaled by teamFteWeight)
  requestsPerYear?: number;     // only set where a real source exists
  requestsSource?: string;      // short provenance note for requestsPerYear
  repetitiveness: number;       // 0–100 standardization potential
  automationStatus: AutomationStatus;
  note?: string;                // interview context
}

export interface Team {
  name: string;
  lead: string;
  teamFteWeight: number;   // rough FTE-based team size; sum = 100 across teams
  tasks: Task[];
}

export interface TreeNode {
  name: string;
  isGroupRow?: boolean;
  children?: TreeNode[];
  value?: number;               // = teamFteWeight × (timePercent / 100), drives rectangle SIZE
  timePercent?: number;         // within-team %, for tooltip display
  requestsPerYear?: number;
  requestsSource?: string;
  repetitiveness?: number;
  automationStatus?: AutomationStatus;
  description?: string;
  note?: string;
  lead?: string;
}

export { teams } from "./teams-data";

// ─── Tree builder ───────────────────────────────────────────────────────────

export function buildTreeData(teams: Team[]): TreeNode {
  const primaryTeams   = teams.slice(0, 2);  // Legal Ops, Regional Legal
  const secondaryTeams = teams.slice(2);     // Privacy, Central, Corporate

  const toTeamNode = (team: Team): TreeNode => ({
    name: team.name,
    lead: team.lead,
    children: team.tasks.map(task => ({
      name:             task.name,
      description:      task.description,
      value:            team.teamFteWeight * (task.timePercent / 100),  // ← drives rectangle SIZE
      timePercent:      task.timePercent,   // ← within-team %, for tooltip
      requestsPerYear:  task.requestsPerYear,
      requestsSource:   task.requestsSource,
      repetitiveness:   task.repetitiveness,
      automationStatus: task.automationStatus,
      note:             task.note,
    })),
  });

  return {
    name: "Legal Department",
    children: [
      { name: "_primary",   isGroupRow: true, children: primaryTeams.map(toTeamNode)   },
      { name: "_secondary", isGroupRow: true, children: secondaryTeams.map(toTeamNode) },
    ],
  };
}
