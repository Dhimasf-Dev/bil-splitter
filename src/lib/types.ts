export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface ParsedItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // Person IDs
  isTaxOrTip?: boolean;
}

export interface BillSummary {
  personId: string;
  personName: string;
  itemsSubtotal: number;
  taxShare: number;
  tipShare: number;
  discountShare: number;
  total: number;
  items: { name: string; sharePrice: number }[];
}

export interface PaymentAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface PersonDeduction {
  id: string;
  name: string;
  price: number;
  personId: string;
}

