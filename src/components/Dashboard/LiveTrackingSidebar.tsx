import { Package, Clock, ChevronRight, User, MessageCircle, Check, Search } from 'lucide-react';
import type { Delivery } from '../../types';
import { cn } from '../../lib/utils';

interface LiveTrackingSidebarProps {
    deliveries: Delivery[];
    onSelectDelivery?: (id: string) => void;
    onChat?: (delivery: Delivery) => void;
    selectedId?: string | null;
}

const LiveTrackingSidebar: React.FC<LiveTrackingSidebarProps> = ({ deliveries, onSelectDelivery, onChat, selectedId }) => {
    const activeDeliveries = deliveries.filter(d => {
        const isPending = d.status === 'pending';
        if (isPending) {
            const isScheduled = d.items?.scheduledAt || (d as any).scheduled_at;
            return !isScheduled;
        }
        return ['accepted', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery', 'picked_up', 'ready_for_pickup'].includes(d.status);
    });

    const getStepIndex = (status: string) => {
        switch (status) {
            case 'pending':
                return 0;
            case 'accepted':
            case 'arrived_at_pickup':
                return 1;
            case 'ready_for_pickup':
                return 2;
            case 'picked_up':
            case 'in_transit':
                return 3;
            case 'arrived_at_delivery':
            case 'completed':
            case 'delivered':
                return 4;
            default:
                return 0;
        }
    };

    const STEPS = [
        { label: 'Chamando' },
        { label: 'Aceito' },
        { label: 'Pronto' },
        { label: 'A Caminho' },
        { label: 'Entregue' }
    ];

    const getStatusDescription = (status: string) => {
        switch (status) {
            case 'pending':
                return 'Procurando pilotos...';
            case 'accepted':
                return 'Piloto aceitou a corrida...';
            case 'arrived_at_pickup':
                return 'Piloto chegou na loja...';
            case 'ready_for_pickup':
                return 'Pedido pronto na loja...';
            case 'picked_up':
                return 'Pedido coletado...';
            case 'in_transit':
                return 'Em rota de entrega...';
            case 'arrived_at_delivery':
                return 'No local de entrega...';
            default:
                return 'Operando...';
        }
    };

    return (
        <div className="w-full md:w-80 h-[350px] md:h-full bg-chocolate-panel border-t md:border-t-0 md:border-l border-white/5 flex flex-col shadow-2xl z-10">
            <div className="p-6 border-b border-white/5">
                <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Live Tracking
                </h3>
                <p className="text-[10px] text-[#A8A29E] font-bold mt-1 uppercase">{activeDeliveries.length} Entregas Operacionais</p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {activeDeliveries.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-40">
                        <Package className="w-12 h-12 text-[#A8A29E]" />
                        <p className="text-xs font-bold text-[#A8A29E] uppercase tracking-tighter">Nenhuma entrega ativa no momento</p>
                    </div>
                ) : (
                    activeDeliveries.map((delivery) => {
                        const isIFood = delivery.external_source?.toUpperCase() === 'IFOOD' || delivery.origin?.toUpperCase() === 'IFOOD';
                        const is99Food = delivery.external_source?.toUpperCase() === '99FOOD' || delivery.origin?.toUpperCase() === '99FOOD';
                        const isSelected = selectedId === delivery.id;
                        
                        const distanceKm = delivery.delivery_distance;
                        const etaMins = distanceKm ? Math.ceil((distanceKm / 25) * 60) + 5 : (delivery.status === 'accepted' ? 12 : null);

                        const currentStepIndex = getStepIndex(delivery.status);

                        return (
                            <div
                                key={delivery.id}
                                onClick={() => onSelectDelivery?.(delivery.id)}
                                className={cn(
                                    "bg-black/40 backdrop-blur-xl border border-white/10 border-l-[6px] rounded-2xl p-4 group hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden active:scale-[0.99]",
                                    isIFood ? "border-l-red-500 shadow-[0_0_20px_rgba(239,68,68,0.05)]" : 
                                    is99Food ? "border-l-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.05)]" : 
                                    "border-l-guepardo-orange",
                                    isSelected && "ring-2 ring-guepardo-orange/50 shadow-glow-intense border-r-white/20 border-t-white/20 border-b-white/20"
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-guepardo-orange uppercase">
                                            #{delivery.displayId || delivery.items?.displayId || delivery.id.slice(0, 8)}
                                        </span>
                                        {isIFood && (
                                            <span className="px-1.5 py-0.5 rounded bg-red-600/20 text-red-500 text-[8px] font-black uppercase tracking-tighter border border-red-500/30 shadow-[0_0_10px_rgba(220,38,38,0.2)]">
                                                iFood
                                            </span>
                                        )}
                                        {is99Food && (
                                            <span className="px-1.5 py-0.5 rounded bg-yellow-600/20 text-yellow-500 text-[8px] font-black uppercase tracking-tighter border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                                                99Food
                                            </span>
                                        )}
                                    </div>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                                        delivery.status === 'pending' ? 'bg-orange-500/10 text-orange-400 animate-pulse border-orange-500/20' :
                                        delivery.status === 'ready_for_pickup' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-glow-cyan' :
                                        delivery.status === 'in_transit' || delivery.status === 'picked_up' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        delivery.status === 'arrived_at_delivery' || delivery.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    )}>
                                        {delivery.status === 'pending' ? 'Pendente' :
                                         delivery.status === 'accepted' ? 'Aceito' : 
                                         delivery.status === 'ready_for_pickup' ? 'Pedido Pronto' :
                                         delivery.status === 'in_transit' ? 'Em Rota' :
                                         delivery.status === 'picked_up' ? 'Coletado' :
                                         delivery.status === 'arrived_at_pickup' ? 'Na Loja' :
                                         delivery.status === 'arrived_at_delivery' ? 'No Destino' :
                                         delivery.status.replace(/_/g, ' ')}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                                            {delivery.status === 'pending' ? (
                                                <div className="w-full h-full flex items-center justify-center bg-guepardo-orange/10 animate-pulse">
                                                    <Search className="w-4 h-4 text-guepardo-orange" />
                                                </div>
                                            ) : delivery.driver_photo ? (
                                                <img src={delivery.driver_photo} alt={delivery.driver_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="text-white opacity-20 w-5 h-5" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-white truncate">{delivery.status === 'pending' ? 'Alocando...' : (delivery.driver_name || 'Alocando...')}</p>
                                            <p className="text-[10px] text-[#A8A29E] font-bold truncate">De: {delivery.store_name}</p>
                                        </div>
                                    </div>

                                    {/* Timeline Stepper */}
                                    <div className="relative flex items-center justify-between my-4 px-1 select-none">
                                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 rounded-full -translate-y-1/2 -z-0"></div>
                                        <div 
                                            className="absolute top-1/2 left-0 h-0.5 bg-guepardo-orange rounded-full -translate-y-1/2 -z-0 transition-all duration-1000 shadow-[0_0_10px_rgba(255,107,0,0.5)]"
                                            style={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
                                        ></div>

                                        {STEPS.map((step, index) => {
                                            const isCompleted = index <= currentStepIndex;
                                            const isCurrent = index === currentStepIndex;

                                            return (
                                                <div key={step.label} className="relative z-10 flex flex-col items-center">
                                                    <div className={cn(
                                                        "w-4 h-4 rounded flex items-center justify-center border transition-all duration-500 shadow-2xl",
                                                        isCompleted 
                                                            ? "bg-guepardo-orange border-guepardo-orange text-white scale-110 shadow-glow" 
                                                            : "bg-[#1C1917]/80 border-white/5 text-white/10",
                                                        isCurrent && "ring-2 ring-guepardo-orange/30 animate-pulse"
                                                    )}>
                                                        {isCompleted ? (
                                                            <Check size={8} strokeWidth={4} />
                                                        ) : (
                                                            <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                                        )}
                                                    </div>
                                                    <span className={cn(
                                                        "text-[6px] font-black mt-1 uppercase tracking-tighter transition-colors duration-500",
                                                        isCurrent ? "text-guepardo-orange text-shadow-glow" : "text-white/20"
                                                    )}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Telemetry and Dynamic Status Description */}
                                    <div className="space-y-1.5 border-t border-white/5 pt-2">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
                                            <span className="text-[#A8A29E] truncate max-w-[140px]">
                                                {getStatusDescription(delivery.status)}
                                            </span>
                                            <span className="text-white flex items-center gap-1 shrink-0">
                                                <Clock size={10} className="text-guepardo-orange" />
                                                {etaMins ? `${etaMins} min` : 'Calculando ETA'}
                                            </span>
                                        </div>
                                        {distanceKm && (
                                            <p className="text-[9px] text-white/40 font-bold uppercase tracking-tighter italic">
                                                {distanceKm.toFixed(1)} km até o cliente
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectDelivery?.(delivery.id);
                                        }}
                                        className={cn(
                                            "flex-1 py-2 border rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2",
                                            isSelected 
                                                ? "bg-guepardo-orange text-white border-guepardo-orange shadow-glow-sm" 
                                                : "bg-white/5 border-white/10 text-[#A8A29E] hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        {isSelected ? 'Acompanhando' : 'Ver no Mapa'} <ChevronRight size={12} className={cn("transition-transform", isSelected && "rotate-90")} />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onChat?.(delivery);
                                        }}
                                        className="p-2.5 bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/20 rounded-xl transition-all"
                                        title="Intervir no Chat"
                                    >
                                        <MessageCircle size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default LiveTrackingSidebar;
