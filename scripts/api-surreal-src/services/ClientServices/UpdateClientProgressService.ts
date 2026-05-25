import { surql, restPatch, normalizeRecord, normalizeRecords } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface Request {
  report: any;
  clientId: string | number;
}

const updateClientProgressService = async ({ report, clientId }: Request): Promise<any> => {
  const clientId_n = Number(clientId);
  const now = new Date().toISOString();

  // Update report fields
  const reportUpdates: Record<string, any> = { updated_at: now };
  if (report.progress !== undefined) reportUpdates.progress = report.progress;
  if (report.compare !== undefined) reportUpdates.compare = report.compare;
  if (report.deletetionsLists !== undefined) reportUpdates.deletions_lists = report.deletetionsLists;
  if (report.accounts !== undefined) reportUpdates.accounts = report.accounts;
  if (report.alternateLetters !== undefined) reportUpdates.alternate_letters = report.alternateLetters;
  if (report.newVersion !== undefined) reportUpdates.new_version = report.newVersion;

  await restPatch('api_reports', clientId_n, reportUpdates);

  const [clientRows, reportRows, extraInfoRows] = await Promise.all([
    surql(`SELECT id, first_name, last_name, address, ssn, dob, dl_id, ssn_id,
             poa_id, poa2_id, poa3_id, names, addresses, employers, has_file, next_reminder
           FROM api_clients:${clientId_n} LIMIT 1`),
    surql(`SELECT * FROM api_reports WHERE client_id = ${clientId_n} LIMIT 1`),
    surql(`SELECT id, name, value FROM extra_infos WHERE client_id = ${clientId_n}`),
  ]);

  if (!clientRows.length) throw new AppError('ERR_NO_CLIENT_FOUND', 404);

  const client = normalizeRecord(clientRows[0]);
  const rpt = reportRows[0];

  return {
    ...client,
    UserId: client.user_id,
    nextReminder: client.next_reminder,
    hasFile: client.has_file,
    extraInfo: normalizeRecords(extraInfoRows),
    json: rpt ? {
      id: rpt.client_id, ClientId: clientId_n,
      username: rpt.username, password: rpt.password,
      reportType: rpt.report_type, newVersion: rpt.new_version,
      compare: rpt.compare ?? [], deletetionsLists: rpt.deletions_lists ?? [],
      progress: rpt.progress ?? [], accounts: rpt.accounts ?? [],
      alternateLetters: rpt.alternate_letters ?? [],
    } : null,
  };
};

export default updateClientProgressService;
