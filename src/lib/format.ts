/**
 * Formats a number to Indonesian Rupiah (e.g. 50000 -> "Rp 50.000")
 */
export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  return `Rp ${rounded.toLocaleString("id-ID")}`;
}

/**
 * Formats a number/string to dot-separated thousands (e.g., 100000 -> "100.000")
 */
export function formatNumberWithDots(val: number | string): string {
  if (val === undefined || val === null || val === 0 || val === "0" || val === "") return "";
  const numStr = typeof val === "number" ? val.toString() : val.replace(/\D/g, "");
  if (!numStr) return "";
  const num = parseInt(numStr, 10);
  return isNaN(num) ? "" : num.toLocaleString("id-ID");
}

/**
 * Parses a dot-separated string back to a number
 */
export function parseNumberFromDots(val: string): number {
  const cleaned = val.replace(/\./g, "").replace(/\D/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

