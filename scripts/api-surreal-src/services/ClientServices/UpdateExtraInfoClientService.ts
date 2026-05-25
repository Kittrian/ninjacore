import { surql, restPatch, restPut, normalizeRecord, normalizeRecords } from '../../lib/surreal';
import AppError from '../../errors/AppError';
import socketEmit from '../../helpers/socketEmit';

interface Request {
  ClientData: any;
  clientId: string;
}

const UpdateExtraInfoClientService = async ({ ClientData, clientId }: Request): Promise<any> => {
  const clientId_n = Number(clientId);
  const now = new Date().toISOString();

  const rows = await surql(`SELECT * FROM api_clients:${clientId_n} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_CLIENT_FOUND', 404);

  const { extraInfo, json, names, addresses, employers } = ClientData;

  await restPatch('api_clients', clientId_n, {
    has_file: true,
    create_pdf: now,
    names: names ?? '',
    addresses: addresses ?? '',
    employers: employers ?? '',
    updated_at: now,
  });

  if (extraInfo) {
    const newInfoIds = extraInfo.map((i: any) => i.id).filter((id: any) => typeof id === 'number');
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

  if (json) {
    const existingReport = await surql(`SELECT * FROM api_reports WHERE client_id = ${clientId_n} LIMIT 1`);
    const reportFields: Record<string, any> = { updated_at: now };
    if (json.progress !== undefined) reportFields.progress = json.progress;
    if (json.compare !== undefined) reportFields.compare = json.compare;
    if (json.accounts !== undefined) reportFields.accounts = json.accounts;

    if (existingReport.length) {
      await restPatch('api_reports', clientId_n, reportFields);
    } else {
      await restPut('api_reports', clientId_n, {
        client_id: clientId_n, username: '', password: '',
        report_type: 'identity', deletions_lists: [], compare: [], progress: [],
        accounts: [], alternate_letters: [], new_version: true,
        created_at: now, updated_at: now, ...reportFields,
      });
    }
  }

  const [updatedRows, reportRows, extraInfoRows] = await Promise.all([
    surql(`SELECT * FROM api_clients:${clientId_n} LIMIT 1`),
    surql(`SELECT * FROM api_reports WHERE client_id = ${clientId_n} LIMIT 1`),
    surql(`SELECT id, name, value FROM extra_infos WHERE client_id = ${clientId_n}`),
  ]);

  const client = normalizeRecord(updatedRows[0] ?? rows[0]);
  const rpt = reportRows[0];

  const returnObj = {
    ...client,
    UserId: client.user_id,
    nextReminder: client.next_reminder,
    hasFile: true,
    createPdf: now,
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

  socketEmit({ tenantId: 'abay', type: 'contact:update', payload: returnObj });
  return returnObj;
};

export default UpdateExtraInfoClientService;
