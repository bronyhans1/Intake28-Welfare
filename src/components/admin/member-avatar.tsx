import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils/initials";
import { getValidImageSrc } from "@/lib/utils/image-src";
import { cn } from "@/lib/utils";

interface MemberAvatarProps {
  fullName: string;
  profilePhotoUrl?: string | null;
  className?: string;
}

export function MemberAvatar({
  fullName,
  profilePhotoUrl,
  className,
}: MemberAvatarProps) {
  const imageSrc = getValidImageSrc(profilePhotoUrl);

  return (
    <Avatar className={cn("size-9", className)}>
      {imageSrc ? (
        <AvatarImage src={imageSrc} alt={fullName} />
      ) : null}
      <AvatarFallback className="bg-[#166534]/10 text-xs font-semibold text-[#14532d]">
        {getInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );
}
