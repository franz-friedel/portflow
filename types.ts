import React from 'react';

export type BookingStatus = 'New' | 'Quote Sent' | 'Booked' | 'In Transit' | 'Completed';
export type ServiceType = 'Sea' | 'Air' | 'Road';

export interface ChargeItem {
  code: string;
  description: string;
  type?: string;
  qty: number;
  uom: string;
  unitPrice: number;
  currency: string;
  total: number;
}

export interface Booking {
  id: string;
  referenceNumber: string;
  customerRef?: string;
  dateSubmitted: string;
  customerName: string;
  contactPerson: string;
  customerEmail: string;
  customerPhone: string;
  
  // Routing & Transport
  origin: string;
  destination: string;
  serviceType: ServiceType;
  direction?: 'Export' | 'Import';
  shipmentMode?: string; // FCL, LCL, etc.
  incoterm?: string;
  vesselName?: string;
  voyageNumber?: string;
  mawb?: string;
  awb?: string;
  hawb?: string;
  subBlNo?: string;
  bookingNumber?: string;
  quotationNumber?: string;
  
  // Partners
  shipperName?: string;
  shipperAddress?: string;
  consignee: string;
  consigneeAddress?: string;
  notifyParty?: string;
  overseasAgent?: string;
  coLoader?: string;
  appointedAgent?: string;
  warehouse?: string;
  billTo?: string;
  cargoHandling?: string;
  customsBroker?: string;
  forwardingAgent?: string;
  
  // Cargo Details
  weight: string;
  grossWeight?: number;
  chargeableWeight?: number;
  volumetricWeight?: number;
  dimensions: string;
  commodity: string;
  hsCode?: string;
  pieces?: number;
  volume?: number;
  packageType?: string;
  
  // Dates
  preferredShippingDate?: string;
  requiredDeliveryDate?: string;
  expirationDate?: string;
  jobAwbDate?: string;
  isUrgent: boolean;
  
  // Financials
  status: BookingStatus;
  charges?: ChargeItem[];
  currencyBuy?: string;
  buyRate?: number;
  currencySell?: string;
  sellRate?: number;
  insuranceAmount?: { currency: string; amount: number };
  
  // Internal
  notes?: string;
  specialInstructions?: string;
  timeline: {
    status: BookingStatus;
    date: string;
    note: string;
  }[];
}

export interface User {
  email: string;
  companyName: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
}
