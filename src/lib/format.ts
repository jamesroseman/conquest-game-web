export function titleCase(s: string): string {
  return s
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function statusLabel(status: string): string {
  switch (status) {
    case "lobby":
      return "Lobby";
    case "placing_troops":
      return "Placing troops";
    case "seeding_disease":
      return "Seeding disease";
    case "placing_researchers":
      return "Placing researchers";
    case "placing_capitals":
      return "Placing capitals";
    case "in_progress":
      return "In progress";
    case "ended":
      return "Ended";
    default:
      return titleCase(status);
  }
}
