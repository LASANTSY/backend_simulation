import AppDataSource from '../src/data-source';

(async () => {
  try {
    await AppDataSource.initialize();
    const repo = AppDataSource.getRepository('EconomicIndicator' as any);
    console.log('Connected. Deleting EconomicIndicator entries for MDG/MG...');
    const res = await repo.createQueryBuilder().delete().where('country IN (:...c)', { c: ['MDG', 'MG'] }).execute();
    console.log('Deleted rows:', res.affected);
    await AppDataSource.destroy();
  } catch (err) {
    console.error('Error clearing economic indicators:', err);
    process.exit(1);
  }
})();
