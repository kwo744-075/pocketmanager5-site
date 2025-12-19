"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type InputHTMLAttributes } from "react";
import {
  Car,
  ClipboardList,
  CreditCard,
  DollarSign,
  Fuel,
  Mail,
  NotebookPen,
  Phone,
  Printer,
  Receipt,
  Trash2,
  User,
  Users,
  ChevronDown,
  ChevronRight,
  PlusCircle,
} from "lucide-react";
import { MINI_POS_SERVICES, type MiniPosNestedItem, type MiniPosService } from "../miniPosServices";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import {
  buildMiniPosSessionPayload,
  createEmptyCustomerInfo,
  createEmptyTechAssignments,
  createEmptyVehicleInfo,
  hydrateMiniPosSession,
} from "../miniPosSessionUtils";
import { getServiceColors } from "../miniPosColors";
import { useMiniPosEmployees } from "../useMiniPosEmployees";
import { getTaxRate } from "@/lib/miniPos/getTaxRate";
import {
  archiveWorkingWo,
  completeWorkingWo,
  createWorkingWo,
  getWorkingWo,
  listWorkOrdersAllBays,
  listWorkingWosByBay,
  subscribeWorkingWos,
  upsertWorkingWo,
  type ManualWorkOrderRow,
} from "@/lib/miniPos/workingWos";
import { assignQueueToBay } from "@/lib/miniPos/assignQueueToBay";
import { listQueue, subscribeQueue, type MiniPosQueueRow } from "@/lib/miniPos/queue";
import {
  type MiniPosCompletePayload,
  type MiniPosSessionPayload,
  type PersistedMiniPosSession,
  type MiniPosSessionListResponse,
  type MiniPosCustomerInfo,
  type MiniPosVehicleInfo,
  type MiniPosCartLine,
  type MiniPosTechAssignments,
  type PaymentMethod,
} from "../miniPosTypes";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash Drawer", icon: DollarSign },
  { value: "credit_card", label: "Card Terminal", icon: CreditCard },
  { value: "fleet", label: "Fleet / PO", icon: Receipt },
] as const;

type CartItem = MiniPosCartLine;
type CustomerInfo = MiniPosCustomerInfo;
type VehicleInfo = MiniPosVehicleInfo;
type TechAssignments = MiniPosTechAssignments;

type BayId = 1 | 2 | 3;
type MiniPosBayViewProps = {
  bayId: BayId;
  shopMeta: { id: string; shop_number: number | null } | null;
  loginEmail: string | null;
  needsLogin: boolean;
  hierarchy: { district_name: string | null; region_name: string | null } | null;
  externalOpenWoId?: string | null;
  onOpenedExternalWo?: () => void;
  onCheckoutCompleted?: (bayId: BayId, workOrderId: string) => void;
};

function MiniPosBayView({
  bayId,
  shopMeta,
  loginEmail,
  needsLogin,
  hierarchy,
  externalOpenWoId,
  onOpenedExternalWo,
  onCheckoutCompleted,
}: MiniPosBayViewProps) {
  const [activeServiceKey, setActiveServiceKey] = useState<string>(MINI_POS_SERVICES[0]?.key ?? "");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState<string>("");
  const [taxRatePctInput, setTaxRatePctInput] = useState<string>("0");
  const [taxRateSource, setTaxRateSource] = useState<"shop" | "zip" | "state" | "none">("none");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(createEmptyCustomerInfo);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>(createEmptyVehicleInfo);
  const [techAssignments, setTechAssignments] = useState<TechAssignments>(createEmptyTechAssignments);
  const [serviceNotes, setServiceNotes] = useState<string>("");
  const [workingTrayOpen, setWorkingTrayOpen] = useState(true);
  const [workingWos, setWorkingWos] = useState<ManualWorkOrderRow[]>([]);
  const [workingWosLoading, setWorkingWosLoading] = useState(false);
  const [activeWoId, setActiveWoId] = useState<string | null>(null);
  const [woSaveState, setWoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"open" | "closed">("open");
  const [sessionLoading, setSessionLoading] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const payloadHashRef = useRef<string>("");

  const activeService: MiniPosService | undefined = useMemo(
    () => MINI_POS_SERVICES.find((service) => service.key === activeServiceKey) ?? MINI_POS_SERVICES[0],
    [activeServiceKey],
  );

  const subtotal = useMemo(() => cartItems.reduce((memo, item) => memo + item.price * item.quantity, 0), [cartItems]);
  const taxableSubtotal = useMemo(
    () => cartItems.filter((item) => item.price > 0).reduce((memo, item) => memo + item.price * item.quantity, 0),
    [cartItems],
  );
  const discountValue = Math.min(Math.max(parseFloat(discountInput) || 0, 0), subtotal);
  const taxRate = useMemo(() => {
    const pct = parseFloat(taxRatePctInput);
    if (Number.isNaN(pct) || pct < 0) return 0;
    return pct / 100;
  }, [taxRatePctInput]);
  const taxAmount = useMemo(() => roundCurrency(Math.max(0, taxableSubtotal) * taxRate), [taxRate, taxableSubtotal]);
  const totalDue = Math.max(subtotal - discountValue + taxAmount, 0);
  const tendered = parseFloat(cashReceived) || 0;
  const changeDue = paymentMethod === "cash" ? Math.max(tendered - totalDue, 0) : 0;
  const balanceRemaining = paymentMethod === "cash" ? Math.max(totalDue - tendered, 0) : 0;

  const handleAddItem = (item: MiniPosNestedItem, serviceKey: string) => {
    if (!item || item.id.endsWith("header")) {
      return;
    }
    setCartItems((prev) => {
      const existing = prev.find((line) => line.id === item.id);
      if (existing) {
        return prev.map((line) => (line.id === item.id ? { ...line, quantity: Math.min(line.quantity + 1, 99) } : line));
      }
      return [...prev, { id: item.id, buttonId: item.id, label: item.label, price: item.price, quantity: 1, serviceKey }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(1, Math.min(99, item.quantity + delta)) } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (id: string) => setCartItems((prev) => prev.filter((item) => item.id !== id));

  const resetCart = useCallback(() => {
    setCartItems([]);
    setDiscountInput("");
    setCashReceived("");
    payloadHashRef.current = "";
  }, []);

  const handleCustomerChange = (field: keyof CustomerInfo, value: string) =>
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
  const handleVehicleChange = (field: keyof VehicleInfo, value: string) =>
    setVehicleInfo((prev) => ({ ...prev, [field]: value }));
  const handleTechChange = (field: keyof TechAssignments, value: string) =>
    setTechAssignments((prev) => ({ ...prev, [field]: value }));

  const buildPayload = useCallback((): MiniPosSessionPayload | null => {
    return buildMiniPosSessionPayload({
      context: {
        sessionId,
        shopId: shopMeta?.id ?? null,
        shopNumber: shopMeta?.shop_number ?? null,
        paymentMethod,
        createdBy: loginEmail,
      },
      draft: {
        cartItems,
        customerInfo,
        vehicleInfo,
        techAssignments,
        serviceNotes,
      },
      totals: {
        subtotal,
        discountAmount: discountValue,
        taxableSubtotal,
        taxRate,
        taxAmount,
        totalDue,
        tenderedAmount: paymentMethod === "cash" ? tendered : totalDue,
        changeDue,
        cashReceived: paymentMethod === "cash" ? tendered : 0,
      },
    });
  }, [cartItems, changeDue, customerInfo, discountValue, loginEmail, paymentMethod, sessionId, serviceNotes, shopMeta?.id, shopMeta?.shop_number, subtotal, taxAmount, taxRate, taxableSubtotal, techAssignments, tendered, totalDue, vehicleInfo]);

  const buildWorkingWoPayload = useCallback(() => {
    return {
      cartItems,
      customerInfo,
      vehicleInfo,
      techAssignments,
      serviceNotes,
      discountInput,
      taxRatePctInput,
    } satisfies Record<string, unknown>;
  }, [cartItems, customerInfo, discountInput, serviceNotes, taxRatePctInput, techAssignments, vehicleInfo]);

  const buildWorkingWoTotals = useCallback(() => {
    return {
      subtotal,
      discountAmount: discountValue,
      taxAmount,
      totalDue,
      paymentMethod,
      tenderedAmount: paymentMethod === "cash" ? tendered : totalDue,
      changeDue,
      cashReceived: paymentMethod === "cash" ? tendered : 0,
    };
  }, [changeDue, discountValue, paymentMethod, taxAmount, tendered, totalDue, subtotal]);

  const ensureWorkingWo = useCallback(async () => {
    if (activeWoId) return activeWoId;
    const row = await createWorkingWo({
      bayId,
      shopNumber: shopMeta?.shop_number ?? null,
      districtName: hierarchy?.district_name ?? null,
      regionName: hierarchy?.region_name ?? null,
      payload: buildWorkingWoPayload(),
      totals: buildWorkingWoTotals(),
    });
    setActiveWoId(row.id);
    setWorkingTrayOpen(true);
    return row.id;
  }, [activeWoId, bayId, buildWorkingWoPayload, buildWorkingWoTotals, hierarchy?.district_name, hierarchy?.region_name, shopMeta?.shop_number]);

  const handleSaveDraft = useCallback(async () => {
    const sessionPayload = buildPayload();
    const woPayload = buildWorkingWoPayload();

    if (!sessionPayload && cartItems.length === 0 && !serviceNotes.trim()) {
      setStatusMessage("Nothing to save yet");
      return null;
    }

    setSaveState("saving");
    setWoSaveState("saving");
    setStatusMessage("Saving draft...");

    try {
      const woId = await ensureWorkingWo();
      await upsertWorkingWo(woId, woPayload, buildWorkingWoTotals());

      setWoSaveState("saved");
      setSaveState("saved");
      setStatusMessage("Draft saved");
      setLastSavedAt(new Date().toISOString());

      if (sessionPayload) {
        void fetch("/api/mini-pos/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionPayload),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const data = (await res.json()) as { sessionId: string };
            setSessionId(data.sessionId);
          })
          .catch((err) => console.error("pos session save failed (non-blocking)", err));
      }

      return woId;
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setWoSaveState("error");
      setStatusMessage("Save failed");
      return null;
    }
  }, [buildPayload, buildWorkingWoPayload, buildWorkingWoTotals, cartItems.length, ensureWorkingWo, serviceNotes]);

  const handleCompleteCheckout = useCallback(async () => {
    const woId = await handleSaveDraft();
    if (!woId) {
      setStatusMessage("Add a cart item or capture info before completing the work order.");
      return;
    }

    const completePayload: MiniPosCompletePayload = {
      paymentMethod,
      totalDue,
      tenderedAmount: paymentMethod === "cash" ? tendered : totalDue,
      changeDue,
      cashReceived: paymentMethod === "cash" ? tendered : 0,
      referenceNumber: customerInfo.purchaseOrder || null,
      recordedBy: loginEmail ?? undefined,
    };

    try {
      setSaveState("saving");
      setWoSaveState("saving");
      setStatusMessage("Completing checkout...");

      const woPayload = buildWorkingWoPayload();
      await completeWorkingWo(woId, woPayload, buildWorkingWoTotals());

      if (sessionId) {
        void fetch(`/api/mini-pos/session/${sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(completePayload),
        }).catch((err) => console.error("pos session close failed (non-blocking)", err));
      }

      setStatusMessage("Work order completed.");
      setWoSaveState("idle");
      setSaveState("idle");
      setActiveWoId(null);
      resetCart();
      setCustomerInfo(createEmptyCustomerInfo());
      setVehicleInfo(createEmptyVehicleInfo());
      setTechAssignments(createEmptyTechAssignments());
      setServiceNotes("");
      setSessionId(null);
      setSessionStatus("open");
      setLastSavedAt(null);
      payloadHashRef.current = "";
      onCheckoutCompleted?.(bayId, woId);
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setWoSaveState("error");
      setStatusMessage("Unable to complete checkout");
    }
  }, [bayId, buildWorkingWoPayload, buildWorkingWoTotals, changeDue, customerInfo.purchaseOrder, handleSaveDraft, loginEmail, onCheckoutCompleted, paymentMethod, resetCart, sessionId, tendered, totalDue]);

  const hydrateSessionFromRecord = useCallback((session: PersistedMiniPosSession) => {
    const snapshot = hydrateMiniPosSession(session);
    if (!snapshot) {
      return;
    }

    setSessionId(snapshot.sessionId);
    setSessionStatus(snapshot.sessionStatus);
    setCartItems(snapshot.cartItems);
    setDiscountInput(snapshot.discountAmount ? String(snapshot.discountAmount) : "");
    setPaymentMethod(snapshot.paymentMethod);
    setCashReceived(snapshot.tenderedAmount ? String(snapshot.tenderedAmount) : "");
    setCustomerInfo(snapshot.customerInfo as CustomerInfo);
    setVehicleInfo(snapshot.vehicleInfo as VehicleInfo);
    setTechAssignments(snapshot.techAssignments as TechAssignments);
    setServiceNotes(snapshot.serviceNotes);
    setTaxRatePctInput(snapshot.taxRate ? String(Math.round(snapshot.taxRate * 10000) / 100) : "0");
    setStatusMessage("Draft restored");
  }, []);

  const reloadWorkingWos = useCallback(async () => {
    setWorkingWosLoading(true);
    try {
      const list = await listWorkingWosByBay(bayId);
      setWorkingWos(list);
    } catch (err) {
      console.error("working WOs load failed", err);
    } finally {
      setWorkingWosLoading(false);
    }
  }, [bayId]);

  useEffect(() => {
    void reloadWorkingWos();
    const unsub = subscribeWorkingWos(() => void reloadWorkingWos());
    return () => unsub();
  }, [reloadWorkingWos]);

  const startNewWorkingWo = useCallback(async () => {
    try {
      setWoSaveState("saving");
      setCartItems([]);
      setDiscountInput("");
      setPaymentMethod("cash");
      setCashReceived("");
      setCustomerInfo(createEmptyCustomerInfo());
      setVehicleInfo(createEmptyVehicleInfo());
      setTechAssignments(createEmptyTechAssignments());
      setServiceNotes("");
      setSessionId(null);
      setSessionStatus("open");
      payloadHashRef.current = "";

      const row = await createWorkingWo({
        bayId,
        shopNumber: shopMeta?.shop_number ?? null,
        districtName: hierarchy?.district_name ?? null,
        regionName: hierarchy?.region_name ?? null,
        payload: {
          cartItems: [],
          customerInfo: createEmptyCustomerInfo(),
          vehicleInfo: createEmptyVehicleInfo(),
          techAssignments: createEmptyTechAssignments(),
          serviceNotes: "",
          discountInput: "",
          taxRatePctInput: "0",
        },
        totals: { subtotal: 0, discountAmount: 0, taxAmount: 0, totalDue: 0, paymentMethod: "cash" },
      });

      setActiveWoId(row.id);
      setWoSaveState("saved");
      setWorkingTrayOpen(true);
    } catch (err) {
      console.error("create working WO failed", err);
      setWoSaveState("error");
    }
  }, [bayId, hierarchy?.district_name, hierarchy?.region_name, shopMeta?.shop_number]);

  const openWorkingWo = useCallback(async (id: string) => {
    try {
      const row = await getWorkingWo(id);
      if (!row) return;
      const payload = (row.payload ?? {}) as any;
      setActiveWoId(row.id);
      setCartItems((payload.cartItems as CartItem[]) ?? []);
      setDiscountInput((payload.discountInput as string) ?? String(row.discount_amount ?? ""));
      setTaxRatePctInput((payload.taxRatePctInput as string) ?? "0");
      setPaymentMethod((row.payment_method as PaymentMethod) ?? "cash");
      setCashReceived(String(row.cash_received ?? ""));
      setCustomerInfo((payload.customerInfo as CustomerInfo) ?? createEmptyCustomerInfo());
      setVehicleInfo((payload.vehicleInfo as VehicleInfo) ?? createEmptyVehicleInfo());
      setTechAssignments((payload.techAssignments as TechAssignments) ?? createEmptyTechAssignments());
      setServiceNotes((payload.serviceNotes as string) ?? "");
      setWoSaveState("idle");
      setWorkingTrayOpen(true);
    } catch (err) {
      console.error("open working WO failed", err);
    }
  }, []);

  useEffect(() => {
    if (!externalOpenWoId) return;
    void openWorkingWo(externalOpenWoId).finally(() => onOpenedExternalWo?.());
  }, [externalOpenWoId, onOpenedExternalWo, openWorkingWo]);

  useEffect(() => {
    if (!shopMeta?.id) {
      return;
    }
    setSessionLoading(true);
    setLoadError(null);

    const controller = new AbortController();
    const loadSession = async () => {
      try {
        const params = new URLSearchParams({ shopId: shopMeta.id, status: "open", limit: "1" });
        const response = await fetch(`/api/mini-pos/session?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load open session");
        }

        const data = (await response.json()) as MiniPosSessionListResponse;
        const [session] = data.sessions;
        if (session) {
          hydrateSessionFromRecord(session);
        } else {
          setSessionId(null);
          setSessionStatus("open");
          resetCart();
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error(error);
          setLoadError("Unable to load saved session");
        }
      } finally {
        setSessionLoading(false);
      }
    };

    loadSession();

    return () => controller.abort();
  }, [hydrateSessionFromRecord, resetCart, shopMeta?.id]);

  useEffect(() => {
    if (!shopMeta?.shop_number) return;
    if (taxRatePctInput !== "0") return;

    let active = true;
    getTaxRate({ shopNumber: Number(shopMeta.shop_number) })
      .then((result) => {
        if (!active) return;
        if (typeof result.rate === "number" && result.rate > 0) {
          setTaxRateSource(result.source);
          setTaxRatePctInput(String(Math.round(result.rate * 10000) / 100));
        } else {
          setTaxRateSource("none");
        }
      })
      .catch((err) => console.error("mini-pos tax lookup failed", err));

    return () => {
      active = false;
    };
  }, [shopMeta?.shop_number, taxRatePctInput]);

  useEffect(() => {
    if (!activeWoId) return;

    const timeout = window.setTimeout(() => {
      const payload = {
        cartItems,
        customerInfo,
        vehicleInfo,
        techAssignments,
        serviceNotes,
        discountInput,
        taxRatePctInput,
      } as Record<string, unknown>;

      setWoSaveState("saving");
      upsertWorkingWo(activeWoId, payload, {
        subtotal,
        discountAmount: discountValue,
        taxAmount,
        totalDue,
        paymentMethod,
        tenderedAmount: paymentMethod === "cash" ? tendered : totalDue,
        changeDue,
        cashReceived: paymentMethod === "cash" ? tendered : 0,
      })
        .then(() => setWoSaveState("saved"))
        .catch((err) => {
          console.error("working WO autosave failed", err);
          setWoSaveState("error");
        });
    }, 750);

    return () => window.clearTimeout(timeout);
  }, [
    activeWoId,
    cartItems,
    changeDue,
    customerInfo,
    discountInput,
    discountValue,
    paymentMethod,
    serviceNotes,
    taxAmount,
    taxRatePctInput,
    techAssignments,
    tendered,
    totalDue,
    vehicleInfo,
    subtotal,
  ]);

  const canPersist = useMemo(() => Boolean(buildPayload()), [buildPayload]);

  const { employees: employeeOptions } = useMiniPosEmployees(shopMeta?.shop_number ? String(shopMeta.shop_number) : null);

  if (needsLogin) {
    return (
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 text-center text-sm text-slate-300">
        Please sign in to access the Mini POS workspace.
      </div>
    );
  }

  const workingCount = workingWos.length;
  const workingTotal = workingWos.reduce((sum, wo) => sum + (Number(wo.total_due ?? 0) || 0), 0);

  return (
    <div className="space-y-8 text-white">
      <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-5">
        <button
          type="button"
          onClick={() => setWorkingTrayOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={workingTrayOpen}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50">
              {workingTrayOpen ? <ChevronDown className="h-5 w-5 text-white" /> : <ChevronRight className="h-5 w-5 text-white" />}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Working WOs</p>
              <p className="text-sm font-semibold text-white">
                {workingCount ? `${workingCount} open` : "No working work orders"}
                {woSaveState === "saving" ? " • Saving…" : woSaveState === "saved" ? " • Saved" : woSaveState === "error" ? " • Save failed" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-white">
              {workingTotal ? currency.format(workingTotal) : "$0.00"}
            </span>
            <span className="rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-white">
              {workingCount}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void startNewWorkingWo();
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-emerald-300/80"
              aria-label="Create new work order"
            >
              <PlusCircle className="h-4 w-4" />
              New WO
            </button>
          </div>
        </button>

        {workingTrayOpen ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">Queue</p>
                {workingWosLoading ? <p className="text-xs text-white/60">Loading…</p> : null}
              </div>
              {workingWos.length ? (
                <ul className="mt-3 space-y-2">
                  {workingWos.map((wo) => {
                    const payload = (wo.payload ?? {}) as any;
                    const customerLabel = (payload.customerInfo?.name as string | undefined) ?? "";
                    const vehicleLabel = [payload.vehicleInfo?.year, payload.vehicleInfo?.make, payload.vehicleInfo?.model]
                      .filter(Boolean)
                      .join(" ");
                    const title = customerLabel || vehicleLabel || `Work Order ${wo.id.slice(0, 6)}`;
                    return (
                      <li key={wo.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
                        <div className="min-w-[220px] flex-1">
                          <p className="text-sm font-semibold text-white">{title}</p>
                          <p className="text-xs text-white/60">
                            Updated {new Date(wo.updated_at).toLocaleString()} • {wo.status.toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">{currency.format(Number(wo.total_due ?? 0) || 0)}</p>
                          <p className="text-xs text-white/60">{wo.payment_method ?? "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void openWorkingWo(wo.id)}
                            className="rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-emerald-300/70"
                          >
                            Open/Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void archiveWorkingWo(wo.id)}
                            className="rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-rose-300/70"
                          >
                            Archive
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/60">
                  No working WOs yet. Click “New WO” to start one.
                </div>
              )}
            </div>

            <SessionStatusBanner
              savingState={saveState}
              statusMessage={statusMessage}
              lastSavedAt={lastSavedAt}
              sessionStatus={sessionStatus}
              sessionLoading={sessionLoading}
              loadError={loadError}
              onSaveDraft={handleSaveDraft}
            />
          </div>
        ) : null}
      </section>
      <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6 shadow-2xl shadow-black/30">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-white">SERVICES</h2>
            <p className="mt-2 text-sm text-white/70">Tap a service tile to add it to the cart. Oil types stay pinned above the board.</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 text-sm text-white">
            <p className="font-semibold">{currency.format(subtotal)}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">Live subtotal</p>
          </div>
        </header>

        <div className="mt-6 grid gap-y-6 lg:grid-cols-[220px_80px_300px_1fr] lg:gap-x-12">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Pricing decks & oil families</p>
            <div className="flex flex-col gap-3">
                {MINI_POS_SERVICES.slice(0, 4).map((service) => {
                  const colors = getServiceColors(service.key);
                  const nested = (service.nestedItems ?? []).filter((item) => item.price > 0);
                  const under75 = nested.find((item) => item.id.endsWith("-u75")) ?? nested[0];
                  const xqt = nested.find((item) => item.label.toLowerCase().includes("x-qt") && !item.label.toLowerCase().includes("hm"));
                  const highMileage = nested.find((item) => item.label.toLowerCase().includes("high mileage") && !item.label.toLowerCase().includes("x-qt"));
                  const highMileageXqt =
                    nested.find((item) => item.id.includes("xqt-hm")) ?? nested.find((item) => item.label.toLowerCase().includes("x-qt hm"));
                  return (
                    <div
                      key={service.key}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold ${colors.baseClass} ${colors.borderClass ?? ""}`}
                    >
                      <p className="text-sm font-semibold text-white">{service.label}</p>
                      <ul className="mt-2 space-y-1 text-xs text-white/80">
                        {under75 ? (
                          <li className="flex items-start justify-between gap-3">
                            <span className="leading-tight text-white/80">{under75.label}</span>
                            <span className="whitespace-nowrap font-semibold text-white">{currency.format(under75.price)}</span>
                          </li>
                        ) : null}
                        {xqt ? (
                          <li className="flex items-start justify-between gap-3">
                            <span className="leading-tight text-white/80">{xqt.label}</span>
                            <span className="whitespace-nowrap font-semibold text-white">{`+ ${currency.format(xqt.price)}`}</span>
                          </li>
                        ) : null}
                        {highMileage ? (
                          <li className="flex items-start justify-between gap-3">
                            <span className="leading-tight text-white/80">High Mileage</span>
                            <span className="whitespace-nowrap font-semibold text-white">
                              {currency.format(highMileage.price)}
                              {highMileageXqt ? ` +${currency.format(highMileageXqt.price)}` : ""}
                            </span>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="hidden lg:block" aria-hidden />

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Main service buttons</p>
            <div className="flex flex-col gap-2">
              {MINI_POS_SERVICES.map((service) => {
                const isActive = activeServiceKey === service.key;
                const colors = getServiceColors(service.key);
                return (
                  <button
                    key={service.key}
                    type="button"
                    onClick={() => setActiveServiceKey(service.key)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${colors.baseClass} ${
                      isActive ? colors.selectedClass : ""
                    } ${colors.hoverClass ?? ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white">{service.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <ServiceTileGrid
            service={activeService}
            cartItems={cartItems}
            onSelect={handleAddItem}
            onSelectOilType={(oil) => {
              setVehicleInfo((prev) => ({ ...prev, oilType: oil }));
              const oilLineId = `oiltype-${activeService?.key ?? "oil"}-${oil}`;
              handleAddItem({ id: oilLineId, label: `${activeService?.label ?? "Oil"} ${oil}`, price: 0 }, activeService?.key ?? "oil");
            }}
            selectedOilType={vehicleInfo.oilType ?? ""}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <CartAndPaymentPanel
          cartItems={cartItems}
          subtotal={subtotal}
          discountInput={discountInput}
          onDiscountChange={setDiscountInput}
          taxableSubtotal={taxableSubtotal}
          taxRatePctInput={taxRatePctInput}
          taxRateSource={taxRateSource}
          taxAmount={taxAmount}
          onTaxRatePctChange={setTaxRatePctInput}
          onAutoTaxRate={() => {
            if (!shopMeta?.shop_number) return;
            void getTaxRate({ shopNumber: Number(shopMeta.shop_number) }).then((result) => {
              setTaxRateSource(result.source);
              if (typeof result.rate === "number" && result.rate >= 0) {
                setTaxRatePctInput(String(Math.round(result.rate * 10000) / 100));
              }
            });
          }}
          onPrintReceipt={() => {
            if (!activeWoId) {
              setStatusMessage("Create or open a Working WO first.");
              return;
            }
            window.open(`/pocket-manager5/features/mini-pos/receipt/${activeWoId}?autoprint=1`, "_blank", "noopener,noreferrer");
          }}
          onEmailReceipt={() => {
            if (!activeWoId) {
              setStatusMessage("Create or open a Working WO first.");
              return;
            }
            const link = `${window.location.origin}/pocket-manager5/features/mini-pos/receipt/${activeWoId}?format=pdf`;
            // TODO: send as an actual PDF attachment via server-side mailer once email infrastructure is available.
            window.location.href = `mailto:?subject=${encodeURIComponent("Work Order Receipt")}&body=${encodeURIComponent(
              `Receipt link (print to PDF): ${link}`,
            )}`;
          }}
          totalDue={totalDue}
          paymentMethod={paymentMethod}
          onPaymentChange={setPaymentMethod}
          cashReceived={cashReceived}
          onCashChange={setCashReceived}
          changeDue={changeDue}
          balanceRemaining={balanceRemaining}
          onIncrement={(id) => updateQuantity(id, 1)}
          onDecrement={(id) => updateQuantity(id, -1)}
          onRemove={removeItem}
          onReset={resetCart}
          onSaveDraft={handleSaveDraft}
          onComplete={handleCompleteCheckout}
          saveState={saveState}
          sessionStatus={sessionStatus}
          canPersist={canPersist}
        />

        <CapturePanel
          customerInfo={customerInfo}
          onCustomerChange={handleCustomerChange}
          vehicleInfo={vehicleInfo}
          onVehicleChange={handleVehicleChange}
          techAssignments={techAssignments}
          onTechChange={handleTechChange}
          employees={employeeOptions}
          serviceNotes={serviceNotes}
          onServiceNotesChange={setServiceNotes}
        />
      </div>
    </div>
  );
}

type ServiceTileGridProps = {
  service?: MiniPosService;
  cartItems: CartItem[];
  onSelect: (item: MiniPosNestedItem, serviceKey: string) => void;
  onSelectOilType: (oil: string) => void;
  selectedOilType: string;
};

function ServiceTileGrid({ service, cartItems, onSelect, onSelectOilType, selectedOilType }: ServiceTileGridProps) {
  if (!service) return null;
  const tiles = (service.nestedItems ?? []).filter((tile) => !isOilTypeTile(service, tile));
  const colors = getServiceColors(service.key);
  const isOilFamily = Boolean(service.oilTypes?.length);

  return (
    <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Nested items</p>
          <h3 className="text-xl font-semibold text-white">{service.label}</h3>
        </div>
        {isOilFamily ? (
          <OilTypeSelector
            oilTypes={service.oilTypes ?? []}
            selected={selectedOilType}
            onSelect={(oil) => onSelectOilType(oil)}
            colors={colors}
          />
        ) : null}
      </div>

      <div className="mt-4 flex h-full flex-col">
        <div className="flex-1">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tiles.map((tile) => {
              const isNote = tile.price === 0;
              const priceLabel = isNote ? "NOTE" : currency.format(tile.price);
              const qty = getCartQtyForButtonId(cartItems, tile.id);
              const isSelected = qty > 0;
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => onSelect(tile, service.key)}
                  className={`relative min-h-[88px] overflow-hidden rounded-2xl border p-4 text-left text-white transition ${colors.baseClass} ${colors.hoverClass ?? ""} ${isSelected ? "ring-2 ring-white/70" : ""}`}
                >
                  <div className="flex h-full flex-col justify-center gap-2">
                    <div className="text-sm font-semibold leading-tight text-white whitespace-normal break-words">{tile.label}</div>
                    <div className="text-sm font-semibold text-white/90">{priceLabel}</div>
                    {isNote ? (
                      <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70">DOCUMENT ONLY</div>
                    ) : null}
                  </div>
                  {qty > 0 ? (
                    <span className="absolute bottom-2 right-2 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white">
                      x{qty}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 border-t border-white/10 pt-3 pb-2 text-center text-[11px] font-semibold tracking-[0.25em] text-white/70">
          TAP TO ADD
        </div>
      </div>
    </div>
  );
}

type SessionStatusBannerProps = {
  savingState: "idle" | "saving" | "saved" | "error";
  statusMessage: string;
  lastSavedAt: string | null;
  sessionStatus: "open" | "closed";
  sessionLoading: boolean;
  loadError: string | null;
  onSaveDraft: () => Promise<string | null> | null;
};

function SessionStatusBanner({
  savingState,
  statusMessage,
  lastSavedAt,
  sessionStatus,
  sessionLoading,
  loadError,
  onSaveDraft,
}: SessionStatusBannerProps) {
  const statusLabel = sessionLoading
    ? "Loading draft…"
    : statusMessage || (sessionStatus === "closed" ? "Session closed" : "Ready for a new work order");
  const timestampLabel = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never";

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Mini POS Session</p>
          <p className="text-base font-semibold text-white">{statusLabel}</p>
          <p className="text-xs text-slate-400">Last saved: {timestampLabel}</p>
          {loadError ? <p className="text-xs text-rose-300">{loadError}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void onSaveDraft?.()}
          disabled={savingState === "saving" || sessionLoading}
          className="inline-flex items-center gap-2 rounded-2xl pm5-teal-border px-4 py-2 text-sm font-semibold pm5-accent-text transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingState === "saving" ? "Saving…" : "Save now"}
        </button>
      </div>
    </section>
  );
}

type CartAndPaymentPanelProps = {
  cartItems: CartItem[];
  subtotal: number;
  discountInput: string;
  onDiscountChange: (value: string) => void;
  taxableSubtotal: number;
  taxRatePctInput: string;
  taxRateSource: "shop" | "zip" | "state" | "none";
  taxAmount: number;
  onTaxRatePctChange: (value: string) => void;
  onAutoTaxRate: () => void;
  onPrintReceipt: () => void;
  onEmailReceipt: () => void;
  totalDue: number;
  paymentMethod: PaymentMethod;
  onPaymentChange: (value: PaymentMethod) => void;
  cashReceived: string;
  onCashChange: (value: string) => void;
  changeDue: number;
  balanceRemaining: number;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  onSaveDraft: () => Promise<string | null> | null;
  onComplete: () => Promise<void> | void;
  saveState: "idle" | "saving" | "saved" | "error";
  sessionStatus: "open" | "closed";
  canPersist: boolean;
};

function CartAndPaymentPanel({
  cartItems,
  subtotal,
  discountInput,
  onDiscountChange,
  taxableSubtotal,
  taxRatePctInput,
  taxRateSource,
  taxAmount,
  onTaxRatePctChange,
  onAutoTaxRate,
  onPrintReceipt,
  onEmailReceipt,
  totalDue,
  paymentMethod,
  onPaymentChange,
  cashReceived,
  onCashChange,
  changeDue,
  balanceRemaining,
  onIncrement,
  onDecrement,
  onRemove,
  onReset,
  onSaveDraft,
  onComplete,
  saveState,
  sessionStatus,
  canPersist,
}: CartAndPaymentPanelProps) {
  const isCartEmpty = cartItems.length === 0;
  const isSaving = saveState === "saving";
  const disableComplete = !canPersist || isSaving || sessionStatus === "closed" || (paymentMethod === "cash" && balanceRemaining > 0);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Active cart</p>
            <h3 className="text-2xl font-semibold text-white">Work order clipboard</h3>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-rose-400/60 hover:text-rose-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset cart
          </button>
        </header>
        <div className="mt-4 space-y-3">
          {isCartEmpty ? (
            <div className="rounded-2xl border border-dashed border-slate-800/80 px-4 py-8 text-center text-sm text-slate-500">
              Add services to start a work order.
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-slate-400">{currency.format(item.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDecrement(item.id)}
                    className="rounded-full border border-slate-700/70 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500"
                  >
                    -
                  </button>
                  <span className="min-w-[2ch] text-center text-sm font-semibold text-white">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onIncrement(item.id)}
                    className="rounded-full border border-slate-700/70 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500"
                  >
                    +
                  </button>
                </div>
                <div className="text-right text-sm text-slate-200">{currency.format(item.price * item.quantity)}</div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-full border border-transparent p-1 text-slate-500 transition hover:border-slate-700 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Cash out terminal</p>
        <h3 className="mt-1 text-2xl font-semibold text-white">Tender & receipts</h3>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-semibold text-white">{currency.format(subtotal)}</span>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Discounts / overrides</span>
            <input
              value={discountInput}
              onChange={(event) => onDiscountChange(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-slate-100 focus:border-emerald-400/70 focus:outline-none"
            />
          </label>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="flex flex-1 flex-col gap-1 text-sm">
                <span className="text-white/70">Tax rate</span>
                <div className="flex items-center gap-2">
                  <input
                    value={taxRatePctInput}
                    onChange={(event) => onTaxRatePctChange(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-28 rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-emerald-400/70 focus:outline-none"
                    aria-label="Tax rate percent"
                  />
                  <span className="text-sm text-white/70">%</span>
                  <button
                    type="button"
                    onClick={onAutoTaxRate}
                    className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-emerald-300/60"
                    aria-label="Auto lookup tax rate"
                  >
                    Auto
                  </button>
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">{taxRateSource !== "none" ? `Source: ${taxRateSource}` : "Manual"}</span>
                </div>
                {/* TODO: restrict manual tax override to DM/Admin once roles are wired to Mini POS. */}
              </label>

              <div className="text-right text-sm">
                <div className="text-white/70">Tax amount</div>
                <div className="text-lg font-semibold text-white">{currency.format(taxAmount)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span>Taxable subtotal</span>
              <span className="font-semibold text-white/80">{currency.format(taxableSubtotal)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Total due</span>
            <span className="text-xl font-semibold text-white">{currency.format(totalDue)}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const isActive = paymentMethod === method.value;
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => onPaymentChange(method.value)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] transition ${
                      isActive
                        ? "pm5-teal-border pm5-teal-soft pm5-accent-text"
                        : "border-slate-800/60 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {method.label}
                </button>
              );
            })}
          </div>
          {paymentMethod === "cash" ? (
            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Cash received</span>
                <input
                  value={cashReceived}
                  onChange={(event) => onCashChange(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-slate-100 focus:border-emerald-400/70 focus:outline-none"
                />
              </label>
              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-3 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Change due</span>
                  <span className="font-semibold text-white">{currency.format(changeDue)}</span>
                </div>
                {balanceRemaining > 0 && (
                  <p className="mt-2 text-xs text-amber-300">Short {currency.format(balanceRemaining)} — collect before closing.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-3 text-sm text-slate-300">
              Record auth # in customer capture. Mark paid once merchant receipt prints.
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onPrintReceipt}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800/70 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-600"
            >
              <Printer className="h-4 w-4" />
              Print receipt
            </button>
            <button
              type="button"
              onClick={onEmailReceipt}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800/70 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-600"
            >
              <Mail className="h-4 w-4" />
              Email customer copy
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void onSaveDraft?.()}
              disabled={!canPersist || isSaving}
              className="inline-flex items-center gap-2 rounded-2xl pm5-teal-border px-4 py-2 text-sm font-semibold pm5-accent-text transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => void onComplete()}
              disabled={disableComplete}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-100/40 pm5-teal-soft px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              Complete checkout
            </button>
          </div>
          {sessionStatus === "closed" && (
            <p className="text-xs text-emerald-300">Session closed — start a new work order to continue.</p>
          )}
        </div>
      </div>
    </section>
  );
}

type CapturePanelProps = {
  customerInfo: CustomerInfo;
  onCustomerChange: (field: keyof CustomerInfo, value: string) => void;
  vehicleInfo: VehicleInfo;
  onVehicleChange: (field: keyof VehicleInfo, value: string) => void;
  techAssignments: TechAssignments;
  onTechChange: (field: keyof TechAssignments, value: string) => void;
  employees: Array<{ id: string; name: string }>;
  serviceNotes: string;
  onServiceNotesChange: (value: string) => void;
};

function CapturePanel({
  customerInfo,
  onCustomerChange,
  vehicleInfo,
  onVehicleChange,
  techAssignments,
  onTechChange,
  employees,
  serviceNotes,
  onServiceNotesChange,
}: CapturePanelProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-emerald-200" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Customer capture</p>
            <h3 className="text-2xl font-semibold text-white">Driver & account details</h3>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField label="Customer name" value={customerInfo.name ?? ""} onChange={(value) => onCustomerChange("name", value)} icon={User} />
          <TextField label="Phone" value={customerInfo.phone ?? ""} onChange={(value) => onCustomerChange("phone", value)} icon={Phone} inputMode="tel" />
          <TextField label="Email" value={customerInfo.email ?? ""} onChange={(value) => onCustomerChange("email", value)} icon={Mail} inputMode="email" />
          <TextField label="Driver name" value={customerInfo.driver ?? ""} onChange={(value) => onCustomerChange("driver", value)} icon={Users} />
          <TextField label="Fleet / account" value={customerInfo.fleetAccount ?? ""} onChange={(value) => onCustomerChange("fleetAccount", value)} icon={ClipboardList} />
          <TextField label="PO / Auth #" value={customerInfo.purchaseOrder ?? ""} onChange={(value) => onCustomerChange("purchaseOrder", value)} icon={Receipt} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6">
        <div className="flex items-center gap-3">
          <Car className="h-5 w-5 text-sky-200" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Vehicle capture</p>
            <h3 className="text-2xl font-semibold text-white">VIN • oil • inspection</h3>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField label="VIN" value={vehicleInfo.vin ?? ""} onChange={(value) => onVehicleChange("vin", value)} icon={ClipboardList} />
          <TextField label="Year" value={vehicleInfo.year ?? ""} onChange={(value) => onVehicleChange("year", value)} icon={NotebookPen} inputMode="numeric" />
          <TextField label="Make" value={vehicleInfo.make ?? ""} onChange={(value) => onVehicleChange("make", value)} icon={Car} />
          <TextField label="Model" value={vehicleInfo.model ?? ""} onChange={(value) => onVehicleChange("model", value)} icon={Car} />
          <TextField label="Mileage" value={vehicleInfo.mileage ?? ""} onChange={(value) => onVehicleChange("mileage", value)} icon={Fuel} inputMode="numeric" />
          <TextField label="License plate" value={vehicleInfo.licensePlate ?? ""} onChange={(value) => onVehicleChange("licensePlate", value)} icon={ClipboardList} />
          <TextField label="Unit #" value={vehicleInfo.unitNumber ?? ""} onChange={(value) => onVehicleChange("unitNumber", value)} icon={ClipboardList} />
          <TextField label="Oil type" value={vehicleInfo.oilType ?? ""} onChange={(value) => onVehicleChange("oilType", value)} icon={Fuel} />
        </div>
        <label className="mt-4 block text-sm text-slate-300">
          <span className="text-slate-400">Vehicle notes</span>
          <textarea
            value={vehicleInfo.notes ?? ""}
            onChange={(event) => onVehicleChange("notes", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/70 focus:outline-none"
          />
        </label>
      </div>

      <div className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-violet-200" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Lane staffing</p>
            <h3 className="text-2xl font-semibold text-white">Assign techs</h3>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["pit", "hood", "safety", "mod"] as const).map((field) => (
            <SelectField
              key={field}
              label={field.charAt(0).toUpperCase() + field.slice(1)}
              value={techAssignments[field] ?? ""}
              onChange={(value) => onTechChange(field, value)}
              options={employees}
            />
          ))}
        </div>
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">Service notes</span>
          <textarea
            value={serviceNotes}
            onChange={(event) => onServiceNotesChange(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400/70 focus:outline-none"
          />
        </label>
      </div>
    </section>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: ComponentType<{ className?: string }>;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
};

function getCartQtyForButtonId(cartItems: CartItem[], buttonId: string): number {
  return cartItems.find((line) => (line.buttonId ?? line.id) === buttonId)?.quantity ?? 0;
}

function TextField({ label, value, onChange, icon: Icon, inputMode }: TextFieldProps) {
  return (
    <label className="text-sm text-slate-300">
      <span className="mb-1 block text-slate-400">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 focus-within:border-emerald-400/70">
        {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          placeholder={label}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <label className="text-sm text-slate-300">
      <span className="mb-1 block text-slate-400">{label}</span>
      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 focus-within:border-emerald-400/70">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-white focus:outline-none"
          aria-label={label}
        >
          <option value="" className="bg-slate-900 text-white/80">
            Select tech
          </option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.name} className="bg-slate-900 text-white">
              {opt.name}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function OilTypeSelector({
  oilTypes,
  selected,
  onSelect,
  colors,
}: {
  oilTypes: string[];
  selected: string;
  onSelect: (oil: string) => void;
  colors: ReturnType<typeof getServiceColors>;
}) {
  if (!oilTypes.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-[0.3em] text-white/70">Oil type</span>
      <div className="flex flex-wrap gap-2">
        {oilTypes.map((oil) => {
          const isActive = selected === oil;
          return (
            <button
              key={oil}
              type="button"
              onClick={() => onSelect(oil)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white ${colors.baseClass} ${
                isActive ? colors.selectedClass : ""
              } ${colors.hoverClass ?? ""}`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {isActive ? <span className="font-black text-red-400">✓</span> : null}
                <span className={isActive ? "font-extrabold" : ""}>{oil}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function isOilTypeTile(service: MiniPosService, tile: MiniPosNestedItem) {
  if (!service.oilTypes?.length) return false;
  const normalized = tile.label.toLowerCase();
  return normalized.includes("oil type") || service.oilTypes.some((oil) => oil.toLowerCase() === normalized) || tile.id.includes("oil-type");
}

function roundCurrency(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

type BayTab = "bay1" | "bay2" | "bay3" | "summary";

export function MiniPosWorkspace() {
  const { shopMeta, loginEmail, needsLogin, hierarchy } = usePocketHierarchy("/pocket-manager5/features/mini-pos");
  const [activeTab, setActiveTab] = useState<BayTab>("bay1");
  const [openRequest, setOpenRequest] = useState<{ bayId: BayId; workOrderId: string } | null>(null);
  const [lastCompletedId, setLastCompletedId] = useState<string | null>(null);

  const [queueItems, setQueueItems] = useState<MiniPosQueueRow[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMenuId, setQueueMenuId] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const shopNumber = shopMeta?.shop_number ?? null;

  const reloadQueue = useCallback(async () => {
    if (!shopNumber) return;
    setQueueLoading(true);
    setQueueError(null);
    try {
      const rows = await listQueue(shopNumber);
      setQueueItems(rows);
    } catch (err) {
      console.error("mini pos queue load failed", err);
      setQueueError("Unable to load queue");
    } finally {
      setQueueLoading(false);
    }
  }, [shopNumber]);

  useEffect(() => {
    void reloadQueue();
    if (!shopNumber) return;
    const unsub = subscribeQueue(shopNumber, () => void reloadQueue());
    return () => unsub();
  }, [reloadQueue, shopNumber]);

  const handleAssignQueue = useCallback(
    async (queueId: string, bayId: BayId) => {
      if (!shopMeta?.id || !shopNumber) return;
      try {
        const result = await assignQueueToBay({
          queueId,
          bayId,
          context: {
            shopId: shopMeta.id,
            shopNumber,
            districtName: hierarchy?.district_name ?? null,
            regionName: hierarchy?.region_name ?? null,
          },
        });
        setQueueMenuId(null);
        setActiveTab((`bay${bayId}` as const) satisfies BayTab);
        setOpenRequest({ bayId, workOrderId: result.workOrderId });
      } catch (err) {
        console.error("assign queue to bay failed", err);
        setQueueError("Assignment failed");
      }
    },
    [hierarchy?.district_name, hierarchy?.region_name, shopMeta?.id, shopNumber],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Service Queue</p>
            <p className="text-sm font-semibold text-white">Tap a pill to assign to Bay 1–3</p>
          </div>
          <div className="flex items-center gap-2">
            {queueLoading ? <span className="text-xs text-white/60">Loading…</span> : null}
            <span className="rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-white">
              {queueItems.length} new
            </span>
          </div>
        </div>
        {queueError ? <p className="mt-2 text-xs text-rose-200">{queueError}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {queueItems.length ? (
            queueItems.map((item) => (
              <div key={item.id} className="relative">
                <button
                  type="button"
                  onClick={() => setQueueMenuId((prev) => (prev === item.id ? null : item.id))}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-white hover:border-emerald-300/50"
                >
                  <span>{item.customer_name?.trim() ? item.customer_name : "New customer"}</span>
                  <span className="text-xs font-semibold text-white/60">{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </button>
                {queueMenuId === item.id ? (
                  <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-xl">
                    <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">Assign to bay</p>
                    <div className="grid gap-2">
                      {[1, 2, 3].map((bay) => (
                        <button
                          key={bay}
                          type="button"
                          onClick={() => void handleAssignQueue(item.id, bay as BayId)}
                          className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-left text-sm font-semibold text-white hover:border-emerald-300/60"
                        >
                          Bay {bay}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/60">No queued customers.</div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "bay1", label: "Bay 1" },
            { key: "bay2", label: "Bay 2" },
            { key: "bay3", label: "Bay 3" },
            { key: "summary", label: "Shop summary" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold text-white transition ${
              activeTab === tab.key ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-slate-900/40 hover:border-white/20"
            }`}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={activeTab === "bay1" ? "" : "hidden"}>
        <MiniPosBayView
          bayId={1}
          shopMeta={shopMeta}
          loginEmail={loginEmail}
          needsLogin={needsLogin}
          hierarchy={hierarchy}
          externalOpenWoId={openRequest?.bayId === 1 ? openRequest.workOrderId : null}
          onOpenedExternalWo={() => setOpenRequest(null)}
          onCheckoutCompleted={(_, workOrderId) => {
            setLastCompletedId(workOrderId);
            setActiveTab("summary");
          }}
        />
      </div>
      <div className={activeTab === "bay2" ? "" : "hidden"}>
        <MiniPosBayView
          bayId={2}
          shopMeta={shopMeta}
          loginEmail={loginEmail}
          needsLogin={needsLogin}
          hierarchy={hierarchy}
          externalOpenWoId={openRequest?.bayId === 2 ? openRequest.workOrderId : null}
          onOpenedExternalWo={() => setOpenRequest(null)}
          onCheckoutCompleted={(_, workOrderId) => {
            setLastCompletedId(workOrderId);
            setActiveTab("summary");
          }}
        />
      </div>
      <div className={activeTab === "bay3" ? "" : "hidden"}>
        <MiniPosBayView
          bayId={3}
          shopMeta={shopMeta}
          loginEmail={loginEmail}
          needsLogin={needsLogin}
          hierarchy={hierarchy}
          externalOpenWoId={openRequest?.bayId === 3 ? openRequest.workOrderId : null}
          onOpenedExternalWo={() => setOpenRequest(null)}
          onCheckoutCompleted={(_, workOrderId) => {
            setLastCompletedId(workOrderId);
            setActiveTab("summary");
          }}
        />
      </div>

      {activeTab === "summary" ? (
        <ShopSummary
          needsLogin={needsLogin}
          shopNumber={shopNumber}
          highlightWorkOrderId={lastCompletedId}
          onOpen={(bayId, workOrderId) => {
            setActiveTab((`bay${bayId}` as const) satisfies BayTab);
            setOpenRequest({ bayId, workOrderId });
          }}
        />
      ) : null}
    </div>
  );
}

function ShopSummary({
  needsLogin,
  shopNumber,
  highlightWorkOrderId,
  onOpen,
}: {
  needsLogin: boolean;
  shopNumber: number | null;
  highlightWorkOrderId: string | null;
  onOpen: (bayId: BayId, workOrderId: string) => void;
}) {
  const [rows, setRows] = useState<ManualWorkOrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!shopNumber) return;
    setLoading(true);
    try {
      const data = await listWorkOrdersAllBays({ statuses: ["draft", "open", "closed"], limit: 400 });
      setRows(data);
    } catch (err) {
      console.error("shop summary load failed", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [shopNumber]);

  useEffect(() => {
    void reload();
    const unsub = subscribeWorkingWos(() => void reload());
    return () => unsub();
  }, [reload]);

  const totals = useMemo(() => {
    const active = rows.filter((r) => r.status === "draft" || r.status === "open");
    const closed = rows.filter((r) => r.status === "closed");
    const totalSales = active.reduce((sum, r) => sum + (Number(r.total_due ?? 0) || 0), 0);
    const byBay: Record<string, { count: number; sales: number }> = { "1": { count: 0, sales: 0 }, "2": { count: 0, sales: 0 }, "3": { count: 0, sales: 0 } };
    active.forEach((r) => {
      const bay = String((r as any).bay_id ?? 1);
      if (!byBay[bay]) byBay[bay] = { count: 0, sales: 0 };
      byBay[bay].count += 1;
      byBay[bay].sales += Number(r.total_due ?? 0) || 0;
    });
    return { count: active.length, sales: totalSales, byBay, active, closed };
  }, [rows]);

  if (needsLogin) {
    return (
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 text-center text-sm text-slate-300">
        Please sign in to access the Mini POS workspace.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Shop summary</p>
          <h2 className="text-2xl font-semibold text-white">Bay rollup</h2>
        </div>
        {loading ? <p className="text-xs text-white/60">Loading…</p> : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Working WOs</div>
          <div className="mt-2 text-2xl font-semibold text-white">{totals.count}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Cars</div>
          <div className="mt-2 text-2xl font-semibold text-white">{totals.count}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Sales</div>
          <div className="mt-2 text-2xl font-semibold text-white">{currency.format(totals.sales)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((bay) => (
          <div key={bay} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Bay {bay}</div>
            <div className="mt-2 text-sm text-white/80">
              {totals.byBay[String(bay)]?.count ?? 0} / {currency.format(totals.byBay[String(bay)]?.sales ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">Active work orders</p>
        </div>
        <div className="mt-3 space-y-2">
          {totals.active.length ? (
            totals.active.map((wo) => {
              const payload = (wo.payload ?? {}) as any;
              const title = payload.customerInfo?.name || `Work Order ${wo.id.slice(0, 6)}`;
              const bay = (wo as any).bay_id ?? 1;
              return (
                <div
                  key={wo.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-900/40 px-4 py-3 ${
                    highlightWorkOrderId === wo.id ? "border-emerald-400/70 ring-2 ring-emerald-300/30" : "border-white/10"
                  }`}
                >
                  <div className="min-w-[220px] flex-1">
                    <div className="text-sm font-semibold text-white">{title}</div>
                    <div className="text-xs text-white/60">Bay {bay} • Updated {new Date(wo.updated_at).toLocaleString()}</div>
                  </div>
                  <div className="text-sm font-semibold text-white">{currency.format(Number(wo.total_due ?? 0) || 0)}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(bay as BayId, wo.id)}
                      className="rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-emerald-300/70"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(`/pocket-manager5/features/mini-pos/receipt/${wo.id}?autoprint=1`, "_blank", "noopener,noreferrer")}
                      className="rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-slate-300/70"
                    >
                      Print
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/60">No active work orders.</div>
          )}
        </div>
      </div>
    </section>
  );
}
