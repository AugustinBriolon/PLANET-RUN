import { NextResponse } from "next/server";

import {
  CityNotOnProfileError,
  InviteExpiredError,
  InviteNotFoundError,
  InviteOwnError,
} from "@/server/services/conquest-service";

export function inviteErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof InviteNotFoundError) {
    return NextResponse.json({ error: "invite_not_found" }, { status: 404 });
  }
  if (error instanceof InviteExpiredError) {
    return NextResponse.json({ error: "invite_expired" }, { status: 410 });
  }
  if (error instanceof InviteOwnError) {
    return NextResponse.json({ error: "own_invite" }, { status: 409 });
  }
  if (error instanceof CityNotOnProfileError) {
    return NextResponse.json({ error: "city_not_on_profile" }, { status: 404 });
  }
  return null;
}
