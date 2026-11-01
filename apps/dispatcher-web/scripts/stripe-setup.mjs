// Creates (or updates) Gepeto's Stripe products, prices and the founding-lab
// code. Safe to re-run: everything is found by lookup key / id.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --live
//
// Prices match apps/landing/app/pricing/plans.ts and lib/plans.ts.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("Set STRIPE_SECRET_KEY");
if (key.startsWith("sk_live_") && !process.argv.includes("--live")) {
  throw new Error("That's a LIVE key. Re-run with --live if you really mean to create live prices.");
}
const stripe = new Stripe(key);

const PRODUCTS = [
  { id: "gepeto_starter", name: "Gepeto Starter", description: "2 active drivers included", prices: { starter_month: [9900, "month"], starter_year: [99000, "year"] } },
  { id: "gepeto_growth", name: "Gepeto Growth", description: "5 active drivers included", prices: { growth_month: [19900, "month"], growth_year: [199000, "year"] } },
  { id: "gepeto_pro", name: "Gepeto Pro", description: "12 active drivers included", prices: { pro_month: [34900, "month"], pro_year: [349000, "year"] } },
  { id: "gepeto_extra_driver", name: "Extra driver", description: "One more active driver (Starter and Growth)", prices: { extra_driver_month: [2500, "month"], extra_driver_year: [25000, "year"] } },
  { id: "gepeto_extra_driver_pro", name: "Extra driver (Pro)", description: "One more active driver on Pro", prices: { extra_driver_pro_month: [2000, "month"], extra_driver_pro_year: [20000, "year"] } },
];

for (const p of PRODUCTS) {
  let product;
  try {
    product = await stripe.products.retrieve(p.id);
    await stripe.products.update(p.id, { name: p.name, description: p.description, active: true });
  } catch {
    product = await stripe.products.create({ id: p.id, name: p.name, description: p.description });
  }
  for (const [lookupKey, [amount, interval]] of Object.entries(p.prices)) {
    const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0];
    if (existing && existing.unit_amount === amount && existing.recurring?.interval === interval && existing.product === p.id) {
      console.log(`ok      ${lookupKey}  $${amount / 100}/${interval}`);
      continue;
    }
    // New or changed price: Stripe prices can't be edited, so create one and
    // move the lookup key onto it. Existing subscribers keep their old price.
    await stripe.prices.create({
      product: product.id ?? p.id,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
    });
    console.log(`${existing ? "updated" : "created"} ${lookupKey}  $${amount / 100}/${interval}`);
  }
}

// Founding labs: 50% off for 12 months, code FOUNDINGLAB, 10 uses.
const COUPON = "founding_lab_50";
try {
  await stripe.coupons.retrieve(COUPON);
  console.log("ok      coupon founding_lab_50");
} catch {
  await stripe.coupons.create({ id: COUPON, name: "Founding lab: 50% off for 12 months", percent_off: 50, duration: "repeating", duration_in_months: 12 });
  console.log("created coupon founding_lab_50");
}
const codes = await stripe.promotionCodes.list({ code: "FOUNDINGLAB", limit: 1 });
if (codes.data.length) {
  console.log("ok      promotion code FOUNDINGLAB");
} else {
  await stripe.promotionCodes.create({ promotion: { type: "coupon", coupon: COUPON }, code: "FOUNDINGLAB", max_redemptions: 10 }).catch(async (err) => {
    // Older API shape
    if (String(err?.message ?? "").includes("promotion")) {
      await stripe.promotionCodes.create({ coupon: COUPON, code: "FOUNDINGLAB", max_redemptions: 10 });
    } else throw err;
  });
  console.log("created promotion code FOUNDINGLAB (10 uses)");
}
console.log("\nDone. Check Products and Coupons in the Stripe dashboard.");
