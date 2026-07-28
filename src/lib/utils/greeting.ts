export function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Admin";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function getTimeOfDayGreeting(firstName: string, date = new Date()): string {
  const hour = date.getHours();
  const period =
    hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  return `Good ${period}, ${firstName} 👋`;
}
