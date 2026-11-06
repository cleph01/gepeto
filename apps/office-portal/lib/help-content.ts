import "server-only";

// The office guide, shown at /t/[token]/help once the access code has been
// entered. When something on the tracking page changes, update it here.
// Uses the same small Markdown set as the dispatcher help. Links stay on the
// page: [text](#heading-in-lowercase-with-dashes).
export const officeGuide = `
This page shows the cases your dental lab is sending you, where they are and what's been delivered. It updates on its own, so you don't need to refresh it.

## Follow a delivery

Your cases are on the **In progress** tab, grouped by driver. Each case shows where it is:

- **At the lab:** the case hasn't left yet.
- **Finding a new driver:** the lab is assigning someone else.
- **Driver assigned:** a driver has been chosen.
- **Driver accepted:** the driver has confirmed.
- **Picked up:** the driver has the case.
- **On the way:** the driver is heading to you.
- **Arrived:** the driver is at your office.

## See the driver on the map

A map appears once a driver is carrying one of your cases.

- **Last seen** or **Last known location:** the driver's phone hasn't updated recently, which can happen when it loses signal. Call the lab if you need an update.
- **Location paused:** your cases are still on the way. Call the lab if you need an update.

## Message the lab and driver

Click **Message** beside a driver to open the conversation. The lab and the driver can both read it. If that driver has several of your cases, use the **About** buttons to choose which case you mean.

> Use case numbers rather than patient names in messages.

## Request a pickup

Use this when you have cases going back to the lab, such as remakes, adjustments or new work.

1. Click **Request a pickup**.
2. Choose how many cases there are.
3. Add the case numbers if you have them. Use case numbers only, not patient names.
4. Choose **Ready now**, or **Ready after** and a time.
5. Add a note for the lab if it helps, such as where to find the cases.
6. Click **Request pickup**.

Your request appears under **Pickups for the lab**, where you can follow it until it's checked in at the lab. You can cancel it until a driver is assigned. After that, call the lab.

## Find a past delivery

1. Open the **Delivered** tab.
2. Choose **Today**, **Last 7 days**, **Last 30 days**, **Last 90 days** or **Custom** dates.

Each delivery shows who received it and any drop-off photo the driver took. The lab removes photos after a set time, but the delivery record stays.

## Get alerts

If your lab has turned on alerts, the gear at the top of the page lets you choose them for this computer:

- **Browser notifications:** alert you when this page is open but you're in another tab or window.
- **Chime:** plays a sound for new messages, and when a driver arrives or delivers.

## Your access code

Each device needs your office's access code once, and then stays unlocked for 30 days. Keep your link and code private, because anyone with both can see your office's deliveries.

If the link or code stops working, the lab may have reset it for security. Call the lab for a new one.
`;
