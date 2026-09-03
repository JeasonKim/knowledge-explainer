export type ProjectQualityGateCommand = "validate" | "inspect" | "verify" | "render";

export function shouldApplyProjectQualityGate(command: string): command is ProjectQualityGateCommand {
  return command === "validate" || command === "inspect" || command === "verify" || command === "render";
}
