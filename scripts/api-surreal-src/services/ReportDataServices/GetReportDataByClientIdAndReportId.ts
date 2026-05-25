import { surql, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface Request { ClientId: number; ReportId: number; }

const GetReportDataByClientIdAndReportId = async ({ ClientId, ReportId }: Request): Promise<any> => {
  const rows = await surql(
    `SELECT * FROM report_data_entries:${ReportId} WHERE client_id = ${ClientId} LIMIT 1`
  );
  if (!rows.length) throw new AppError(`ReportData not found for ClientId ${ClientId} and ReportId ${ReportId}.`, 404);
  const r = normalizeRecord(rows[0]);
  return {
    id: r.id, ClientId,
    InquiryPartition: r.inquiry_partition ?? [],
    Subscriber: r.subscriber ?? [],
    TradeLinePartition: r.trade_line_partition ?? [],
    creditScore: r.credit_score ?? {},
    deletetionsLists: r.deletions_lists ?? [],
    keyDate: r.key_date,
    origin: r.origin ?? {},
    PulblicRecordPartition: r.public_record_partition ?? null,
  };
};

export default GetReportDataByClientIdAndReportId;
