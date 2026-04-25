import { z } from "zod";

export const dashboardHealthActionSchema = z.object({
  action: z.enum([
    "refresh_cache",
    "validate_google_sheet",
    "create_snapshot",
    "test_price_providers",
  ]),
  replaceExisting: z.boolean().optional(),
  date: z.string().trim().optional(),
});

export type DashboardHealthActionInput = z.infer<typeof dashboardHealthActionSchema>;
