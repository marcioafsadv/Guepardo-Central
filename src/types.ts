export interface StoreAddress {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    zip_code?: string;
}

export interface Store {
    id: string;
    fantasy_name?: string;
    company_name?: string;
    document?: string;
    status?: 'open' | 'closed' | 'paused' | string;
    balance?: number;
    cancel_rate?: number;
    tipo_pessoa?: string;
    is_active?: boolean;
    lat?: number;
    lng?: number;
    address?: string | StoreAddress;
    cnpj?: string;
    phone?: string;
    created_at?: string;
    onboarding_status?: 'pending' | 'approved' | 'rejected';
    document_url?: string;
    contract_url?: string;
    location_photo_url?: string;
    onboarding_notes?: string;
    logo_url?: string;
}

export interface Profile {
    id: string;
    full_name?: string;
    role: 'admin' | 'merchant' | 'courier';
    latitude?: number;
    longitude?: number;
    current_lat?: number;
    current_lng?: number;
    status?: string;
    is_online?: boolean;
    avatar_url?: string;
    phone?: string;
    birth_date?: string;
    cpf?: string;
    gender?: string;
    pix_key?: string;
    work_city?: string;
    vehicle_type?: string;
    vehicle_model?: string;
    vehicle_color?: string;
    vehicle_plate?: string;
    cnh_number?: string;
    last_location_update?: string;
    active_delivery_id?: string;
    completed_deliveries_count?: number;
    rating?: number;
    metadata?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export interface Address {
    user_id: string;
    street: string;
    number: string;
    district?: string;
    city: string;
    state: string;
    zip_code?: string;
    complement?: string;
    full_name?: string;
}

export interface Vehicle {
    user_id: string;
    model: string;
    plate: string;
    color?: string;
    year?: number;
    cnh_number: string;
    cnh_front_url?: string;
    cnh_back_url?: string;
    crlv_url?: string;
    bike_photo_url?: string;
    full_name?: string;
}

export interface Delivery {
    id: string;
    status: string;
    latitude?: number;
    longitude?: number;
    customer_name?: string;
    customer_address?: string;
    customer_phone_suffix?: string;
    earnings?: number;
    created_at: string;
    store_id: string;
    store_name?: string;
    store_phone?: string;
    driver_id?: string;
    courier_id?: string;
    driver_name?: string;
    driver_photo?: string;
    driver_phone?: string;
    items?: Record<string, any>;
    collection_code?: string;
    delivery_distance?: number;
    estimated_arrival_time?: string;
    pickup_time?: string;
    arrived_at_pickup_time?: string;
    ready_at_time?: string;
    delivery_time?: string;
    cancel_reason?: string;
    accepted_at?: string;
    completed_at?: string;
    displayId?: string;
    calculated_merchant_fee?: number;
    calculated_platform_fee?: number;
    vehicle_plate?: string;
    payment_method?: string;
    order_value?: number;
    origin?: string;
}

export interface DriverWithDetails extends Profile {
    accepted_deliveries?: number;
    rejected_deliveries?: number;
    completed_deliveries?: number;
    total_earnings?: number;
    addresses?: Address;
    vehicles?: Vehicle;
}

export interface Stats {
    activeDeliveries: number;
    onlineDrivers: number;
    activeMerchants: number;
    registeredMerchants: number;
    openMerchants: number;
    closedMerchants: number;
    todayRevenue: number;
    totalDelivered: number;
    totalRevenue: number;
    platformRevenue: number;
    waitingForPickup: number;
    cancelledOrders: number;
}

export interface Conversation {
    id: string;
    order_id: string;
    type: 'courier-customer' | 'store-courier';
    created_at: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id?: string;
    content: string;
    is_admin_intervention: boolean;
    created_at: string;
    sender_name?: string; // Virtual field for UI
}
