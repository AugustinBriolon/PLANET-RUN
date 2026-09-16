import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/session";

export default async function HomePage() {
  redirect((await getCurrentUser()) ? "/globe" : "/login");
}
