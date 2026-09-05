export class BaseRepository {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }

  async findById(id, columns = '*') {
    return this.db(this.tableName)
      .where({ id, deleted_at: null })
      .select(columns)
      .first();
  }

  async findAll(filters = {}, options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', orderDir = 'desc' } = options;
    const offset = (page - 1) * limit;

    let query = this.db(this.tableName).where({ deleted_at: null });

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.where(key, value);
      }
    }

    const [data, total] = await Promise.all([
      query.clone().orderBy(orderBy, orderDir).limit(limit).offset(offset).select('*'),
      query.clone().count('* as count').first(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total: Number(total?.count || 0),
        totalPages: Math.ceil(Number(total?.count || 0) / limit),
      },
    };
  }

  async create(data) {
    const [id] = await this.db(this.tableName).insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('id');
    return this.findById(id);
  }

  async update(id, data) {
    await this.db(this.tableName)
      .where({ id, deleted_at: null })
      .update({ ...data, updated_at: new Date() });
    return this.findById(id);
  }

  async softDelete(id) {
    return this.db(this.tableName)
      .where({ id, deleted_at: null })
      .update({ deleted_at: new Date(), updated_at: new Date() });
  }

  async restore(id) {
    return this.db(this.tableName)
      .where({ id })
      .update({ deleted_at: null, updated_at: new Date() });
  }

  async hardDelete(id) {
    return this.db(this.tableName).where({ id }).delete();
  }

  async exists(id) {
    const result = await this.db(this.tableName)
      .where({ id, deleted_at: null })
      .select('id')
      .first();
    return !!result;
  }

  getQueryBuilder() {
    return this.db(this.tableName).where({ deleted_at: null });
  }
}

export default BaseRepository;