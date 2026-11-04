// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const officeAccess = require("@gepeto/db/office-access");

export const OFFICE_COLUMNS = ["id", "name", "address", "phone", "contact_name", "email", "tracking_token", "access_code_enc"];

type OfficeRow = {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  email: string | null;
  trackingToken: string;
  accessCodeEnc: string | null;
};

/** What the lab sees: the code readable, its stored form left out. */
export function officeForLab(row: OfficeRow) {
  const { accessCodeEnc, ...rest } = row;
  return { ...rest, accessCode: accessCodeEnc ? officeAccess.decryptCode(accessCodeEnc) as string : null };
}

/** Offices from before access codes get one the first time the lab loads them. */
export async function ensureAccessCode(row: OfficeRow): Promise<OfficeRow> {
  if (row.accessCodeEnc) return row;
  const accessCodeEnc = officeAccess.encryptCode(officeAccess.generateCode());
  const [updated] = await db("offices")
    .where({ id: row.id })
    .whereNull("access_code_enc")
    .update({ access_code_enc: accessCodeEnc })
    .returning(OFFICE_COLUMNS);
  // Another request got there first: use its code.
  return updated ?? db("offices").where({ id: row.id }).first(OFFICE_COLUMNS);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed address, null for blank, undefined when it isn't a valid email. */
export function cleanEmail(input: unknown): string | null | undefined {
  if (input === null || input === "") return null;
  if (typeof input !== "string") return undefined;
  const email = input.trim();
  if (!email) return null;
  return EMAIL.test(email) && email.length <= 254 ? email : undefined;
}
