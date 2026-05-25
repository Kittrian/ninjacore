import { surql, restPut, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface CreateReportDataRequest {
  keyDate: string;
  InquiryPartition: any;
  Subscriber: any;
  TradeLinePartition: any;
  creditScore: any;
  deletetionsLists: any;
  origin: any;
  PulblicRecordPartition?: any;
}

const CreateReportDataService = async (
  ClientId: number,
  data: CreateReportDataRequest
): Promise<any> => {
  const clientRows = await surql(`SELECT id FROM api_clients:${ClientId} LIMIT 1`);
  if (!clientRows.length) throw new AppError('ERR_CLIENT_NOT_FOUND', 404);

  const { keyDate, InquiryPartition, Subscriber, TradeLinePartition,
          creditScore, deletetionsLists, origin, PulblicRecordPartition } = data;

  let formattedKeyDate: string;
  try {
    const d = new Date(keyDate);
    if (isNaN(d.getTime())) throw new Error('Invalid date');
    formattedKeyDate = d.toISOString().split('T')[0];
  } catch {
    throw new AppError(`ERR_INVALID_KEYDATE_FORMAT: ${keyDate}`, 400);
  }

  const now = new Date().toISOString();

  // Find existing record for this client+keyDate
  const existing = await surql(
    `SELECT id FROM report_data_entries WHERE client_id = ${ClientId} AND key_date = "${formattedKeyDate}" LIMIT 1`
  );

  const payload = {
    client_id: ClientId,
    key_date: formattedKeyDate,
    inquiry_partition: InquiryPartition ?? [],
    subscriber: Subscriber ?? [],
    trade_line_partition: TradeLinePartition ?? [],
    credit_score: creditScore ?? {},
    deletions_lists: deletetionsLists ?? [],
    public_record_partition: PulblicRecordPartition ?? null,
    origin: origin ?? {},
  };

  if (existing.length) {
    const existingId = normalizeRecord(existing[0]).id;
    await restPatch('report_data_entries', existingId, { ...payload, updated_at: now });
    return { id: existingId, ClientId, ...payload };
  } else {
    const lastRows = await surql(`SELECT id FROM report_data_entries ORDER BY id DESC LIMIT 1`);
    const newId = (normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1;
    await restPut('report_data_entries', newId, { ...payload, created_at: now, updated_at: now });
    return { id: newId, ClientId, ...payload };
  }
};

export default CreateReportDataService;
