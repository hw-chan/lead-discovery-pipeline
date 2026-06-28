import { z } from "zod";

export const createJobSchema = z.object({
  companies: z.array(z.string().min(1)).min(1),
  roles: z.array(z.string().min(1)).min(1),
  region: z.string().min(1),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
