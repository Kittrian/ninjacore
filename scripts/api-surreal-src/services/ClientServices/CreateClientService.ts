import { surql, sEsc, restPut, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';
import socketEmit from '../../helpers/socketEmit';
import CreateReportDataService from '../ReportDataServices/CreateReportDataService';

export interface ClientRequest {
  id?: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  addresses?: string;
  currentAddress?: string;
  names?: string;
  ssn: string;
  dob: Date | string;
  dl_id?: string | null;
  ssn_id?: string | null;
  poa_id?: string | null;
  poa2_id?: string | null;
  poa3_id?: string | null;
  lastssn: string | null;
  hasFile?: boolean;
  json: any;
  extraInfo?: any[];
  UserId: number;
  cover_sheet?: string;
  nextReminder?: Date | string | null;
  secret_question_name?: string;
  employers?: string;
  reportType?: string;
  username?: string;
  password?: string;
}

const CreateClientService = async (
  data: ClientRequest, generateReport = false
): Promise<any> => {
  const {
    id, first_name, last_name, phone, email, address, ssn, reportType, dob,
    dl_id, secret_question_name = '', ssn_id = null, poa_id = null,
    poa2_id = null, poa3_id = null, username, hasFile, password, addresses,
    names, employers = '', json, UserId, extraInfo = [], cover_sheet, nextReminder,
    currentAddress
  } = data;

  // Check for duplicate SSN
  const existing = await surql(`SELECT id FROM api_clients WHERE ssn = "${sEsc(ssn)}" LIMIT 1`);
  if (existing.length) throw new AppError('ERR_DUPLICATED_SSN_CLIENT');

  // Find next available numeric ID
  const lastRows = await surql(`SELECT id FROM api_clients ORDER BY id DESC LIMIT 1`);
  const newId = id ?? ((normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1);

  const now = new Date().toISOString();
  const nextReminderIso = nextReminder ? new Date(nextReminder as any).toISOString() : null;

  // Create client record
  const clientData: Record<string, any> = {
    user_id: UserId,
    first_name, last_name, phone: phone || '', email: email || '',
    current_address: currentAddress || '',
    address, addresses: addresses || '', names: names || '',
    ssn, dob: dob ? String(dob).split('T')[0] : '',
    secret_question_name, employers,
    dl_id: dl_id || '', ssn_id: ssn_id || '', poa_id: poa_id || '',
    poa2_id: poa2_id || '', poa3_id: poa3_id || '', cover_sheet: cover_sheet || '',
    next_reminder: nextReminderIso,
    has_file: hasFile ?? false,
    create_pdf: null,
    created_at: now, updated_at: now,
  };

  await restPut('api_clients', newId, clientData);
  const client = { id: newId, ...clientData };

  // Create the associated Report
  const reportUsername = json?.username ?? username ?? '';
  const reportPassword = json?.password ?? password ?? '';
  await restPut('api_reports', newId, {
    client_id: newId,
    username: reportUsername,
    password: reportPassword,
    report_type: reportType ?? json?.reportType ?? 'identity',
    deletions_lists: json?.deletetionsLists ?? [],
    compare: json?.compare ?? [],
    progress: json?.progress ?? [],
    accounts: json?.accounts ?? [],
    alternate_letters: json?.alternateLetters ?? [],
    new_version: json?.newVersion ?? true,
    created_at: now, updated_at: now,
  });

  // Create ExtraInfo records
  if (extraInfo.length) {
    const extraRows = await surql(`SELECT id FROM extra_infos ORDER BY id DESC LIMIT 1`);
    let nextExtraId = (normalizeRecord(extraRows[0] ?? {}).id ?? 0) + 1;
    for (const info of extraInfo) {
      if (info.id) {
        await restPut('extra_infos', info.id, {
          client_id: newId, name: info.name || '', value: info.value || '',
          created_at: now, updated_at: now,
        });
      } else {
        await restPut('extra_infos', nextExtraId++, {
          client_id: newId, name: info.name || '', value: info.value || '',
          created_at: now, updated_at: now,
        });
      }
    }
  }

  if (generateReport && json?.data) {
    for (const entry of json.data) {
      await CreateReportDataService(newId, entry);
    }
  }

  // Build return object matching expected shape
  const returnObj: any = {
    id: newId, ...clientData,
    UserId, nextReminder: nextReminderIso,
    hasFile: hasFile ?? false,
    extraInfo,
    json: {
      username: reportUsername, password: reportPassword,
      reportType: reportType ?? json?.reportType ?? 'identity',
      newVersion: json?.newVersion ?? true,
      compare: json?.compare ?? [], deletetionsLists: json?.deletetionsLists ?? [],
      progress: json?.progress ?? [], accounts: json?.accounts ?? [],
      alternateLetters: json?.alternateLetters ?? [],
    },
    username: reportUsername, password: reportPassword,
  };

  socketEmit({ tenantId: 'abay', type: 'contact:update', payload: returnObj });
  return returnObj;
};

export default CreateClientService;
