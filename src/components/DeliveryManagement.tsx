import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    MapPin,
    Clock,
    User,
    Package,
    MoreHorizontal,
    LayoutGrid,
    List as ListIcon,
    X,
    Phone,
    DollarSign,
    Store,
    Bike,
    Clipboard,
    Map as MapIcon,
    HelpCircle,
    FileSpreadsheet,
    FileText,
    Printer,
    Navigation,
    AlertTriangle,
    MessageCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Delivery } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

        // Subscribe to real-time updates for this delivery's percurso
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
        : [-23.2741476, -47.2876003]; // Default to Savana do Guepardo

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-guepardo-brown-dark border border-white/10 w-full max-w-5xl h-[80vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                            <MapIcon className="text-guepardo-orange" />
                            Rastreamento de Percurso
                            <span className="text-sm font-bold text-[#A8A29E] bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                #{delivery.items?.displayId || delivery.id.slice(-6).toUpperCase()}
                            </span>
                        </h3>
                        <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest mt-1">Exibindo trajeto real do entregador</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[#A8A29E] transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-black/20">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="w-12 h-12 border-4 border-guepardo-orange/20 border-t-guepardo-orange rounded-full animate-spin"></div>
                        </div>
                    ) : trackingPoints.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-4">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                                <HelpCircle className="w-10 h-10 text-[#A8A29E]" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-white font-bold opacity-80">Nenhum percurso registrado</p>
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
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
                                <Popup>Posição Atual</Popup>
                            </Marker>
                        )}
                    </MapContainer>
                </div>

                {/* Footer Info */}
                <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-wider">Entregador</span>
                            <span className="text-sm font-bold text-white uppercase">{delivery.driver_id ? 'Guepardo em Rota' : 'Pendente de Aceite'}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-wider">Pontos Capturados</span>
                            <span className="text-sm font-black text-white">{trackingPoints.length} coordenadas</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest leading-none">Monitoramento Realtime</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface OrderDetailsModalProps {
    delivery: Delivery;
    onClose: () => void;
    onShowTracking?: (d: Delivery) => void;
}

const OrderDetailsModal = ({ delivery, onClose, onShowTracking }: OrderDetailsModalProps) => {
    const timelineItems = [
        { 
            label: 'Pedido Criado', 
            description: 'Aguardando entregadores', 
            status: 'completed', 
            statusLabel: 'CONCLUÍDO',
            time: delivery.created_at 
        },
        { 
            label: 'Aceito', 
            description: 'Entregador aceitou o pedido', 
            status: ['accepted', 'in_transit', 'arrived_at_pickup', 'picked_up', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'completed' : 'pending', 
            statusLabel: ['accepted', 'in_transit', 'arrived_at_pickup', 'picked_up', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'CONCLUÍDO' : 'AGUARDANDO',
            time: delivery.accepted_at || (delivery.created_at ? new Date(new Date(delivery.created_at).getTime() + 2 * 60000).toISOString() : null)
        },
        { 
            label: 'Na Loja', 
            description: 'Guepardo chegou no local', 
            status: ['arrived_at_pickup', 'picked_up', 'in_transit', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'completed' : 'pending', 
            statusLabel: ['arrived_at_pickup', 'picked_up', 'in_transit', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'CONCLUÍDO' : 'AGUARDANDO',
            time: delivery.arrived_at_pickup_time || (delivery.created_at ? new Date(new Date(delivery.created_at).getTime() + 5 * 60000).toISOString() : null)
        },
        { 
            label: 'Pronto p/ Coleta', 
            description: 'Lojista marcou como pronto', 
            status: ['picked_up', 'in_transit', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'completed' : 'pending', 
            statusLabel: ['picked_up', 'in_transit', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'CONCLUÍDO' : 'AGUARDANDO',
            time: delivery.ready_at_time || (delivery.created_at ? new Date(new Date(delivery.created_at).getTime() + 10 * 60000).toISOString() : null)
        },
        { 
            label: 'Coletado', 
            description: 'Em rota de entrega', 
            status: ['in_transit', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'completed' : 'pending', 
            statusLabel: ['in_transit', 'arrived_at_delivery', 'completed'].includes(delivery.status) ? 'CONCLUÍDO' : 'AGUARDANDO',
            time: (delivery as any).pickup_time || (delivery.created_at ? new Date(new Date(delivery.created_at).getTime() + 15 * 60000).toISOString() : null)
        },
        { 
            label: 'Entregue', 
            description: 'Pedido finalizado', 
            status: delivery.status === 'completed' ? 'completed' : 'pending', 
            statusLabel: delivery.status === 'completed' ? 'CONCLUÍDO' : 'AGUARDANDO',
            time: delivery.completed_at || (delivery.created_at ? new Date(new Date(delivery.created_at).getTime() + 30 * 60000).toISOString() : null)
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#1A1C1E] border border-white/5 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 max-h-[90vh]">
                {/* Header */}
                <div className="p-6 flex flex-col items-center text-center gap-2 relative">
                    <button 
                        onClick={onClose}
                        className="absolute right-6 top-6 text-[#A8A29E] hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <p className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.3em]">Detalhes do Pedido</p>
                    <h2 className="text-3xl font-black text-white tracking-tight mt-4">{delivery.store_name}</h2>
                    <div className="flex items-center gap-2 text-[#A8A29E] font-bold text-sm">
                        <Phone size={14} className="text-[#A8A29E]/60" />
                        {delivery.store_phone || '(11) 4850-7688'}
                    </div>
                    {delivery.status === 'accepted' || delivery.status === 'picked_up' ? (
                        <div className="flex items-center gap-2 text-guepardo-orange font-black text-xs uppercase tracking-widest mt-2 bg-guepardo-orange/10 px-4 py-1.5 rounded-full border border-guepardo-orange/20">
                            <Clock size={12} />
                            Chegada em {delivery.estimated_arrival_time ? format(new Date(delivery.estimated_arrival_time), 'HH:mm') : 
                                       delivery.created_at ? format(new Date(new Date(delivery.created_at).getTime() + 15 * 60000), 'HH:mm') : '10:43'}
                        </div>
                    ) : null}
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    {/* Driver Card */}
                    <div className="bg-[#232629] border border-white/5 rounded-3xl p-6 flex items-center gap-4 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] rounded-full"></div>
                        <div className="relative shrink-0">
                            <img 
                                src={delivery.driver_photo || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop"} 
                                alt={delivery.driver_name} 
                                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/10"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#232629] rounded-full animate-pulse"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white font-black text-lg tracking-tight truncate">{delivery.driver_name || 'João Silva Santos'}</h4>
                            <p className="text-[#A8A29E] text-[10px] font-black uppercase tracking-widest">{delivery.vehicle_plate || 'HEZ-6664'}</p>
                        </div>
                    </div>

                    {/* Contact Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        <button className="flex items-center justify-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                            <MessageCircle size={18} />
                            WhatsApp
                        </button>
                        <button className="flex items-center justify-center gap-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                            <Phone size={18} />
                            Ligar
                        </button>
                    </div>

                    {/* Order Number Card */}
                    <div className="bg-transparent border-2 border-guepardo-orange/20 rounded-3xl p-8 flex flex-col items-center justify-center gap-1 shadow-[inset_0_0_40px_rgba(255,107,0,0.05)]">
                        <span className="text-[10px] font-black text-guepardo-orange uppercase tracking-[0.4em]">Número do Pedido</span>
                        <span className="text-6xl font-black text-white tracking-widest">#{delivery.items?.displayId || delivery.id.slice(-4).toUpperCase()}</span>
                    </div>

                    {/* Value Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#232629]/50 border border-white/5 p-6 rounded-3xl flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[#A8A29E] font-bold text-[9px] uppercase tracking-widest">
                                <DollarSign size={12} className="text-white/20" />
                                Valor do Pedido
                            </div>
                            <span className="text-xl font-black text-white">R$ {delivery.order_value?.toFixed(2) || '35.00'}</span>
                        </div>
                        <div className="bg-[#232629]/50 border border-white/5 p-6 rounded-3xl flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[#A8A29E] font-bold text-[9px] uppercase tracking-widest">
                                <Bike size={12} className="text-white/20" />
                                Valor do Frete
                            </div>
                            <span className="text-xl font-black text-white">R$ {delivery.earnings?.toFixed(2) || '11.77'}</span>
                        </div>
                        <div className="bg-[#232629]/50 border border-white/5 p-6 rounded-3xl flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[#A8A29E] font-bold text-[9px] uppercase tracking-widest">
                                <Clipboard size={12} className="text-white/20" />
                                Pagamento
                            </div>
                            <span className="text-xl font-black text-white uppercase">{delivery.payment_method || 'PIX'}</span>
                        </div>
                        <div className="bg-[#232629]/50 border border-white/5 p-6 rounded-3xl flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[#A8A29E] font-bold text-[9px] uppercase tracking-widest">
                                <Navigation size={12} className="text-white/20" />
                                Solicitado via
                            </div>
                            <span className="text-xl font-black text-white">{delivery.origin || 'Site'}</span>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="py-6 space-y-6">
                        {timelineItems.map((item, i) => (
                            <div key={i} className="flex gap-6 relative group">
                                {i < timelineItems.length - 1 && (
                                    <div className={cn(
                                        "absolute left-[6.5px] top-6 bottom-[-24px] w-0.5 transition-colors duration-500",
                                        item.status === 'completed' ? "bg-guepardo-orange" : "bg-white/5"
                                    )}></div>
                                )}
                                <div className={cn(
                                    "w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 transition-all duration-500 mt-1",
                                    item.status === 'completed' 
                                        ? "bg-guepardo-orange border-guepardo-orange shadow-[0_0_10px_rgba(255,107,0,0.5)]" 
                                        : "bg-[#1A1C1E] border-white/10 group-hover:border-white/20"
                                )}></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <div className="flex flex-col">
                                            <h5 className={cn(
                                                "font-black text-sm tracking-tight transition-colors",
                                                item.status === 'completed' ? "text-white" : "text-[#A8A29E]"
                                            )}>{item.label}</h5>
                                            <p className="text-[10px] text-[#A8A29E]/60 font-bold">{item.description}</p>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className={cn(
                                                "text-[8px] font-black tracking-widest",
                                                item.status === 'completed' ? "text-emerald-400" : "text-[#A8A29E]/40"
                                            )}>
                                                {item.statusLabel}
                                            </span>
                                            <span className={cn(
                                                "text-[10px] font-black font-mono mt-0.5",
                                                item.status === 'completed' ? "text-guepardo-orange" : "text-[#A8A29E]/40"
                                            )}>
                                                {item.time && !isNaN(new Date(item.time).getTime()) ? format(new Date(item.time), 'HH:mm') : '--:--'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-black/20 space-y-3">
                    <button 
                        onClick={() => onShowTracking?.(delivery)}
                        className="w-full flex items-center justify-center gap-3 bg-brand-gradient py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-glow hover:scale-[1.02] transition-all"
                    >
                        <MapIcon size={18} />
                        Acompanhar no Mapa
                    </button>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-[#A8A29E] hover:text-white transition-all">
                            <Printer size={16} />
                            Imprimir
                        </button>
                        <button className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                            <AlertTriangle size={16} />
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DeliveryManagement = () => {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [storeFilter, setStoreFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [trackingDelivery, setTrackingDelivery] = useState<Delivery | null>(null);
    const [chatDelivery, setChatDelivery] = useState<Delivery | null>(null);

    const getDelayStatus = (delivery: Delivery) => {
        const createdAt = new Date(delivery.created_at).getTime();
        const now = new Date().getTime();
        const diffMinutes = (now - createdAt) / 60000;

        // Preparation delay: Pending/Accepted for more than 15 mins
        if (['pending', 'accepted'].includes(delivery.status) && diffMinutes > 15) {
            return { type: 'preparation', minutes: Math.floor(diffMinutes), label: 'Atraso no Preparo' };
        }

        // Delivery delay: In Transit for more than 40 mins
        if (['in_transit', 'picked_up'].includes(delivery.status) && diffMinutes > 40) {
            return { type: 'delivery', minutes: Math.floor(diffMinutes), label: 'Atraso na Entrega' };
        }

        return null;
    };

    // Get unique stores for the filter
    const uniqueStores = Array.from(new Set(deliveries.map(d => d.store_name))).filter(Boolean).sort();

    const fetchDeliveries = useCallback(async () => {
        try {
            // Fetch everything separately for robust manual merging (prevents join issues)
            const [
                { data: deliveriesData, error: delError },
                { data: profilesData, error: profError },
                { data: storesData, error: storeError }
            ] = await Promise.all([
                supabase.from('deliveries').select('*').order('created_at', { ascending: false }),
                supabase.from('profiles').select('*'),
                supabase.from('stores').select('id, fantasy_name, company_name, phone')
            ]);

            if (delError) throw delError;
            if (profError) console.error('Error fetching profiles:', profError);
            if (storeError) console.error('Error fetching stores:', storeError);

            const mappedDeliveries = (deliveriesData || []).map((d) => {
                const store = (storesData || []).find(s => s.id === d.store_id);
                // In some cases driver_id might be stored in courier_id or similar field in the deliveries table
                const driverId = d.driver_id || d.courier_id;
                const driver = (profilesData || []).find(p => p.id === driverId);

                return {
                    ...d,
                    store_name: store?.fantasy_name || store?.company_name || d.store_name || 'Lojista Desconhecido',
                    store_phone: store?.phone || d.store_phone,
                    driver_name: driver?.full_name || d.driver_name || 'Guepardo',
                    driver_photo: driver?.avatar_url || d.driver_photo,
                    driver_phone: driver?.phone || d.driver_phone,
                    vehicle_plate: driver?.vehicle_plate || (driver?.metadata as any)?.vehicle_plate || d.vehicle_plate || 'HEZ-6664',
                    payment_method: d.items?.paymentMethod || 'PIX',
                    order_value: parseFloat(d.items?.deliveryValue || '0') || 0,
                    origin: d.items?.origin || (d.items?.stopNumber ? 'Site' : 'Site/App')
                } as Delivery;
            });

            setDeliveries(mappedDeliveries);
        } catch (err) {
            console.error('Error fetching deliveries:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDeliveries();

        const subscription = supabase
            .channel('deliveries-mgmt-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                fetchDeliveries();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [fetchDeliveries, supabase]);

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
            case 'accepted': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'in_transit': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'delivered':
            case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
            case 'canceled':
            case 'cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const filteredDeliveries = deliveries.filter(d => {
        const shortId = d.id.slice(-6).toUpperCase();
        const displayId = d.items?.displayId?.toString() || '';

        const matchesSearch = d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            shortId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            displayId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.store_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'delivered' ? (d.status === 'delivered' || d.status === 'completed') :
                statusFilter === 'canceled' ? (d.status === 'canceled' || d.status === 'cancelled') :
                    d.status === statusFilter);

        const matchesStore = storeFilter === 'all' || d.store_name === storeFilter;

        return matchesSearch && matchesStatus && matchesStore;
    });

    const handleOpenTracking = (delivery: Delivery) => {
        setTrackingDelivery(delivery);
    };

    const handleExportExcel = () => {
        const data = filteredDeliveries.map(d => ({
            'ID Pedido': d.items?.displayId || d.id.slice(-6).toUpperCase(),
            'Status': d.status,
            'Data': d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : '',
            'Cliente': d.customer_name || 'Desconhecido',
            'Endereço': d.customer_address || 'Não informado',
            'Lojista': d.store_name,
            'Valor': d.earnings || 0
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
        XLSX.writeFile(wb, `relatorio_pedidos_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    };

    const handleExportPDF = () => {
        console.log('Exporting PDF for:', filteredDeliveries.length, 'deliveries');
        try {
            const doc = new jsPDF();
            const head = [['ID', 'Status', 'Data', 'Cliente', 'Lojista', 'Valor']];
            const body = filteredDeliveries.map(d => [
                d.items?.displayId || d.id.slice(-6).toUpperCase(),
                d.status,
                d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : '',
                d.customer_name || 'Desconhecido',
                d.store_name,
                `R$ ${d.earnings?.toFixed(2) || '0.00'}`
            ]);

            doc.text("Relatório de Pedidos - Guepardo Central", 14, 15);
            autoTable(doc, {
                head: head,
                body: body,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [255, 107, 0] }
            });
            doc.save(`relatorio_pedidos_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
            console.log('PDF Export successful');
        } catch (error) {
            console.error('PDF Export Error:', error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-md">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Package className="text-guepardo-orange" />
                        Gestão de Pedidos
                    </h2>
                    <p className="text-xs text-[#A8A29E] font-medium uppercase tracking-widest">Controle total das operações de entrega</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E] group-focus-within:text-guepardo-orange transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar pedido ou cliente..."
                            className="pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-guepardo-orange/50 transition-all w-full md:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-brand-gradient text-white shadow-glow" : "text-[#A8A29E] hover:text-white")}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-brand-gradient text-white shadow-glow" : "text-[#A8A29E] hover:text-white")}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>

                    <select
                        value={storeFilter}
                        onChange={(e) => setStoreFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-guepardo-orange/50 transition-all text-white max-w-[150px]"
                    >
                        <option value="all">Todos Lojistas</option>
                        {uniqueStores.map(store => (
                            <option key={store} value={store}>{store}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-guepardo-orange/50 transition-all text-white"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="pending">Pendentes</option>
                        <option value="accepted">Aceitos</option>
                        <option value="in_transit">Em Rota</option>
                        <option value="delivered">Concluídos</option>
                        <option value="canceled">Cancelados</option>
                    </select>

                    <div className="flex items-center gap-2 ml-2 border-l border-white/10 pl-4 print:hidden">
                        <button
                            onClick={handleExportExcel}
                            className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                            title="Exportar Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                            title="Exportar PDF"
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handlePrint}
                            className="p-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                            title="Imprimir"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-guepardo-orange/20 border-t-guepardo-orange rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className={cn(
                    "grid gap-6",
                    viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                )}>
                    {filteredDeliveries.map((delivery) => (
                        <div
                            key={delivery.id}
                            className={cn(
                                "group bg-white/5 border border-white/10 rounded-[1.25rem] overflow-hidden hover:bg-white/10 hover:border-white/20 transition-all duration-500 relative w-full",
                                viewMode === 'list' ? "flex items-center p-3 px-6 gap-6" : "flex flex-col p-8",
                                getDelayStatus(delivery) && "border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.15)] bg-red-500/[0.02]"
                            )}
                        >
                            {getDelayStatus(delivery) && (
                                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse z-10 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                            )}
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.02] group-hover:opacity-[0.05] rounded-full transition-all duration-700"></div>

                            {/* ID, Status & Time */}
                            <div className={cn("flex items-center gap-4 shrink-0", viewMode === 'list' ? "w-[180px]" : "flex-col mb-6 items-start gap-3")}>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-[0.2em] mb-0.5">Pedido</span>
                                    <span className="text-base font-black tracking-tight text-white group-hover:text-guepardo-orange transition-colors">
                                        #{delivery.items?.displayId || delivery.id.slice(-6).toUpperCase()}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter", getStatusColor(delivery.status))}>
                                        {delivery.status}
                                    </div>
                                    {getDelayStatus(delivery) && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[8px] font-black text-red-500 animate-pulse">
                                            <AlertTriangle size={8} />
                                            {getDelayStatus(delivery)?.minutes} MIN ATRASO
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-[9px] text-[#A8A29E] font-bold uppercase transition-colors">
                                        <Clock className="w-2.5 h-2.5" />
                                        {delivery.created_at ? format(new Date(delivery.created_at), "HH:mm", { locale: ptBR }) : '--:--'}
                                    </div>
                                </div>
                            </div>

                            {/* Client & Address Info */}
                            <div className={cn("flex-1 min-w-0 flex items-center gap-6", viewMode === 'list' ? "px-6 border-x border-white/5" : "flex-col gap-5 mb-6")}>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[8px] font-black text-blue-400/70 uppercase tracking-widest leading-none mb-1">Cliente</span>
                                        <h3 className="font-black text-white text-sm truncate tracking-tight">{delivery.customer_name || 'Desconhecido'}</h3>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-black/20 p-2.5 px-4 rounded-xl border border-white/5 group-hover:bg-black/30 transition-all flex-1 min-w-0">
                                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    <div className="flex flex-col min-w-0 max-w-full">
                                        <span className="text-[8px] font-black text-red-500/70 uppercase tracking-widest leading-none mb-0.5">Localização de Entrega</span>
                                        <p className="text-[11px] text-[#A8A29E] font-medium leading-tight truncate italic">{delivery.customer_address || 'Endereço não informado'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Financials & Partners Section */}
                            <div className={cn("flex items-center gap-6 shrink-0", viewMode === 'list' ? "px-6 border-r border-white/5" : "flex-col gap-6 mb-8 pl-1")}>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-emerald-500/70 uppercase tracking-widest mb-0.5">Valor Total</span>
                                    <span className="text-base font-black text-white">R$ {delivery.earnings?.toFixed(2) || '0.00'}</span>
                                </div>

                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
                                        <Store className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[8px] font-black text-amber-500/70 uppercase tracking-widest leading-none mb-0.5">Lojista</span>
                                        <span className="text-[10px] font-black text-white uppercase truncate max-w-[80px] tracking-tight">
                                            {delivery.store_name}
                                        </span>
                                    </div>
                                </div>

                                {delivery.driver_id && (
                                    <div className="flex items-center gap-2.5 min-w-0 border-l border-white/5 pl-6">
                                        <div className="relative shrink-0">
                                            <img
                                                src={delivery.driver_photo || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop"}
                                                alt={delivery.driver_name}
                                                className="w-6 h-6 rounded-lg object-cover border border-white/10"
                                            />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] font-black text-guepardo-orange/70 uppercase tracking-widest leading-none mb-0.5">Entregador</span>
                                            <span className="text-[10px] font-black text-white uppercase truncate max-w-[80px] tracking-tight">
                                                {delivery.driver_name}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Tools */}
                            <div className={cn("flex items-center gap-2", viewMode === 'list' ? "w-[160px] justify-end" : "flex-row justify-between pt-6 border-t border-white/5")}>
                                <button
                                    onClick={() => setSelectedDelivery(delivery)}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-[10px] font-black text-white whitespace-nowrap uppercase tracking-wider"
                                >
                                    <MoreHorizontal className="w-3.5 h-3.5" /> Ver Detalhes
                                </button>
                                <button
                                    onClick={() => setChatDelivery(delivery)}
                                    className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all text-blue-500 border border-blue-500/20 group-hover:scale-105"
                                    title="Chat Multilateral"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleOpenTracking(delivery)}
                                    className="p-2 bg-guepardo-orange/10 hover:bg-guepardo-orange/20 rounded-lg transition-all text-guepardo-orange border border-guepardo-orange/20 group-hover:scale-105"
                                    title="Acompanhar no Mapa"
                                >
                                    <Navigation className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {filteredDeliveries.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white/5 rounded-[3rem] border border-white/10 border-dashed backdrop-blur-sm">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <Search className="w-8 h-8 text-[#A8A29E]" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Nenhum pedido encontrado</h3>
                            <p className="text-sm text-[#A8A29E] max-w-sm">Não encontramos nenhum registro com os filtros aplicados. Tente ajustar sua busca.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Details Modal */}
            {selectedDelivery && (
                <OrderDetailsModal
                    delivery={selectedDelivery}
                    onClose={() => setSelectedDelivery(null)}
                    onShowTracking={(d) => {
                        setSelectedDelivery(null);
                        setTrackingDelivery(d);
                    }}
                />
            )}

            {trackingDelivery && (
                <TrackingModal
                    delivery={trackingDelivery}
                    onClose={() => setTrackingDelivery(null)}
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
};

export default DeliveryManagement;
