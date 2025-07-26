import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
  const scopes = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  return NextResponse.json({ authUrl });
}

export async function POST(request: NextRequest) {
  // Clear the authentication cookies
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set("access_token", "", { maxAge: 0 });
  response.cookies.set("refresh_token", "", { maxAge: 0 });
  return response;
}
