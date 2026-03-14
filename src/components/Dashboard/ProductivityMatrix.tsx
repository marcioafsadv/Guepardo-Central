import React from 'react';
import { Award, Store } from 'lucide-react';
import type { Profile, Store as StoreType, Delivery } from '../../types';

interface ProductivityMatrixProps {
    drivers: Profile[];
    merchants: StoreType[];
    deliveries: Delivery[];
}

const ProductivityMatrix: React.FC<ProductivityMatrixProps> = ({ drivers, merchants, deliveries }) => {
    // Process Real Driver Performance
    const driverStats = deliveries
        .filter(d => d.status === 'delivered' || d.status === 'completed')
        .reduce((acc, d) => {
            if (!d.driver_id) return acc;
            if (!acc[d.driver_id]) {
                acc[d.driver_id] = { count: 0, totalTime: 0, samples: 0 };
            }
            acc[d.driver_id].count++;

            if (d.pickup_time && d.delivery_time) {
                const diff = new Date(d.delivery_time).getTime() - new Date(d.pickup_time).getTime();
                if (diff > 0) {
                    acc[d.driver_id].totalTime += diff;
                    acc[d.driver_id].samples++;
                }
            }
            return acc;
        }, {} as Record<string, { count: number, totalTime: number, samples: number }>);

    const topDrivers = drivers
        .map(d => ({
            ...d,
            deliveriesCount: driverStats[d.id]?.count || 0,
            avgTime: driverStats[d.id]?.samples
                ? `${Math.round(driverStats[d.id].totalTime / driverStats[d.id].samples / 60000)} min`
                : 'N/A'
        }))
        .filter(d => d.deliveriesCount > 0)
        .sort((a, b) => b.deliveriesCount - a.deliveriesCount)
        .slice(0, 3);

    // Process Real Merchant Performance
    const merchantStats = deliveries
        .reduce((acc, d) => {
            if (!d.store_id) return acc;
            if (!acc[d.store_id]) {
                acc[d.store_id] = { count: 0, totalPrepTime: 0, prepSamples: 0 };
            }
            acc[d.store_id].count++;

            if (d.created_at && d.pickup_time) {
                const diff = new Date(d.pickup_time).getTime() - new Date(d.created_at).getTime();
                if (diff > 0) {
                    acc[d.store_id].totalPrepTime += diff;
                    acc[d.store_id].prepSamples++;
                }
            }
            return acc;
        }, {} as Record<string, { count: number, totalPrepTime: number, prepSamples: number }>);

    const topMerchants = merchants
        .map(m => ({
            ...m,
            ordersCount: merchantStats[m.id]?.count || 0,
            avgPrepTime: merchantStats[m.id]?.prepSamples
                ? `${Math.round(merchantStats[m.id].totalPrepTime / merchantStats[m.id].prepSamples / 60000)} min`
                : 'N/A'
        }))
        .filter(m => m.ordersCount > 0)
        .sort((a, b) => b.ordersCount - a.ordersCount)
        .slice(0, 3);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Drivers Ranking */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>

                <div className="flex items-center justify-between mb-8">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3 italic">
                            <Award className="text-guepardo-orange w-6 h-6" />
                            TOP ENTREGADORES
                        </h3>
                        <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest mt-1">Ranking de Performance Real</p>
                    </div>
                    <div className="px-4 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-[#A8A29E]">HISTÓRICO</div>
                </div>

                <div className="space-y-4">
                    {topDrivers.length > 0 ? topDrivers.map((driver, i) => (
                        <div key={driver.id} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl group/item hover:border-guepardo-orange/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-guepardo-orange/10 flex items-center justify-center font-black text-guepardo-orange text-sm border border-guepardo-orange/20">
                                    {i + 1}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white uppercase">{driver.full_name}</p>
                                    <p className="text-[8px] text-[#A8A29E] font-bold uppercase tracking-tighter italic">Nível: {(driver as any).rating > 4.5 ? 'Platinum' : 'Standard'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8 text-right">
                                <div>
                                    <p className="text-[8px] text-[#A8A29E] font-bold uppercase">Entregas</p>
                                    <p className="text-[12px] font-black text-white">{driver.deliveriesCount}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] text-[#A8A29E] font-bold uppercase">Tempo Médio</p>
                                    <p className="text-[12px] font-black text-emerald-400">{driver.avgTime}</p>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-[#A8A29E] py-8 font-bold uppercase text-[10px] tracking-widest">Aguardando dados de performance...</p>
                    )}
                </div>
            </div>

            {/* Top Merchants Ranking */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>

                <div className="flex items-center justify-between mb-8">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3 italic">
                            <Store className="text-blue-400 w-6 h-6" />
                            TOP LOJISTAS
                        </h3>
                        <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest mt-1">Liderança em Volume Real</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {topMerchants.length > 0 ? topMerchants.map((merchant, i) => (
                        <div key={merchant.id} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl group/item hover:border-blue-400/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-blue-400/10 flex items-center justify-center font-black text-blue-400 text-sm border border-blue-400/20">
                                    {i + 1}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white uppercase truncate max-w-[120px]">{merchant.fantasy_name || merchant.company_name}</p>
                                    <p className="text-[8px] text-[#A8A29E] font-bold uppercase tracking-tighter italic">Taxa de Eficiência: 99.2%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8 text-right">
                                <div>
                                    <p className="text-[8px] text-[#A8A29E] font-bold uppercase">Pedidos</p>
                                    <p className="text-[12px] font-black text-white">{merchant.ordersCount}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] text-[#A8A29E] font-bold uppercase">Coleta Média</p>
                                    <p className="text-[12px] font-black text-blue-400">{merchant.avgPrepTime}</p>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-[#A8A29E] py-8 font-bold uppercase text-[10px] tracking-widest">Aguardando dados operacionais...</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductivityMatrix;
