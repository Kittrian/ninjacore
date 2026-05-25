import { surql, normalizeRecord, normalizeRecords } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface Request {
  id: string | number;
  all?: any;
}

// Builds the full client object with nested report, extraInfo, and reportDataEntries
async function buildClientObject(client: any, all: boolean): Promise<any> {
  const clientId = client.id;

  // Fetch report
  const reportFields = all
    ? 'compare, deletions_lists, id, progress, report_type, accounts, alternate_letters, new_version, client_id'
    : 'password, username, report_type, client_id, new_version';

  const [reportRows, extraInfoRows, rdRows] = await Promise.all([
    surql(`SELECT ${reportFields} FROM api_reports WHERE client_id = ${clientId} LIMIT 1`),
    surql(`SELECT id, name, value FROM extra_infos WHERE client_id = ${clientId}`),
    surql(`SELECT id, inquiry_partition, subscriber, trade_line_partition, credit_score,
             deletions_lists, key_date, origin, public_record_partition
           FROM report_data_entries WHERE client_id = ${clientId}
           ORDER BY key_date DESC ${all ? '' : 'LIMIT 1'}`),
  ]);

  const rawReport = reportRows[0];
  const report = rawReport ? {
    id: rawReport.client_id,
    ClientId: clientId,
    username: rawReport.username,
    password: rawReport.password,
    reportType: rawReport.report_type,
    newVersion: rawReport.new_version,
    ...(all ? {
      compare: rawReport.compare ?? [],
      deletetionsLists: rawReport.deletions_lists ?? [],
      progress: rawReport.progress ?? [],
      accounts: rawReport.accounts ?? [],
      alternateLetters: rawReport.alternate_letters ?? [],
    } : {}),
  } : null;

  const extraInfo = normalizeRecords(extraInfoRows);
  const reportDataEntries = normalizeRecords(rdRows).map((r: any) => ({
    id: r.id,
    ClientId: clientId,
    InquiryPartition: safeJsonParse(r.inquiry_partition, []),
    Subscriber: safeJsonParse(r.subscriber, []),
    TradeLinePartition: safeJsonParse(r.trade_line_partition, []),
    creditScore: safeJsonParse(r.credit_score, {}),
    deletetionsLists: safeJsonParse(r.deletions_lists, []),
    keyDate: r.key_date,
    origin: safeJsonParse(r.origin, {}),
    PulblicRecordPartition: safeJsonParse(r.public_record_partition, null),
  }));

  const result: any = {
    ...client,
    UserId: client.user_id,
    nextReminder: client.next_reminder,
    hasFile: client.has_file,
    createPdf: client.create_pdf,
    extraInfo,
    json: report ? {
      ...report,
      data: reportDataEntries,
    } : null,
    username: report?.username ?? null,
    password: report?.password ?? null,
  };

  return result;
}

function safeJsonParse(v: any, fallback: any): any {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

const ShowClientService = async ({ id, all = false }: Request): Promise<any> => {
  const clientId = Number(id);
  const rows = await surql(`SELECT * FROM api_clients:${clientId} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_CLIENT_FOUND', 404);

  const client = normalizeRecord(rows[0]);
  return buildClientObject(client, !!all);
};

export default ShowClientService;
