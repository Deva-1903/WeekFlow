import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  buildGoogleCalendarConnectUrl,
  isGoogleCalendarConfigured,
} from "@/lib/calendar-sync";

const OAUTH_STATE_COOKIE = "weekflow_google_calendar_state";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  const state = randomUUID();
  const redirectUrl = buildGoogleCalendarConnectUrl(new URL(request.url).origin, state);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
