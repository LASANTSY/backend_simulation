import 'reflect-metadata';
import * as dotenv from 'dotenv';
import PipelineService from './pipeline.service';

dotenv.config();

(async () => {
  try {
    await PipelineService.runOnce();
    console.log('ETL runOnce completed');
    process.exit(0);
  } catch (e) {
    console.error('ETL runOnce failed:', (e as Error).message);
    process.exit(1);
  }
})();
