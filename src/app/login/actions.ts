"use server";

import { signIn } from "@/auth";

export async function signInWithStrava() {
  await signIn("strava", { redirectTo: "/globe" });
}
