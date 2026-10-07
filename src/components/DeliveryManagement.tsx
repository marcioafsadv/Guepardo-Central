import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search,
    MapPin,
    Clock,
    User,
    ShoppingBag,
    Radio,
    Utensils,
    ShieldCheck,
    Navigation,
    Bike,
    Store as StoreIcon,
    Eye,
    EyeOff,
    MessageSquare,
    Phone,
    Sparkles,
    FileSpreadsheet,
    FileText,
    X,
    AlertTriangle,
    CheckCircle2,
    List as ListIcon,
    HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Delivery, Profile, Store } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import ChatMultilateral from './ChatMultilateral';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper para calcular tempo decorrido amigável
const formatElapsedTime = (dateString?: string) => {
    if (!dateString) return 'Agora mesmo';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    const hours = Math.floor(diffMinutes / 60);
    const restMin = diffMinutes % 60;
    return `há ${hours}h ${restMin}m`;
};

// ─── MODAL DE RASTREAMENTO GPS EM TEMPO REAL ─────────────────────────────
const TrackingModal = ({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) => {
    const [trackingPoints, setTrackingPoints] = useState<[number, number][]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrackingPoints = async () => {
            try {
                const { data, error } = await supabase
                    .from('delivery_tracking')
                    .select('latitude, longitude')
                    .eq('delivery_id', delivery.id)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                if (data && data.length > 0) {
                    setTrackingPoints(data.map(p => [p.latitude, p.longitude]));
                }
            } catch (err) {
                console.error('Error fetching tracking points:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchTrackingPoints();

        const subscription = supabase
            .channel(`tracking-${delivery.id}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'delivery_tracking', filter: `delivery_id=eq.${delivery.id}` },
                (payload) => {
                    setTrackingPoints(prev => [...prev, [payload.new.latitude, payload.new.longitude]]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [delivery.id]);

    const center: [number, number] = trackingPoints.length > 0
        ? trackingPoints[trackingPoints.length - 1]
        : (delivery.latitude && delivery.longitude ? [delivery.latitude, delivery.longitude] : [-23.2741476, -47.2876003]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#1a0900] border border-orange-500/30 w-full max-w-5xl h-[80vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                            <MapPin className="text-[#FF6B00]" />
                            Rastreamento de Percurso
                            <span className="text-sm font-bold text-[#A8A29E] bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                #{delivery.items?.displayId || delivery.displayId || delivery.id.slice(-4).toUpperCase()}
                            </span>
                        </h3>
                        <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest mt-1">
                            Trajeto em tempo real do Guepardo • {delivery.store_name || 'Lojista'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[#A8A29E] hover:text-white transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 relative bg-black/30">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="w-12 h-12 border-4 border-[#FF6B00]/20 border-t-[#FF6B00] rounded-full animate-spin"></div>
                        </div>
                    ) : trackingPoints.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-4">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                                <HelpCircle className="w-10 h-10 text-[#A8A29E]" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-white font-bold opacity-80">Nenhum ponto de GPS registrado</p>
                                <p className="text-xs text-[#A8A29E] max-w-xs">Aguardando as primeiras coordenadas do entregador em rota.</p>
                            </div>
                        </div>
                    ) : null}

                    <MapContainer
                        center={center}
                        zoom={15}
                        style={{ height: '100%', width: '100%' }}
                        className="z-0"
                    >
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {trackingPoints.length > 1 && (
                            <Polyline
                                positions={trackingPoints}
                                color="#FF6B00"
                                weight={5}
                                opacity={0.8}
                                lineCap="round"
                                lineJoin="round"
                            />
                        )}
                        {trackingPoints.length > 0 && (
                            <Marker position={trackingPoints[0]}>
                                <Popup>Início da Rota</Popup>
                            </Marker>
                        )}
                        {trackingPoints.length > 0 && (
                            <Marker position={trackingPoints[trackingPoints.length - 1]}>
                                <Popup>Posição Atual do Guepardo</Popup>
                            </Marker>
                        )}
                    </MapContainer>
                </div>

                <div className="p-6 bg-black/40 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-wider">Entregador</span>
                            <span className="text-sm font-bold text-white uppercase">{delivery.driver_name || 'Guepardo em Rota'}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-wider">Pontos Capturados</span>
                            <span className="text-sm font-black text-white">{trackingPoints.length} coordenadas</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Monitoramento Realtime</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── MODAL DE DETALHES COMPLETOS DO PEDIDO ──────────────────────────────
interface OrderDetailsModalProps {
    delivery: Delivery;
    onClose: () => void;
    onShowTracking?: (d: Delivery) => void;
    onOpenChat?: (d: Delivery) => void;
}

const OrderDetailsModal = ({ delivery, onClose, onShowTracking, onOpenChat }: OrderDetailsModalProps) => {
    const timelineItems = [
        { 
            label: 'Pedido Criado', 
            description: 'Registrado na plataforma', 
            status: 'completed', 
            time: delivery.created_at 
        },
        { 
            label: 'Aceito', 
            description: 'Entregador aceitou a corrida', 
            status: ['accepted', 'in_transit', 'arrived_at_pickup', 'picked_up', 'arrived_at_delivery', 'completed', 'delivered'].includes(delivery.status) ? 'completed' : 'pending', 
            time: delivery.accepted_at 
        },
        { 
            label: 'Na Loja', 
            description: 'Guepardo no balcão', 
            status: ['arrived_at_pickup', 'picked_up', 'in_transit', 'arrived_at_delivery', 'completed', 'delivered'].includes(delivery.status) ? 'completed' : 'pending', 
            time: delivery.arrived_at_pickup_time 
        },
        { 
            label: 'Pronto p/ Coleta', 
            description: 'Pedido embalado pelo restaurante', 
            status: ['picked_up', 'in_transit', 'arrived_at_delivery', 'completed', 'delivered'].includes(delivery.status) ? 'completed' : 'pending', 
            time: delivery.ready_at_time 
        },
        { 
            label: 'Em Rota', 
            description: 'Deslocando até o cliente', 
            status: ['in_transit', 'arrived_at_delivery', 'completed', 'delivered'].includes(delivery.status) ? 'completed' : 'pending', 
            time: (delivery as any).pickup_time 
        },
        { 
            label: 'Entregue', 
            description: 'Entrega concluída com sucesso', 
            status: ['completed', 'delivered'].includes(delivery.status) ? 'completed' : 'pending', 
            time: delivery.completed_at 
        }
    ];

    const displayNum = delivery.items?.displayId || delivery.displayId || delivery.id.slice(-4).toUpperCase();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#140600] border border-orange-500/30 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white tracking-tight">Pedido #{displayNum}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-[#FF6B00] border border-orange-500/30">
                                {delivery.origin || 'Guepardo'}
                            </span>
                        </div>
                        <p className="text-xs text-[#A8A29E] font-bold uppercase tracking-wider mt-0.5">
                            {delivery.store_name || 'Lojista'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[#A8A29E] hover:text-white transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 scrollbar-guepardo">
                    {delivery.items?.customer_missing && (
                        <div className="bg-red-950/40 border-2 border-red-500/40 rounded-2xl p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase">
                                    <AlertTriangle size={16} className="animate-pulse" />
                                    <span>Protocolo Cliente Ausente (5 Minutos)</span>
                                </div>
                                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-black">
                                    {delivery.items?.customer_missing_action === 'store_return' ? 'Devolução' : 'Descarte'}
                                </span>
                            </div>
                            <p className="text-xs text-white/80">
                                Entregador aguardou na portaria sem retorno do morador.
                            </p>
                        </div>
                    )}

                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                                    <User size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-blue-400/80 font-black uppercase">Cliente</p>
                                    <p className="text-sm font-black text-white">{delivery.customer_name || 'Não informado'}</p>
                                </div>
                            </div>
                            {delivery.customer_phone_suffix && (
                                <span className="text-xs text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 font-bold">
                                    Final: ****-{delivery.customer_phone_suffix}
                                </span>
                            )}
                        </div>
                        <div className="flex items-start gap-2 pt-2 border-t border-white/5 text-xs text-white/80">
                            <MapPin size={14} className="text-[#FF6B00] shrink-0 mt-0.5" />
                            <span>{delivery.customer_address || 'Endereço não informado'}</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                                <Bike size={18} />
                            </div>
                            <div>
                                <p className="text-[10px] text-emerald-400/80 font-black uppercase">Entregador</p>
                                <p className="text-sm font-black text-white">{delivery.driver_name || 'Pendente de Aceite'}</p>
                                {delivery.vehicle_plate && (
                                    <p className="text-[10px] text-white/50 uppercase">{delivery.vehicle_plate}</p>
                                )}
                            </div>
                        </div>
                        {delivery.driver_phone && (
                            <a 
                                href={`tel:${delivery.driver_phone}`} 
                                className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 transition-all"
                                title="Ligar para o entregador"
                            >
                                <Phone size={16} />
                            </a>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                            <span className="text-[9px] text-white/50 uppercase font-black block">Valor Pedido</span>
                            <span className="text-sm font-black text-white">R$ {(delivery.order_value || 0).toFixed(2)}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                            <span className="text-[9px] text-[#FF6B00] uppercase font-black block">Frete</span>
                            <span className="text-sm font-black text-[#FF6B00]">R$ {(delivery.earnings || 0).toFixed(2)}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                            <span className="text-[9px] text-white/50 uppercase font-black block">Distância</span>
                            <span className="text-sm font-black text-white">{(delivery.delivery_distance || 0).toFixed(1)} km</span>
                        </div>
                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                            <span className="text-[9px] text-white/50 uppercase font-black block">Pagamento</span>
                            <span className="text-sm font-black text-white uppercase">{delivery.payment_method || 'PIX'}</span>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <p className="text-[11px] font-black text-white/60 uppercase tracking-wider">Histórico da Jornada</p>
                        <div className="space-y-2">
                            {timelineItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-black/30 border border-white/5 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            item.status === 'completed' ? "bg-emerald-400 shadow-[0_0_6px_#10B981]" : "bg-white/20"
                                        )}></div>
                                        <div>
                                            <span className={cn("font-bold", item.status === 'completed' ? "text-white" : "text-white/40")}>
                                                {item.label}
                                            </span>
                                            <span className="text-[10px] text-white/30 ml-2 hidden sm:inline">
                                                {item.description}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-white/50">
                                        {item.time ? format(new Date(item.time), 'HH:mm:ss') : '--:--:--'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-black/40 border-t border-white/10 flex items-center justify-end gap-3">
                    {onOpenChat && (
                        <button
                            onClick={() => {
                                onClose();
                                onOpenChat(delivery);
                            }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                        >
                            <MessageSquare size={14} className="text-[#FF6B00]" />
                            <span>Abrir Chat</span>
                        </button>
                    )}
                    {onShowTracking && (
                        <button
                            onClick={() => {
                                onClose();
                                onShowTracking(delivery);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-[#FF6B00] to-[#D35400] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-glow"
                        >
                            <MapPin size={14} />
                            <span>Ver Trajeto no Mapa</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── COMPONENTE PRINCIPAL DO GESTOR DE PEDIDOS (DELIVERY MANAGEMENT) ─────────
export default function DeliveryManagement() {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [drivers, setDrivers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    // Modos de Visão: 'kanban' (Quadros 5 Colunas) | 'map' (Mapa ao Vivo) | 'table' (Tabela BI)
    const [viewMode, setViewMode] = useState<'kanban' | 'map' | 'table'>('kanban');

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [channelFilter, setChannelFilter] = useState<'ALL' | 'IFOOD' | '99FOOD' | 'ANOTA_AI' | 'DIRECT'>('ALL');
    const [storeFilter, setStoreFilter] = useState<string>('all');

    // Modo Capinha de Números Grandes (com persistência)
    const [showOrderCover, setShowOrderCover] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('guepardo_kanban_cover_mode');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    // IDs desbloqueados manualmente ao clicar
    const [unlockedOrderIds, setUnlockedOrderIds] = useState<Set<string>>(new Set());

    // Modais
    const [trackingDelivery, setTrackingDelivery] = useState<Delivery | null>(null);
    const [detailsDelivery, setDetailsDelivery] = useState<Delivery | null>(null);
    const [chatDelivery, setChatDelivery] = useState<Delivery | null>(null);

    // Salvar preferência de capinha
    useEffect(() => {
        try {
            localStorage.setItem('guepardo_kanban_cover_mode', JSON.stringify(showOrderCover));
        } catch (e) {
            console.warn('Erro ao salvar cover mode:', e);
        }
    }, [showOrderCover]);

    const toggleUnlockOrder = (orderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setUnlockedOrderIds(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    // Busca de entregas do Supabase
    const fetchDeliveries = useCallback(async () => {
        try {
            const [
                { data: deliveriesData, error: delError },
                { data: profilesData },
                { data: storesData },
                { data: vehiclesData }
            ] = await Promise.all([
                supabase.from('deliveries').select('*').order('created_at', { ascending: false }),
                supabase.from('profiles').select('*'),
                supabase.from('stores').select('*'),
                supabase.from('vehicles').select('*')
            ]);

            if (delError) throw delError;

            const storesList = storesData || [];
            const profilesList = profilesData || [];
            const vehiclesList = vehiclesData || [];

            setStores(storesList);
            setDrivers(profilesList.filter(p => p.role === 'courier'));

            const mapped = (deliveriesData || []).map((d) => {
                const store = storesList.find(s => s.id === d.store_id);
                const driverId = d.driver_id || d.courier_id;
                const driver = profilesList.find(p => p.id === driverId);
                const vehicle = vehiclesList.find(v => v.user_id === driverId);

                const distance = d.delivery_distance || 0;
                const earnings = d.earnings || 0;
                const items = d.items;
                const dispId = items?.displayId || d.displayId || d.id.slice(-4).toUpperCase();

                return {
                    ...d,
                    delivery_distance: distance,
                    earnings,
                    items,
                    displayId: dispId,
                    store_name: store?.fantasy_name || store?.company_name || d.store_name || 'Lojista',
                    store_phone: store?.phone || d.store_phone,
                    driver_name: driver?.full_name || d.driver_name || (driverId ? 'Guepardo' : undefined),
                    driver_photo: driver?.avatar_url || d.driver_photo,
                    driver_phone: driver?.phone || d.driver_phone,
                    vehicle_plate: vehicle?.plate || driver?.vehicle_plate || d.vehicle_plate || 'MOTO',
                    payment_method: items?.paymentMethod || 'PIX',
                    order_value: parseFloat(items?.deliveryValue || '0') || d.order_value || 0,
                    origin: items?.origin || d.origin || (items?.stopNumber ? 'Site' : 'App')
                } as Delivery;
            });

            setDeliveries(mapped);
        } catch (err) {
            console.error('Erro ao buscar pedidos no Supabase:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDeliveries();

        const subscription = supabase
            .channel('deliveries-central-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                fetchDeliveries();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [fetchDeliveries]);

    // Contagem de entregadores online
    const onlineDriversCount = useMemo(() => {
        return drivers.filter(d => d.is_online).length;
    }, [drivers]);

    // Filtragem geral
    const filteredDeliveries = useMemo(() => {
        return deliveries.filter(d => {
            // Filtro por Loja
            if (storeFilter !== 'all') {
                if (d.store_id !== storeFilter && d.store_name !== storeFilter) return false;
            }

            // Filtro por Canal
            const src = (d.origin || d.items?.origin || (d as any).external_source || '').toUpperCase();
            if (channelFilter === 'IFOOD' && !src.includes('IFOOD')) return false;
            if (channelFilter === '99FOOD' && !src.includes('99')) return false;
            if (channelFilter === 'ANOTA_AI' && !src.includes('ANOTA')) return false;
            if (channelFilter === 'DIRECT' && (src.includes('IFOOD') || src.includes('99') || src.includes('ANOTA'))) return false;

            // Busca por texto
            if (searchTerm) {
                const term = searchTerm.trim().toLowerCase();
                const idMatch = d.id.toLowerCase().includes(term);
                const dispMatch = (d.displayId || '').toLowerCase().includes(term);
                const clientMatch = (d.customer_name || '').toLowerCase().includes(term);
                const driverMatch = (d.driver_name || '').toLowerCase().includes(term);
                const storeMatch = (d.store_name || '').toLowerCase().includes(term);
                const addressMatch = (d.customer_address || '').toLowerCase().includes(term);
                if (!idMatch && !dispMatch && !clientMatch && !driverMatch && !storeMatch && !addressMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [deliveries, storeFilter, channelFilter, searchTerm]);

    // ─── CLASSIFICAÇÃO NAS 5 COLUNAS OPERACIONAIS ────────────────────────────
    const colLocating = useMemo(() => {
        return filteredDeliveries.filter(d => {
            if (['completed', 'delivered', 'canceled', 'cancelled'].includes(d.status.toLowerCase())) return false;
            return (!d.driver_id && !d.courier_id) || d.status.toLowerCase() === 'created';
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [filteredDeliveries]);

    const colPrep = useMemo(() => {
        return filteredDeliveries.filter(d => {
            if (['completed', 'delivered', 'canceled', 'cancelled'].includes(d.status.toLowerCase())) return false;
            if (!d.driver_id && !d.courier_id) return false;
            const st = d.status.toLowerCase();
            return ['pending', 'accepted', 'scheduled', 'to_store', 'in_preparation'].includes(st);
        }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [filteredDeliveries]);

    const colReady = useMemo(() => {
        return filteredDeliveries.filter(d => {
            if (['completed', 'delivered', 'canceled', 'cancelled'].includes(d.status.toLowerCase())) return false;
            const st = d.status.toLowerCase();
            return ['ready_for_pickup', 'arrived_at_pickup', 'arrived_at_store'].includes(st);
        }).sort((a, b) => {
            const aAtStore = a.status.toLowerCase().includes('arrived') ? 0 : 1;
            const bAtStore = b.status.toLowerCase().includes('arrived') ? 0 : 1;
            if (aAtStore !== bAtStore) return aAtStore - bAtStore;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
    }, [filteredDeliveries]);

    const colInTransit = useMemo(() => {
        return filteredDeliveries.filter(d => {
            if (['completed', 'delivered', 'canceled', 'cancelled'].includes(d.status.toLowerCase())) return false;
            const st = d.status.toLowerCase();
            return ['in_transit', 'picked_up', 'returning', 'arrived_at_customer', 'arrived_at_delivery'].includes(st);
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [filteredDeliveries]);

    const colDelivered = useMemo(() => {
        return filteredDeliveries.filter(d => {
            const st = d.status.toLowerCase();
            return ['completed', 'delivered'].includes(st);
        }).slice(0, 30);
    }, [filteredDeliveries]);

    // Verificação de Atraso
    const getDelayStatus = (delivery: Delivery) => {
        const now = Date.now();
        const created = new Date(delivery.created_at).getTime();
        const diffMinutes = (now - created) / 60000;

        if (['pending', 'accepted'].includes(delivery.status.toLowerCase()) && diffMinutes > 15) {
            return { minutes: Math.floor(diffMinutes), label: 'Atraso no Preparo' };
        }
        if (['in_transit', 'picked_up'].includes(delivery.status.toLowerCase()) && diffMinutes > 40) {
            return { minutes: Math.floor(diffMinutes), label: 'Atraso na Rota' };
        }
        return null;
    };

    // Badge do Canal
    const renderChannelBadge = (delivery: Delivery) => {
        const src = (delivery.origin || delivery.items?.origin || (delivery as any).external_source || '').toUpperCase();
        if (src.includes('IFOOD')) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
                    iFood
                </span>
            );
        }
        if (src.includes('99')) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    99Food
                </span>
            );
        }
        if (src.includes('ANOTA')) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#7952DE]/20 text-[#c8b6ff] border border-[#7952DE]/40">
                    Anota AI
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-[#FF6B00] border border-orange-500/30">
                Guepardo
            </span>
        );
    };

    // Renderizador da Capinha de Números Grandes Translúcida
    const renderOrderCover = (delivery: Delivery, stepLabel: string, stepColorClass: string) => {
        if (!showOrderCover) return null;
        if (unlockedOrderIds.has(delivery.id)) return null;

        const displayNum = delivery.displayId || delivery.id.slice(-4).toUpperCase();

        return (
            <div
                onClick={(e) => toggleUnlockOrder(delivery.id, e)}
                className="absolute inset-0 z-20 rounded-xl bg-gradient-to-b from-white/[0.18] via-white/[0.09] to-white/[0.04] backdrop-blur-md border border-white/30 hover:border-[#FF6B00]/70 flex flex-col items-center justify-between p-3.5 text-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),0_8px_25px_rgba(0,0,0,0.6)] transition-all duration-300 pointer-events-auto group-hover:opacity-0 group-hover:pointer-events-none group-hover:scale-[0.98] cursor-pointer select-none"
                title="Passe o mouse para espiar ou clique para fixar o card aberto"
            >
                {/* Topo da Capinha */}
                <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {renderChannelBadge(delivery)}
                        <span className="text-[9px] font-bold text-white/70 bg-black/40 px-2 py-0.5 rounded-full truncate max-w-[90px]">
                            {delivery.store_name}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-white/80 font-bold bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                        <Clock size={10} />
                        <span>{formatElapsedTime(delivery.created_at)}</span>
                    </div>
                </div>

                {/* Centro da Capinha: Número Gigante */}
                <div className="my-auto flex flex-col items-center justify-center py-2">
                    <span className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] group-hover:text-[#FF6B00] transition-colors">
                        #{displayNum}
                    </span>
                    <p className="text-xs font-bold text-white/90 truncate max-w-[210px] mt-1 drop-shadow-sm">
                        {delivery.customer_name || 'Cliente'}
                    </p>
                    <span className={cn("mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/60 border border-white/20 shadow-sm", stepColorClass)}>
                        {stepLabel}
                    </span>
                </div>

                {/* Rodapé da Capinha */}
                <div className="w-full flex items-center justify-between pt-1.5 border-t border-white/15 text-[10px]">
                    <span className="font-black text-white/90">
                        R$ {(delivery.order_value || delivery.earnings || 0).toFixed(2).replace('.', ',')}
                    </span>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-white/70 tracking-wider">
                        <Sparkles size={10} className="text-[#FF6B00]" />
                        <span>Passe o mouse ou clique</span>
                    </div>
                </div>
            </div>
        );
    };

    // Exportação Excel
    const handleExportExcel = () => {
        const data = filteredDeliveries.map(d => ({
            'ID Pedido': d.displayId || d.id.slice(-6).toUpperCase(),
            'Status': d.status,
            'Data': d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : '',
            'Cliente': d.customer_name || 'Desconhecido',
            'Endereço': d.customer_address || 'Não informado',
            'Lojista': d.store_name,
            'Entregador': d.driver_name || 'Pendente',
            'Valor': d.earnings || 0
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
        XLSX.writeFile(wb, `guepardo_pedidos_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    };

    // Exportação PDF
    const handleExportPDF = () => {
        try {
            const doc = new jsPDF();
            const head = [['ID', 'Status', 'Data', 'Cliente', 'Lojista', 'Entregador', 'Valor']];
            const body = filteredDeliveries.map(d => [
                d.displayId || d.id.slice(-6).toUpperCase(),
                d.status,
                d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : '',
                d.customer_name || 'Desconhecido',
                d.store_name || 'Lojista',
                d.driver_name || 'Pendente',
                `R$ ${(d.earnings || 0).toFixed(2)}`
            ]);

            doc.text("Relatório Geral de Pedidos - Guepardo Central", 14, 15);
            autoTable(doc, {
                head: head,
                body: body,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [255, 107, 0] }
            });
            doc.save(`guepardo_pedidos_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
        } catch (error) {
            console.error('PDF Export Error:', error);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#0A0400] text-white overflow-hidden select-none relative">
            
            {loading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-[#FF6B00]/20 border-t-[#FF6B00] rounded-full animate-spin"></div>
                </div>
            )}

            {/* ─── BARRA SUPERIOR TÁTICA / FAROL DA OPERAÇÃO ──────────────────────── */}
            <div className="shrink-0 px-4 md:px-6 py-3.5 bg-gradient-to-r from-[#1A0900] via-[#120500] to-[#0A0400] border-b border-white/10 shadow-lg flex flex-wrap items-center justify-between gap-3 z-10">
                
                {/* Lado Esquerdo: Identificação & Indicadores */}
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#D35400] flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,107,0,0.5)]">
                            <ShoppingBag size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base md:text-lg font-black italic tracking-tighter uppercase leading-none">
                                    Gestor de Pedidos
                                </h1>
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/20 text-[#FF6B00] border border-orange-500/30 font-bold uppercase tracking-widest hidden sm:inline-block">
                                    Central de Operações
                                </span>
                            </div>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
                                {colLocating.length + colPrep.length + colReady.length + colInTransit.length} em andamento • {colDelivered.length} entregues hoje
                            </p>
                        </div>
                    </div>

                    {/* Seletor de Loja (Central Master) */}
                    <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5">
                        <StoreIcon size={14} className="text-[#FF6B00]" />
                        <select
                            value={storeFilter}
                            onChange={(e) => setStoreFilter(e.target.value)}
                            className="bg-transparent text-[11px] font-bold text-white outline-none cursor-pointer"
                        >
                            <option value="all" className="bg-[#1a0900]">Todas as Lojas</option>
                            {stores.map(store => (
                                <option key={store.id} value={store.id} className="bg-[#1a0900]">
                                    {store.fantasy_name || store.company_name || 'Lojista'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Contador de Guepardos Online */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-[11px] font-bold">
                        <Bike size={14} className="text-[#FF6B00]" />
                        <span className="text-white/60">Guepardos:</span>
                        <span className="text-[#FF6B00] font-black">{onlineDriversCount} online</span>
                        <span className="text-white/30 text-[10px]">/ {drivers.length}</span>
                    </div>

                    {/* Alternador de Visão: [Quadros] [Mapa ao Vivo] [Tabela BI] */}
                    <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-0.5 shrink-0 shadow-inner">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                                viewMode === 'kanban'
                                    ? "bg-gradient-to-r from-[#FF6B00] to-[#D35400] text-white shadow-[0_0_12px_rgba(255,107,0,0.5)]"
                                    : "text-white/40 hover:text-white"
                            )}
                        >
                            <ShoppingBag size={13} />
                            <span>Quadros</span>
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                                viewMode === 'map'
                                    ? "bg-gradient-to-r from-[#FF6B00] to-[#D35400] text-white shadow-[0_0_12px_rgba(255,107,0,0.5)]"
                                    : "text-white/40 hover:text-white"
                            )}
                        >
                            <MapPin size={13} />
                            <span>Mapa ao Vivo</span>
                            {colInTransit.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                            )}
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                                viewMode === 'table'
                                    ? "bg-gradient-to-r from-[#FF6B00] to-[#D35400] text-white shadow-[0_0_12px_rgba(255,107,0,0.5)]"
                                    : "text-white/40 hover:text-white"
                            )}
                        >
                            <ListIcon size={13} />
                            <span>Tabela BI</span>
                        </button>
                    </div>

                    {/* Alternador de Capinha de Números Grandes */}
                    <button
                        onClick={() => setShowOrderCover(prev => !prev)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all shrink-0 shadow-sm",
                            showOrderCover
                                ? "bg-white/10 border-white/30 text-white hover:bg-white/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                                : "bg-black/50 border-white/10 text-white/40 hover:text-white/80"
                        )}
                        title={showOrderCover ? "Capinha com números grandes ATIVA" : "Capinha de números DESATIVADA"}
                    >
                        {showOrderCover ? <Eye size={13} className="text-[#FF6B00]" /> : <EyeOff size={13} />}
                        <span className="hidden sm:inline">Capinha de Números</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full", showOrderCover ? "bg-[#FF6B00] shadow-[0_0_6px_#FF6B00]" : "bg-white/20")} />
                    </button>
                </div>

                {/* Lado Direito: Filtros, Busca & Ferramentas */}
                <div className="flex items-center gap-2.5 flex-1 justify-end max-w-full">
                    {/* Campo de Busca Rápida */}
                    <div className="relative w-36 sm:w-48 md:w-56">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                            type="text"
                            placeholder="Buscar pedido, cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Chips de Canal */}
                    <div className="hidden xl:flex items-center bg-black/50 border border-white/10 rounded-xl p-0.5 text-[10px] font-bold">
                        <button
                            onClick={() => setChannelFilter('ALL')}
                            className={cn("px-2.5 py-1 rounded-lg transition-colors", channelFilter === 'ALL' ? "bg-[#FF6B00] text-white" : "text-white/50 hover:text-white")}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setChannelFilter('IFOOD')}
                            className={cn("px-2.5 py-1 rounded-lg transition-colors", channelFilter === 'IFOOD' ? "bg-red-600 text-white" : "text-white/50 hover:text-white")}
                        >
                            iFood
                        </button>
                        <button
                            onClick={() => setChannelFilter('99FOOD')}
                            className={cn("px-2.5 py-1 rounded-lg transition-colors", channelFilter === '99FOOD' ? "bg-amber-500 text-black font-black" : "text-white/50 hover:text-white")}
                        >
                            99Food
                        </button>
                        <button
                            onClick={() => setChannelFilter('ANOTA_AI')}
                            className={cn("px-2.5 py-1 rounded-lg transition-colors", channelFilter === 'ANOTA_AI' ? "bg-[#7952DE] text-white font-black" : "text-white/50 hover:text-white")}
                        >
                            Anota AI
                        </button>
                        <button
                            onClick={() => setChannelFilter('DIRECT')}
                            className={cn("px-2.5 py-1 rounded-lg transition-colors", channelFilter === 'DIRECT' ? "bg-orange-600 text-white" : "text-white/50 hover:text-white")}
                        >
                            Direto
                        </button>
                    </div>

                    {/* Exportadores Excel & PDF */}
                    <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
                        <button
                            onClick={handleExportExcel}
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition-all"
                            title="Exportar Excel"
                        >
                            <FileSpreadsheet size={15} />
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all"
                            title="Exportar PDF"
                        >
                            <FileText size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── CONTEÚDO PRINCIPAL: KANBAN OU MAPA OU TABELA ────────────────────── */}
            {viewMode === 'kanban' ? (
                /* ─── KANBAN BOARD (5 COLUNAS OPERACIONAIS + MASCOTE) ─────────────── */
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 md:p-5 flex gap-3 md:gap-4 scrollbar-guepardo min-h-0">
                    
                    {/* ─── COLUNA 1: LOCALIZANDO ENTREGADOR ───────────────────────── */}
                    <div className="flex-1 min-w-[270px] max-w-[340px] flex flex-col bg-[#120500]/70 rounded-2xl border border-orange-500/25 backdrop-blur-md shadow-xl overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-r from-orange-950/60 to-transparent border-b border-orange-500/20 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B00] animate-ping" />
                                <h2 className="text-xs font-black uppercase tracking-wider text-[#FF6B00]">
                                    1. Localizando Entregador
                                </h2>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-[#FF6B00] text-[11px] font-black">
                                {colLocating.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-guepardo">
                            {colLocating.map(delivery => {
                                const delay = getDelayStatus(delivery);
                                return (
                                    <div
                                        key={delivery.id}
                                        onClick={() => setDetailsDelivery(delivery)}
                                        className="group relative bg-black/80 hover:bg-black border border-white/10 hover:border-orange-500/60 rounded-xl p-3.5 transition-all cursor-pointer shadow-lg overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-white group-hover:text-[#FF6B00] transition-colors">
                                                    #{delivery.displayId}
                                                </span>
                                                {renderChannelBadge(delivery)}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold">
                                                <Clock size={11} />
                                                <span>{formatElapsedTime(delivery.created_at)}</span>
                                            </div>
                                        </div>

                                        <p className="text-[11px] font-black text-[#FF6B00] uppercase truncate mb-0.5">
                                            {delivery.store_name}
                                        </p>
                                        <p className="text-xs font-bold text-white truncate mb-1">
                                            {delivery.customer_name || 'Cliente'}
                                        </p>
                                        <p className="text-[10px] text-white/50 truncate flex items-center gap-1 mb-2">
                                            <MapPin size={10} className="shrink-0 text-white/30" />
                                            <span>{delivery.customer_address || 'Endereço'}</span>
                                        </p>

                                        {delay && (
                                            <div className="my-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-black animate-pulse flex items-center gap-1">
                                                <AlertTriangle size={10} />
                                                <span>{delay.label} ({delay.minutes}m)</span>
                                            </div>
                                        )}

                                        <div className="my-2 p-2 bg-orange-950/20 border border-orange-500/20 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[10px] text-[#FF6B00] font-bold">
                                                <Radio size={12} className="animate-pulse" />
                                                <span>Buscando Guepardo...</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                                            <span className="text-white/40">
                                                R$ {(delivery.order_value || delivery.earnings || 0).toFixed(2).replace('.', ',')}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChatDelivery(delivery);
                                                }}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white"
                                                title="Chat"
                                            >
                                                <MessageSquare size={12} className="text-[#FF6B00]" />
                                            </button>
                                        </div>

                                        {renderOrderCover(delivery, 'Aguardando Piloto', 'text-[#FF6B00]')}
                                    </div>
                                );
                            })}

                            {colLocating.length === 0 && (
                                <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-white/20">
                                    <Radio size={32} className="mb-2 opacity-30 animate-pulse" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider">Radar Limpo</p>
                                    <p className="text-[9px] text-white/20 mt-1">Nenhum pedido aguardando entregador</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── COLUNA 2: EM PREPARO ───────────────────────────────────── */}
                    <div className="flex-1 min-w-[270px] max-w-[340px] flex flex-col bg-[#120500]/70 rounded-2xl border border-amber-500/20 backdrop-blur-md shadow-xl overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-r from-amber-950/60 to-transparent border-b border-amber-500/20 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                                    2. Em Preparo
                                </h2>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] font-black">
                                {colPrep.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-guepardo">
                            {colPrep.map(delivery => {
                                const delay = getDelayStatus(delivery);
                                return (
                                <div
                                    key={delivery.id}
                                    onClick={() => setDetailsDelivery(delivery)}
                                    className="group relative bg-black/80 hover:bg-black border border-white/10 hover:border-amber-400/60 rounded-xl p-3.5 transition-all cursor-pointer shadow-lg overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                                                #{delivery.displayId}
                                            </span>
                                            {renderChannelBadge(delivery)}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold">
                                            <Clock size={11} />
                                            <span>{formatElapsedTime(delivery.created_at)}</span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] font-black text-amber-400 uppercase truncate mb-0.5">
                                        {delivery.store_name}
                                    </p>
                                    <p className="text-xs font-bold text-white truncate mb-1">
                                        {delivery.customer_name || 'Cliente'}
                                    </p>
                                    <p className="text-[10px] text-white/50 truncate flex items-center gap-1 mb-2">
                                        <MapPin size={10} className="shrink-0 text-white/30" />
                                        <span>{delivery.customer_address || 'Endereço'}</span>
                                    </p>

                                    {delay && (
                                        <div className="my-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-black animate-pulse flex items-center gap-1">
                                            <AlertTriangle size={10} />
                                            <span>{delay.label} ({delay.minutes}m)</span>
                                        </div>
                                    )}

                                    <div className="my-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Bike size={14} className="text-amber-400 shrink-0" />
                                            <span className="text-[10px] font-bold text-white truncate">
                                                {delivery.driver_name || 'Guepardo a caminho'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                                        <span className="text-white/40">
                                            R$ {(delivery.order_value || delivery.earnings || 0).toFixed(2).replace('.', ',')}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChatDelivery(delivery);
                                                }}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white"
                                            >
                                                <MessageSquare size={12} className="text-amber-400" />
                                            </button>
                                        </div>
                                    </div>

                                    {renderOrderCover(delivery, delivery.driver_name ? `Com ${delivery.driver_name}` : 'Em Preparo', 'text-amber-300')}
                                </div>
                            );})}

                            {colPrep.length === 0 && (
                                <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-white/20">
                                    <Utensils size={32} className="mb-2 opacity-30" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider">Cozinha Livre</p>
                                    <p className="text-[9px] text-white/20 mt-1">Nenhum pedido em preparação</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── COLUNA 3: PRONTO / NA LOJA ─────────────────────────────── */}
                    <div className="flex-1 min-w-[270px] max-w-[340px] flex flex-col bg-[#120500]/70 rounded-2xl border border-cyan-500/20 backdrop-blur-md shadow-xl overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-r from-cyan-950/60 to-transparent border-b border-cyan-500/20 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                                <h2 className="text-xs font-black uppercase tracking-wider text-cyan-300">
                                    3. Pronto / Na Loja
                                </h2>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-[11px] font-black">
                                {colReady.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-guepardo">
                            {colReady.map(delivery => {
                                const isAtStore = delivery.status.toLowerCase().includes('arrived');
                                return (
                                    <div
                                        key={delivery.id}
                                        onClick={() => setDetailsDelivery(delivery)}
                                        className={cn(
                                            "group relative bg-black/80 hover:bg-black border rounded-xl p-3.5 transition-all cursor-pointer shadow-lg overflow-hidden",
                                            isAtStore ? "border-cyan-400/80 ring-2 ring-cyan-500/30 bg-cyan-950/20" : "border-white/10 hover:border-cyan-400/60"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                                                    #{delivery.displayId}
                                                </span>
                                                {renderChannelBadge(delivery)}
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold">
                                                <Clock size={11} />
                                                <span>{formatElapsedTime(delivery.created_at)}</span>
                                            </div>
                                        </div>

                                        <p className="text-[11px] font-black text-cyan-400 uppercase truncate mb-0.5">
                                            {delivery.store_name}
                                        </p>
                                        <p className="text-xs font-bold text-white truncate mb-1">
                                            {delivery.customer_name || 'Cliente'}
                                        </p>
                                        <p className="text-[10px] text-white/50 truncate flex items-center gap-1 mb-2">
                                            <MapPin size={10} className="shrink-0 text-white/30" />
                                            <span>{delivery.customer_address || 'Endereço'}</span>
                                        </p>

                                        <div className="my-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Bike size={14} className="text-cyan-400 shrink-0" />
                                                <span className="text-[10px] font-bold text-white truncate">
                                                    {delivery.driver_name || 'Guepardo no Balcão'}
                                                </span>
                                            </div>
                                            {isAtStore && (
                                                <span className="px-2 py-0.5 bg-cyan-500/30 text-cyan-200 text-[8px] font-black uppercase rounded">
                                                    No Local
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                                            <span className="text-white/40">
                                                R$ {(delivery.order_value || delivery.earnings || 0).toFixed(2).replace('.', ',')}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setChatDelivery(delivery);
                                                    }}
                                                    className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white"
                                                >
                                                    <MessageSquare size={12} className="text-cyan-400" />
                                                </button>
                                            </div>
                                        </div>

                                        {renderOrderCover(delivery, isAtStore ? 'Guepardo na Loja' : 'Pronto p/ Coleta', 'text-cyan-300')}
                                    </div>
                                );
                            })}

                            {colReady.length === 0 && (
                                <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-white/20">
                                    <ShieldCheck size={32} className="mb-2 opacity-30" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider">Balcão Liberado</p>
                                    <p className="text-[9px] text-white/20 mt-1">Nenhum pedido aguardando retirada</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── COLUNA 4: EM ROTA ───────────────────────────────────────── */}
                    <div className="flex-1 min-w-[270px] max-w-[340px] flex flex-col bg-[#120500]/70 rounded-2xl border border-emerald-500/20 backdrop-blur-md shadow-xl overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-r from-emerald-950/60 to-transparent border-b border-emerald-500/20 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                <h2 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                                    4. Em Rota
                                </h2>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-[11px] font-black">
                                {colInTransit.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-guepardo">
                            {colInTransit.map(delivery => {
                                const delay = getDelayStatus(delivery);
                                return (
                                <div
                                    key={delivery.id}
                                    onClick={() => setDetailsDelivery(delivery)}
                                    className="group relative bg-black/80 hover:bg-black border border-white/10 hover:border-emerald-400/60 rounded-xl p-3.5 transition-all cursor-pointer shadow-lg overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">
                                                #{delivery.displayId}
                                            </span>
                                            {renderChannelBadge(delivery)}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-white/40 font-bold">
                                            <Clock size={11} />
                                            <span>{formatElapsedTime(delivery.created_at)}</span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] font-black text-emerald-400 uppercase truncate mb-0.5">
                                        {delivery.store_name}
                                    </p>
                                    <p className="text-xs font-bold text-white truncate mb-1">
                                        {delivery.customer_name || 'Cliente'}
                                    </p>
                                    <p className="text-[10px] text-white/50 truncate flex items-center gap-1 mb-2">
                                        <MapPin size={10} className="shrink-0 text-white/30" />
                                        <span>{delivery.customer_address || 'Endereço'}</span>
                                    </p>

                                    {delay && (
                                        <div className="my-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-black animate-pulse flex items-center gap-1">
                                            <AlertTriangle size={10} />
                                            <span>{delay.label} ({delay.minutes}m)</span>
                                        </div>
                                    )}

                                    {/* Alerta de Ausência se houver */}
                                    {delivery.items?.customer_missing && (
                                        <div className="my-1.5 p-2 rounded-lg bg-red-950/40 border border-red-500/40 flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-1 text-red-400 font-bold">
                                                <AlertTriangle size={12} className="animate-pulse" />
                                                <span>Cliente Ausente (5 Min)</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="my-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Bike size={14} className="text-emerald-400 shrink-0" />
                                            <div className="truncate">
                                                <p className="text-[10px] font-bold text-white truncate">
                                                    {delivery.driver_name || 'Guepardo em Rota'}
                                                </p>
                                                <p className="text-[8px] text-white/40 uppercase">
                                                    {delivery.vehicle_plate || 'Moto'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px]">
                                        <span className="text-white/40">
                                            R$ {(delivery.order_value || delivery.earnings || 0).toFixed(2).replace('.', ',')}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setChatDelivery(delivery);
                                                }}
                                                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white"
                                                title="Chat"
                                            >
                                                <MessageSquare size={12} className="text-emerald-400" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTrackingDelivery(delivery);
                                                }}
                                                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 text-emerald-300 rounded-lg text-[9px] font-bold flex items-center gap-1"
                                                title="Ver Trajeto"
                                            >
                                                <MapPin size={10} />
                                                <span>Rastreio</span>
                                            </button>
                                        </div>
                                    </div>

                                    {renderOrderCover(delivery, 'Em Rota de Entrega', 'text-emerald-300')}
                                </div>
                            );})}

                            {colInTransit.length === 0 && (
                                <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-white/20">
                                    <Navigation size={32} className="mb-2 opacity-30" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider">Sem entregas na rua</p>
                                    <p className="text-[9px] text-white/20 mt-1">Nenhum motoboy em trânsito</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── COLUNA 5: FINALIZADOS ───────────────────────────────────── */}
                    <div className="flex-1 min-w-[270px] max-w-[340px] flex flex-col bg-[#120500]/70 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl overflow-hidden">
                        <div className="p-3.5 bg-gradient-to-r from-white/5 to-transparent border-b border-white/10 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-white/40" />
                                <h2 className="text-xs font-black uppercase tracking-wider text-white/60">
                                    5. Finalizados
                                </h2>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-[11px] font-black">
                                {colDelivered.length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-guepardo">
                            {colDelivered.map(delivery => (
                                <div
                                    key={delivery.id}
                                    onClick={() => setDetailsDelivery(delivery)}
                                    className="group relative bg-black/60 hover:bg-black/90 border border-white/5 hover:border-white/20 rounded-xl p-3 transition-all cursor-pointer opacity-80 hover:opacity-100 overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-white/90">
                                                #{delivery.displayId}
                                            </span>
                                            {renderChannelBadge(delivery)}
                                        </div>
                                        <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Entregue
                                        </span>
                                    </div>

                                    <p className="text-[10px] text-white/50 font-bold truncate">
                                        {delivery.store_name}
                                    </p>
                                    <p className="text-[11px] font-bold text-white/80 truncate mb-1">
                                        {delivery.customer_name || 'Cliente'}
                                    </p>

                                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[10px] text-white/50">
                                        <span>{delivery.driver_name || 'Entregador'}</span>
                                        <span className="font-bold text-white/80">
                                            R$ {(delivery.order_value || delivery.earnings || 0).toFixed(2).replace('.', ',')}
                                        </span>
                                    </div>

                                    {renderOrderCover(delivery, 'Entregue', 'text-emerald-300')}
                                </div>
                            ))}

                            {colDelivered.length === 0 && (
                                <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-white/20">
                                    <Clock size={32} className="mb-2 opacity-30" />
                                    <p className="text-[11px] font-bold uppercase tracking-wider">Ainda nenhum</p>
                                    <p className="text-[9px] text-white/20 mt-1">Os pedidos entregues aparecerão aqui</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── PAINEL DO MASCOTE GUEPARDO 3D COM ILUMINAÇÃO RADIAL ──────── */}
                    <div className="flex-1 min-w-[280px] max-w-[340px] xl:max-w-[420px] hidden lg:flex flex-col items-center justify-center bg-gradient-to-b from-orange-950/25 via-[#120500]/50 to-[#0A0400]/70 rounded-2xl border border-orange-500/20 backdrop-blur-md shadow-2xl p-4 sm:p-6 relative overflow-hidden select-none shrink-0 group transition-all duration-300 hover:border-orange-500/40">
                        {/* Efeito radial suave de luz de fundo */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,107,0,0.22)_0%,rgba(255,107,0,0.06)_50%,transparent_75%)] pointer-events-none" />

                        {/* Halo central de iluminação laranja suave */}
                        <div className="absolute w-80 h-80 xl:w-[380px] xl:h-[380px] rounded-full bg-orange-500/15 blur-3xl pointer-events-none transition-all duration-700 group-hover:scale-105 group-hover:bg-orange-500/25" />

                        {/* Imagem do Mascote Oficial em Grande Destaque */}
                        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                            <img 
                                src="/mascote-guepardo.png" 
                                alt="Mascote Guepardo Delivery" 
                                className="w-full h-full max-h-[580px] xl:max-h-[660px] object-contain drop-shadow-[0_20px_40px_rgba(255,107,0,0.35)] transition-transform duration-500 select-none group-hover:scale-105 group-hover:drop-shadow-[0_25px_50px_rgba(255,107,0,0.5)]"
                                draggable={false}
                            />

                            {/* Pedestal / Sombra e reflexo suave de luz sob as patas */}
                            <div className="w-52 xl:w-64 h-4 rounded-full bg-orange-500/25 blur-md -mt-3 pointer-events-none transition-all duration-500 group-hover:w-60 group-hover:bg-orange-500/40" />
                        </div>
                    </div>

                </div>
            ) : viewMode === 'map' ? (
                /* ─── VISÃO: MAPA AO VIVO GERAL DA CENTRAL ────────────────────────── */
                <div className="flex-1 relative w-full h-full overflow-hidden flex">
                    <MapContainer
                        center={[-23.2741476, -47.2876003]}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        className="z-0"
                    >
                        <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {/* Marcadores de Lojas */}
                        {stores.filter(s => s.lat && s.lng).map(store => (
                            <Marker key={`store-${store.id}`} position={[store.lat!, store.lng!]}>
                                <Popup>
                                    <div className="p-1">
                                        <strong className="block text-sm">{store.fantasy_name || 'Lojista'}</strong>
                                        <span className="text-xs text-gray-600">{store.phone || ''}</span>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {/* Marcadores de Pedidos Ativos */}
                        {colInTransit.concat(colReady).filter(d => d.latitude && d.longitude).map(del => (
                            <Marker key={`del-${del.id}`} position={[del.latitude!, del.longitude!]}>
                                <Popup>
                                    <div className="p-1">
                                        <strong>#{del.displayId}</strong>
                                        <p className="text-xs">{del.customer_name}</p>
                                        <p className="text-xs text-gray-500">{del.customer_address}</p>
                                        <button
                                            onClick={() => setTrackingDelivery(del)}
                                            className="mt-2 text-xs text-orange-600 font-bold underline"
                                        >
                                            Ver Percurso GPS
                                        </button>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            ) : (
                /* ─── VISÃO: TABELA DETALHADA BI COM EXPORTAÇÃO ─────────────────────── */
                <div className="flex-1 overflow-auto p-6 scrollbar-guepardo space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-black/40 text-[#A8A29E] font-black uppercase tracking-wider text-[10px]">
                                    <th className="p-4">ID Pedido</th>
                                    <th className="p-4">Canal</th>
                                    <th className="p-4">Lojista</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4">Entregador</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Valor</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredDeliveries.map(del => (
                                    <tr key={del.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-black text-white">#{del.displayId}</td>
                                        <td className="p-4">{renderChannelBadge(del)}</td>
                                        <td className="p-4 font-bold text-white/90">{del.store_name}</td>
                                        <td className="p-4 text-white/80">{del.customer_name || 'Desconhecido'}</td>
                                        <td className="p-4 text-white/80">{del.driver_name || 'Pendente'}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-white/10 text-white">
                                                {del.status}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-[#FF6B00]">
                                            R$ {(del.order_value || del.earnings || 0).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button
                                                onClick={() => setDetailsDelivery(del)}
                                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[10px] font-bold"
                                            >
                                                Detalhes
                                            </button>
                                            <button
                                                onClick={() => setTrackingDelivery(del)}
                                                className="px-2.5 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-[#FF6B00] rounded text-[10px] font-bold"
                                            >
                                                GPS
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modais Globais */}
            {trackingDelivery && (
                <TrackingModal
                    delivery={trackingDelivery}
                    onClose={() => setTrackingDelivery(null)}
                />
            )}

            {detailsDelivery && (
                <OrderDetailsModal
                    delivery={detailsDelivery}
                    onClose={() => setDetailsDelivery(null)}
                    onShowTracking={(d) => setTrackingDelivery(d)}
                    onOpenChat={(d) => setChatDelivery(d)}
                />
            )}

            {chatDelivery && (
                <ChatMultilateral
                    delivery={chatDelivery}
                    onClose={() => setChatDelivery(null)}
                />
            )}

        </div>
    );
}
