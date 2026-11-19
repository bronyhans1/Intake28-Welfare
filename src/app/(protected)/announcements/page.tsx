import {
  createPageMetadata,
  PagePlaceholder,
} from "@/components/shared/page-placeholder";

export const metadata = createPageMetadata("Announcements");

export default function AnnouncementsPage() {
  return (
    <PagePlaceholder
      title="Announcements"
      description="Portal announcements and notices."
      route="/announcements"
      access="Protected — All roles"
    />
  );
}
