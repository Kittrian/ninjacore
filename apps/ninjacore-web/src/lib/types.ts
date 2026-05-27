// Subset of fields returned by the Rust ninjacore /api/clients endpoint.
// Mirrors server.mjs toClientListItem / toSafeClient shapes for the parts
// the new frontend actually displays.

export type Bureau = 'transunion' | 'experian' | 'equifax';

export type BureauScores = Partial<Record<Bureau, string>>;
export type BureauNumberMap = Partial<Record<Bureau, number | null>>;
export type BureauUtilization = Partial<
  Record<
    Bureau,
    { balanceTotal: number; creditLimitTotal: number; utilizationPercent: number | null }
  >
>;

export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  phase: string;
  phone: string;
  monitoringAgency: string;
  reportDate: string;
  updatedAt?: string;
  /** Days until next credit-report import. Negative = overdue. */
  daysLeft?: number | null;
};

export type ClientDetail = ClientListItem & {
  dob?: string;
  ssn?: string;
  address?: string;
  monitoringUsername?: string;
  creditScores?: BureauScores;
  creditScoresFound?: boolean;
  bureauUtilization?: BureauUtilization;
  bureauTotalDebt?: BureauNumberMap;
  bureauAgeOfCredit?: BureauNumberMap;
  bureauOnTimePayments?: BureauNumberMap;
  openAccounts?: unknown[];
  lastSyncedAt?: string;
};

export type ClientListResponse = {
  statuses: string[];
  phases: string[];
  clients: ClientListItem[];
};

export type ClientDetailResponse = {
  client: ClientDetail;
};
