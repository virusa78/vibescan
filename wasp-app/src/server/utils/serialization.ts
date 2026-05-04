/**
 * Utilities for serializing Prisma objects for client consumption
 * Converts Decimal fields to numbers for JSON serialization
 */

/**
 * Convert Prisma Decimal objects to numbers for JSON serialization
 * Also handles Date objects and nested structures
 */
export function serializeDecimalFields(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle Decimal objects (Prisma Decimal has a toNumber method)
  if (typeof obj.toNumber === 'function') {
    return obj.toNumber();
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimalFields);
  }

  // Handle plain objects - recursively serialize all properties
  const serialized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      serialized[key] = serializeDecimalFields(obj[key]);
    }
  }
  return serialized;
}
