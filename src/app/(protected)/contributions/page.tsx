import {
  createPageMetadata,
  PagePlaceholder,
} from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata("Contributions");

export default function ContributionsPage() {
  return (
    <PagePlaceholder
      title="Contributions"
      description="Monthly dues, special, emergency, and funeral contributions."
      route="/contributions"
      access="Protected — Member, Admin"
    />
  );
}
