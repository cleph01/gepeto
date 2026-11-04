import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TrackingView from "./tracking-view";
import LockedView from "./locked-view";
import { loadTrackingForRequest } from "@/lib/tracking";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  const office = await db("offices")
    .leftJoin("labs", "offices.lab_id", "labs.id")
    .where("offices.tracking_token", token)
    .select("offices.name", "labs.name as labName")
    .first();

  if (!office) return { title: "Tracking", robots: { index: false, follow: false } };

  return {
    robots: { index: false, follow: false },
    title: `${office.name} — Delivery Tracker`,
    description: `Track your deliveries from ${office.labName}`,
  };
}

export default async function TrackingPage({ params }: Props) {
  const { token } = await params;
  const data = await loadTrackingForRequest(token);
  if (!data) notFound();
  if (data.locked) return <LockedView token={token} initial={data} />;
  return <TrackingView token={token} initial={data} />;
}
