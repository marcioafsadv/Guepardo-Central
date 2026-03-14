import { useState, useEffect } from 'react';
import {
    TrendingUp,
    DollarSign,
    Package,
    Calendar,
    ArrowUpRight,
    Search,
    Download,
    ChevronRight,
    Store,
    Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Delivery } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

const FinanceManagement = () => {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    useEffect(() => {
        fetchFinanceData();

        const subscription = supabase
            .channel('finance-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                fetchFinanceData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [dateFilter, startDate, endDate]);

    const fetchFinanceData = async () => {
        try {
            let query = supabase
                .from('deliveries')
                .select(`
                    *,
                    stores (
                        fantasy_name,
                        company_name
                    )
                `)
                .or('status.eq.delivered,status.eq.completed');

            if (dateFilter !== 'all') {
                const now = new Date();
                let start: Date | null = null;
                let end: Date | null = null;

                if (dateFilter === 'today') {
                    start = new Date(now.setHours(0, 0, 0, 0));
                    end = new Date(now.setHours(23, 59, 59, 999));
                } else if (dateFilter === '7days') {
                    start = new Date(now.setDate(now.getDate() - 7));
                    start.setHours(0, 0, 0, 0);
                } else if (dateFilter === '30days') {
                    start = new Date(now.setDate(now.getDate() - 30));
                    start.setHours(0, 0, 0, 0);
                } else if (dateFilter === 'custom' && startDate && endDate) {
                    start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                }

                if (start) {
                    query = query.gte('created_at', start.toISOString());
                }
                if (end) {
                    query = query.lte('created_at', end.toISOString());
                }
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            const mapped = data?.map((d: any) => {
                const totalMerchant = 8.00 + ((d.delivery_distance || 0) * 1.32);
                const platformFee = totalMerchant - (d.earnings || 0);

                return {
                    ...d,
                    store_name: d.stores?.fantasy_name || d.stores?.company_name || 'Lojista Desconhecido',
                    calculated_merchant_fee: Number(totalMerchant.toFixed(2)),
                    calculated_platform_fee: Number(platformFee.toFixed(2))
                };
            }) || [];

            setDeliveries(mapped);
        } catch (err) {
            console.error('Error fetching finance data:', err);
        } finally {
            setLoading(false);
        }
    };

    const totalVolume = deliveries.reduce((acc: number, curr: any) => acc + (curr.calculated_merchant_fee || 0), 0);
    const courierTotal = deliveries.reduce((acc: number, curr: Delivery) => acc + (curr.earnings || 0), 0);
    const platformTotal = deliveries.reduce((acc: number, curr: any) => acc + (curr.calculated_platform_fee || 0), 0);

    const filteredDeliveries = deliveries.filter((d: Delivery) =>
        d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header section with stats summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500 opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Volume de Transação</span>
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-3xl font-black text-white">R$ {totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-1.5 text-emerald-500">
                            <ArrowUpRight size={14} className="font-bold" />
                            <span className="text-[10px] font-black uppercase">Acumulado Total</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-guepardo-orange opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Repasse Central (12.5%)</span>
                        <div className="p-3 bg-guepardo-orange/10 text-guepardo-orange rounded-2xl">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-3xl font-black text-white">R$ {platformTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-1.5 text-orange-500">
                            <ArrowUpRight size={14} className="font-bold" />
                            <span className="text-[10px] font-black uppercase">Receita Líquida App</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500 opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Total Entregadores (87.5%)</span>
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
                            <Package className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-3xl font-black text-white">R$ {courierTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-1.5 text-blue-400">
                            <ArrowUpRight size={14} className="font-bold" />
                            <span className="text-[10px] font-black uppercase">Repasse aos Parceiros</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Table section */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="p-8 border-b border-white/10 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <Calendar className="text-guepardo-orange w-5 h-5" />
                                Histórico Financeiro
                            </h3>
                            <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Relatório detalhado de transações</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E] group-focus-within:text-guepardo-orange transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar transação..."
                                    className="pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-guepardo-orange/50 transition-all w-full md:w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all shadow-inner">
                                <Download className="w-4 h-4" /> Exportar CSV
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-black/20 p-2 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                            {[
                                { id: 'all', label: 'Tudo' },
                                { id: 'today', label: 'Hoje' },
                                { id: '7days', label: '7 Dias' },
                                { id: '30days', label: '30 Dias' },
                                { id: 'custom', label: 'Personalizado' }
                            ].map((filter) => (
                                <button
                                    key={filter.id}
                                    onClick={() => setDateFilter(filter.id as any)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        dateFilter === filter.id
                                            ? "bg-brand-gradient text-white shadow-glow"
                                            : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        {dateFilter === 'custom' && (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest ml-1">Início</span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-white outline-none focus:border-guepardo-orange/50 transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest ml-1">Fim</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-white outline-none focus:border-guepardo-orange/50 transition-all"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/20">
                                <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">ID Pedido</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Lojista</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Data / Hora</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-right">Valor Lojista</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-right">Pág. Entregador</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-right">Taxa (12.5%)</th>
                                <th className="px-8 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-2 border-guepardo-orange/20 border-t-guepardo-orange rounded-full animate-spin"></div>
                                            <span className="text-xs text-[#A8A29E] font-bold uppercase">Carregando dados financeiros...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredDeliveries.length > 0 ? (
                                filteredDeliveries.map((delivery: Delivery) => (
                                    <tr key={delivery.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-black text-white group-hover:text-guepardo-orange transition-colors">#{delivery.items?.displayId || delivery.id.slice(-6).toUpperCase()}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <Store size={14} className="text-[#A8A29E]" />
                                                <span className="text-xs font-bold text-white">{delivery.store_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white">{format(new Date(delivery.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                                                <span className="text-[10px] text-[#A8A29E] flex items-center gap-1 mt-0.5 font-medium uppercase tracking-tight">
                                                    <Clock size={10} /> {format(new Date(delivery.created_at), 'HH:mm', { locale: ptBR })}h
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-xs font-black text-white">R$ {(delivery as any).calculated_merchant_fee?.toFixed(2) || '0.00'}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-xs font-bold text-blue-400">
                                                R$ {(delivery.earnings || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-[10px] font-black text-guepardo-orange bg-guepardo-orange/10 px-2 py-1 rounded-md border border-guepardo-orange/10">
                                                R$ {(delivery as any).calculated_platform_fee?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[#A8A29E] transition-all">
                                                <ChevronRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-8 py-20 text-center text-[#A8A29E] font-bold uppercase text-xs italic">
                                        Nenhuma transação encontrada
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinanceManagement;
