export interface Company {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  industry?: string;
  logoUrl?: string;
  subscriptionPlan: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial' | 'past_due';
  defaultDimensionUnit: 'inches' | 'mm';
  defaultAreaUnit: 'sqft' | 'sqm';
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  _id: string;
  companyId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'Admin' | 'Manager' | 'Staff';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffFormData {
  email: string;
  password?: string; // Optional for updates
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'Admin' | 'Manager' | 'Staff';
}

export interface InviteStaffData {
  email: string;
  role: 'Admin' | 'Manager' | 'Staff';
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface Client {
  _id: string;
  companyId: string;
  clientName: string;
  contactPerson?: string;
  contactNumber: string;
  email?: string;
  billingAddress?: string | Address;
  siteAddress?: string | Address;
  gstin?: string;
  leadSource?: string;
  followUpStatus: 'New Lead' | 'In Discussion' | 'Quoted' | 'Negotiation' | 'Converted' | 'Dropped';
  createdBy: string | Staff;
  notes: ClientNote[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNote {
  _id?: string;
  text: string;
  createdBy: string;
  createdAt: string;
  reminderDate?: string;
}

export interface ClientFormData {
  clientName: string;
  contactPerson?: string;
  contactNumber: string;
  email?: string;
  billingAddress?: string;
  siteAddress?: string;
  gstin?: string;
  leadSource?: string;
  followUpStatus: 'New Lead' | 'In Discussion' | 'Quoted' | 'Negotiation' | 'Converted' | 'Dropped';
  isActive: boolean;
}

export interface ClientHistory {
  _id: string;
  type: 'Quotation' | 'Order' | 'Invoice' | 'StatusChange' | 'Note';
  title: string;
  description?: string;
  date: string;
  amount?: number;
  status?: string;
  documentId?: string;
}

// Quotation interfaces
export interface QuotationItem {
  _id?: string;
  productTypeId: string;
  productTypeNameSnapshot?: string;
  width: number;
  height: number;
  quantity: number;
  itemLabel?: string;
  rawAreaPerItem?: number;
  convertedAreaPerItem?: number;
  roundedAreaPerItem?: number;
  chargeableAreaPerItem?: number;
  totalChargeableArea?: number;
  pricePerAreaUnit: number;
  itemSubtotal?: number;
  materialsSnapshot?: MaterialSnapshot[];
  // Glass and frame specifications (display-only, populated from estimation)
  selectedGlassTypeId?: string;
  selectedGlassTypeNameSnapshot?: string;
  frameColour?: string;
}

export interface MaterialSnapshot {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
}

export interface QuotationCharge {
  _id?: string;
  description: string;
  amount: number;
  isTax?: boolean;
  isPredefined?: boolean;
}

export interface QuotationDiscount {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface ClientSnapshot {
  clientName: string;
  contactPerson?: string;
  contactNumber: string;
  email?: string;
  billingAddress?: string;
  siteAddress?: string;
  gstin?: string;
}

// New type for Quotation History entries
export interface QuotationHistoryEntry {
  status: string;
  notes?: string;
  updatedBy?: string | { _id?: string; firstName?: string; lastName?: string; email?: string; };
  timestamp: string;
}

export interface Quotation {
  _id: string;
  companyId: string;
  quotationIdDisplay: string;
  clientId: string | Client;
  clientSnapshot: ClientSnapshot;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';
  dimensionUnit: 'inches' | 'mm';
  areaUnit: 'sqft' | 'sqm';
  priceUnit: 'sqft' | 'sqm';
  areaRoundingRule?: string;
  minimumChargeableArea?: number;
  items: QuotationItem[];
  charges: QuotationCharge[];
  discount: QuotationDiscount;
  subtotal: number;
  totalCharges: number;
  discountAmount?: number;
  totalTax: number;
  grandTotal: number;
  termsAndConditions?: string;
  notes?: string;
  createdBy: string | Staff;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  history?: QuotationHistoryEntry[];
  companyNameSnapshot?: string;
}

export interface QuotationFormData {
  clientId: string;
  items: Omit<QuotationItem, '_id' | 'productTypeNameSnapshot' | 'rawAreaPerItem' | 'roundedAreaPerItem' | 'chargeableAreaPerItem' | 'totalChargeableArea' | 'itemSubtotal' | 'materialsSnapshot'>[];
  charges?: Omit<QuotationCharge, '_id'>[];
  discount?: QuotationDiscount;
  notes?: string;
  validUntil?: string;
}

export interface QuotationFilters {
  status?: string;
  clientId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
} 