import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TrackingView from "./tracking-view";
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

  if (!office) return { title: "Tracking" };

  return {
    title: `${office.name} — Delivery Tracker`,
    description: `Track your deliveries from ${office.labName}`,
  };
}

export default async function TrackingPage({ params }: Props) {
  const { token } = await params;

  const office = await db("offices")
    .leftJoin("labs", "offices.lab_id", "labs.id")
    .where("offices.tracking_token", token)
    .select(
      "offices.id",
      "offices.name",
      "offices.address",
      "offices.phone",
      "offices.contact_name as contactName",
      "labs.name as labName"
    )
    .first();

  if (!office) notFound();

  const [jobs, recentDelivered] = await Promise.all([
    db("jobs")
      .leftJoin("drivers", "jobs.driver_id", "drivers.id")
      .where("jobs.office_id", office.id)
      .whereNotIn("jobs.status", ["delivered", "rejected"])
      .orderBy("jobs.created_at", "desc")
      .select(
        "jobs.id",
        "jobs.case_id as caseId",
        "jobs.status",
        "jobs.priority",
        "jobs.delivery_address as deliveryAddress",
        "jobs.delivery_lat as deliveryLat",
        "jobs.delivery_lng as deliveryLng",
        "jobs.scheduled_at as scheduledAt",
        "jobs.created_at as createdAt",
        "jobs.updated_at as updatedAt",
        "drivers.name as driverName",
        "drivers.current_location as driverLocation"
      ),
    db("jobs")
      .where("jobs.office_id", office.id)
      .where("jobs.status", "delivered")
      .orderBy("jobs.updated_at", "desc")
      .limit(3)
      .select(
        "jobs.id",
        "jobs.case_id as caseId",
        "jobs.status",
        "jobs.priority",
        "jobs.delivery_address as deliveryAddress",
        "jobs.updated_at as updatedAt"
      ),
  ]);

  return (
    <TrackingView
      token={token}
      initial={{ office, jobs, recentDelivered }}
    />
  );
}
