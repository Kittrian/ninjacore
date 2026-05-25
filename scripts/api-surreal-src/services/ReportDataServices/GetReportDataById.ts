import { surql, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const GetReportDataById = async (id: number): Promise<any> => {
  const rows = await surql(`SELECT * FROM report_data_entries:${id} LIMIT 1`);
  if (!rows.length) throw new AppError(`ReportData ${id} not found.`, 404);
  const r = normalizeRecord(rows[0]);
  return {
    id: r.id, ClientId: r.client_id,
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

export default GetReportDataById;
