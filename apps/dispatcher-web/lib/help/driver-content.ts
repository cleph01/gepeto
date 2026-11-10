import "server-only";
import type { HelpManual } from "./types";

// The driver app's help guide, served to signed-in drivers by GET /api/help.
// Changes here reach drivers without a new app release. When a driver feature
// changes, update its article. Links open other articles: [text](/help/slug).
export const driverGuide: HelpManual = {
  sections: [
    {
      title: "Getting started",
      articles: [
        {
          slug: "get-set-up",
          title: "Get set up",
          summary: "Sign in, allow location and choose your maps app.",
          related: ["location-and-breaks", "the-jobs-screen"],
          body: `
Your lab adds you to Gepeto and sends you an email to set your password.

## Sign in

1. Open the email from your lab and set a password.
2. Open the Gepeto driver app.
3. Enter your email address and password.

If the email never arrived, or you can't get in, ask your dispatcher to send a new one.

## Allow location

When the app asks, allow location access. Choose **Always** if you can, so the lab and office can still follow you while you're navigating in another app. See [Location and breaks](/help/location-and-breaks).

## Choose your maps app

1. Open the **Settings** tab.
2. Under **Navigation**, tap **Change** and choose your maps app.

Tap **Ask me each time instead** if you'd rather choose on every trip.
`,
        },
        {
          slug: "the-jobs-screen",
          title: "Read the Jobs screen",
          summary: "See what's new, what's in progress and what to do next.",
          related: ["accept-or-reject", "complete-a-delivery", "alerts-and-changes"],
          body: `
The **Jobs** tab shows only what's next. Finished work clears off on its own. Pull down to refresh it.

## The numbers at the top

- **Active:** jobs you're working on.
- **New jobs:** jobs waiting for your answer.
- **Delivered:** deliveries you've completed today.

The **Messages** card shows your unread messages. Tap it to open the newest one.

## The lists

- **Accept or reject:** jobs and pickups waiting for your answer. See [Accept or reject a job](/help/accept-or-reject).
- **In progress:** your current jobs, with the most urgent stop first. See [Complete a delivery](/help/complete-a-delivery).
- **Pickups & returns** or **Returning to lab:** cases going back to the lab. See [Pickups and returns](/help/pickups-and-returns).

## Due times

Each job shows when it's due. The time turns amber within the hour and red when it's late.
`,
        },
        {
          slug: "alerts-and-changes",
          title: "Alerts and changes",
          summary: "What the banners at the top of the screen mean.",
          related: ["the-jobs-screen", "messages"],
          body: `
A banner drops in over any screen when something changes. Banners only appear while the app is open, so check it regularly during your shift.

## What each banner means

- **New job** or **New pickup:** tap it to accept or reject.
- **Now STAT:** this job just became urgent, so re-plan your route.
- **No longer STAT:** the job is back to standard priority.
- **Delivery changed:** the job is going to a different office.
- **Due time changed:** the job has a new due time.
- **Moved to** a new status: dispatch changed the job's status.
- **Job removed:** dispatch gave the job to someone else, so it's left your list.
- **Job updated:** dispatch changed more than one detail.
- **Message from Lab** or **Message from Office:** tap it to open the conversation.
- **Return checked in:** the lab has your cases. Several check-ins close together share one banner. Tap it to see the details in History.
- **Lab counted 2, you logged 3** (with your numbers): the lab's count doesn't match yours, so talk to the front desk.
- **Check-in undone:** the return is back on your list until the lab checks it in again.
`,
        },
      ],
    },
    {
      title: "Deliveries",
      articles: [
        {
          slug: "accept-or-reject",
          title: "Accept or reject a job",
          summary: "Answer a new job so dispatch knows you have it.",
          related: ["complete-a-delivery", "the-jobs-screen"],
          body: `
New jobs wait under **Accept or reject** on the Jobs tab.

## Answer a job

1. Tap the job to see its details.
2. Tap **Accept** or **Reject**.

Dispatch can see your answer right away.

> If you reject a job, it goes back to dispatch to give to someone else. You'll still find it in [History](/help/history-and-photos).
`,
        },
        {
          slug: "complete-a-delivery",
          title: "Complete a delivery",
          summary: "Move a job from pickup to drop-off, and record who received it.",
          related: ["deliver-several-cases", "pickups-and-returns", "messages"],
          body: `
Each job shows one big button for the next step, so you always know what to tap.

## Follow the steps

1. **Mark picked up:** tap once the case is in your hands.
2. **Mark en route:** tap when you start driving to the office.
3. **Mark arrived:** tap when you reach the office.
4. **Complete delivery:** tap to finish at the door.

Tap **Navigate** on the job to open directions in your maps app.

Check the case details on the job for flags such as **Fragile** or **Temp sensitive**.

## Finish at the door

1. Tap **Complete delivery**.
2. Enter the **Recipient name**.
3. Take a photo of the drop-off if you can. Your lab may require one.
4. Answer **Bringing anything back to the lab?**. See [Pickups and returns](/help/pickups-and-returns).
5. Tap **Confirm delivery**.

> Show the box on the front desk or in the office. Keep labels and paperwork out of the photo, so patient names stay out of it.

## If something goes wrong

If you see **Photo didn't upload** or **Couldn't complete the delivery**, the delivery isn't marked yet. Check your signal and try again.
`,
        },
        {
          slug: "deliver-several-cases",
          title: "Deliver several cases at one stop",
          summary: "Handle every case for the same office with one tap.",
          related: ["complete-a-delivery", "pickups-and-returns"],
          body: `
Jobs going to the same office are grouped into one stop on the Jobs tab, showing the earliest due time.

## Move the whole stop along

Use the button on the stop to move its jobs together, such as **Mark all 3 picked up** at the lab. It only moves jobs you've accepted, so you may see something like **Mark 2 of 3 picked up**. Tap **Navigate** on the stop for directions.

## Finish at the door

1. Tap **Complete all 3 deliveries** (the number matches your stop).
2. Enter the **Recipient name** once. It's saved on every case.
3. Take one photo if you can. It covers the whole stop.
4. Answer **Bringing anything back to the lab?**.
5. Tap **Confirm 3 deliveries**.
`,
        },
      ],
    },
    {
      title: "Pickups and returns",
      articles: [
        {
          slug: "pickups-and-returns",
          title: "Pickups and returns",
          summary: "Log cases you collect from an office and drop them at the lab.",
          related: ["complete-a-delivery", "accept-or-reject"],
          body: `
Returns are cases going back to the lab, such as remakes, adjustments or new work. There are three ways to log them.

## At the end of a delivery

1. When you complete a delivery, tap **Yes** under **Bringing anything back to the lab?**.
2. Set how many cases you have.
3. Add case numbers or a note if you have them. Use case numbers only, not patient names.

## When the lab assigns you a pickup

1. You'll see **New pickup** as a banner, and the pickup waits under **Accept or reject**.
2. Tap **Accept**. If you can't take it, tap **Reject** and it goes back to dispatch.
3. At the office, tap **Log pickup**. The form is filled in from the office's request.
4. Check the details and tap **Log 2 cases** (the number matches your count).

## When you pick up without a delivery

1. On the Jobs tab, tap **Log a pickup for the lab**.
2. Choose the office under **Picked up from**.
3. Set how many cases you have, then tap **Log 2 cases** (the number matches your count).

## Drop them at the lab

1. When you're back at the lab, tap the **Dropped at lab** button.
2. Tap **Dropped off** to confirm.

The front desk then checks the cases in. A banner tells you when that's done, and the return moves from your Jobs tab to [History](/help/history-and-photos). If the lab's count is different from yours, the banner says so.

## Message about a pickup

Tap **Messages** on a pickup to talk with the lab and the office. New messages appear as a violet banner. If the pickup moves to another driver, the conversation goes with it.
`,
        },
      ],
    },
    {
      title: "Staying in touch",
      articles: [
        {
          slug: "messages",
          title: "Message the lab and office",
          summary: "Send a message about a job, use a one-tap reply, or message dispatch privately.",
          related: ["alerts-and-changes", "complete-a-delivery"],
          body: `
Each job has its own conversation. Both the lab and the office can read it.

## Send a message

1. Open the job and tap **Messages**.
2. Tap a quick reply, or type your message and tap the send button.

Quick replies send right away: **On my way**, **Running ~10 min late**, **Left at front desk** and **Call me**.

Pressing Return only starts a new line, so a stray tap won't send a half-written note.

> Use case numbers rather than patient names in messages.

## When you can't send

Once a job is delivered, its messages are read-only. If a job is given to someone else, its messages are hidden from you.

## Message dispatch privately

For anything just between you and the lab, such as running late on your whole route or needing a call, tap **Dispatch** at the top of the Jobs screen. Only the lab's dispatch sees that conversation. Offices never do.

- A red number on **Dispatch** means dispatch has written to you. A banner also shows if the app is open.
- Dispatch may tag a message with a case number when it's about one job.
- For anything the office should see too, use the job's own **Messages** instead.
`,
        },
        {
          slug: "location-and-breaks",
          title: "Location and breaks",
          summary: "When your location is shared, and how to pause it.",
          related: ["get-set-up", "the-jobs-screen"],
          body: `
Your location only needs to be shared while you're working.

## Who can see your location

- **Your lab:** once you've accepted a job or pickup, or while you're carrying cases.
- **An office:** only while you're carrying one of its cases.

## Keep sharing while you navigate

If you see **Your location stops when you leave Gepeto**, tap it to open your phone's Settings and set Location to **Always**. This keeps the lab and office updated while you're in your maps app or your phone is locked, and only while you have work on board.

## Take a break

1. On the Jobs tab, tap **Take a break**. Your location pauses until you end the break, even if the app is closed.
2. When you're ready, tap **End break**.

Dispatch sees when your break started, but no location. Offices see only "Location paused" and nothing about a break.

If you see **Your break didn't start** or **Your break didn't end**, check your signal and try again.
`,
        },
        {
          slug: "history-and-photos",
          title: "History and drop-off photos",
          summary: "Find past deliveries, rejected jobs, checked-in returns and your photos.",
          related: ["complete-a-delivery", "accept-or-reject", "pickups-and-returns"],
          body: `
The **History** tab lists every delivery, rejected job and checked-in return from the last 30 days, grouped by day. Tap **Load older jobs** to go further back.

## See a checked-in return

Returns are marked **Returned**. Tap one to see when you picked it up and dropped it off, when the lab checked it in, and the lab's count. If the lab's count is different from yours, the row is marked in amber.

## See a drop-off photo

If an office says a case never arrived, the photo can settle it.

1. Open the **History** tab. A camera icon marks deliveries with a photo.
2. Tap the delivery to view its photo.

> Photos stay in the app for 7 days after delivery. After that, ask dispatch, because the lab keeps the record.
`,
        },
      ],
    },
  ],
};
