import { z } from 'zod';

export const BureauSchema = z.enum(['transunion', 'experian', 'equifax']);
export type Bureau = z.infer<typeof BureauSchema>;

export const ClientItemSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  status: z.string(),
  phase: z.string(),
  monitoringAgency: z.string(),
  reportDate: z.string(),
  updatedAt: z.string().optional(),
  daysLeft: z.number().nullable().optional(),
});

export type ClientItem = z.infer<typeof ClientItemSchema>;

export const ClientListResponseSchema = z.object({
  statuses: z.array(z.string()),
  phases: z.array(z.string()),
  clients: z.array(ClientItemSchema),
});

export type ClientListResponse = z.infer<typeof ClientListResponseSchema>;

export const BureauUtilizationSchema = z.object({
  balanceTotal: z.number(),
  creditLimitTotal: z.number(),
  utilizationPercent: z.number().nullable(),
});

export type BureauUtilization = z.infer<typeof BureauUtilizationSchema>;

export const ClientDetailSchema = ClientItemSchema.extend({
  dob: z.string().optional(),
  ssn: z.string().optional(),
  address: z.string().optional(),
  creditScores: z.record(z.string()).optional(),
  creditScoresFound: z.boolean().optional(),
  bureauUtilization: z.record(BureauUtilizationSchema).optional(),
  bureauTotalDebt: z.record(z.number().nullable()).optional(),
  bureauAgeOfCredit: z.record(z.number().nullable()).optional(),
  bureauOnTimePayments: z.record(z.number().nullable()).optional(),
  openAccounts: z.array(z.unknown()).optional(),
  lastSyncedAt: z.string().optional(),
});

export type ClientDetail = z.infer<typeof ClientDetailSchema>;

export const ClientDetailResponseSchema = z.object({
  client: ClientDetailSchema,
});

export type ClientDetailResponse = z.infer<typeof ClientDetailResponseSchema>;
