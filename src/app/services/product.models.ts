export enum ProductCategory {
  NATURAL_COSMETICS = 'NATURAL_COSMETICS',
  ECO_FRIENDLY_HOME = 'ECO_FRIENDLY_HOME',
  SUSTAINABLE_FASHION = 'SUSTAINABLE_FASHION',
  KITCHEN_AND_DINING = 'KITCHEN_AND_DINING',
  ECO_GARDENING = 'ECO_GARDENING',
  ECO_PET_PRODUCTS = 'ECO_PET_PRODUCTS',
  ECO_GIFT_SETS = 'ECO_GIFT_SETS'
}

export interface Product {
  id: number;
  name: string;
  image: string;
  description: string;
  price: number;
  stock: number;
  category: ProductCategory;
  origin: string;
  isEcological: boolean;
}

export interface Order {
  id?: number;
  createdAt?: string;
  deliveryAddress: string;
  idUser: number;
  notes?: string;
  status: OrderStatus;
  totalAmount: number;
  produits?: Product[];
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED'
}
