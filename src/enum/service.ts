export enum SERVICE_STATUS {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum SERVICE_PRICING_TYPE {
  DAILY = 'DAILY',
  HOURLY = 'HOURLY',
  PACKAGE = 'PACKAGE',
}

export enum SERVICE_LOCATION_TYPE {
  ONSITE = 'ONSITE',
  REMOTE = 'REMOTE',
}

export enum PRICING_RULE_TYPE {
  PEAK_HOUR = 'peak_hour',
  WEEKEND = 'weekend',
  HOLIDAY = 'holiday',
  SEASONAL = 'seasonal',
  DURATION_DISCOUNT = 'duration_discount',
}

export enum PRICING_MODIFIER_TYPE {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
  MULTIPLIER = 'multiplier',
}
