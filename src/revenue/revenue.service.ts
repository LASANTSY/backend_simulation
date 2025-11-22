import AppDataSource from '../data-source';
import { Revenue } from '../entities/Revenue';
import transactionService from '../integrations/transaction.service';

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

export class RevenueService {
  private repo = AppDataSource.getRepository(Revenue);

  async findAll(municipalityId?: string): Promise<Revenue[]> {
    if (municipalityId) {
      return this.repo.find({ where: { municipalityId }, order: { date: 'ASC' } as any } as any);
    }
    return this.repo.find({ order: { date: 'ASC' } });
  }

  async findOne(id: string): Promise<Revenue | null> {
    return this.repo.findOneBy({ id });
  }

  async create(data: Partial<Revenue>): Promise<Revenue> {
    const entity = this.repo.create(data as any);
    return (this.repo.save(entity as any) as unknown) as Promise<Revenue>;
  }

  // Synchronize external transactions for a municipality
  async syncFromExternal(municipalityId: string) {
    const report: any = { fetched: 0, inserted: 0, duplicates: 0, errors: [] };
    if (!municipalityId) {
      report.errors.push('municipalityId required');
      return report;
    }

    // Fetch with retries (max 3)
    let external: any = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        external = await transactionService.fetchTransactions(municipalityId);
        break;
      } catch (err: any) {
        console.warn(`[RevenueService.sync] fetchTransactions attempt #${attempt} failed:`, err?.message || String(err));
        if (attempt === maxAttempts) {
          report.errors.push(`fetchTransactions failed after ${maxAttempts} attempts: ${String(err)}`);
          return report;
        }
        await sleep(300 * attempt);
      }
    }

    // external may be { message, data: [...] } or directly an array
    const txs = Array.isArray(external) ? external : (external?.data ?? []);
    report.fetched = Array.isArray(txs) ? txs.length : 0;
    if (!Array.isArray(txs) || txs.length === 0) return report;

    // Transform transactions into revenue-like objects
    const today = new Date().toISOString().slice(0, 10);
    const transformed = txs.map((t: any) => {
      const amount = Number(t?.amount ?? t?.montant ?? 0) || 0;
      const categoryName = t?.transactionType?.name ?? t?.name ?? 'Unknown';
      const source = t?.paymentMethod?.provider ?? t?.source ?? null;
      const mun = t?.transactionType?.municipality_id ?? municipalityId;
      return {
        amount: Number(amount),
        date: today,
        name: categoryName,
        source: source,
        municipalityId: String(mun),
        _raw: t,
      } as any;
    });

    // Deduplicate: load existing revenues for this municipality and date
    const repo = this.repo;

    try {
      await AppDataSource.manager.transaction(async (manager) => {
        const rrepo = manager.getRepository(Revenue);
        // Fetch existing revenues for municipality and today's date to minimize comparisons
        const existing = await rrepo.find({ where: { municipalityId, date: today } as any });
        const existingSet = new Set(existing.map(e => `${e.municipalityId}||${e.name}||${e.source || ''}||${Number(e.amount).toFixed(2)}||${e.date}`));

        const toInsert: Partial<Revenue>[] = [];
        for (const tx of transformed) {
          const key = `${tx.municipalityId}||${tx.name}||${tx.source || ''}||${tx.amount.toFixed(2)}||${tx.date}`;
          if (existingSet.has(key)) {
            report.duplicates++;
            continue;
          }
          // push to insert and add to existingSet to avoid duplicates within the batch
          toInsert.push({ date: tx.date, amount: tx.amount, source: tx.source, name: tx.name, municipalityId: tx.municipalityId, parameters: { external: true } });
          existingSet.add(key);
        }

        if (toInsert.length > 0) {
          // Bulk save for performance
          const created = toInsert.map(d => rrepo.create(d as any));
          const saved = await rrepo.save(created as any[]);
          report.inserted = saved.length;
        }
      });
    } catch (e: any) {
      console.error('[RevenueService.sync] transaction failed:', e?.message || String(e));
      report.errors.push(String(e));
    }

    return report;
  }

  async update(id: string, data: Partial<Revenue>): Promise<Revenue | null> {
    const existing = await this.repo.findOneBy({ id });
    if (!existing) return null;
    const merged = this.repo.create({ ...existing, ...data } as any);
    return (this.repo.save(merged as any) as unknown) as Promise<Revenue>;
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.repo.delete(id);
    return res.affected !== undefined && res.affected > 0;
  }
}
