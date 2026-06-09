'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
class QueryBuilder {
  constructor(modelQuery, query) {
    this.modelQuery = modelQuery
    this.query = query
  }
  //searching
  search(searchableFields) {
    var _a
    if (
      (_a = this === null || this === void 0 ? void 0 : this.query) === null ||
      _a === void 0
        ? void 0
        : _a.searchTerm
    ) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(field => ({
          [field]: {
            $regex: this.query.searchTerm,
            $options: 'i',
          },
        })),
      })
    }
    return this
  }
  //filtering
  filter() {
    const queryObj = { ...this.query }
    const excludeFields = [
      'searchTerm',
      'sort',
      'page',
      'limit',
      'fields',
      'withLocked',
      'showHidden',
      'download',
    ]
    excludeFields.forEach(el => delete queryObj[el])
    this.modelQuery = this.modelQuery.find(cleanObject(queryObj))
    return this
  }
  //sorting
  sort() {
    var _a
    const sort =
      ((_a = this === null || this === void 0 ? void 0 : this.query) === null ||
      _a === void 0
        ? void 0
        : _a.sort) || '-createdAt'
    this.modelQuery = this.modelQuery.sort(sort)
    return this
  }
  //pagination
  paginate() {
    var _a, _b
    const limit =
      Number(
        (_a = this === null || this === void 0 ? void 0 : this.query) ===
          null || _a === void 0
          ? void 0
          : _a.limit,
      ) || 10
    const page =
      Number(
        (_b = this === null || this === void 0 ? void 0 : this.query) ===
          null || _b === void 0
          ? void 0
          : _b.page,
      ) || 1
    const skip = (page - 1) * limit
    this.modelQuery = this.modelQuery.skip(skip).limit(limit)
    return this
  }
  //fields filtering
  fields() {
    var _a, _b
    const fields =
      ((_b =
        (_a = this === null || this === void 0 ? void 0 : this.query) ===
          null || _a === void 0
          ? void 0
          : _a.fields) === null || _b === void 0
        ? void 0
        : _b.split(',').join(' ')) || '-__v'
    this.modelQuery = this.modelQuery.select(fields)
    return this
  }
  //populating
  populate(populateFields, selectFields) {
    this.modelQuery = this.modelQuery.populate(
      populateFields.map(field => ({
        path: field,
        select: selectFields[field],
      })),
    )
    return this
  }
  //pagination information
  async getPaginationInfo() {
    var _a, _b
    const total = await this.modelQuery.model.countDocuments(
      this.modelQuery.getFilter(),
    )
    const limit =
      Number(
        (_a = this === null || this === void 0 ? void 0 : this.query) ===
          null || _a === void 0
          ? void 0
          : _a.limit,
      ) || 10
    const page =
      Number(
        (_b = this === null || this === void 0 ? void 0 : this.query) ===
          null || _b === void 0
          ? void 0
          : _b.page,
      ) || 1
    const totalPage = Math.ceil(total / limit)
    return {
      total,
      limit,
      page,
      totalPage,
    }
  }
}
function cleanObject(obj) {
  const cleaned = {}
  for (const key in obj) {
    const value = obj[key]
    // Skip null, undefined, empty string, empty array, or empty object
    if (
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== 'undefined' &&
      !(Array.isArray(value) && value.length === 0) &&
      !(
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      )
    ) {
      cleaned[key] = value
    }
  }
  return cleaned
}
exports.default = QueryBuilder
