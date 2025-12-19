export type PaymentMethod = "cash" | "credit_card" | "fleet";

export type MiniPosCartLine = {
	id: string;
	buttonId?: string | null;
	serviceKey?: string | null;
	label: string;
	price: number;
	quantity: number;
};

export type MiniPosCartItemPayload = {
	id?: string;
	buttonId?: string | null;
	serviceKey?: string | null;
	label: string;
	price: number;
	quantity: number;
};

export type MiniPosCustomerInfo = {
	name?: string;
	phone?: string;
	email?: string;
	driver?: string;
	fleetAccount?: string;
	purchaseOrder?: string;
};

export type MiniPosVehicleInfo = {
	vin?: string;
	year?: string;
	make?: string;
	model?: string;
	mileage?: string;
	licensePlate?: string;
	unitNumber?: string;
	oilType?: string;
	notes?: string;
};

export type MiniPosTechAssignments = {
	pit?: string;
	hood?: string;
	safety?: string;
	mod?: string;
};

export type MiniPosSessionPayload = {
	sessionId?: string | null;
	shopId: string;
	shopNumber: number | null;
	subtotal: number;
	discountAmount: number;
	taxRate?: number | null;
	taxAmount?: number | null;
	taxableSubtotal?: number | null;
	totalDue: number;
	paymentMethod: PaymentMethod;
	tenderedAmount: number;
	changeDue: number;
	cashReceived: number;
	createdBy?: string | null;
	cartItems: MiniPosCartItemPayload[];
	customerInfo: MiniPosCustomerInfo;
	vehicleInfo: MiniPosVehicleInfo;
	techAssignments: MiniPosTechAssignments;
	serviceNotes: string;
};

export type MiniPosCompletePayload = {
	paymentMethod: PaymentMethod;
	totalDue: number;
	tenderedAmount: number;
	changeDue: number;
	cashReceived: number;
	referenceNumber?: string | null;
	recordedBy?: string | null;
};

export type MiniPosCartItemRecord = {
	id: string;
	button_id: string | null;
	service_key: string | null;
	label: string;
	price: number;
	quantity: number;
};

export type MiniPosCustomerRecord = {
	customer_name: string | null;
	phone: string | null;
	email: string | null;
	driver: string | null;
	fleet_account: string | null;
	purchase_order: string | null;
};

export type MiniPosVehicleRecord = {
	vin: string | null;
	vehicle_year: string | null;
	make: string | null;
	model: string | null;
	mileage: string | null;
	license_plate: string | null;
	unit_number: string | null;
	oil_type: string | null;
	notes: string | null;
};

export type PersistedMiniPosSession = {
	id: string;
	shop_id: string;
	shop_number: number | null;
	session_status: "open" | "closed";
	payment_method: PaymentMethod | null;
	subtotal: number;
	discount_amount: number;
	total_due: number;
	tendered_amount: number | null;
	change_due: number | null;
	cash_received: number | null;
	notes_json: {
		techAssignments?: MiniPosTechAssignments;
		serviceNotes?: string;
		tax?: {
			rate?: number | null;
			amount?: number | null;
			taxableSubtotal?: number | null;
		};
	} | null;
	cart: MiniPosCartItemRecord[];
	customer: MiniPosCustomerRecord | null;
	vehicle: MiniPosVehicleRecord | null;
};

export type MiniPosSessionListResponse = {
	sessions: PersistedMiniPosSession[];
};

export type MiniPosHydratedDraft = {
	sessionId: string;
	sessionStatus: "open" | "closed";
	cartItems: MiniPosCartLine[];
	discountAmount: number;
	taxRate: number;
	taxAmount: number;
	taxableSubtotal: number;
	paymentMethod: PaymentMethod;
	tenderedAmount: number;
	changeDue: number;
	cashReceived: number;
	customerInfo: MiniPosCustomerInfo;
	vehicleInfo: MiniPosVehicleInfo;
	techAssignments: MiniPosTechAssignments;
	serviceNotes: string;
};
