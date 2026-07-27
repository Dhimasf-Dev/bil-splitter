import { ParsedItem } from "./types";

export interface OCRResult {
  items: ParsedItem[];
  subtotal: number | null;
  tax: number;
  tip: number;
  discount: number;
  rawText: string;
}

/**
 * Parses numeric price strings from Indonesian receipts (e.g. "Rp 45.000", "45.000", "150000", "25,000.00")
 */
function parsePriceValue(str: string): number {
  // Strip "Rp", "RP", "rp", and all internal spaces
  let cleaned = str.replace(/rp/gi, "").replace(/\s+/g, "").trim();

  // Handle dot thousands separator vs comma decimal (e.g. 50.000 or 50.000,00)
  if (cleaned.includes(".") && cleaned.includes(",")) {
    // Standard IDR 50.000,00
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    // Check if dot is thousands separator (e.g. 50.000 or 150.000)
    const parts = cleaned.split(".");
    if (parts[parts.length - 1].length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
  } else if (cleaned.includes(",")) {
    // Check if comma is thousands separator (e.g. 50,000)
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length === 3) {
      cleaned = cleaned.replace(/,/g, "");
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extracts line items, amounts, subtotal, tax, and tip from raw OCR string.
 */
export function parseReceiptText(text: string): OCRResult {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);

  const items: ParsedItem[] = [];
  let subtotal: number | null = null;
  let tax = 0;
  let tip = 0;
  let discount = 0;

  // Match Rupiah formats allowing spaces after dot/comma: Rp 45.000, Rp45000, 45.000, 150,000, 25000
  const priceRegexSource = /(?:Rp\.?|RP\.?|rp\.?)?\s*(?:[0-9]{1,3}(?:[.,]\s*[0-9]{3})+|[0-9]{4,})/i.source;
  const priceRegexGlobal = new RegExp(priceRegexSource, "gi");

  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase();

    // Check for tax / PB1 / PPN / service
    if (lowerLine.includes("tax") || lowerLine.includes("ppn") || lowerLine.includes("pb1") || lowerLine.includes("pajak")) {
      const matches = line.match(priceRegexGlobal);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const val = parsePriceValue(lastMatch);
        if (val > 0) tax = val;
      }
      return;
    }

    // Check for tip / service charge
    if (lowerLine.includes("tip") || lowerLine.includes("service") || lowerLine.includes("servis")) {
      const matches = line.match(priceRegexGlobal);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const val = parsePriceValue(lastMatch);
        if (val > 0) tip = val;
      }
      return;
    }

    // Check for subtotal
    if (lowerLine.includes("subtotal") || lowerLine.includes("sub total")) {
      const matches = line.match(priceRegexGlobal);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const val = parsePriceValue(lastMatch);
        if (val > 0) subtotal = val;
      }
      return;
    }

    // Check for discount / diskon / promo
    if (lowerLine.includes("discount") || lowerLine.includes("diskon") || lowerLine.includes("promo")) {
      const matches = line.match(priceRegexGlobal);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const val = parsePriceValue(lastMatch);
        if (val > 0) discount = val;
      }
      return;
    }

    // Ignore receipt headers/footers
    if (
      lowerLine.startsWith("total") ||
      lowerLine.startsWith("grand total") ||
      lowerLine.includes("kembali") ||
      lowerLine.includes("bayar") ||
      lowerLine.includes("cash") ||
      lowerLine.includes("tunai") ||
      lowerLine.includes("qr") ||
      lowerLine.includes("bca") ||
      lowerLine.includes("mandiri") ||
      lowerLine.includes("terima kasih") ||
      lowerLine.includes("telp")
    ) {
      return;
    }

    // Extract item line (take the last price on the line as the price)
    const matches = line.match(priceRegexGlobal);
    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const price = parsePriceValue(lastMatch);

      if (price > 0) {
        // Option B: Clean all matched prices from the item name for clean results
        let itemName = line;
        matches.forEach((m) => {
          itemName = itemName.replace(m, "");
        });
        itemName = itemName.replace(/^[0-9]+\s*[xX]?\s*/, "").trim();

        if (itemName.length > 1) {
          items.push({
            id: `item-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
            name: itemName,
            price: price,
            assignedTo: [],
          });
        }
      }
    }
  });

  return {
    items,
    subtotal,
    tax,
    tip,
    discount,
    rawText: text,
  };
}

/**
 * Searches the raw OCR text specifically for the final Grand Total amount.
 */
export function findTotalInText(text: string): number {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const priceRegexSource = /(?:Rp\.?|RP\.?|rp\.?)?\s*(?:[0-9]{1,3}(?:[.,]\s*[0-9]{3})+|[0-9]{4,})/i.source;
  const priceRegexGlobal = new RegExp(priceRegexSource, "gi");

  // Keywords indicative of the grand total, ordered by specificity/likelihood
  const primaryKeywords = [
    "grand total",
    "total bayar",
    "total tagihan",
    "total bill",
    "total amount",
    "amount due",
    "net total",
    "jumlah total",
    "total akhir",
    "grandtotal"
  ];

  const secondaryKeywords = [
    "total",
    "jumlah",
    "bayar",
    "harga jual"
  ];

  const reversedLines = [...lines].reverse();

  // 1st pass: Look for lines containing primary keywords
  for (const line of reversedLines) {
    const lower = line.toLowerCase();
    if (primaryKeywords.some((kw) => lower.includes(kw))) {
      const matches = line.match(priceRegexGlobal);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const val = parsePriceValue(lastMatch);
        if (val > 0) return val;
      }
    }
  }

  // 2nd pass: Look for lines containing secondary keywords, avoiding subtotal, discount, change (kembali)
  for (const line of reversedLines) {
    const lower = line.toLowerCase();
    if (
      secondaryKeywords.some((kw) => lower.includes(kw)) &&
      !lower.includes("sub") &&
      !lower.includes("discount") &&
      !lower.includes("diskon") &&
      !lower.includes("promo") &&
      !lower.includes("kembali") &&
      !lower.includes("change")
    ) {
      const matches = line.match(priceRegexGlobal);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const val = parsePriceValue(lastMatch);
        if (val > 0) return val;
      }
    }
  }

  // 3rd pass: Fallback to any line containing "total" or "jumlah" or "bayar" with a price
  for (const line of reversedLines) {
    const lower = line.toLowerCase();
    if (lower.includes("total") || lower.includes("jumlah") || lower.includes("bayar")) {
      const matches = line.match(priceRegexGlobal);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const val = parsePriceValue(lastMatch);
        if (val > 0) return val;
      }
    }
  }

  return 0;
}

