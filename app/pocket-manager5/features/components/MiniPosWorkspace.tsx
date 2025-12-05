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
} from "lucide-react";
import { MINI_POS_SERVICES, type MiniPosNestedItem, type MiniPosService } from "../miniPosServices";
import { usePocketHierarchy } from "@/hooks/usePocketHierarchy";
import {
  buildMiniPosSessionPayload,
  createEmptyCustomerInfo,
  createEmptyTechAssignments,
  createEmptyVehicleInfo,
  hydrateMiniPosSession,
} from "@shared/features/mini-pos/sessionUtils";
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

export function MiniPosWorkspace() {
  const { shopMeta, loginEmail, needsLogin } = usePocketHierarchy("/pocket-manager5/features/mini-pos");
  const [activeServiceKey, setActiveServiceKey] = useState<string>(MINI_POS_SERVICES[0]?.key ?? "");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(createEmptyCustomerInfo);
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>(createEmptyVehicleInfo);
  const [techAssignments, setTechAssignments] = useState<TechAssignments>(createEmptyTechAssignments);
  const [serviceNotes, setServiceNotes] = useState<string>("");
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
  const discountValue = Math.min(Math.max(parseFloat(discountInput) || 0, 0), subtotal);
  const totalDue = Math.max(subtotal - discountValue, 0);
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
        totalDue,
        tenderedAmount: paymentMethod === "cash" ? tendered : totalDue,
        changeDue,
        cashReceived: paymentMethod === "cash" ? tendered : 0,
      },
    });
  }, [cartItems, changeDue, customerInfo, discountValue, loginEmail, paymentMethod, sessionId, serviceNotes, shopMeta?.id, shopMeta?.shop_number, subtotal, techAssignments, tendered, totalDue, vehicleInfo]);

  const handleSaveDraft = useCallback(async () => {
    const payload = buildPayload();
    if (!payload) {
      setStatusMessage("Nothing to save yet");
      return null;
    }

    const nextHash = JSON.stringify(payload);
    if (payloadHashRef.current === nextHash && sessionId) {
      return sessionId;
    }

    setSaveState("saving");
    setStatusMessage("Saving draft...");

    try {
      const response = await fetch("/api/mini-pos/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save session");
      }

      const data = (await response.json()) as { sessionId: string };
      setSessionId(data.sessionId);
      setStatusMessage("Draft saved");
      setSaveState("saved");
      setLastSavedAt(new Date().toISOString());
      payloadHashRef.current = nextHash;
      return data.sessionId;
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setStatusMessage("Save failed");
      return null;
    }
  }, [buildPayload, sessionId]);

  const handleCompleteCheckout = useCallback(async () => {
    const ensuredSessionId = (await handleSaveDraft()) ?? sessionId;
    if (!ensuredSessionId) {
      setStatusMessage("Add a cart item or capture info before closing the session.");
      return;
    }

    const payload: MiniPosCompletePayload = {
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
      setStatusMessage("Closing session...");
      const response = await fetch(`/api/mini-pos/session/${ensuredSessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to close session");
      }

      setStatusMessage("Session closed and payment recorded.");
      resetCart();
      setCustomerInfo(createEmptyCustomerInfo());
      setVehicleInfo(createEmptyVehicleInfo());
      setTechAssignments(createEmptyTechAssignments());
      setServiceNotes("");
      setSessionId(null);
      setSessionStatus("open");
      setSaveState("idle");
      setLastSavedAt(null);
      payloadHashRef.current = "";
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setStatusMessage("Unable to close session");
    }
  }, [changeDue, customerInfo.purchaseOrder, handleSaveDraft, loginEmail, paymentMethod, resetCart, sessionId, tendered, totalDue]);

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
    setStatusMessage("Draft restored");
  }, []);

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

  const canPersist = useMemo(() => Boolean(buildPayload()), [buildPayload]);

  if (needsLogin) {
    return (
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 text-center text-sm text-slate-300">
        Please sign in to access the Mini POS workspace.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SessionStatusBanner
        savingState={saveState}
        statusMessage={statusMessage}
        lastSavedAt={lastSavedAt}
        sessionStatus={sessionStatus}
        sessionLoading={sessionLoading}
        loadError={loadError}
        onSaveDraft={handleSaveDraft}
      />
      <section className="rounded-3xl border border-slate-900/70 bg-slate-950/80 p-6 shadow-2xl shadow-black/30">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Service buttons</p>
            <h2 className="text-3xl font-semibold text-white">Pricing decks & oil families</h2>
            <p className="mt-2 text-sm text-slate-400">Tap a service tile to add it to the cart. Oil types and zero-dollar tiles drop in as notes for documentation.</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold">{currency.format(subtotal)}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Live subtotal</p>
          </div>
        </header>
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {MINI_POS_SERVICES.map((service) => (
            <button
              key={service.key}
              type="button"
              onClick={() => setActiveServiceKey(service.key)}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                activeServiceKey === service.key
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                  : "border-slate-800/60 bg-slate-900/60 text-slate-300 hover:border-slate-600"
              }`}
            >
              {service.label}
            </button>
          ))}
        </div>
        <ServiceTileGrid service={activeService} onSelect={handleAddItem} />
        <PricingLegend />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <CartAndPaymentPanel
          cartItems={cartItems}
          subtotal={subtotal}
          discountInput={discountInput}
          onDiscountChange={setDiscountInput}
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
          serviceNotes={serviceNotes}
          onServiceNotesChange={setServiceNotes}
        />
      </div>
    </div>
  );
}

type ServiceTileGridProps = {
  service?: MiniPosService;
  onSelect: (item: MiniPosNestedItem, serviceKey: string) => void;
};

function ServiceTileGrid({ service, onSelect }: ServiceTileGridProps) {
  if (!service) return null;
  const tiles = service.nestedItems ?? [];

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => {
        const isHeader = tile.id.endsWith("header");
        const isNote = tile.price === 0;
        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => onSelect(tile, service.key)}
            disabled={isHeader}
            className={`rounded-2xl border p-4 text-left transition ${
              isHeader
                ? "cursor-default border-slate-800/60 bg-slate-900/40 text-slate-500"
                : "group border-slate-800/60 bg-slate-900/70 text-slate-100 hover:border-emerald-400/40"
            } ${isNote && !isHeader ? "bg-slate-900/40" : ""}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{tile.label}</p>
              {!isHeader && <span className="text-sm text-slate-400">{isNote ? "Note" : currency.format(tile.price)}</span>}
            </div>
            {!isHeader && !isNote && <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Tap to add</p>}
            {!isHeader && isNote && <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Document only</p>}
          </button>
        );
      })}
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
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/60 px-4 py-2 text-sm font-semibold text-emerald-100 transition disabled:cursor-not-allowed disabled:opacity-60"
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
                      ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-100"
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
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600"
            >
              <Printer className="h-4 w-4" />
              Print receipt
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-800/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600"
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
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 px-4 py-2 text-sm font-semibold text-emerald-100 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => void onComplete()}
              disabled={disableComplete}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-100/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
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
          <TextField label="Customer name" value={customerInfo.name} onChange={(value) => onCustomerChange("name", value)} icon={User} />
          <TextField label="Phone" value={customerInfo.phone} onChange={(value) => onCustomerChange("phone", value)} icon={Phone} inputMode="tel" />
          <TextField label="Email" value={customerInfo.email} onChange={(value) => onCustomerChange("email", value)} icon={Mail} inputMode="email" />
          <TextField label="Driver name" value={customerInfo.driver} onChange={(value) => onCustomerChange("driver", value)} icon={Users} />
          <TextField label="Fleet / account" value={customerInfo.fleetAccount} onChange={(value) => onCustomerChange("fleetAccount", value)} icon={ClipboardList} />
          <TextField label="PO / Auth #" value={customerInfo.purchaseOrder} onChange={(value) => onCustomerChange("purchaseOrder", value)} icon={Receipt} />
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
          <TextField label="VIN" value={vehicleInfo.vin} onChange={(value) => onVehicleChange("vin", value)} icon={ClipboardList} />
          <TextField label="Year" value={vehicleInfo.year} onChange={(value) => onVehicleChange("year", value)} icon={NotebookPen} inputMode="numeric" />
          <TextField label="Make" value={vehicleInfo.make} onChange={(value) => onVehicleChange("make", value)} icon={Car} />
          <TextField label="Model" value={vehicleInfo.model} onChange={(value) => onVehicleChange("model", value)} icon={Car} />
          <TextField label="Mileage" value={vehicleInfo.mileage} onChange={(value) => onVehicleChange("mileage", value)} icon={Fuel} inputMode="numeric" />
          <TextField label="License plate" value={vehicleInfo.licensePlate} onChange={(value) => onVehicleChange("licensePlate", value)} icon={ClipboardList} />
          <TextField label="Unit #" value={vehicleInfo.unitNumber} onChange={(value) => onVehicleChange("unitNumber", value)} icon={ClipboardList} />
          <TextField label="Oil type" value={vehicleInfo.oilType} onChange={(value) => onVehicleChange("oilType", value)} icon={Fuel} />
        </div>
        <label className="mt-4 block text-sm text-slate-300">
          <span className="text-slate-400">Vehicle notes</span>
          <textarea
            value={vehicleInfo.notes}
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
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Lane staffing</p>
            <h3 className="text-2xl font-semibold text-white">Assign techs</h3>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Pit" value={techAssignments.pit} onChange={(value) => onTechChange("pit", value)} icon={Users} />
          <TextField label="Hood" value={techAssignments.hood} onChange={(value) => onTechChange("hood", value)} icon={Users} />
          <TextField label="Safety" value={techAssignments.safety} onChange={(value) => onTechChange("safety", value)} icon={Users} />
          <TextField label="Mod" value={techAssignments.mod} onChange={(value) => onTechChange("mod", value)} icon={Users} />
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

function PricingLegend() {
  const highlightServices = MINI_POS_SERVICES.slice(0, 4);
  return (
    <div className="mt-8 rounded-2xl border border-slate-900/70 bg-slate-950/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Price cards</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {highlightServices.map((service) => {
          const pricePoints = (service.nestedItems ?? []).filter((item) => item.price > 0).slice(0, 3);
          return (
            <div key={service.key} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3">
              <p className="text-sm font-semibold text-white">{service.label}</p>
              <ul className="mt-3 space-y-1 text-xs text-slate-400">
                {pricePoints.map((point) => (
                  <li key={point.id} className="flex items-center justify-between text-slate-300">
                    <span>{point.label}</span>
                    <span className="font-semibold text-white">{currency.format(point.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
