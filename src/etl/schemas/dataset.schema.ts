import { z } from 'zod';

export const DataRecordSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  value: z.number(),
  source: z.object({
    name: z.string(),
    url: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export const DataSetSchema = z.array(DataRecordSchema);

export type DataRecord = z.infer<typeof DataRecordSchema>;
export type DataSet = z.infer<typeof DataSetSchema>;
