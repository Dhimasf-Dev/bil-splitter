"use client";

import React from "react";
import { Person, ParsedItem } from "@/lib/types";
import { formatRupiah } from "@/lib/format";
import { Plus, Trash2, Check, Sparkles } from "lucide-react";

interface ItemAssignerProps {
  items: ParsedItem[];
  setItems: React.Dispatch<React.SetStateAction<ParsedItem[]>>;
  people: Person[];
}

export function ItemAssigner({
  items,
  setItems,
  people,
}: ItemAssignerProps) {
  const togglePersonAssignment = (itemId: string, personId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.assignedTo.includes(personId);
        const nextAssigned = exists
          ? item.assignedTo.filter((id) => id !== personId)
          : [...item.assignedTo, personId];
        return { ...item, assignedTo: nextAssigned };
      })
    );
  };

  const toggleSelectAll = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const allSelected = item.assignedTo.length === people.length;
        return {
          ...item,
          assignedTo: allSelected ? [] : people.map((p) => p.id),
        };
      })
    );
  };

  const addItem = () => {
    const newItem: ParsedItem = {
      id: `item-manual-${Date.now()}`,
      name: `Item Baru ${items.length + 1}`,
      price: 0,
      assignedTo: people.map((p) => p.id),
    };
    setItems([...items, newItem]);
  };

  const deleteItem = (itemId: string) => {
    setItems(items.filter((i) => i.id !== itemId));
  };

  const updateItem = (itemId: string, field: "name" | "price", value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (field === "price") {
          const num = typeof value === "number" ? value : parseFloat(value) || 0;
          return { ...item, price: num };
        }
        return { ...item, name: value as string };
      })
    );
  };

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Item & Pembagian Biaya
              </h2>
              <p className="text-xs text-slate-400">
                Tekan nama anggota untuk membagi harga per item
              </p>
            </div>
          </div>

          <button
            onClick={addItem}
            className="h-9 px-3.5 flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all active:scale-95 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Item</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-3">
            <p className="text-sm">Belum ada item ditambahkan.</p>
            <button
              onClick={addItem}
              className="text-xs text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
            >
              Tambah item pertama
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const numAssigned = item.assignedTo.length;
              const perPersonShare = numAssigned > 0 ? item.price / numAssigned : 0;
              const isAllSelected = numAssigned === people.length;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      placeholder="Nama pesanan"
                      className="flex-1 min-w-[160px] bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-medium text-slate-100 focus:outline-none focus:border-emerald-500/60"
                    />

                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold">Rp</span>
                      <input
                        type="number"
                        step="500"
                        min="0"
                        value={item.price || ""}
                        onChange={(e) => updateItem(item.id, "price", e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus:border-emerald-500/60 text-right"
                      />
                    </div>

                    <button
                      onClick={() => toggleSelectAll(item.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                        isAllSelected
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {isAllSelected ? "Semua Person" : "Pilih Semua"}
                    </button>

                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Hapus Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {people.map((person) => {
                        const isAssigned = item.assignedTo.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            onClick={() => togglePersonAssignment(item.id, person.id)}
                            className={`h-8 px-2.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all border active:scale-95 ${
                              isAssigned
                                ? "bg-slate-800 border-slate-600 text-white shadow-sm"
                                : "bg-slate-900/40 border-slate-800/80 text-slate-500 opacity-50 hover:opacity-80"
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: person.color }}
                            />
                            <span>{person.name}</span>
                            {isAssigned && <Check className="w-3 h-3 text-emerald-400 ml-0.5" />}
                          </button>
                        );
                      })}
                    </div>

                    {numAssigned > 0 && (
                      <span className="text-xs text-slate-400 font-mono">
                        {formatRupiah(perPersonShare)} / person ({numAssigned})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400 font-medium">Subtotal Item:</span>
          <span className="text-slate-100 font-mono font-semibold">{formatRupiah(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
