// Customer-facing feature guide, polished from the internal running list in
// marketing/feature-notes.md (outside the repo). Update this file when a
// feature should go public; the page, its table of contents and the PDF all
// render from it.

export type Feature = { title: string; body: string };
export type Group = { id: string; title: string; features: Feature[] };
export type Section = { id: string; eyebrow: string; title: string; intro: string; groups: Group[] };

export const SECTIONS: Section[] = [
  {
    id: "dispatchers",
    eyebrow: "For the lab",
    title: "Dispatchers",
    intro:
      "The dispatch dashboard is your front desk for every case that leaves the lab: who has it, where it is, and when it will land.",
    groups: [
      {
        id: "dispatch-live",
        title: "Know the moment something changes",
        features: [
          { title: "A live jobs board", body: "When a driver accepts, picks up, heads out, arrives or delivers, the job's status updates on your board right away. No refreshing, no check-in calls." },
          { title: "Driver alerts on any screen", body: "A notice pops up with a soft chime when a driver accepts, rejects or delivers a job. Click it to jump straight to that job." },
          { title: "Rejections never slip through", body: "If a driver turns a job down, it goes straight back to Pending, unassigned, and you're alerted so you can hand it to someone else." },
          { title: "Messages arrive instantly", body: "New messages from drivers and offices chime in with an unread count, even when Gepeto is in another browser tab. Open conversations update live and always open on the newest message." },
        ],
      },
      {
        id: "dispatch-control",
        title: "Fast, mistake-proof dispatching",
        features: [
          { title: "Fix anything with a click", body: "Click a job's case number, office or due time to change it. Every change is logged, and the driver is alerted when it affects their route or timing." },
          { title: "Redirect a delivery mid-trip", body: "Change a job's office even after pickup. The delivery address updates and the driver gets a clear \"Delivery changed\" alert." },
          { title: "Reassign in two clicks", body: "Click a driver's name on any job to hand it to someone else. The new driver is asked to accept it fresh." },
          { title: "Upgrade to STAT at any time", body: "Make a job STAT, or back to standard, whenever priorities shift, not just when it's created." },
          { title: "Guardrails built in", body: "A job can't move past Pending without a driver, and a delivered job can't be reassigned. Your board stays honest." },
          { title: "Due times on every job", body: "Every job carries an expected delivery time, and late jobs are flagged in red." },
          { title: "Fewer trips, automatically", body: "When you assign a job, Gepeto points out drivers already headed to the same office, so cases can go out together." },
        ],
      },
      {
        id: "dispatch-returns",
        title: "Nothing lost on the way back",
        features: [
          { title: "Every returning case tracked", body: "Remakes, adjustments and new work a driver picks up at an office get their own return number and show up for you the moment the driver logs them, before they reach your door." },
          { title: "Check in at the front desk in seconds", body: "Confirm how many cases arrived, give the return your lab's case number, and link it to the delivery it came back from. Gepeto suggests the likely match." },
          { title: "Count mismatches caught", body: "If fewer cases arrive than the driver logged, you see it at check-in, and the difference is recorded in the return's history." },
          { title: "Returns at a glance", body: "A dashboard tile and a sidebar badge show what's waiting to be checked in and what's still with drivers, updated live." },
          { title: "History for every return", body: "When it was picked up, dropped off and checked in, and by whom." },
        ],
      },
      {
        id: "dispatch-record",
        title: "A full paper trail",
        features: [
          { title: "Per-job history", body: "Every status change and every edit (case number, office, due time, driver, priority) with who made it and when, including driver rejections. Settle \"what happened to this case?\" in seconds." },
          { title: "A dashboard that fits on one screen", body: "Active jobs, pending work, returning cases and unread messages up top, with today's deliveries one click away. Jobs and drivers scroll in their own panels with the live map alongside." },
        ],
      },
    ],
  },
  {
    id: "drivers",
    eyebrow: "On the road",
    title: "Drivers",
    intro:
      "The Gepeto driver app is built for one hand and a busy day: the next step is always obvious, and nothing important gets missed.",
    groups: [
      {
        id: "driver-alerts",
        title: "Never miss a job",
        features: [
          { title: "Alerts wherever you are in the app", body: "A banner drops in over any screen when you're assigned a job. Tap it to accept or reject." },
          { title: "STAT gets your attention", body: "If a job becomes STAT, you get a bold alert and a strong buzz so you can re-plan your route." },
          { title: "Every change explained at a glance", body: "Short alerts lead with what changed (a new delivery address, a new due time) and the case number. Paperwork fixes update quietly without interrupting you." },
          { title: "Told when plans change", body: "If dispatch reassigns one of your jobs, it leaves your list immediately, so you never drive to a pickup that's no longer yours." },
        ],
      },
      {
        id: "driver-road",
        title: "Built for the road",
        features: [
          { title: "Always one obvious next step", body: "Each job shows a single big button for what to do next (Mark picked up, Mark en route, Mark arrived, Complete delivery) with a one-line hint." },
          { title: "Your day at a glance", body: "Every job shows the office, the address and when it's due. Due times turn amber within the hour and red when late, and the most urgent stop comes first." },
          { title: "Progress you can read in a second", body: "A four-step bar (Assigned, Picked up, In transit, Arrived) on every job in progress." },
          { title: "Jobs waiting on you come first", body: "New jobs that need your answer sit in their own section at the top, so nothing waits unanswered." },
          { title: "Designed for sunlight", body: "A high-contrast dark design with big tap targets, and status colors that differ in brightness, not just hue." },
        ],
      },
      {
        id: "driver-stops",
        title: "One trip, several cases",
        features: [
          { title: "Jobs grouped by office", body: "Several cases going to the same office appear as one stop, with the earliest due time and a single Navigate button." },
          { title: "One tap for the whole stop", body: "\"Mark all 3 picked up\" at the lab, \"Complete all 3 deliveries\" at the door. The recipient's name is entered once and saved as proof of delivery on every case." },
        ],
      },
      {
        id: "driver-returns",
        title: "Bringing cases back",
        features: [
          { title: "Log returns at the door", body: "Completing a delivery asks \"Bringing anything back to the lab?\" Tap Yes, set the number of cases, and add case numbers or a note if you like. The lab sees it right away." },
          { title: "Pickups without a delivery", body: "Log cases collected from any office, even when you weren't dropping anything off." },
          { title: "One tap at the lab", body: "\"Dropped off\" tells the front desk your returns are waiting, and you can see when they've been checked in." },
        ],
      },
      {
        id: "driver-messages",
        title: "Messages that stay out of the way",
        features: [
          { title: "Chat on its own screen", body: "Conversations with the lab and the office work like texting, while the job screen keeps the next step up front with a one-line preview of the latest message." },
          { title: "One-tap replies", body: "\"On my way\", \"Running ~10 min late\", \"Left at front desk\", \"Call me\": answer without typing." },
          { title: "Never miss a message", body: "A banner appears on any screen when the lab or office writes, and badges show which jobs have unread messages." },
          { title: "Know who's talking", body: "Lab and office messages are color-coded, and only the Send button sends, so a stray tap never fires off a half-written note." },
        ],
      },
      {
        id: "driver-records",
        title: "Simple, honest record keeping",
        features: [
          { title: "Proof of delivery", body: "Every delivery records who received it and when." },
          { title: "History tab", body: "Every delivery and every job you turned down in the last 30 days, grouped by day, with older history a tap away." },
          { title: "Accept or reject in one tap", body: "With a confirmation, so nothing is turned down by accident." },
        ],
      },
    ],
  },
  {
    id: "offices",
    eyebrow: "For your clients",
    title: "Dental offices",
    intro: "Your dental offices see what's coming to them without calling the lab.",
    groups: [
      {
        id: "office-tracking",
        title: "Tracking without the phone calls",
        features: [
          { title: "A private tracking link", body: "Each office gets its own link. No account or password needed: open it to see every case on its way, with its status." },
          { title: "Follow the delivery on a map", body: "See the driver's progress toward the office." },
          { title: "Talk to the lab and the driver", body: "Send a message about any case, right from the tracking page." },
          { title: "Private conversations", body: "If a case is moved to a different office, the new office never sees messages from the previous one." },
        ],
      },
    ],
  },
  {
    id: "security",
    eyebrow: "Peace of mind",
    title: "Security & trust",
    intro: "Built so the right people see the right things, and nothing else.",
    groups: [
      {
        id: "security-access",
        title: "Access and data",
        features: [
          { title: "Role separation", body: "Driver accounts can't open the dispatch console, and drivers only ever see their own jobs." },
          { title: "Each lab's data stays its own", body: "Every lab's jobs, drivers, offices and messages are kept separate at the database level." },
          { title: "Alerts can't be spoofed", body: "The driver app double-checks every alert against the database before acting on it." },
          { title: "A complete audit trail", body: "Every status change and edit is recorded with who made it and when." },
        ],
      },
    ],
  },
];
