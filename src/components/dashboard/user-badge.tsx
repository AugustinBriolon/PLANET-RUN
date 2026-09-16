import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type UserBadgeProps = {
  displayName: string;
  avatarUrl: string | null;
  signOutAction: () => Promise<void>;
};

function getInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function UserBadge({ displayName, avatarUrl, signOutAction }: UserBadgeProps) {
  return (
    <div className="glass-panel flex h-9 items-center gap-2 rounded-lg pr-1 pl-1.5">
      <Avatar size="sm">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
      </Avatar>
      <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{displayName}</span>
      <form action={signOutAction}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out">
                <LogOut aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </form>
    </div>
  );
}
