// Accepting a job doesn't change its status (it stays Assigned until pickup), so
// this shows where the driver stands on it, under the status on job rows.
export function DriverReplyTag({ status, driverResponse }: { status: string; driverResponse?: string }) {
  if (status !== "assigned") return null;
  if (driverResponse === "accepted") {
    return <span style={{ fontSize: 11, fontWeight: 500, color: "#3B6D11", whiteSpace: "nowrap" }}>Accepted</span>;
  }
  if (driverResponse === "pending") {
    return <span style={{ fontSize: 11, fontWeight: 500, color: "#854F0B", whiteSpace: "nowrap" }}>Awaiting reply</span>;
  }
  return null;
}
