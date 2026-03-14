import React from 'react';
import { AlertTriangle, Clock, WifiOff } from 'lucide-react';
import type { Profile, Delivery } from '../../types';

interface ExceptionsWidgetProps {
    drivers: Profile[];
    deliveries: Delivery[];
}

const ExceptionsWidget: React.FC<ExceptionsWidgetProps> = ({ drivers, deliveries }) => {
    // Logic for "Who Vanished": Drivers with no GPS update for > 5 mins
    const vanishedDrivers = drivers.filter(d => {
        if (!d.last_location_update || !d.is_online) return false;
        const lastUpdate = new Date(d.last_location_update);
        const diff = (new Date().getTime() - lastUpdate.getTime()) / 60000;
        return diff > 5;
    });

    // Logic for "Stuck Orders": Differentiated by status
    const stuckDeliveries = deliveries.filter(d => {
        const createdAt = new Date(d.created_at).getTime();
        const now = new Date().getTime();
        const diff = (now - createdAt) / 60000;

        if (['pending', 'accepted'].includes(d.status)) return diff > 15; // 15 mins for prep
        if (['in_transit', 'picked_up'].includes(d.status)) return diff > 40; // 40 mins for delivery
        return false;
    });

    if (vanishedDrivers.length === 0 && stuckDeliveries.length === 0) {
        return (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                    <AlertTriangle className="opacity-40" />
                </div>
                <div>
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Operação Nominal</p>
                    <p className="text-[10px] text-emerald-400/60 font-medium">Nenhuma exceção detectada no momento.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                <AlertTriangle size={12} />
                Gestão por Exceção
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vanishedDrivers.map(driver => (
                    <div key={driver.id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between group hover:bg-red-500/20 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 border border-red-500/30">
                                <WifiOff size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-white uppercase">{driver.full_name}</p>
                                <p className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">Sem atualização GPS - 5 min+</p>
                            </div>
                        </div>
                    </div>
                ))}

                {stuckDeliveries.map(delivery => {
                    const status = ['pending', 'accepted'].includes(delivery.status) ? 'PREPARO' : 'ENTREGA';
                    const diff = Math.floor((new Date().getTime() - new Date(delivery.created_at).getTime()) / 60000);
                    
                    return (
                        <div key={delivery.id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between group hover:bg-red-500/20 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 border border-red-500/30 animate-pulse">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white uppercase">Pedido #{delivery.id.slice(0, 8)}</p>
                                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">ATRASO {status}: {diff} MINUTOS</p>
                                    <p className="text-[8px] text-[#A8A29E] font-medium uppercase tracking-widest mt-0.5">{delivery.store_name}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ExceptionsWidget;
