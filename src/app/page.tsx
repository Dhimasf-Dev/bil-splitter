"use client";

import React, { useState, useEffect } from "react";
import { Person, ParsedItem, BillSummary, PaymentAccount, PersonDeduction } from "@/lib/types";
import { findTotalInText, parseReceiptText } from "@/lib/ocr";
import { formatRupiah, formatNumberWithDots, parseNumberFromDots } from "@/lib/format";
import { createWorker } from "tesseract.js";
import confetti from "canvas-confetti";
import {
  Users,
  Camera,
  Upload,
  Plus,
  Trash2,
  Check,
  Share2,
  Receipt,
  RefreshCw,
  UserPlus,
  X,
  Calculator,
  ListOrdered,
  CreditCard,
  ChevronDown,
} from "lucide-react";

const PRESET_COLORS = [
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

const PREDEFINED_BANKS = [
  "BCA",
  "Mandiri",
  "BNI",
  "BRI",
  "BSI",
  "Bank Jago",
  "Seabank",
  "CIMB Niaga",
  "Permata",
  "Danamon",
  "GoPay",
  "OVO",
  "Dana",
  "LinkAja",
  "ShopeePay",
];

export default function Home() {
  // Mode: "bundle" (Quick Total Split) vs "itemized" (Line-by-line)
  const [splitMode, setSplitMode] = useState<"bundle" | "itemized">("bundle");

  // 1. Bundle Mode Total State
  const [bundleTotal, setBundleTotal] = useState<number>(0);

  // 2. Group Members
  const [people, setPeople] = useState<Person[]>([]);

  // 3. Itemized Bill Items in Rupiah
  const [items, setItems] = useState<ParsedItem[]>([]);

  // 4. Payment Recipient Details (Supports Multi Account)
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([
    { id: `acc-default`, bankName: "", accountNumber: "", accountHolder: "" }
  ]);

  // 5. Personal deductions (Pengurangan Patungan) for itemized view
  const [deductions, setDeductions] = useState<PersonDeduction[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedPeople = localStorage.getItem("bill_splitter_people");
    const savedItems = localStorage.getItem("bill_splitter_items");
    const savedBundleTotal = localStorage.getItem("bill_splitter_bundleTotal");
    const savedSplitMode = localStorage.getItem("bill_splitter_splitMode");
    const savedPaymentAccounts = localStorage.getItem("bill_splitter_paymentAccounts");
    const savedDeductions = localStorage.getItem("bill_splitter_deductions");

    /* eslint-disable react-hooks/set-state-in-effect */
    if (savedPeople) setPeople(JSON.parse(savedPeople));
    if (savedItems) setItems(JSON.parse(savedItems));
    if (savedBundleTotal) setBundleTotal(parseFloat(savedBundleTotal) || 0);
    if (savedSplitMode) setSplitMode(savedSplitMode as "bundle" | "itemized");
    if (savedPaymentAccounts) {
      try {
        const parsed = JSON.parse(savedPaymentAccounts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPaymentAccounts(parsed);
        }
      } catch (e) {
        console.error("Error parsing payment accounts", e);
      }
    }
    if (savedDeductions) {
      try {
        setDeductions(JSON.parse(savedDeductions));
      } catch (e) {
        console.error("Error parsing deductions", e);
      }
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    setIsLoaded(true);
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem("bill_splitter_people", JSON.stringify(people));
    localStorage.setItem("bill_splitter_items", JSON.stringify(items));
    localStorage.setItem("bill_splitter_bundleTotal", bundleTotal.toString());
    localStorage.setItem("bill_splitter_splitMode", splitMode);
    localStorage.setItem("bill_splitter_paymentAccounts", JSON.stringify(paymentAccounts));
    localStorage.setItem("bill_splitter_deductions", JSON.stringify(deductions));
  }, [people, items, bundleTotal, splitMode, paymentAccounts, deductions, isLoaded]);

  // Auto-populate 2 members when total bill or items are added and no members exist
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isLoaded) return;
    if ((bundleTotal > 0 || items.length > 0) && people.length === 0) {
      const color1 = PRESET_COLORS[0];
      const color2 = PRESET_COLORS[1];
      const id1 = `p-${Date.now()}-1`;
      const id2 = `p-${Date.now()}-2`;
      const p1 = { id: id1, name: "", color: color1 };
      const p2 = { id: id2, name: "", color: color2 };
      setPeople([p1, p2]);

      // Assign the new people to existing items
      setItems((prev) =>
        prev.map((it) => {
          const newAssigned = [...it.assignedTo];
          if (!newAssigned.includes(id1)) newAssigned.push(id1);
          if (!newAssigned.includes(id2)) newAssigned.push(id2);
          return { ...it, assignedTo: newAssigned };
        })
      );
    }
  }, [bundleTotal, items, people.length, isLoaded]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Clear data handler
  const clearData = () => {
    setPeople([]);
    setItems([]);
    setBundleTotal(0);
    setSplitMode("bundle");
    setPaymentAccounts([
      { id: `acc-default`, bankName: "", accountNumber: "", accountHolder: "" }
    ]);
    setDeductions([]);
    localStorage.removeItem("bill_splitter_people");
    localStorage.removeItem("bill_splitter_items");
    localStorage.removeItem("bill_splitter_bundleTotal");
    localStorage.removeItem("bill_splitter_splitMode");
    localStorage.removeItem("bill_splitter_paymentAccounts");
    localStorage.removeItem("bill_splitter_deductions");
  };

  // Camera & OCR states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [copied, setCopied] = useState(false);

  // Unified Scan Modal & Batch OCR states
  const [showScanModal, setShowScanModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{ previewUrl: string; fileOrData: File | string }[]>([]);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // People Management
  const addPerson = () => {
    const newId = `p-${Date.now()}`;
    const color = PRESET_COLORS[people.length % PRESET_COLORS.length];
    const newP = { id: newId, name: "", color };
    setPeople((prev) => [...prev, newP]);
    setItems((prev) => prev.map((it) => ({ ...it, assignedTo: [...it.assignedTo, newId] })));
  };

  const removePerson = (id: string) => {
    if (people.length <= 1) return;
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => prev.map((it) => ({ ...it, assignedTo: it.assignedTo.filter((pId) => pId !== id) })));
    setDeductions((prev) => prev.filter((d) => d.personId !== id));
  };

  const updatePersonName = (id: string, name: string) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  // OCR Processing
  const processImages = async (images: { previewUrl: string; fileOrData: File | string }[]) => {
    setIsScanning(true);
    setScanProgress({ current: 1, total: images.length });
    setScanError(null);
    try {
      const worker = await createWorker(["eng", "ind"]);
      let totalSum = 0;
      const allNewItems: ParsedItem[] = [];

      for (let i = 0; i < images.length; i++) {
        setScanProgress({ current: i + 1, total: images.length });
        const src = images[i].fileOrData;
        const ret = await worker.recognize(src);

        if (splitMode === "bundle") {
          const totalVal = findTotalInText(ret.data.text);
          if (totalVal > 0) {
            totalSum += totalVal;
          }
        } else {
          let grandTotal = findTotalInText(ret.data.text);
          const parsed = parseReceiptText(ret.data.text);

          if (grandTotal === 0 && parsed.items.length > 0) {
            grandTotal = parsed.items.reduce((sum, item) => sum + item.price, 0);
          }

          if (grandTotal > 0) {
            const suffix = images.length > 1 ? ` Struk ${i + 1}` : "";
            allNewItems.push({
              id: `i-total-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
              name: `Total${suffix}`,
              price: grandTotal,
              assignedTo: people.map((p) => p.id),
            });
          }
        }
      }

      await worker.terminate();

      if (splitMode === "bundle") {
        if (totalSum > 0) {
          setBundleTotal((prev) => prev + totalSum);
        }
      } else {
        if (allNewItems.length > 0) {
          setItems((prev) => [...prev, ...allNewItems]);
        }
      }

      setSelectedImages([]);
      setShowScanModal(false);
      try { confetti({ particleCount: 40, spread: 50 }); } catch { }
    } catch (e) {
      console.error("OCR Error:", e);
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  // Camera stream controls
  const startCamera = async () => {
    setShowCameraModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      stopCamera();
      setSelectedImages((prev) => [...prev, { previewUrl: dataUrl, fileOrData: dataUrl }]);
    }
  };

  // Itemized item management
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `i-${Date.now()}`,
        name: "",
        price: 0,
        assignedTo: people.map((p) => p.id),
      },
    ]);
  };

  const updateItem = (id: string, field: "name" | "price", val: string | number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (field === "price") return { ...it, price: typeof val === "number" ? val : parseFloat(val) || 0 };
        return { ...it, name: val as string };
      })
    );
  };

  const toggleAssign = (itemId: string, personId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const exists = it.assignedTo.includes(personId);
        return {
          ...it,
          assignedTo: exists ? it.assignedTo.filter((p) => p !== personId) : [...it.assignedTo, personId],
        };
      })
    );
  };

  // Personal deduction management
  const addDeduction = () => {
    setDeductions((prev) => [
      ...prev,
      {
        id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: "",
        price: 0,
        personId: people[0]?.id || "", // Default to first person if available
      },
    ]);
  };

  const updateDeduction = (
    id: string,
    field: "name" | "price" | "personId",
    val: string | number
  ) => {
    setDeductions((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        if (field === "price") return { ...d, price: typeof val === "number" ? val : parseFloat(val) || 0 };
        return { ...d, [field]: val };
      })
    );
  };

  const removeDeduction = (id: string) => {
    setDeductions((prev) => prev.filter((d) => d.id !== id));
  };


  // Payment accounts management
  const addPaymentAccount = () => {
    setPaymentAccounts((prev) => [
      ...prev,
      {
        id: `acc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        bankName: "",
        accountNumber: "",
        accountHolder: "",
      },
    ]);
  };

  const removePaymentAccount = (id: string) => {
    setPaymentAccounts((prev) => prev.filter((acc) => acc.id !== id));
  };

  const updatePaymentAccount = (
    id: string,
    field: "bankName" | "accountNumber" | "accountHolder",
    val: string
  ) => {
    setPaymentAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, [field]: val } : acc))
    );
  };


  const itemizedSummaries: BillSummary[] = people.map((p, index) => {
    let pSubtotal = 0;
    const pItems: { name: string; sharePrice: number }[] = [];
    items.forEach((it) => {
      if (it.assignedTo.includes(p.id)) {
        const share = it.price / it.assignedTo.length;
        pSubtotal += share;
        pItems.push({ name: it.name, sharePrice: share });
      }
    });

    const personDeductions = deductions
      .filter((d) => d.personId === p.id)
      .reduce((acc, d) => acc + d.price, 0);

    const total = Math.max(0, pSubtotal - personDeductions);

    return {
      personId: p.id,
      personName: p.name || `Person ${index + 1}`,
      itemsSubtotal: pSubtotal,
      taxShare: 0,
      tipShare: 0,
      discountShare: personDeductions,
      total,
      items: pItems,
    };
  });

  const itemizedGrandTotal = items.reduce((a, item) => a + item.price, 0);
  const bundleSharePerPerson = people.length > 0 ? bundleTotal / people.length : 0;
  const activeGrandTotal = splitMode === "bundle" ? bundleTotal : itemizedGrandTotal;

  // Reliable Clipboard Copy for Mobile
  const copySummaryText = () => {
    let text = `🧾 RINCIAN PATUNGAN\n`;
    text += `      Total Tagihan: ${formatRupiah(activeGrandTotal)}\n`;
    text += `------------------------------\n\n`;

    if (splitMode === "bundle") {
      text += `Dibagi untuk ${people.length} orang: ${formatRupiah(bundleSharePerPerson)} / orang\n\n`;
      const hasDeductions = deductions.some((d) => d.price > 0);
      people.forEach((p, index) => {
        if (!hasDeductions) {
          text += `👤 ${p.name || `Person ${index + 1}`}: ${formatRupiah(bundleSharePerPerson)}\n`;
        } else {
          const personDeductions = deductions
            .filter((d) => d.personId === p.id)
            .reduce((acc, d) => acc + d.price, 0);
          const personTotal = Math.max(0, bundleSharePerPerson - personDeductions);

          text += `👤 ${p.name || `Person ${index + 1}`}\n`;
          text += `   - Bagi Rata: ${formatRupiah(bundleSharePerPerson)}\n`;
          if (personDeductions > 0) {
            const pDeductions = deductions.filter((d) => d.personId === p.id && d.price > 0);
            pDeductions.forEach((d) => {
              const dIdx = deductions.findIndex((x) => x.id === d.id);
              const displayName = d.name || `Diskon / Potongan ${dIdx + 1}`;
              text += `   - ${displayName}: -${formatRupiah(d.price)}\n`;
            });
          }
          text += `   TOTAL: ${formatRupiah(personTotal)}\n\n`;
        }
      });
    } else {
      itemizedSummaries.forEach((s) => {
        text += `👤 ${s.personName}\n`;
        s.items.forEach((i) => {
          text += `   - ${i.name}: ${formatRupiah(i.sharePrice)}\n`;
        });

        // Add personal deductions if any
        const pDeductions = deductions.filter((d) => d.personId === s.personId && d.price > 0);
        if (pDeductions.length > 0) {
          pDeductions.forEach((d) => {
            const dIdx = deductions.findIndex((x) => x.id === d.id);
            const displayName = d.name || `Diskon / Potongan ${dIdx + 1}`;
            text += `   - ${displayName}: -${formatRupiah(d.price)}\n`;
          });
        }

        text += `   TOTAL: ${formatRupiah(s.total)}\n\n`;
      });
    }

    const validAccounts = paymentAccounts.filter(
      (acc) => acc.bankName.trim() || acc.accountNumber.trim() || acc.accountHolder.trim()
    );

    if (validAccounts.length > 0) {
      text = text.trimEnd() + "\n\n";
      text += `------------------------------\n`;
      text += `💳 Informasi Pembayaran:\n`;
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
        text += `${accLine}\n`;
      });
    }

    text = text.trimEnd() + "\n\n";
    text += `Powered by Bill Splitter`;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed", e);
    }
    document.body.removeChild(el);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 selection:bg-emerald-500 selection:text-slate-950">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
                <span>Bill Splitter</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedImages([]);
                setShowScanModal(true);
              }}
              className="h-10 px-3 sm:px-3.5 rounded-xl bg-emerald-600 active:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Pindai Struk</span>
            </button>

            <button
              type="button"
              onClick={clearData}
              className="h-10 px-3.5 rounded-xl bg-red-950/40 border border-red-900/50 hover:bg-red-900/25 active:bg-red-900/35 text-red-400 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sleek Segmented Tab Control */}
      <div className="max-w-5xl mx-auto px-4 pt-4 relative z-20">
        <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex max-w-sm mx-auto shadow-md">
          <button
            type="button"
            onClick={() => setSplitMode("bundle")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${splitMode === "bundle"
              ? "bg-emerald-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
              }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Bagi Rata</span>
          </button>

          <button
            type="button"
            onClick={() => setSplitMode("itemized")}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${splitMode === "itemized"
              ? "bg-emerald-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
              }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Per Item</span>
          </button>
        </div>
      </div>

      {/* Main Container Grid */}
      <div className="max-w-5xl mx-auto px-4 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        {/* Left Column: Input Forms & Items */}
        <div className="lg:col-span-7 space-y-5">
          {/* Group Members Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Anggota Patungan ({people.length})</span>
              </span>

              <button
                type="button"
                onClick={addPerson}
                className="text-xs text-emerald-400 active:text-emerald-300 flex items-center gap-1 font-medium px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 active:bg-emerald-500/20 cursor-pointer min-h-[36px]"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Tambahkan</span>
              </button>
            </div>

            {people.length === 0 ? (
              <div className="py-4 text-center text-slate-500 text-xs border border-dashed border-slate-800/80 rounded-xl w-full">
                Belum ada anggota. Silakan klik &quot;Tambahkan&quot; untuk memulai.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                {people.map((p, index) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium min-w-0"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updatePersonName(p.id, e.target.value)}
                      placeholder={`Person ${index + 1}`}
                      className="bg-transparent text-slate-200 focus:outline-none flex-1 min-w-0 text-base sm:text-xs font-medium placeholder:text-slate-500/80"
                    />
                    {people.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePerson(p.id)}
                        className="text-slate-500 hover:text-red-400 p-1 cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BUNDLE MODE: Enter Lump Sum Total */}
          {splitMode === "bundle" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Total Biaya</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Masukkan total biaya keseluruhan untuk dibagi rata
                </p>
              </div>

              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-emerald-400 font-bold text-lg pointer-events-none">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberWithDots(bundleTotal)}
                  onChange={(e) => setBundleTotal(parseNumberFromDots(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 rounded-xl pl-12 pr-10 py-3.5 text-xl font-bold font-mono text-slate-100 focus:outline-none"
                />
                {bundleTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => setBundleTotal(0)}
                    className="absolute right-3 text-slate-500 hover:text-slate-300 p-1 cursor-pointer flex items-center justify-center"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Biaya Per Person ({people.length} Person):</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {formatRupiah(bundleSharePerPerson)}
                </span>
              </div>

              {/* Personal Deductions Section in Bundle Mode */}
              <div className="pt-5 border-t border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span>Pengurangan Patungan</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Pengurangan khusus yang langsung mengurangi tagihan anggota tertentu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addDeduction}
                    disabled={people.length === 0}
                    className="text-xs text-emerald-400 active:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 active:bg-emerald-500/20 cursor-pointer min-h-[32px] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Pengurangan</span>
                  </button>
                </div>

                {deductions.length > 0 && (
                  <div className="space-y-3">
                    {deductions.map((d, index) => (
                      <div
                        key={d.id}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-3"
                      >
                        {/* Name Input */}
                        <input
                          type="text"
                          value={d.name}
                          onChange={(e) => updateDeduction(d.id, "name", e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-emerald-500/60"
                          placeholder={`Diskon / Potongan ${index + 1}`}
                        />

                        {/* Member Selector */}
                        <div className="relative w-full sm:w-44 shrink-0">
                          <select
                            value={d.personId}
                            onChange={(e) => updateDeduction(d.id, "personId", e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-100 focus:outline-none transition-all cursor-pointer appearance-none"
                          >
                            <option value="" disabled>Pilih Anggota</option>
                            {people.map((p, pIdx) => (
                              <option key={p.id} value={p.id}>
                                {p.name || `Person ${pIdx + 1}`}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>

                        {/* Amount Input */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 sm:w-28 sm:flex-none">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-400 text-xs font-semibold pointer-events-none">-Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberWithDots(d.price)}
                              onChange={(e) => updateDeduction(d.id, "price", parseNumberFromDots(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-2 py-2 text-xs text-right text-red-400 font-bold focus:outline-none focus:border-emerald-500/60"
                              placeholder="0"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDeduction(d.id)}
                            className="text-slate-500 hover:text-red-400 p-2 cursor-pointer shrink-0 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ITEMIZED MODE: Line-by-line */}
          {splitMode === "itemized" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Daftar Item & Harga</h2>
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setItems([])}
                      className="h-9 px-3 rounded-xl bg-red-950/40 border border-red-900/50 hover:bg-red-900/25 text-red-400 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clear All</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addItem}
                    className="h-9 px-2.5 sm:px-3.5 rounded-xl bg-emerald-600 active:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Tambah Item</span>
                  </button>
                </div>
              </div>

              {isScanning && (
                <div className="py-8 text-center space-y-2">
                  <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Membaca teks dengan OCR...</p>
                </div>
              )}

              {!isScanning && items.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Belum ada item. Silakan klik Tambah Item.
                </div>
              )}

              {!isScanning && (
                <div className="space-y-3">
                  {items.map((it, index) => (
                    <div
                      key={it.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5"
                    >
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium min-w-0">
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => updateItem(it.id, "name", e.target.value)}
                          className="bg-transparent text-slate-200 focus:outline-none flex-1 min-w-0 text-base sm:text-xs font-medium placeholder:text-slate-500/80"
                          placeholder={`Item Baru ${index + 1}`}
                        />
                        <div className="flex items-center gap-1 border-l border-slate-800/60 pl-2 shrink-0">
                          <span className="text-slate-500 text-xs font-semibold pointer-events-none">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatNumberWithDots(it.price)}
                            onChange={(e) => updateItem(it.id, "price", parseNumberFromDots(e.target.value))}
                            className="bg-transparent text-slate-200 focus:outline-none w-20 text-right text-base sm:text-xs font-semibold placeholder:text-slate-500/80"
                            placeholder="0"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((i) => i.id !== it.id))}
                          className="text-slate-500 hover:text-red-400 p-1 cursor-pointer shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Touch-Friendly Person Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-800/60">
                        <span className="text-[11px] text-slate-400 mr-1">Patungan:</span>
                        {people.map((p, pIdx) => {
                          const assigned = it.assignedTo.includes(p.id);
                          const displayName = p.name || `Person ${pIdx + 1}`;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleAssign(it.id, p.id)}
                              className={`h-9 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${assigned
                                ? "bg-slate-800 border-slate-600 text-white shadow-sm font-bold"
                                : "bg-slate-900/60 border-slate-800 text-slate-500 opacity-60"
                                }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                              <span className="truncate max-w-[70px] sm:max-w-[100px]">{displayName}</span>
                              {assigned && <Check className="w-3.5 h-3.5 text-emerald-400 ml-0.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Personal Deductions Section */}
              {!isScanning && (
                <div className="pt-5 border-t border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span>Pengurangan Patungan</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Pengurangan khusus yang langsung mengurangi tagihan anggota tertentu
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addDeduction}
                      disabled={people.length === 0}
                      className="text-xs text-emerald-400 active:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-medium px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 active:bg-emerald-500/20 cursor-pointer min-h-[32px] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pengurangan</span>
                    </button>
                  </div>

                  {deductions.length > 0 && (
                    <div className="space-y-3">
                      {deductions.map((d, index) => (
                        <div
                          key={d.id}
                          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-xl p-3"
                        >
                          {/* Name Input */}
                          <input
                            type="text"
                            value={d.name}
                            onChange={(e) => updateDeduction(d.id, "name", e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-emerald-500/60"
                            placeholder={`Diskon / Potongan ${index + 1}`}
                          />

                          {/* Member Selector */}
                          <div className="relative w-full sm:w-44 shrink-0">
                            <select
                              value={d.personId}
                              onChange={(e) => updateDeduction(d.id, "personId", e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-100 focus:outline-none transition-all cursor-pointer appearance-none"
                            >
                              <option value="" disabled>Pilih Anggota</option>
                              {people.map((p, pIdx) => (
                                <option key={p.id} value={p.id}>
                                  {p.name || `Person ${pIdx + 1}`}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                          </div>

                          {/* Amount Input */}
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1 sm:w-28 sm:flex-none">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-400 text-xs font-semibold pointer-events-none">-Rp</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatNumberWithDots(d.price)}
                                onChange={(e) => updateDeduction(d.id, "price", parseNumberFromDots(e.target.value))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-2 py-2 text-xs text-right text-red-400 font-bold focus:outline-none focus:border-emerald-500/60"
                                placeholder="0"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeDeduction(d.id)}
                              className="text-slate-500 hover:text-red-400 p-2 cursor-pointer shrink-0 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


            </div>
          )}

          {/* Rekening Pembayaran */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">Info Rekening Penerima</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Masukkan informasi rekening tujuan transfer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addPaymentAccount}
                className="text-xs text-emerald-400 active:text-emerald-300 flex items-center gap-1.5 font-medium px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 active:bg-emerald-500/20 cursor-pointer min-h-[32px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tambah</span>
              </button>
            </div>

            <div className="space-y-4">
              {paymentAccounts.map((acc, index) => (
                <div key={acc.id} className="relative bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-900/60 pb-2">
                    <span className="text-[11px] font-semibold text-emerald-400">
                      Rekening #{index + 1}
                    </span>
                    {paymentAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePaymentAccount(acc.id)}
                        className="text-slate-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Bank / E-Wallet
                      </label>
                      {(() => {
                        const isPredefined = PREDEFINED_BANKS.includes(acc.bankName);
                        const isCustom = acc.bankName !== "" && !isPredefined;

                        return (
                          <div className="space-y-1.5">
                            <div className="relative flex items-center">
                              <select
                                value={isPredefined ? acc.bankName : (acc.bankName ? "Lainnya" : "")}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "Lainnya") {
                                    updatePaymentAccount(acc.id, "bankName", "Lainnya");
                                  } else {
                                    updatePaymentAccount(acc.id, "bankName", val);
                                  }
                                }}
                                className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-100 focus:outline-none transition-all cursor-pointer appearance-none"
                              >
                                <option value="" disabled>Pilih Bank/Wallet</option>
                                {PREDEFINED_BANKS.map((bank) => (
                                  <option key={bank} value={bank} className="bg-slate-950">
                                    {bank}
                                  </option>
                                ))}
                                <option value="Lainnya" className="bg-slate-950">Lainnya / Kustom</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                            </div>

                            {(isCustom || acc.bankName === "Lainnya") && (
                              <input
                                type="text"
                                value={acc.bankName === "Lainnya" ? "" : acc.bankName}
                                onChange={(e) => updatePaymentAccount(acc.id, "bankName", e.target.value)}
                                placeholder="Nama Bank/Wallet Kustom"
                                className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500/80 focus:outline-none transition-all mt-1"
                              />
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Nomor Rekening / HP
                      </label>
                      <input
                        type="number"
                        value={acc.accountNumber}
                        onChange={(e) => updatePaymentAccount(acc.id, "accountNumber", e.target.value)}
                        placeholder="Contoh: 123456789"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500/80 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Atas Nama (A.n)
                      </label>
                      <input
                        type="text"
                        value={acc.accountHolder}
                        onChange={(e) => updatePaymentAccount(acc.id, "accountHolder", e.target.value)}
                        placeholder="Contoh: John Doe"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500/60 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500/80 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Summary Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Total Tagihan
                </span>
                <h2 className="text-xl font-bold font-mono text-slate-100">
                  {formatRupiah(activeGrandTotal)}
                </h2>
              </div>

              <button
                type="button"
                onClick={copySummaryText}
                className="h-10 px-3 sm:px-4 bg-emerald-500 active:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? "Tersalin!" : "Salin Rincian"}</span>
              </button>
            </div>

            {/* Individual Breakdown Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
              {splitMode === "bundle"
                ? people.map((p, index) => {
                  const displayName = p.name || `Person ${index + 1}`;
                  const personDeductions = deductions
                    .filter((d) => d.personId === p.id)
                    .reduce((acc, d) => acc + d.price, 0);
                  const personTotal = Math.max(0, bundleSharePerPerson - personDeductions);

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col lg:flex-row items-center lg:justify-between text-center lg:text-left gap-2 min-w-0"
                    >
                      <div className="flex flex-col lg:flex-row items-center gap-1.5 lg:gap-2.5 min-w-0 w-full lg:w-auto">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 shrink-0 shadow-sm"
                          style={{ backgroundColor: p.color }}
                        >
                          {displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 w-full lg:w-auto">
                          <p className="text-xs font-semibold text-slate-200 truncate">{displayName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            Bagi Rata{personDeductions > 0 ? ` (Potongan: -${formatRupiah(personDeductions)})` : ""}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 shrink-0 w-full lg:w-auto text-center lg:text-right pt-1.5 lg:pt-0 border-t border-slate-800/40 lg:border-t-0">
                        {formatRupiah(personTotal)}
                      </span>
                    </div>
                  );
                })
                : itemizedSummaries.map((s) => {
                  const pObj = people.find((p) => p.id === s.personId);
                  return (
                    <div
                      key={s.personId}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col lg:flex-row items-center lg:justify-between text-center lg:text-left gap-2 min-w-0"
                    >
                      <div className="flex flex-col lg:flex-row items-center gap-1.5 lg:gap-2.5 min-w-0 w-full lg:w-auto">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 shrink-0 shadow-sm"
                          style={{ backgroundColor: pObj?.color || "#10B981" }}
                        >
                          {s.personName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 w-full lg:w-auto">
                          <p className="text-xs font-semibold text-slate-200 truncate">{s.personName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {s.items.length} item{s.discountShare > 0 ? ` (Potongan: -${formatRupiah(s.discountShare)})` : ""}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400 shrink-0 w-full lg:w-auto text-center lg:text-right pt-1.5 lg:pt-0 border-t border-slate-800/40 lg:border-t-0">
                        {formatRupiah(s.total)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR (Appears on Mobile Screen Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-950 border-t border-slate-800 lg:hidden z-40 flex items-center justify-between shadow-2xl">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase">Total Patungan</span>
          <span className="text-base font-bold font-mono text-emerald-400">
            {formatRupiah(activeGrandTotal)}
          </span>
        </div>

        <button
          type="button"
          onClick={copySummaryText}
          className="h-11 px-4 sm:px-5 rounded-xl bg-emerald-500 active:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/30 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{copied ? "Tersalin!" : "Salin Rincian"}</span>
        </button>
      </div>

      {/* Camera Live Modal Overlay */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/95 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" /> Arahkan ke Kamera
              </h3>
              <button type="button" onClick={stopCamera} className="text-slate-400 hover:text-white p-2 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-72 object-cover rounded-xl border border-slate-800"
            />

            <button
              type="button"
              onClick={capturePhoto}
              className="w-full py-3.5 rounded-xl bg-emerald-500 active:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <Camera className="w-5 h-5" /> Ambil Foto
            </button>
          </div>
        </div>
      )}

      {/* Scan Receipt Modal Overlay */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">

            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  <span>Pindai Nota / Struk (Batch OCR)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Kumpulkan foto nota Anda dari kamera atau upload file gambar
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedImages([]);
                  setShowScanModal(false);
                }}
                disabled={isScanning}
                className="text-slate-400 hover:text-white p-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Error */}
            {scanError && (
              <div className="mt-4 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs flex justify-between items-start gap-2">
                <div>
                  <span className="font-semibold">Gagal memproses struk:</span> {scanError}
                </div>
                <button
                  type="button"
                  onClick={() => setScanError(null)}
                  className="text-red-400 hover:text-red-300 font-medium text-[10px] uppercase cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* Modal Body */}
            {isScanning ? (
              <div className="flex-1 py-12 flex flex-col items-center justify-center space-y-4">
                <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-200">Sedang Memproses...</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Membaca struk {scanProgress?.current} dari {scanProgress?.total} dengan OCR
                  </p>
                </div>
                <div className="w-64 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${scanProgress
                        ? (scanProgress.current / scanProgress.total) * 100
                        : 0
                        }%`,
                    }}
                  />
                </div>
              </div>
            ) : selectedImages.length === 0 ? (
              <div className="flex-1 py-12 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-center max-w-sm">
                  <p className="text-sm font-semibold text-slate-200">Belum ada gambar ditambahkan</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Tambahkan satu atau beberapa foto/file nota untuk diproses sekaligus.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-4 min-h-[200px] max-h-[50vh]">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={`Struk ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-900/50 text-red-400 cursor-pointer shadow-md transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-950/70 border border-slate-800 text-[10px] text-slate-300 font-semibold">
                        Nota #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer (Actions) */}
            {!isScanning && (
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 flex-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex-1 h-11 px-4 rounded-xl bg-slate-800 active:bg-slate-700 hover:text-slate-100 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Ambil Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 h-11 px-4 rounded-xl bg-slate-800 active:bg-slate-700 hover:text-slate-100 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Upload File</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        const newImages = Array.from(files).map((file) => ({
                          previewUrl: URL.createObjectURL(file),
                          fileOrData: file,
                        }));
                        setSelectedImages((prev) => [...prev, ...newImages]);
                      }
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </div>

                {selectedImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => processImages(selectedImages)}
                    className="h-11 px-6 rounded-xl bg-emerald-500 active:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline">Proses {selectedImages.length} Struk</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
