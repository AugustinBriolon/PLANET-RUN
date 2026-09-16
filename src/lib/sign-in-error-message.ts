// Auth.js redirects to the sign-in page with an `error` code when OAuth fails.
const MESSAGES: Record<string, string> = {
  AccessDenied: "Strava access was declined. Planet Run needs read access to your activities.",
  Configuration: "Something went wrong while signing in with Strava. Please try again.",
};

const FALLBACK_MESSAGE = "We couldn't connect to Strava. Please try again.";

export function getSignInErrorMessage(errorCode: string | string[] | undefined): string | null {
  if (!errorCode) return null;
  const code = Array.isArray(errorCode) ? errorCode[0] : errorCode;
  return (code && MESSAGES[code]) ?? FALLBACK_MESSAGE;
}
