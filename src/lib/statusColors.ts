import { RiskLevel, SimulationStatus } from "./types";
import { tone } from "./theme";

export const riskTone: Record<RiskLevel, string> = {
  low: tone.success,
  medium: tone.warning,
  high: tone.orange,
  critical: tone.danger,
};

export const riskLabel: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const statusTone: Record<SimulationStatus, string> = {
  healthy: tone.success,
  degraded: tone.warning,
  partitioned: tone.danger,
};

export const statusLabel: Record<SimulationStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  partitioned: "Partitioned",
};
