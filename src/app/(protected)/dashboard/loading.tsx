import { PageLoader } from "@/components/loading/page-loader";
import { SkeletonCard } from "@/components/loading/skeletons";

export default function MemberDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageLoader compact label="Loading…" className="min-h-0 py-4" />
      <SkeletonCard lines={3} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
