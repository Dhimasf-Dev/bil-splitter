"use client";

import React, { useEffect, useState } from "react";
import { Person, ParsedItem, BillSummary, PaymentAccount } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import confetti from "canvas-confetti";
import {
  Receipt,
  Check,
  Share2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SummaryCardProps {
  people: Person[];
  items: ParsedItem[];
  tax: number;
  tip: number;
  discount: number;
  paymentAccounts?: PaymentAccount[];
}

export function SummaryCard({
  people,
  items,
  tax,
  tip,
  discount,
  paymentAccounts,
}: SummaryCardProps) {
  const [copied, setCopied] = useState(false);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);

  useEffect(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {}
  }, []);

  const rawSubtotal = items.reduce((acc, item) => acc + item.price, 0);

  const summaries: BillSummary[] = people.map((person) => {
    const personItems: { name: string; sharePrice: number }[] = [];
    let personSubtotal = 0;

    items.forEach((item) => {
      if (item.assignedTo.includes(person.id)) {
        const count = item.assignedTo.length;
        const share = count > 0 ? item.price / count : 0;
        personSubtotal += share;
        personItems.push({
          name: item.name + (count > 1 ? ` (1/${count})` : ""),
          sharePrice: share,
        });
      }
    });

    const proportion = rawSubtotal > 0 ? personSubtotal / rawSubtotal : 1 / people.length;
    const taxShare = tax * proportion;
    const tipShare = tip * proportion;
    const discountShare = discount * proportion;
    const total = Math.max(0, personSubtotal + taxShare + tipShare - discountShare);

    return {
      personId: person.id,
      personName: person.name,
      itemsSubtotal: personSubtotal,
      taxShare,
      tipShare,
      discountShare,
      total,
      items: personItems,
    };
  });

  const grandTotal = summaries.reduce((acc, s) => acc + s.total, 0);

  const generateFormattedText = () => {
    let txt = `🧾 RINCIAN PATUNGAN\n`;
    txt += `      Total Tagihan: ${formatRupiah(grandTotal)}\n`;
    txt += `----------------------------------------\n\n`;

    summaries.forEach((s) => {
      txt += `👤 ${s.personName}\n`;
      s.items.forEach((i) => {
        txt += `   - ${i.name}: ${formatRupiah(i.sharePrice)}\n`;
      });

      txt += `   Total: ${formatRupiah(s.total)}\n\n`;
    });

    const validAccounts = paymentAccounts?.filter(
      (acc) => acc.bankName.trim() || acc.accountNumber.trim() || acc.accountHolder.trim()
    ) || [];

    if (validAccounts.length > 0) {
      txt = txt.trimEnd() + "\n\n";
      txt += `----------------------------------------\n`;
      txt += `💳 Informasi Pembayaran:\n`;
      validAccounts.forEach((acc) => {
        let accLine = `   - `;
        if (acc.bankName.trim()) {
          accLine += `${acc.bankName.trim()}`;
        }
        if (acc.accountNumber.trim()) {
          accLine += acc.bankName.trim() ? `: ${acc.accountNumber.trim()}` : `${acc.accountNumber.trim()}`;
        }
        if (acc.accountHolder.trim()) {
          accLine += ` (a.n. ${acc.accountHolder.trim()})`;
        }
        txt += `${accLine}\n`;
      });
    }

    txt = txt.trimEnd() + "\n\n";
    txt += `Powered by Bill Splitter`;
    return txt;
  };

  const copyToClipboard = () => {
    const text = generateFormattedText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Total Tagihan Patungan
              </span>
              <h2 className="text-2xl font-bold text-slate-100 font-mono">
                {formatRupiah(grandTotal)}
              </h2>
            </div>
          </div>

          <button
            onClick={copyToClipboard}
            className="h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Tersalin ke Clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Salin Rincian ke WhatsApp</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-400">Subtotal Item:</span>
            <p className="text-slate-200 font-mono font-medium">{formatRupiah(rawSubtotal)}</p>
          </div>

          <div>
            <span className="text-slate-400">Jumlah Person:</span>
            <p className="text-slate-200 font-mono font-medium">{people.length} Person</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map((summary) => {
          const personObj = people.find((p) => p.id === summary.personId);
          const isExpanded = expandedPerson === summary.personId;

          return (
            <div
              key={summary.personId}
              className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-5 shadow-xl transition-all hover:border-slate-700 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-slate-950 shadow-md shrink-0"
                    style={{ backgroundColor: personObj?.color || "#10B981" }}
                  >
                    {summary.personName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 text-base">
                      {summary.personName}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {summary.items.length} pesanan
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {formatRupiah(summary.total)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setExpandedPerson(isExpanded ? null : summary.personId)}
                className="w-full pt-2 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 border-t border-slate-800/80 transition-colors"
              >
                <span>{isExpanded ? "Sembunyikan rincian" : "Lihat rincian pesanan"}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isExpanded && (
                <div className="space-y-2 pt-2 text-xs border-t border-slate-800/60 bg-slate-950/40 p-3 rounded-xl">
                  {summary.items.length === 0 ? (
                    <p className="text-slate-500 italic">Belum ada pesanan.</p>
                  ) : (
                    summary.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300">
                        <span className="truncate pr-2">{it.name}</span>
                        <span className="font-mono text-slate-200">{formatRupiah(it.sharePrice)}</span>
                      </div>
                    ))
                  )}



                  {summary.discountShare > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Diskon</span>
                      <span className="font-mono">-{formatRupiah(summary.discountShare)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
