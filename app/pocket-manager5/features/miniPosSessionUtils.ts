import type {
  MiniPosCartItemRecord,
  MiniPosCartLine,
  MiniPosCustomerInfo,
  MiniPosHydratedDraft,
  MiniPosSessionPayload,
  MiniPosTechAssignments,
  MiniPosVehicleInfo,
  PaymentMethod,
  PersistedMiniPosSession,
} from "./miniPosTypes";

export type MiniPosTotalsSnapshot = {
  subtotal: number;
  discountAmount?: number;
  totalDue: number;
  tenderedAmount: number;
  changeDue: number;
  cashReceived: number;
};

export type MiniPosSessionDraft = {
  cartItems: MiniPosCartLine[];
  customerInfo?: MiniPosCustomerInfo;
  vehicleInfo?: MiniPosVehicleInfo;
  techAssignments?: MiniPosTechAssignments;
  serviceNotes?: string;
};

export type MiniPosSessionContext = {
  sessionId?: string | null;
  shopId?: string | null;
  shopNumber?: number | null;
  paymentMethod: PaymentMethod;
  createdBy?: string | null;
};

export type BuildMiniPosPayloadArgs = {
  context: MiniPosSessionContext;
  draft: MiniPosSessionDraft;
  totals: MiniPosTotalsSnapshot;
};

const clampCurrency = (value: number, min = 0, max?: number) => {
  if (Number.isNaN(value)) return min;
  const lower = Math.max(min, value);
  if (typeof max === "number") {
    return Math.min(lower, max);
  }
  return lower;
};

const normalizeCustomer = (customer?: MiniPosCustomerInfo): MiniPosCustomerInfo => ({
  name: customer?.name ?? "",
  phone: customer?.phone ?? "",
  email: customer?.email ?? "",
  driver: customer?.driver ?? "",
  fleetAccount: customer?.fleetAccount ?? "",
  purchaseOrder: customer?.purchaseOrder ?? "",
});

const normalizeVehicle = (vehicle?: MiniPosVehicleInfo): MiniPosVehicleInfo => ({
  vin: vehicle?.vin ?? "",
  year: vehicle?.year ?? "",
  make: vehicle?.make ?? "",
  model: vehicle?.model ?? "",
  mileage: vehicle?.mileage ?? "",
  licensePlate: vehicle?.licensePlate ?? "",
  unitNumber: vehicle?.unitNumber ?? "",
  oilType: vehicle?.oilType ?? "",
  notes: vehicle?.notes ?? "",
});

const normalizeTechAssignments = (assignments?: MiniPosTechAssignments): MiniPosTechAssignments => ({
  pit: assignments?.pit ?? "",
  hood: assignments?.hood ?? "",
  safety: assignments?.safety ?? "",
  mod: assignments?.mod ?? "",
});

const hasCapturedDetails = (input: MiniPosSessionDraft): boolean => {
  if (input.serviceNotes?.trim()) {
    return true;
  }

  const customer = normalizeCustomer(input.customerInfo);
  if (Object.values(customer).some(Boolean)) {
    return true;
  }

  const vehicle = normalizeVehicle(input.vehicleInfo);
  if (Object.values(vehicle).some(Boolean)) {
    return true;
  }

  const techAssignments = normalizeTechAssignments(input.techAssignments);
  return Object.values(techAssignments).some(Boolean);
};

export const createEmptyCustomerInfo = (): MiniPosCustomerInfo => normalizeCustomer();

export const createEmptyVehicleInfo = (): MiniPosVehicleInfo => normalizeVehicle();

export const createEmptyTechAssignments = (): MiniPosTechAssignments => normalizeTechAssignments();

export const mapCartRecordToLine = (record: MiniPosCartItemRecord): MiniPosCartLine => ({
  id: record.button_id ?? record.id,
  buttonId: record.button_id,
  serviceKey: record.service_key,
  label: record.label,
  price: record.price,
  quantity: record.quantity,
});

export const hydrateMiniPosSession = (
  session: PersistedMiniPosSession | null,
): MiniPosHydratedDraft | null => {
  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    sessionStatus: session.session_status,
    cartItems: (session.cart ?? []).map(mapCartRecordToLine),
    discountAmount: session.discount_amount ?? 0,
    paymentMethod: session.payment_method ?? "cash",
    tenderedAmount: session.tendered_amount ?? 0,
    changeDue: session.change_due ?? 0,
    cashReceived: session.cash_received ?? 0,
    customerInfo: normalizeCustomer({
      name: session.customer?.customer_name ?? undefined,
      phone: session.customer?.phone ?? undefined,
      email: session.customer?.email ?? undefined,
      driver: session.customer?.driver ?? undefined,
      fleetAccount: session.customer?.fleet_account ?? undefined,
      purchaseOrder: session.customer?.purchase_order ?? undefined,
    }),
    vehicleInfo: normalizeVehicle({
      vin: session.vehicle?.vin ?? undefined,
      year: session.vehicle?.vehicle_year ?? undefined,
      make: session.vehicle?.make ?? undefined,
      model: session.vehicle?.model ?? undefined,
      mileage: session.vehicle?.mileage ?? undefined,
      licensePlate: session.vehicle?.license_plate ?? undefined,
      unitNumber: session.vehicle?.unit_number ?? undefined,
      oilType: session.vehicle?.oil_type ?? undefined,
      notes: session.vehicle?.notes ?? undefined,
    }),
    techAssignments: normalizeTechAssignments({
      pit: session.notes_json?.techAssignments?.pit ?? undefined,
      hood: session.notes_json?.techAssignments?.hood ?? undefined,
      safety: session.notes_json?.techAssignments?.safety ?? undefined,
      mod: session.notes_json?.techAssignments?.mod ?? undefined,
    }),
    serviceNotes: session.notes_json?.serviceNotes ?? "",
  };
};

export const buildMiniPosSessionPayload = (
  args: BuildMiniPosPayloadArgs,
): MiniPosSessionPayload | null => {
  const { context, draft, totals } = args;
  if (!context.shopId) {
    return null;
  }

  const cartItems = draft.cartItems ?? [];
  const hasCart = cartItems.length > 0;
  const hasCapture = hasCapturedDetails(draft);

  if (!hasCart && !hasCapture) {
    return null;
  }

  const normalizedTotals: MiniPosTotalsSnapshot = {
    subtotal: clampCurrency(totals.subtotal, 0),
    discountAmount: clampCurrency(totals.discountAmount ?? 0, 0, totals.subtotal),
    totalDue: clampCurrency(totals.totalDue, 0),
    tenderedAmount: clampCurrency(totals.tenderedAmount, 0),
    changeDue: clampCurrency(totals.changeDue ?? 0, 0),
    cashReceived: clampCurrency(totals.cashReceived ?? 0, 0),
  };

  return {
    sessionId: context.sessionId ?? null,
    shopId: context.shopId,
    shopNumber: context.shopNumber ?? null,
    subtotal: normalizedTotals.subtotal,
    discountAmount: normalizedTotals.discountAmount ?? 0,
    totalDue: normalizedTotals.totalDue,
    paymentMethod: context.paymentMethod,
    tenderedAmount: normalizedTotals.tenderedAmount,
    changeDue: normalizedTotals.changeDue,
    cashReceived: normalizedTotals.cashReceived,
    createdBy: context.createdBy ?? null,
    cartItems: cartItems.map((item) => ({
      id: item.id,
      buttonId: item.buttonId ?? item.id,
      serviceKey: item.serviceKey ?? null,
      label: item.label,
      price: item.price,
      quantity: item.quantity,
    })),
    customerInfo: normalizeCustomer(draft.customerInfo),
    vehicleInfo: normalizeVehicle(draft.vehicleInfo),
    techAssignments: normalizeTechAssignments(draft.techAssignments),
    serviceNotes: draft.serviceNotes ?? "",
  };
};
