/**
 * Safe Math Utilities for handling decimal/string to number conversions
 * Prevents NaN and ensures type safety
 */

export const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? 0 : parsed;
};

export const safeMath = {
  /**
   * Add multiple values safely
   */
  add: (...values: any[]): number => 
    values.reduce((sum, val) => sum + toNum(val), 0),
  
  /**
   * Subtract two values safely
   */
  subtract: (a: any, b: any): number => 
    toNum(a) - toNum(b),
  
  /**
   * Multiply two values safely
   */
  multiply: (a: any, b: any): number => 
    toNum(a) * toNum(b),
  
  /**
   * Divide two values safely (returns 0 if divisor is 0)
   */
  divide: (a: any, b: any): number => {
    const divisor = toNum(b);
    return divisor === 0 ? 0 : toNum(a) / divisor;
  },
  
  /**
   * Check if a > b
   */
  isGreaterThan: (a: any, b: any): boolean => 
    toNum(a) > toNum(b),
  
  /**
   * Check if a < b
   */
  isLessThan: (a: any, b: any): boolean => 
    toNum(a) < toNum(b),
  
  /**
   * Check if a >= b
   */
  isGreaterOrEqual: (a: any, b: any): boolean => 
    toNum(a) >= toNum(b),
  
  /**
   * Check if a <= b
   */
  isLessOrEqual: (a: any, b: any): boolean => 
    toNum(a) <= toNum(b),
  
  /**
   * Format number to string with decimals
   */
  format: (val: any, decimals: number = 2): string => 
    toNum(val).toFixed(decimals),
  
  /**
   * Get minimum value
   */
  min: (...values: any[]): number => 
    Math.min(...values.map(toNum)),
  
  /**
   * Get maximum value
   */
  max: (...values: any[]): number => 
    Math.max(...values.map(toNum)),
};
