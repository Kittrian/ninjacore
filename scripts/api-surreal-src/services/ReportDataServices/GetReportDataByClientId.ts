import { surql, normalizeRecords } from '../../lib/surreal';
import { logger } from '../../utils/logger';

interface Request { ClientId: number; }

const GetReportDataByClientId = async ({ ClientId }: Request): Promise<any[]> => {
  const rows = await surql(
    `SELECT id, inquiry_partition, subscriber, trade_line_partition, credit_score,
       deletions_lists, key_date, origin, public_record_partition
     FROM report_data_entries WHERE client_id = ${ClientId}
     ORDER BY key_date DESC, created_at DESC`
  );
  if (!rows.length) logger.warn(`No ReportData found for ClientId ${ClientId}`);
  return normalizeRecords(rows).map((r: any) => ({
    id: r.id, ClientId,
    InquiryPartition: r.inquiry_partition ?? [],
    Subscriber: r.subscriber ?? [],
    TradeLinePartition: r.trade_line_partition ?? [],
    creditScore: r.credit_score ?? {},
    deletetionsLists: r.deletions_lists ?? [],
    keyDate: r.key_date,
    origin: r.origin ?? {},
    PulblicRecordPartition: r.public_record_partition ?? null,
  }));
};

export default GetReportDataByClientId;
