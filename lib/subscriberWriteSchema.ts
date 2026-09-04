import { z } from "zod";

/**
 * What a client is allowed to send about a subscriber.
 *
 * Lives here rather than inside the API route so it can be read by something
 * other than the route — specifically by the test that checks it agrees with
 * `SUBSCRIBER_FIELD_POLICY`. The two used to be a schema and a hand-written
 * allow-list in the same file, silently disagreeing about six fields, and a
 * disagreement no test could see is what let `residence`, `dialCode`,
 * `phoneCountry`, `phoneE164`, `referrer` and `sourceDetail` be validated and
 * then discarded on the next line.
 *
 * Importing the route to test it is not an option — it pulls in firebase-admin
 * and a live credential check. This file is plain Zod and imports nothing else,
 * so both the route and the test can hold the same object.
 *
 * Validation only. Whether a field is *stored* is the policy table's question,
 * and passing this schema is not permission to write: the route filters the
 * parsed result through the policy afterwards.
 */

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .optional();

export const currencySchema = z.string().min(1).max(10);

export const subscriberCoreSchema = z.object({
  name:             z.string().min(1, "Name is required").max(200),
  phone:            z.string().max(50).optional().nullable(),
  package:          z.string().max(200).optional().nullable(),
  duration:         z.number().int().positive().optional(),
  source:           z.string().max(100).optional().nullable(),
  convincedBy:      z.string().max(200).optional().nullable(),
  convincedByUid:   z.string().max(128).optional().nullable(),
  paidShift:        z.string().max(200).optional().nullable(),
  notes:            z.string().max(2000).optional().nullable(),
  date:             dateSchema,
  startDate:        dateSchema,
  expiryDate:       dateSchema,
  currencyOriginal: currencySchema.optional(),
  lockedRate:       z.number().positive().optional(),
  totalPrice:       z.number().min(0).optional(),
  totalPriceUSD:    z.number().min(0).optional(),
  payment:          z.string().max(100).optional().nullable(),
  paymentMethodId:  z.string().max(100).optional().nullable(),
  gender:           z.enum(["male","female"]).optional().nullable(),
  age:              z.number().int().min(1).max(150).optional().nullable(),
  /**
   * The team name, denormalised onto the subscriber.
   *
   * Absent from this schema until now, so Zod stripped it before the allow-list
   * ever saw it — every subscriber created through the form came out with no
   * team, while all 51 imported ones have one. The team leaderboard reads this
   * field, which is why it scored new records nothing.
   */
  team:             z.string().max(200).optional().nullable(),
  teamId:           z.string().optional().nullable(),
  teamName:         z.string().max(200).optional().nullable(),
  // Extended profile fields
  residence:        z.string().max(100).optional().nullable(),
  phoneCountry:     z.string().max(10).optional().nullable(),
  dialCode:         z.string().max(10).optional().nullable(),
  phoneE164:        z.string().max(20).optional().nullable(),
  height:           z.number().positive().optional().nullable(),
  weight:           z.number().positive().optional().nullable(),
  goal:             z.string().max(500).optional().nullable(),
  referrer:         z.string().max(200).optional().nullable(),
  sourceDetail:     z.string().max(200).optional().nullable(),
  assignedSalesId:          z.string().max(128).optional().nullable(),
  assignedSalesName:        z.string().max(200).optional().nullable(),
  assignedNutritionistId:   z.string().max(128).optional().nullable(),
  assignedNutritionistName: z.string().max(200).optional().nullable(),
  assignedTeamId:           z.string().max(128).optional().nullable(),
  assignedTeamName:         z.string().max(200).optional().nullable(),
  assignmentType:           z.string().max(50).optional().nullable(),
});

/** The field names this schema accepts, for cross-checking against the policy. */
export const SUBSCRIBER_SCHEMA_FIELDS: readonly string[] = Object.keys(
  subscriberCoreSchema.shape
);
