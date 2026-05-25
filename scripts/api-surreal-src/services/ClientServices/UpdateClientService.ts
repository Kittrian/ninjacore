import { surql, sEsc, restPut, restPatch, normalizeRecord, normalizeRecords } from '../../lib/surreal';
import AppError from '../../errors/AppError';
import socketEmit from '../../helpers/socketEmit';
import CreateReportDataService from '../ReportDataServices/CreateReportDataService';

interface Request {
  ClientData: any;
  clientId: string;
}

const UpdateClientService = async ({ ClientData, clientId }: Request, generateReport = false): Promise<any> => {
  const clientId_n = Number(clientId);
  const rows = await surql(`SELECT * FROM api_clients:${clientId_n} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_CLIENT_FOUND', 404);

  const { extraInfo, json, username, password, lastssn, ...clientDataToUpdate } = ClientData;
  const now = new Date().toISOString();

  // Build update payload (field name mapping from camelCase to snake_case)
  const fieldMap: Record<string, string> = {
    nextReminder: 'next_reminder', hasFile: 'has_file', createPdf: 'create_pdf',
    UserId: 'user_id', currentAddress: 'current_address',
  };

  const updates: Record<string, any> = { updated_at: now };
  for (const [k, v] of Object.entries(clientDataToUpdate)) {
    if (v !== undefined) {
      const mapped = fieldMap[k] ?? k;
      updates[mapped] = v;
    }
  }
  if (updates.next_reminder) {
    updates.next_reminder = new Date(updates.next_reminder).toISOString();
  }

  await restPatch('api_clients', clientId_n, updates);

  // Update Report
  const reportFields: Record<string, any> = { updated_at: now };
  if (username !== undefined) reportFields.username = username;
  if (password !== undefined) reportFields.password = password;
  if (json) {
    if (json.reportType !== undefined)       reportFields.report_type = json.reportType;
    if (json.newVersion !== undefined)       reportFields.new_version = json.newVersion;
    if (json.compare !== undefined)          reportFields.compare = json.compare;
    if (json.deletetionsLists !== undefined) reportFields.deletions_lists = json.deletetionsLists;
    if (json.progress !== undefined)         reportFields.progress = json.progress;
    if (json.accounts !== undefined)         reportFields.accounts = json.accounts;
    if (json.alternateLetters !== undefined) reportFields.alternate_letters = json.alternateLetters;
    if (json.username !== undefined)         reportFields.username = json.username;
    if (json.password !== undefined)         reportFields.password = json.password;
  }

  const existingReport = await surql(`SELECT * FROM api_reports WHERE client_id = ${clientId_n} LIMIT 1`);
  if (existingReport.length) {
    await restPatch('api_reports', clientId_n, reportFields);
  } else {
    await restPut('api_reports', clientId_n, {
      client_id: clientId_n,
      username: json?.username ?? username ?? '',
      password: json?.password ?? password ?? '',
      report_type: json?.reportType ?? 'identity',
      deletions_lists: json?.deletetionsLists ?? [],
      compare: json?.compare ?? [],
      progress: json?.progress ?? [],
      accounts: json?.accounts ?? [],
      alternate_letters: json?.alternateLetters ?? [],
      new_version: json?.newVersion ?? true,
      created_at: now, updated_at: now,
    });
  }

  // Update ExtraInfo
  if (extraInfo) {
    const newInfoIds = extraInfo.map((i: any) => i.id).filter(Boolean);
    const oldInfoRows = await surql(`SELECT id FROM extra_infos WHERE client_id = ${clientId_n}`);

    for (const info of extraInfo) {
      if (info.id) {
        await restPatch('extra_infos', info.id, {
          client_id: clientId_n, name: info.name, value: info.value, updated_at: now,
        });
      } else {
        const lastExtra = await surql(`SELECT id FROM extra_infos ORDER BY id DESC LIMIT 1`);
        const nextId = (normalizeRecord(lastExtra[0] ?? {}).id ?? 0) + 1;
        await restPut('extra_infos', nextId, {
          client_id: clientId_n, name: info.name, value: info.value,
          created_at: now, updated_at: now,
        });
      }
    }

    for (const old of normalizeRecords(oldInfoRows)) {
      if (!newInfoIds.includes(old.id)) {
        await surql(`DELETE extra_infos:${old.id}`);
      }
    }
  }

  if (generateReport && json?.data) {
    for (const entry of json.data) {
      await CreateReportDataService(clientId_n, entry);
    }
  }

  // Reload and return
  const [updatedRows, reportRows, extraInfoRows, rdRows] = await Promise.all([
    surql(`SELECT * FROM api_clients:${clientId_n} LIMIT 1`),
    surql(`SELECT * FROM api_reports WHERE client_id = ${clientId_n} LIMIT 1`),
    surql(`SELECT id, name, value FROM extra_infos WHERE client_id = ${clientId_n}`),
    surql(`SELECT id, inquiry_partition, subscriber, trade_line_partition, credit_score,
             deletions_lists, key_date, origin, public_record_partition
           FROM report_data_entries WHERE client_id = ${clientId_n}
           ORDER BY key_date DESC`),
  ]);

  const updatedClient = normalizeRecord(updatedRows[0] ?? rows[0]);
  const rpt = reportRows[0];
  const reportObj = rpt ? {
    id: rpt.client_id, ClientId: clientId_n,
    username: rpt.username, password: rpt.password,
    reportType: rpt.report_type, newVersion: rpt.new_version,
    compare: rpt.compare ?? [], deletetionsLists: rpt.deletions_lists ?? [],
    progress: rpt.progress ?? [], accounts: rpt.accounts ?? [],
    alternateLetters: rpt.alternate_letters ?? [],
    data: normalizeRecords(rdRows).map((r: any) => ({ id: r.id, ClientId: clientId_n, keyDate: r.key_date })),
  } : null;

  const returnObj: any = {
    ...updatedClient,
    UserId: updatedClient.user_id,
    nextReminder: updatedClient.next_reminder,
    hasFile: updatedClient.has_file,
    extraInfo: normalizeRecords(extraInfoRows),
    json: reportObj,
    username: rpt?.username ?? null,
    password: rpt?.password ?? null,
  };

  socketEmit({ tenantId: 'abay', type: 'contact:update', payload: returnObj });
  return returnObj;
};

export default UpdateClientService;
