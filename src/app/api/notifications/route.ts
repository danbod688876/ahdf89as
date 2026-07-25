import { NextResponse } from "next/server";
import { getPendingNotifications } from "@/lib/notifications/engine";

export async function GET() {
  const notifications = await getPendingNotifications();
  return NextResponse.json(notifications);
}
