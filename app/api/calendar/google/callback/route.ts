import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  syncGoogleCalendarConnection,
  upsertGoogleCalendarConnection,
} from "@/lib/calendar-sync";

const OAUTH_STATE_COOKIE = "weekflow_google_calendar_state";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    const response = NextResponse.redirect(new URL("/settings", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  try {
    const connection = await upsertGoogleCalendarConnection(
      session.user.id,
      code,
      url.origin
    );
    await syncGoogleCalendarConnection(connection.id);

    const response = NextResponse.redirect(new URL("/settings", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/settings", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
