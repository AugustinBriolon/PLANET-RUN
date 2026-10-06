import { NextResponse } from "next/server";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

type RouteContext = { params: Promise<{ areaId: string }> };

/** Rivals, titles and hall of fame for one city, filtered by profile visibility. */
export async function GET(request: Request, context: RouteContext) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const areaId = Number((await context.params).areaId);
  if (!Number.isInteger(areaId) || areaId <= 0) {
    return NextResponse.json({ error: "invalid_area" }, { status: 400 });
  }

  const board = await getServices().conquest.getCityBoard(userOrError.id, areaId);
  if (!board) return NextResponse.json({ error: "city_not_on_profile" }, { status: 404 });
  return NextResponse.json(board);
}
