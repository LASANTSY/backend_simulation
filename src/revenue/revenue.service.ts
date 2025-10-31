import AppDataSource from '../data-source';
import { Revenue } from '../entities/Revenue';

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
