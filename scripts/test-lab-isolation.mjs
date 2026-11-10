#!/usr/bin/env node
// Proves one lab can't reach another's data, and that roles hold, on every API
// route. Run with both local dev servers up (dispatcher on 3000, office portal on
// 3001):  pnpm test:isolation
//
// It signs in with the seed accounts, creates a temporary second lab ("B") and a
// few temporary rows in the test lab ("A"), attacks them, then removes them all.
// Local dev shares its database with the live site, so it touches only those rows.
// Every API route must be listed below, or as exempt with a reason, so a new
// route can't quietly go untested. It can't see the live deployment.
//
// Each office page run uses one of that device's 5 access-code tries per 15 minutes.
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readEnv = (file) =>
  Object.fromEntries(
    readFileSync(join(ROOT, file), "utf8").split("\n").filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
  );
const dbEnv = readEnv("packages/db/.env");
const webEnv = readEnv("apps/dispatcher-web/.env.local");
Object.assign(process.env, dbEnv);
const db = createRequire(import.meta.url)(join(ROOT, "packages/db"));

const API = process.env.DISPATCHER_URL ?? "http://localhost:3000";
const OFFICE = process.env.OFFICE_URL ?? "http://localhost:3001";
const SUPABASE = webEnv.NEXT_PUBLIC_SUPABASE_URL;
const ANON = webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const B_MARK = "ZZBMARK";
const A_MARK = "ZZAMARK";
const REFUSED = [400, 401, 403, 404, 409];

let passed = 0;
const failures = [];
const check = (name, ok, detail) => {
  if (ok) passed++;
  else failures.push(name + (detail === undefined ? "" : ` -> ${JSON.stringify(detail).slice(0, 220)}`));
};

async function signIn(email) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: dbEnv.SEED_USER_PASSWORD }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Couldn't sign in as ${email}`);
  return json.access_token;
}
const claims = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

async function call(base, method, path, { token, body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

/** Every "METHOD route" in the API, read from the files, so nothing can be missed. */
function discoverRoutes(appDir) {
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "route.ts") {
        const route = relative(join(ROOT, appDir), dirname(full));
        const src = readFileSync(full, "utf8");
        for (const m of src.matchAll(/export (?:async )?function (GET|POST|PATCH|PUT|DELETE)\b/g)) found.push(`${m[1]} ${route}`);
      }
    }
  };
  walk(join(ROOT, appDir));
  return found;
}

const EXEMPT = {
  "GET cron/alerts": "secret key, no lab input",
  "GET cron/lab-deletion": "secret key, no lab input",
  "GET cron/pod-photos": "secret key, no lab input",
  "POST stripe/checkout": "public signup, takes no lab id",
  "POST stripe/webhook": "verified by Stripe's signature",
  "GET help": "same content for every lab, covered by the sign-in check",
};
const covered = new Set();

const made = { labs: [], jobs: [], returns: [], drivers: [], offices: [] };

async function cleanup() {
  const noted = await db("returns").where("note", "like", "ZZ%MARK%").select("id");
  const retIds = [...new Set([...made.returns, ...noted.map((r) => r.id)])];
  if (retIds.length) {
    await db("return_message_reads").whereIn("return_id", retIds).del();
    await db("return_messages").whereIn("return_id", retIds).del();
    await db("return_events").whereIn("return_id", retIds).del();
    await db("returns").whereIn("id", retIds).del();
  }
  const attackJobs = await db("jobs").where("case_id", "like", "ZZ%MARK%").select("id");
  const jobIds = [...new Set([...made.jobs, ...attackJobs.map((j) => j.id)])];
  if (jobIds.length) {
    await db("message_reads").whereIn("job_id", jobIds).del();
    await db("messages").whereIn("job_id", jobIds).del();
    await db("job_status_events").whereIn("job_id", jobIds).del();
    await db("job_edit_events").whereIn("job_id", jobIds).del();
    await db("jobs").whereIn("id", jobIds).del();
  }
  if (made.offices.length) {
    await db("direct_message_reads").whereIn("thread", made.offices.map((id) => `office:${id}`)).del();
    await db("direct_messages").whereIn("office_id", made.offices).del();
  }
  if (made.drivers.length) await db("drivers").whereIn("id", made.drivers).del();
  if (made.offices.length) await db("offices").whereIn("id", made.offices).del();
  if (made.labs.length) await db("labs").whereIn("id", made.labs).del();
}

async function seed(labId) {
  const [office] = await db("offices").insert({
    lab_id: labId, name: `${labId === made.labs[0] ? B_MARK : A_MARK} office`, address: "1 Test St", phone: "0", contact_name: "x", tracking_token: randomUUID(), email: "zz@example.invalid",
  }).returning("*");
  made.offices.push(office.id);
  const mark = labId === made.labs[0] ? B_MARK : A_MARK;
  const [driver] = await db("drivers").insert({ lab_id: labId, user_id: randomUUID(), name: `${mark} driver`, phone: "0", email: `zz-${randomUUID()}@example.invalid`, status: "available" }).returning("*");
  made.drivers.push(driver.id);
  const job = async (o) => {
    const [row] = await db("jobs").insert({ lab_id: labId, office_id: office.id, driver_id: driver.id, case_id: `${mark}-${randomUUID().slice(0, 6)}`, status: "assigned", driver_response: "accepted", priority: "standard", items: JSON.stringify([{ description: mark, flags: [] }]), pickup_address: "x", delivery_address: "y", ...o }).returning("*");
    made.jobs.push(row.id);
    return row;
  };
  const open = await job({});
  const delivered = await job({ status: "delivered", delivered_at: new Date().toISOString(), pod_photo_path: `${labId}/zz.jpg`, proof_of_delivery: JSON.stringify({ recipientName: mark }) });
  const ret = async (o) => {
    const [row] = await db("returns").insert({ lab_id: labId, office_id: office.id, case_count: 1, case_numbers: "[]", note: `${mark} note`, ...o }).returning("*");
    made.returns.push(row.id);
    return row;
  };
  const request = await ret({ status: "requested", requested_at: new Date().toISOString(), picked_up_at: null, driver_id: driver.id, driver_response: "pending" });
  const withDriver = await ret({ status: "with_driver", driver_id: driver.id, driver_response: "accepted", picked_up_at: new Date().toISOString() });
  const checkedIn = await ret({ status: "checked_in", driver_id: driver.id, driver_response: "accepted", picked_up_at: new Date().toISOString(), checked_in_at: new Date().toISOString(), received_count: 1, case_id: `${mark}-CASE` });
  await db("messages").insert({ job_id: open.id, sender_role: "office", body: `${mark} message` });
  await db("return_messages").insert({ return_id: withDriver.id, lab_id: labId, sender_role: "office", body: `${mark} message` });
  await db("direct_messages").insert({ lab_id: labId, office_id: office.id, sender_role: "office", about_job_id: open.id, body: `${mark} private` });
  await db("job_status_events").insert({ job_id: open.id, lab_id: labId, from_status: "pending", to_status: "assigned", changed_by_role: "dispatcher" }).catch(() => {});
  return { office, driver, open, delivered, request, withDriver, checkedIn };
}

/** Everything of lab B's, to compare before and after the attacks. */
async function snapshot(labId, b) {
  const rows = await Promise.all([
    db("labs").where({ id: labId }).first(),
    db("offices").where({ lab_id: labId }).orderBy("id"),
    db("drivers").where({ lab_id: labId }).orderBy("id"),
    db("jobs").where({ lab_id: labId }).orderBy("id"),
    db("returns").where({ lab_id: labId }).orderBy("id"),
    db("messages").where({ job_id: b.open.id }).orderBy("id"),
    db("return_messages").where({ lab_id: labId }).orderBy("id"),
    db("return_events").where({ lab_id: labId }).orderBy("id"),
    db("job_status_events").where({ lab_id: labId }).orderBy("id"),
    db("job_edit_events").where({ lab_id: labId }).orderBy("id"),
    db("direct_messages").where({ lab_id: labId }).orderBy("id"),
  ]);
  return JSON.stringify(rows);
}

async function main() {
  const dispatcher = await signIn("dispatcher@gepeto.dev");
  const driver = await signIn("driver1@gepeto.dev");
  const labA = claims(dispatcher).user_metadata?.lab_id ?? claims(dispatcher).app_metadata?.lab_id;
  if (!labA) throw new Error("Couldn't find the test lab");

  const labB = randomUUID();
  await db("labs").insert({ id: labB, name: `${B_MARK} lab`, address: "", phone: "", settings: "{}" });
  made.labs.push(labB);
  const B = await seed(labB);
  const A = await seed(labA);
  const before = await snapshot(labB, B);

  const FAKE = { upTo: new Date().toISOString() };
  // Valid requests aimed at lab B. If a route skipped its lab check, these would work.
  const asDispatcher = [
    ["GET", "jobs/[id]", `/api/jobs/${B.open.id}`],
    ["PATCH", "jobs/[id]", `/api/jobs/${B.open.id}`, { priority: "stat" }],
    ["GET", "jobs/[id]/history", `/api/jobs/${B.open.id}/history`],
    ["GET", "jobs/[id]/messages", `/api/jobs/${B.open.id}/messages`],
    ["POST", "jobs/[id]/messages", `/api/jobs/${B.open.id}/messages`, { body: "attack" }],
    ["POST", "jobs/[id]/messages/read", `/api/jobs/${B.open.id}/messages/read`, FAKE],
    ["GET", "jobs/[id]/pod-photo", `/api/jobs/${B.delivered.id}/pod-photo`],
    ["PATCH", "jobs/[id]/status", `/api/jobs/${B.open.id}/status`, { status: "picked_up" }],
    ["PATCH", "drivers/[id]", `/api/drivers/${B.driver.id}`, { name: "attack" }],
    ["POST", "drivers/[id]/resend", `/api/drivers/${B.driver.id}/resend`, {}],
    ["PATCH", "offices/[id]", `/api/offices/${B.office.id}`, { name: "attack" }],
    ["POST", "offices/[id]/email-code", `/api/offices/${B.office.id}/email-code`, {}],
    ["POST", "offices/[id]/email-link", `/api/offices/${B.office.id}/email-link`, {}],
    ["POST", "offices/[id]/reset-code", `/api/offices/${B.office.id}/reset-code`, {}],
    ["POST", "offices/[id]/reset-link", `/api/offices/${B.office.id}/reset-link`, {}],
    ["POST", "returns/[id]/assign", `/api/returns/${B.request.id}/assign`, { driverId: null }],
    ["POST", "returns/[id]/cancel", `/api/returns/${B.request.id}/cancel`, {}],
    ["POST", "returns/[id]/check-in", `/api/returns/${B.withDriver.id}/check-in`, { receivedCount: 1, caseId: "attack" }],
    ["POST", "returns/[id]/correct", `/api/returns/${B.checkedIn.id}/correct`, { undo: "check_in" }],
    ["GET", "returns/[id]/history", `/api/returns/${B.withDriver.id}/history`],
    ["GET", "returns/[id]/messages", `/api/returns/${B.withDriver.id}/messages`],
    ["POST", "returns/[id]/messages", `/api/returns/${B.withDriver.id}/messages`, { body: "attack" }],
    ["POST", "returns/[id]/messages/read", `/api/returns/${B.withDriver.id}/messages/read`, FAKE],
    ["POST", "team/[id]/resend", `/api/team/${randomUUID()}/resend`, {}],
    ["GET", "direct-messages/offices/[id]", `/api/direct-messages/offices/${B.office.id}`],
    ["POST", "direct-messages/offices/[id]", `/api/direct-messages/offices/${B.office.id}`, { body: "attack" }],
    ["POST", "direct-messages/offices/[id]/read", `/api/direct-messages/offices/${B.office.id}/read`, FAKE],
    // Lab A's own rows, pointing at lab B's.
    ["POST", "jobs", "/api/jobs", { caseId: `${A_MARK}-attack1`, officeId: B.office.id, pickupAddress: "x", deliveryAddress: "y", items: [{ description: "x", flags: [] }], priority: "standard" }],
    ["POST", "jobs", "/api/jobs", { caseId: `${A_MARK}-attack2`, officeId: A.office.id, driverId: B.driver.id, pickupAddress: "x", deliveryAddress: "y", items: [{ description: "x", flags: [] }], priority: "standard" }],
    ["PATCH", "jobs/[id]", `/api/jobs/${A.open.id}`, { driverId: B.driver.id }],
    ["PATCH", "jobs/[id]", `/api/jobs/${A.open.id}`, { officeId: B.office.id }],
    ["POST", "returns/[id]/assign", `/api/returns/${A.request.id}/assign`, { driverId: B.driver.id }],
    ["POST", "returns/[id]/correct", `/api/returns/${A.withDriver.id}/correct`, { driverId: B.driver.id }],
    ["POST", "returns/[id]/check-in", `/api/returns/${A.withDriver.id}/check-in`, { receivedCount: 1, caseId: "x", sourceJobId: B.open.id }],
    ["POST", "returns/request", "/api/returns/request", { officeId: B.office.id, caseCount: 1, note: `${A_MARK} attack` }],
    ["POST", "direct-messages/offices/[id]", `/api/direct-messages/offices/${A.office.id}`, { body: `${A_MARK} attack`, aboutJobId: B.open.id }],
  ];
  for (const [method, route, path, body] of asDispatcher) {
    covered.add(`${method} ${route}`);
    const res = await call(API, method, path, { token: dispatcher, body });
    check(`lab A dispatcher refused: ${method} ${route} ${body ? JSON.stringify(Object.keys(body)) : ""}`, REFUSED.includes(res.status), [res.status, res.text]);
    check(`no lab B data returned: ${method} ${route}`, !res.text.includes(B_MARK), res.text);
  }
  const aJob = await db("jobs").where({ id: A.open.id }).first();
  check("lab A's job didn't move to lab B", aJob.driverId === A.driver.id && aJob.officeId === A.office.id, aJob);
  const aRet = await db("returns").where({ id: A.request.id }).first();
  check("lab A's return didn't get lab B's driver", aRet.driverId === A.driver.id, aRet);

  // Lists must show this lab's rows and never lab B's.
  const lists = [
    ["GET", "jobs", "/api/jobs", true],
    ["GET", "drivers", "/api/drivers", true],
    ["GET", "offices", "/api/offices", true],
    ["GET", "returns", "/api/returns?status=all", true],
    ["GET", "returns", `/api/returns?officeId=${B.office.id}&status=all`, false],
    ["GET", "returns", `/api/returns?driverId=${B.driver.id}&status=all`, false],
    ["GET", "search", `/api/search?q=${B_MARK}`, false],
    ["GET", "search", `/api/search?q=${A_MARK}`, true],
    ["GET", "reports", "/api/reports", false],
    ["GET", "reports/export", "/api/reports/export?type=jobs", true],
    ["GET", "reports/export", "/api/reports/export?type=returns", true],
    ["GET", "reports/export", "/api/reports/export?type=messages", true],
    ["GET", "reports/export", "/api/reports/export?type=drivers", true],
    ["GET", "reports/export", "/api/reports/export?type=offices", true],
    ["GET", "messages/unread", "/api/messages/unread", true],
    ["GET", "returns/messages/unread", "/api/returns/messages/unread", true],
    ["GET", "direct-messages", "/api/direct-messages", true],
    ["GET", "direct-messages/unread", "/api/direct-messages/unread", true],
    ["GET", "direct-messages/offices/[id]", `/api/direct-messages/offices/${A.office.id}?aboutJobId=${B.open.id}`, false],
    ["GET", "returns/summary", "/api/returns/summary", false],
    ["GET", "jobs/driver-activity", "/api/jobs/driver-activity", false],
    ["GET", "team", "/api/team", false],
    ["GET", "settings", "/api/settings", false],
    ["GET", "settings/delivery-photos", "/api/settings/delivery-photos", false],
    ["GET", "billing", "/api/billing", false],
    ["GET", "lab-status", "/api/lab-status", false],
  ];
  for (const [method, route, path, expectA] of lists) {
    covered.add(`${method} ${route}`);
    const res = await call(API, method, path, { token: dispatcher });
    check(`list works: ${path}`, res.status === 200, [res.status, res.text]);
    check(`list hides lab B: ${path}`, !res.text.includes(B_MARK), res.text);
    if (expectA) check(`list isn't empty, so the check means something: ${path}`, res.text.includes(A_MARK), res.text.slice(0, 200));
  }
  const unread = JSON.parse((await call(API, "GET", "/api/returns/messages/unread", { token: dispatcher })).text).data;
  check("unread counts hide lab B's return", !unread.byReturn[B.withDriver.id]);
  const jobUnread = JSON.parse((await call(API, "GET", "/api/messages/unread", { token: dispatcher })).text).data;
  check("unread counts hide lab B's job", !jobUnread.byJob[B.open.id]);

  // Driver: lab B's work, and another driver's work in the same lab.
  for (const [who, t] of [["lab B", B], ["another driver in the lab", A]]) {
    const asDriver = [
      ["GET", "jobs/[id]", `/api/jobs/${t.open.id}`],
      ["GET", "jobs/[id]/messages", `/api/jobs/${t.open.id}/messages`],
      ["POST", "jobs/[id]/messages", `/api/jobs/${t.open.id}/messages`, { body: "attack" }],
      ["POST", "jobs/[id]/messages/read", `/api/jobs/${t.open.id}/messages/read`, FAKE],
      ["GET", "jobs/[id]/pod-photo", `/api/jobs/${t.delivered.id}/pod-photo`],
      ["PATCH", "jobs/[id]/status", `/api/jobs/${t.open.id}/status`, { status: "picked_up" }],
      ["PATCH", "jobs/[id]/response", `/api/jobs/${t.open.id}/response`, { driverResponse: "rejected" }],
      ["GET", "driver/history/[jobId]", `/api/driver/history/${t.delivered.id}`],
      ["GET", "driver/history/returns/[returnId]", `/api/driver/history/returns/${t.checkedIn.id}`],
      ["GET", "returns/[id]/messages", `/api/returns/${t.withDriver.id}/messages`],
      ["POST", "returns/[id]/messages", `/api/returns/${t.withDriver.id}/messages`, { body: "attack" }],
      ["POST", "returns/[id]/messages/read", `/api/returns/${t.withDriver.id}/messages/read`, FAKE],
      ["POST", "returns/[id]/response", `/api/returns/${t.request.id}/response`, { driverResponse: "accepted" }],
    ];
    for (const [method, route, path, body] of asDriver) {
      covered.add(`${method} ${route}`);
      const res = await call(API, method, path, { token: driver, body });
      check(`driver refused (${who}): ${method} ${route}`, REFUSED.includes(res.status), [res.status, res.text]);
      check(`driver sees nothing (${who}): ${method} ${route}`, !res.text.includes(B_MARK) && !res.text.includes(A_MARK), res.text);
    }
    const drop = await call(API, "POST", "/api/returns/drop", { token: driver, body: { ids: [t.withDriver.id] } });
    covered.add("POST returns/drop");
    check(`driver can't drop off ${who}'s return`, drop.status === 200 && JSON.parse(drop.text).data.dropped === 0, drop.text);
  }
  covered.add("POST returns");
  const logged = await call(API, "POST", "/api/returns", { token: driver, body: { officeId: B.office.id, caseCount: 1, note: `${A_MARK} attack` } });
  check("driver can't log a pickup at lab B's office", REFUSED.includes(logged.status), [logged.status, logged.text]);

  // A driver's own lists stay within what's theirs.
  for (const [route, path] of [
    ["driver/history", "/api/driver/history"], ["driver/messages/unread", "/api/driver/messages/unread"], ["driver/break", "/api/driver/break"],
    ["driver/settings", "/api/driver/settings"], ["jobs", "/api/jobs"], ["returns", "/api/returns"], ["returns/messages/unread", "/api/returns/messages/unread"], ["lab-status", "/api/lab-status"],
  ]) {
    covered.add(`GET ${route}`);
    const res = await call(API, "GET", path, { token: driver });
    check(`driver list works: ${path}`, res.status === 200, [res.status, res.text]);
    check(`driver list hides others' work: ${path}`, !res.text.includes(B_MARK) && !res.text.includes(A_MARK), res.text);
  }

  // Roles: each side is kept out of the other's routes.
  const dispatcherOnly = [
    ["GET", "/api/drivers"], ["POST", "/api/drivers", {}], ["GET", "/api/offices"], ["POST", "/api/offices", {}], ["GET", "/api/team"], ["POST", "/api/team", {}],
    ["GET", "/api/settings"], ["PATCH", "/api/settings/lab", {}], ["PATCH", "/api/settings/notifications", {}], ["PATCH", "/api/settings/delivery-photos", {}],
    ["GET", "/api/billing"], ["POST", "/api/billing/portal", {}], ["POST", "/api/billing/restart", {}], ["GET", "/api/search?q=x"], ["GET", "/api/reports"], ["GET", "/api/reports/export?type=jobs"],
    ["GET", "/api/returns/summary"], ["GET", "/api/jobs/driver-activity"], ["GET", "/api/messages/unread"], ["POST", "/api/jobs", {}], ["POST", "/api/returns/request", {}],
    ["GET", `/api/jobs/${A.open.id}/history`], ["GET", `/api/returns/${A.withDriver.id}/history`], ["POST", `/api/returns/${A.request.id}/assign`, {}], ["POST", `/api/returns/${A.request.id}/cancel`, {}],
    ["GET", "/api/direct-messages"], ["GET", "/api/direct-messages/unread"], ["GET", `/api/direct-messages/offices/${A.office.id}`],
    ["POST", `/api/direct-messages/offices/${A.office.id}`, { body: "attack" }], ["POST", `/api/direct-messages/offices/${A.office.id}/read`, FAKE],
    ["POST", `/api/returns/${A.withDriver.id}/check-in`, {}], ["POST", `/api/returns/${A.withDriver.id}/correct`, {}], ["PATCH", `/api/drivers/${A.driver.id}`, {}], ["POST", `/api/drivers/${A.driver.id}/resend`, {}],
    ["PATCH", `/api/offices/${A.office.id}`, {}], ["POST", `/api/offices/${A.office.id}/email-code`, {}], ["POST", `/api/offices/${A.office.id}/email-link`, {}], ["POST", `/api/offices/${A.office.id}/reset-code`, {}],
    ["POST", `/api/offices/${A.office.id}/reset-link`, {}], ["PATCH", `/api/jobs/${A.open.id}`, {}],
  ];
  const routeOf = (p) => p.split("?")[0].replace("/api/", "").replace(/[0-9a-f-]{36}/g, "[id]");
  for (const [method, path, body] of dispatcherOnly) {
    covered.add(`${method} ${routeOf(path)}`);
    const res = await call(API, method, path, { token: driver, body });
    check(`driver kept out: ${method} ${routeOf(path)}`, res.status === 403 || res.status === 404, [res.status, res.text]);
  }
  const driverOnly = [
    ["PATCH", "/api/drivers/location", { lat: 1, lng: 1 }], ["POST", "/api/driver/break", {}], ["GET", "/api/driver/break"], ["GET", "/api/driver/history"], ["GET", "/api/driver/messages/unread"], ["POST", "/api/driver/pod-photo", {}],
    ["PATCH", `/api/jobs/${A.open.id}/response`, { driverResponse: "rejected" }], ["POST", `/api/returns/${A.request.id}/response`, { driverResponse: "accepted" }], ["POST", "/api/returns/drop", {}], ["POST", "/api/returns", { officeId: A.office.id, caseCount: 1, note: `${A_MARK} attack` }],
  ];
  for (const [method, path, body] of driverOnly) {
    covered.add(`${method} ${routeOf(path)}`);
    const res = await call(API, method, path, { token: dispatcher, body });
    check(`dispatcher kept out: ${method} ${routeOf(path)}`, res.status === 403, [res.status, res.text]);
  }

  // No sign-in at all: every route except the exempt ones.
  const routes = discoverRoutes("apps/dispatcher-web/app/api");
  for (const r of routes) {
    if (EXEMPT[r]) continue;
    const [method, route] = r.split(" ");
    const path = "/api/" + route.replace(/\[[a-zA-Z]+\]/g, randomUUID());
    const res = await call(API, method, path, method === "GET" ? {} : { body: {} });
    check(`sign-in required: ${r}`, res.status === 401, [res.status, res.text.slice(0, 120)]);
    covered.add(`AUTH ${r}`);
  }

  // Office page: a valid office can't reach lab B's, or another office's.
  const offices = JSON.parse((await call(API, "GET", "/api/offices", { token: dispatcher })).text).data;
  const mine = offices.find((o) => o.id === A.office.id);
  const unlock = await call(OFFICE, "POST", `/api/track/${mine.trackingToken}/unlock`, { body: { code: mine.accessCode } });
  const cookie = (unlock.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie) {
    failures.push(`Couldn't unlock the temporary office [${unlock.status}]. If 429, wait 15 minutes and rerun.`);
  } else {
    const T = `/api/track/${mine.trackingToken}`;
    const officeAttacks = [
      ["GET", `${T}/jobs/${B.open.id}/messages`],
      ["POST", `${T}/jobs/${B.open.id}/messages`, { body: "attack" }],
      ["GET", `${T}/photo/${B.delivered.id}`],
      ["GET", `${T}/pickups/${B.withDriver.id}/messages`],
      ["POST", `${T}/pickups/${B.withDriver.id}/messages`, { body: "attack" }],
      ["POST", `${T}/pickups/${B.request.id}/cancel`, {}],
      ["POST", `${T}/dispatch/messages`, { body: `${A_MARK} attack`, aboutJobId: B.open.id }],
    ];
    for (const [method, path, body] of officeAttacks) {
      const res = await call(OFFICE, method, path, { cookie, body });
      check(`office refused: ${method} ${path.replace(T, "").replace(/[0-9a-f-]{36}/g, ":id")}`, REFUSED.includes(res.status), [res.status, res.text]);
      check("office sees nothing of lab B's", !res.text.includes(B_MARK), res.text);
    }
    const own = await call(OFFICE, "GET", T, { cookie });
    check("office page works", own.status === 200, own.status);
    check("office page hides lab B", !own.text.includes(B_MARK), own.text.slice(0, 200));
    const privateThread = await call(OFFICE, "GET", `${T}/dispatch/messages`, { cookie });
    check("office private thread works", privateThread.status === 200 && privateThread.text.includes(`${A_MARK} private`), [privateThread.status, privateThread.text.slice(0, 200)]);
    check("office private thread hides lab B", !privateThread.text.includes(B_MARK), privateThread.text.slice(0, 200));
    const caseThread = await call(OFFICE, "GET", `${T}/jobs/${A.open.id}/messages`, { cookie });
    check("private messages stay out of the case thread", caseThread.status === 200 && !caseThread.text.includes("private"), caseThread.text.slice(0, 200));
    const delivered = await call(OFFICE, "GET", `${T}/delivered`, { cookie });
    check("office history hides lab B", !delivered.text.includes(B_MARK), delivered.text.slice(0, 200));

    const otherToken = `/api/track/${B.office.trackingToken}`;
    for (const [method, path, body] of [["GET", `${otherToken}/jobs/${B.open.id}/messages`], ["GET", `${otherToken}/dispatch/messages`], ["GET", `${otherToken}/delivered`], ["POST", `${otherToken}/pickups`, { caseCount: 1 }], ["GET", `${otherToken}/photo/${B.delivered.id}`]]) {
      const res = await call(OFFICE, method, path, { cookie, body });
      check(`one office's unlock doesn't open another: ${method} ${path.replace(otherToken, "")}`, res.status === 401, [res.status, res.text]);
    }
    const noCode = await call(OFFICE, "GET", otherToken);
    // The code screen names the office and lab by design. Nothing else may show.
    const locked = JSON.parse(noCode.text).data;
    check("office page needs the code", locked?.locked === true && !locked.jobs && !locked.pickups && !locked.liveTopic && !noCode.text.includes("note") && !noCode.text.includes("message"), noCode.text.slice(0, 200));
    const noCodeMessages = await call(OFFICE, "GET", `${T}/jobs/${A.open.id}/messages`);
    check("office messages need the code", noCodeMessages.status === 401, noCodeMessages.status);
    const wrong = await call(OFFICE, "GET", `/api/track/${randomUUID()}/delivered`);
    check("unknown link refused", wrong.status === 404, wrong.status);
  }

  check("lab B is exactly as it started", (await snapshot(labB, B)) === before);

  // Coverage: a route with no test fails, so it gets one.
  for (const r of routes) {
    if (!EXEMPT[r] && !covered.has(r)) failures.push(`No isolation test for: ${r}`);
  }
  for (const r of Object.keys(EXEMPT)) if (!routes.includes(r)) failures.push(`Exempt route no longer exists: ${r}`);
  return routes.length;
}

let routeCount = 0;
try {
  routeCount = await main();
} catch (err) {
  failures.push(`Stopped early: ${err.message}`);
} finally {
  await cleanup().catch((err) => failures.push(`Cleanup failed: ${err.message}`));
  const left = await db("labs").where("name", "like", `${B_MARK}%`).count("* as n").first();
  if (Number(left.n)) failures.push(`Temporary lab left behind: ${left.n}`);
  await db.destroy();
}
console.log(`${passed} passed, ${failures.length} failed, across ${routeCount} route methods`);
for (const f of failures) console.log(`FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
