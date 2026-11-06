import "server-only";
import type { HelpManual } from "./types";

// The Dispatcher help site and printable manual both render from this one
// source. When a dispatcher feature changes, update its article here.
// Link format: [text](/help/slug) or [text](/help/slug#heading-in-lowercase-with-dashes).
export const dispatcherManual: HelpManual = {
  sections: [
    {
      title: "Jobs",
      articles: [
        {
          slug: "create-a-job",
          title: "Create and assign a job",
          summary: "Add a delivery, choose a driver and see whether they accepted.",
          related: ["follow-and-change-a-job", "office-access"],
          body: `
Every delivery in Gepeto is a job. You need at least one office before you can create one. If you don't have one yet, see [Give an office tracking access](/help/office-access).

## Create a job

1. Go to [Jobs](/jobs) and click **New Job**.
2. Enter the **Case ID**. Use your lab's case number, not a patient name.
3. Choose the **Dental Office**.
4. Set the **Expected Delivery Time** and enter an **Item Description**, such as "PFM Crown, upper right molar".
5. Choose **Standard** or **STAT** for the priority.
6. Add any **Handling Flags** that apply: Fragile, Temp Sensitive, Rush or Biohazard.
7. Choose a driver under **Assign Driver**, or leave it **Unassigned** to decide later.
8. Click **Create Job**.

A job with a driver starts as **Assigned**. A job without one starts as **Pending**. See [what each status means](/help/follow-and-change-a-job#what-each-status-means).

## Send cases out together

When you assign a job, Gepeto tells you if a driver is already headed to that office and how many of their jobs haven't been picked up yet. Use this to group cases into one trip. If the driver has already picked up everything for that office, Gepeto warns you that they'd need to come back to the lab for the new job.

## See whether the driver accepted

The driver is asked to accept or reject the job in the driver app. Until they answer, the job shows **Awaiting reply** under its status. After they accept, it shows **Accepted**. Both tags update on their own on the Jobs page and the Dashboard.

## If a driver rejects a job

Gepeto alerts you, returns the job to **Pending** and removes the driver. Assign someone else by following [Change the driver or priority](/help/follow-and-change-a-job#change-the-driver-or-priority). The rejection stays in the job's [history](/help/follow-and-change-a-job#check-what-happened-to-a-job).
`,
        },
        {
          slug: "follow-and-change-a-job",
          title: "Follow and change a job",
          summary: "Read job statuses, fix details, reassign drivers and check a job's history.",
          related: ["create-a-job", "returning-cases"],
          body: `
The [Jobs](/jobs) page updates on its own as drivers work, so you don't need to refresh it.

## What each status means

- **Pending:** the job has no driver yet.
- **Assigned:** the job has a driver who hasn't picked it up. Check for **Accepted** or **Awaiting reply** under the status.
- **Picked Up:** the driver has the case.
- **In Transit:** the driver is on the way to the office.
- **Arrived:** the driver is at the office.
- **Delivered:** the delivery is complete.

## Change a status

Drivers normally update the status from their app. To change it yourself, click the status on the job and choose a new one.

> A job can't move out of Pending until it has a driver. If you mark a job Delivered yourself, no recipient name is recorded.

## Change the driver or priority

Click the driver or priority on the job, make your change and save.

- A new driver is asked to accept or reject the job, just like the first one.
- You can only leave a job unassigned while it's Pending or Assigned. Once it's on the road, you can give it to another driver, but not remove the driver.
- If you [assign a driver going to the same office](/help/create-a-job#send-cases-out-together), Gepeto points that out here too.

## Fix the case number, office or due time

Click the value on the job, change it and save.

- **Due time:** the driver is alerted to the new time.
- **Office:** the delivery address changes to the new office's address. If the driver is already on the way, they're alerted to the new destination. The new office won't see messages from before the change.

> After a job is delivered, you can still correct its case number. You can't change its office, due time or driver.

## Message the driver and office

Click **Messages** on the job to open its conversation. The driver and the office can both see it. An office can read and reply once it has [tracking access](/help/office-access).

## Check what happened to a job

Click **History** on the job to see each status change and edit, who made it and when. Driver rejections are listed too. On a delivered job, **Proof of Delivery** shows who received it and any photo the driver took.
`,
        },
      ],
    },
    {
      title: "Returning Cases",
      articles: [
        {
          slug: "returning-cases",
          title: "Handle pickups and check in returns",
          summary: "Assign pickup requests and record the cases that come back to the lab.",
          related: ["office-access", "follow-and-change-a-job"],
          body: `
A return is any group of cases on its way back to the lab, such as remakes, adjustments or new work. Each one gets its own number, such as RET-1001. You'll find them all on [Returning Cases](/returns).

## How a return gets started

- **An office requests a pickup** from its tracking page. You get an alert, and the request appears at the top of the list until a driver is assigned. Offices need [tracking access](/help/office-access) to do this.
- **A driver logs a pickup** in the driver app, either after a delivery or as a separate stop. The return appears in your list right away.

## What each status means

- **Pickup requested:** an office asked for a pickup, and the driver hasn't collected the cases yet.
- **With driver:** the driver has the cases.
- **At lab · needs check-in:** the driver marked the cases as dropped off at the lab.
- **Checked in:** the front desk has received the cases.

## Assign or cancel a pickup request

Choose a driver from **Assign driver…** on the request. To call it off, click **Cancel** and confirm.

## Check in a return

1. Find the return and click **Check in**. You can do this even if the driver forgot to mark it as dropped off.
2. Compare the driver's count and notes with what arrived, then set **Cases received**.
3. Enter the **Lab case number**. Use your lab's number, not a patient name. If the driver logged several numbers, you can click one to fill it in.
4. If this is a remake or adjustment, choose the original delivery under **Came back from**. A star marks a job that matches a case number the driver logged. You can skip this step.
5. Click the **Check in** button at the bottom of the window to finish.

> If the count you enter differs from the driver's, Gepeto warns you and keeps the difference in the return's history.

## Find older returns

Use the **Checked in** filter to see returns from the last 30 days. Click **History** on any return to see who picked it up, dropped it off, checked it in or linked it, and when.
`,
        },
      ],
    },
    {
      title: "Offices",
      articles: [
        {
          slug: "office-access",
          title: "Give an office tracking access",
          summary: "Share an office's tracking link and access code, and reset them if needed.",
          related: ["create-a-job", "returning-cases"],
          body: `
Offices don't need an account to follow their deliveries. Each office has a private **tracking link** and an **access code**, and needs both to see its cases, driver locations, messages, delivery history and photos, or to [request pickups](/help/returning-cases#how-a-return-gets-started).

## Add an office

1. Go to [Offices](/offices) and click **Add Office**.
2. Enter the office name, contact name, phone and address.
3. Add an email address if you want to send the link and code from Gepeto.
4. Click **Add Office**. Gepeto then shows the new tracking link and access code.

> Adding an office doesn't send it anything. You choose when to [share the link and code](/help/office-access#share-the-link-and-code).

## Share the link and code

Both are always available on the office's card on the [Offices](/offices) page.

- **By email:** click **Email link to office** and **Email code to office** on the card. The link and code go in separate emails, so forwarding one doesn't open the full view.
- **Yourself:** click **Copy** and send them however you prefer. Try to share them separately.

## How the office gets in

The office opens the link and enters the code. That device then stays unlocked for 30 days. After too many wrong tries, the office has to wait 15 minutes or call the lab for the code.

## Reset a link or code

Reset one if it reached the wrong person. Use **Reset code** or **Reset link** on the office's card.

- **Reset code:** the old code stops working on every device right away, and everyone at the office has to enter the new one.
- **Reset link:** the old link stops working right away, including bookmarks. The access code stays the same, but everyone has to enter it again on the new link.

> A reset takes effect immediately and can't be undone. Gepeto doesn't send the new link or code automatically, so the office can't get back in until you share it.
`,
        },
      ],
    },
  ],
};
