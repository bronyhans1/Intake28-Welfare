export function shouldShowProfileCompletionBanner(
  profileCompletionPercentage: number,
): boolean {
  return profileCompletionPercentage < 100;
}
