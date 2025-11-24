export interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  btwRate: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  isOptional: boolean;
  isSelectedByCustomer: boolean;
  position: number;
}

export interface QuoteBlock {
  id: string;
  blockType: 'text' | 'pricing_table' | 'pricing_plans' | 'image' | 'signature';
  title?: string;
  description?: string;
  imageUrl?: string;
  isOptional: boolean;
  isSelectedByCustomer: boolean;
  position: number;
  lines: QuoteLine[];
}

export interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  introText?: string;
  footerText?: string;
  blocks: QuoteBlock[];
  customerId?: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'paid';
  validUntil?: Date;
  subtotal: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  btwAmount: number;
  total: number;
}

export interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
}

export interface Service {
  id: string;
  categoryId?: string;
  name: string;
  description?: string;
  defaultPrice: number;
  unit: string;
  btwRate: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  icon?: string;
  services: Service[];
}
