import "server-only";
import type { HelpManual } from "./types";

// The Dispatcher help site and printable manual both render from this one
// source. When a dispatcher feature changes, update its article here.
// Link format: [text](/help/slug) or [text](/help/slug#heading-in-lowercase-with-dashes).
export const dispatcherManual: HelpManual = {
  sections: [
    {
      title: "Getting started",
      articles: [
        {
          slug: "read-the-dashboard",
          title: "Read the Dashboard",
          summary: "See active jobs, drivers, returns and unread messages on one screen.",
          related: ["find-anything", "alerts-and-notifications", "follow-and-change-a-job"],
          body: `
The [Dashboard](/dashboard) shows what's happening right now and updates on its own.

## The tiles across the top

- **Active Jobs:** jobs still in progress, and how many were created today.
- **In Transit:** jobs on the road, and how many of them are STAT.
- **Returning Cases:** cases on their way back to the lab. Click the tile to open [Returning Cases](/help/returning-cases).
- **Pending:** jobs waiting for a driver. See [Create and assign a job](/help/create-a-job).
- **Unread Messages:** click the tile to open the newest unread conversation. If nothing is unread, it opens the Jobs page.

## The job list

Use **All**, **STAT**, **In Transit**, **Pending** and **Delivered** to filter the list. Click a column heading to sort by it. Your sort choice is remembered on that browser.

Assigned jobs show **Accepted** or **Awaiting reply**, so you can see [who still needs to answer](/help/create-a-job#see-whether-the-driver-accepted).

## Drivers and the map

**Drivers On Shift** lists your drivers and their status. A driver on a break shows when the break started and no location. See [Follow a driver's break](/help/manage-drivers#follow-a-driver-s-break).

**Live Map** shows your drivers and deliveries. The legend on the map explains the colors.
`,
        },
        {
          slug: "find-anything",
          title: "Find anything with search",
          summary: "Jump straight to a job, return, office or driver.",
          related: ["read-the-dashboard", "follow-and-change-a-job"],
          body: `
Search looks through all of your lab's jobs, including finished ones, so you can use it for old cases too.

## Search for something

1. Click the search box in the sidebar, or press **⌘K** (**Ctrl+K** on Windows) or **/** on any page. On a phone, tap the magnifying glass at the top.
2. Type at least two characters.
3. Click a result, or use the arrow keys and press **Enter**. Gepeto opens it on the right page.

## What you can search for

- Case numbers. You don't have to type them exactly: "lab2042" finds LAB-2042.
- Return numbers, such as RET-1001.
- Office and driver names.
- Item descriptions and addresses.
`,
        },
        {
          slug: "alerts-and-notifications",
          title: "Alerts and notifications",
          summary: "Choose how Gepeto tells you about messages, driver updates and late jobs.",
          related: ["lab-settings", "read-the-dashboard", "create-a-job"],
          body: `
Gepeto alerts you on screen and can also notify you when you're working somewhere else.

## Alerts inside Gepeto

While Gepeto is open, a pop-up and a chime tell you when a driver accepts, rejects or delivers a job, when someone sends a message, and when an office requests a pickup. Click an alert to go straight to it.

Unread messages also show as a count beside **Jobs** in the sidebar and on the Gepeto browser tab.

## Turn on desktop notifications

Desktop notifications reach you when Gepeto is in another tab or window.

1. Go to [Settings](/settings) and open **Notifications**.
2. Under **Message Alerts**, turn on **Desktop notifications**.
3. If your browser asks, allow notifications.

These settings apply to that browser only, so repeat them on each computer. The Gepeto tab has to stay open, even if it's in the background.

> Notifications show who a message is from and which case it's about, but never the message itself. Nothing sensitive sits on a shared screen.

## Turn the chime on or off

Use **Sound for new messages** under **Message Alerts**. This also applies only to that browser.

## Late and unassigned job alerts

Gepeto can email you when a job has no driver or is running late. To set the times, see [Set alert times](/help/lab-settings#set-alert-times).
`,
        },
      ],
    },
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
      title: "Drivers",
      articles: [
        {
          slug: "manage-drivers",
          title: "Add and manage drivers",
          summary: "Invite drivers, edit their details, take them off the roster and follow breaks.",
          related: ["create-a-job", "plan-and-billing", "lab-settings"],
          body: `
Your drivers use the Gepeto driver app on their phones. You add and manage them on the [Drivers](/drivers) page.

## Add a driver

1. Go to [Drivers](/drivers) and click **Add Driver**.
2. Enter their full name, phone number and email address.
3. Choose **Available** or **Off Duty** as their starting status.
4. Click **Add Driver**.

Gepeto emails the driver an invite to set a password. They then log in to the driver app with that email address and password.

If your plan's driver spots are full, Gepeto tells you when you try to add someone. See [Driver spots](/help/plan-and-billing#driver-spots).

## If a driver didn't get the invite

On the driver's row, click the button labeled **Resend account-setup email** when you hover over it. Ask them to check their spam folder too.

## What each status means

- **Available:** ready for work.
- **On Delivery:** currently out on a delivery.
- **Off Duty:** not working, and not offered for new jobs.

## Edit or deactivate a driver

Use the buttons on the driver's row to edit their details or deactivate them. A deactivated driver is set to **Off Duty** and doesn't appear when you assign jobs. Use **Reactivate** to bring them back.

> Off Duty drivers don't use a spot on your plan. Reactivating one takes a spot again.

## Follow a driver's break

Drivers can pause location sharing from the app when they take a break. You'll see when the break started and no location until they end it. Offices see only "Location paused", with nothing about a break.

To flag long breaks, see [Set alert times](/help/lab-settings#set-alert-times).
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

## Help for offices

Offices have their own guide. Once they've entered their code, they can open it from the **?** at the top of their tracking page.
`,
        },
      ],
    },
    {
      title: "Settings and billing",
      articles: [
        {
          slug: "lab-settings",
          title: "Set up your lab",
          summary: "Set lab details, alert times, office alerts and proof of delivery rules.",
          related: ["alerts-and-notifications", "invite-teammates", "plan-and-billing"],
          body: `
Lab-wide choices live in [Settings](/settings). Your own name, role and email are under **Profile**.

## Enter your lab's details

1. Open **Lab Info** in Settings.
2. Enter your lab's name, phone and address.
3. Set your opening and closing times and your time zone.
4. Save your changes.

Your lab's phone number is what offices see on the **Call the lab** button on their tracking page.

## Set alert times

Open **Notifications** in Settings to turn on each alert and choose its time, then click **Save Changes**.

- **Unassigned job threshold:** alerts you when a job still has no driver after this time.
- **Late delivery alert:** alerts you when a delivery runs past its expected time.
- **Long driver break:** flags a driver on the Dashboard and Drivers pages when a break passes this time.

## Choose alerts for offices

**Alerts for offices** lets offices get a chime, on-page notices and browser notifications for new messages, a driver arriving and deliveries. Each office chooses its own settings from the gear on its tracking page. Turn this off and the gear disappears for all of your offices.

## Set proof of delivery rules

Open **Proof of delivery** in Settings.

- **Require a photo on every delivery:** when this is off, drivers can still add a photo. Either way, they enter who received the case.
- **Keep photos for:** photos are deleted automatically after this time. The delivery record and the recipient's name stay.

> Choosing a shorter time deletes older photos that night.
`,
        },
        {
          slug: "invite-teammates",
          title: "Invite teammates",
          summary: "Give other people at your lab a dispatcher login.",
          related: ["lab-settings", "manage-drivers"],
          body: `
Teammates are people at your lab who use this dispatcher site. Drivers are added separately. See [Add a driver](/help/manage-drivers#add-a-driver).

## Invite someone

Only the lab owner can do this.

1. Go to [Settings](/settings) and open **Team**.
2. Click **+ Invite Teammate**.
3. Enter their name and email address, then click **Send Invite**.

They get an email with a link to set a password. If they didn't get it, the owner can resend it from the Team list.

## If an invite link has expired

Whoever opens an expired link is told to ask for a new one. Resend it from the Team list.
`,
        },
        {
          slug: "plan-and-billing",
          title: "Plan and billing",
          summary: "Check your plan and driver spots, and manage your subscription.",
          related: ["manage-drivers", "lab-settings"],
          body: `
Go to [Settings](/settings) and open **Plan & billing** to see your plan, status and driver spots.

## Your free trial

New labs start with a 30-day free trial. **Plan & billing** shows the date it ends. Add a card before then to keep Gepeto running. Without one, the subscription ends on that date.

## Driver spots

Each plan includes a set number of active drivers. If your spots are full, you can't add or reactivate a driver until you add a spot, upgrade or take another driver off duty. Off Duty drivers don't use a spot. See [Edit or deactivate a driver](/help/manage-drivers#edit-or-deactivate-a-driver).

## Manage your subscription

Click **Manage billing** to change your plan, add drivers or a card, see invoices or cancel. Only the lab owner can do this.

## If a payment fails

**Plan & billing** tells you when your last payment didn't go through. Update your card there to keep Gepeto running.
`,
        },
      ],
    },
  ],
};
