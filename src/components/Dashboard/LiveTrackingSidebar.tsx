import { Package, Clock, ChevronRight, User, MessageCircle } from 'lucide-react';
import type { Delivery } from '../../types';
import { cn } from '../../lib/utils';

interface LiveTrackingSidebarProps {
    deliveries: Delivery[];
    onSelectDelivery?: (id: string) => void;
    onChat?: (delivery: Delivery) => void;
    selectedId?: string | null;
}

const LiveTrackingSidebar: React.FC<LiveTrackingSidebarProps> = ({ deliveries, onSelectDelivery, onChat, selectedId }) => {
    const activeDeliveries = deliveries.filter(d => ['accepted', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery', 'picked_up'].includes(d.status));

    return (
        <div className="w-80 h-full bg-chocolate-panel border-l border-white/5 flex flex-col shadow-2xl z-10">
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
                    activeDeliveries.map((delivery) => (
                        <div
                            key={delivery.id}
                            onClick={() => onSelectDelivery?.(delivery.id)}
                            className={cn(
                                "bg-white/5 border rounded-2xl p-4 group hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden",
                                selectedId === delivery.id ? "border-guepardo-orange bg-guepardo-orange/5 shadow-glow-intense" : "border-white/10"
                            )}
                        >
                            {selectedId === delivery.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-guepardo-orange shadow-glow-intense"></div>
                            )}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-guepardo-orange uppercase">
                                    #{delivery.displayId || delivery.items?.displayId || delivery.id.slice(0, 8)}
                                </span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                                    delivery.status === 'in_transit' || delivery.status === 'picked_up' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        delivery.status === 'arrived_at_delivery' || delivery.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                )}>
                                    {delivery.status === 'accepted' ? 'Aceito' : 
                                     delivery.status === 'in_transit' ? 'Em Rota' :
                                     delivery.status === 'picked_up' ? 'Coletado' :
                                     delivery.status === 'arrived_at_pickup' ? 'Na Loja' :
                                     delivery.status === 'arrived_at_delivery' ? 'No Destino' :
                                     delivery.status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-guepardo-brown-light border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                        {delivery.driver_photo ? (
                                            <img src={delivery.driver_photo} alt={delivery.driver_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="text-white opacity-20 w-5 h-5" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white truncate">{delivery.driver_name || 'Alocando...'}</p>
                                        <p className="text-[10px] text-[#A8A29E] font-bold truncate">De: {delivery.store_name}</p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
                                        <span className="text-[#A8A29E]">Progresso da Rota</span>
                                        <span className="text-white flex items-center gap-1">
                                            <Clock size={10} className="text-guepardo-orange" />
                                            {delivery.status === 'accepted' ? '12 min' : 'Calculando ETA'}
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className="h-full bg-brand-gradient shadow-glow-intense transition-all duration-1000"
                                            style={{ 
                                                width: delivery.status === 'arrived_at_delivery' ? '95%' : 
                                                       delivery.status === 'in_transit' ? '60%' : 
                                                       delivery.status === 'picked_up' ? '45%' : 
                                                       delivery.status === 'arrived_at_pickup' ? '25%' : '10%' 
                                            }}
                                        ></div>
                                    </div>
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
                                        selectedId === delivery.id 
                                            ? "bg-guepardo-orange text-white border-guepardo-orange shadow-glow-sm" 
                                            : "bg-white/5 border-white/10 text-[#A8A29E] hover:text-white hover:bg-white/10"
                                    )}
                                >
                                    {selectedId === delivery.id ? 'Acompanhando' : 'Ver no Mapa'} <ChevronRight size={12} className={cn("transition-transform", selectedId === delivery.id && "rotate-90")} />
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
                    ))
                )}
            </div>
        </div>
    );
};

export default LiveTrackingSidebar;
