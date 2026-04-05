import { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp,
    DollarSign,
    Package,
    Calendar,
    ArrowUpRight,
    Search,
    ChevronRight,
    Store,
    Clock,
    User,
    Hash,
    Truck,
    CreditCard,
    BarChart3,
    PieChart as PieChartIcon,
    X,
    FileSpreadsheet,
    FileText,
    Printer,
    Wallet,
    CheckCircle,
    AlertCircle,
    Info,
    ArrowDownLeft,
    AlertTriangle,
    Copy
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { supabase } from '../lib/supabase';
import type { Delivery } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const FinanceManagement = () => {
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'history' | 'payouts' | 'recharges'>('history');
    const [payouts, setPayouts] = useState<any[]>([]);
    const [rechargeRequests, setRechargeRequests] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [manualPayoutData, setManualPayoutData] = useState<any>(null);

    const fetchFinanceData = useCallback(async () => {
        try {
            setLoading(true);
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

            const mapped = (data || []).map((d: any) => {
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
    }, [dateFilter, startDate, endDate]);

    const fetchPayouts = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .select(`
                    *,
                    profiles:user_id (
                        full_name,
                        phone
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayouts(data || []);
        } catch (err) {
            console.error('Error fetching payouts:', err);
        }
    }, []);

    const fetchRecharges = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('wallet_transactions')
                .select(`
                    *,
                    stores:store_id (
                        fantasy_name,
                        company_name
                    )
                `)
                .or('payment_method.eq.MANUAL,payment_method.eq.PIX')
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRechargeRequests(data || []);
        } catch (err) {
            console.error('Error fetching recharges:', err);
        }
    }, []);

    useEffect(() => {
        void fetchFinanceData();
        void fetchPayouts();
        void fetchRecharges();

        const subscription = supabase
            .channel('finance-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                void fetchFinanceData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => {
                void fetchPayouts();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, () => {
                void fetchRecharges();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchFinanceData, fetchPayouts, fetchRecharges, supabase]);

    const handleApproveRecharge = async (recharge: any) => {
        if (!window.confirm(`Confirmar recarga de R$ ${recharge.amount.toFixed(2)} para ${recharge.stores?.fantasy_name || recharge.stores?.company_name}?`)) return;

        try {
            setIsProcessing(recharge.id);
            
            const { error: rpcError } = await supabase.rpc('increment_wallet_balance', {
                target_store_id: recharge.store_id,
                amount_to_add: recharge.amount
            });

            if (rpcError) throw rpcError;

            const { error: updateError } = await supabase
                .from('wallet_transactions')
                .update({ 
                    status: 'CONFIRMED'
                })
                .eq('id', recharge.id);

            if (updateError) throw updateError;

            alert('Recarga aprovada! O saldo foi creditado na conta da loja.');
            void fetchRecharges();
        } catch (err: any) {
            console.error('Error approving recharge:', err);
            alert('Erro ao aprovar: ' + (err.message || 'Tente novamente.'));
        } finally {
            setIsProcessing(null);
        }
    };

    const handleRejectRecharge = async (recharge: any) => {
        if (!window.confirm(`Recusar esta solicitação de recarga?`)) return;

        try {
            setIsProcessing(recharge.id);
            const { error } = await supabase
                .from('wallet_transactions')
                .update({ status: 'CANCELLED' })
                .eq('id', recharge.id);

            if (error) throw error;
            void fetchRecharges();
        } catch (err) {
            console.error('Error rejecting recharge:', err);
        } finally {
            setIsProcessing(null);
        }
    };

    const totalVolume = deliveries.reduce((acc, curr) => acc + (curr.calculated_merchant_fee || 0), 0);
    const courierTotal = deliveries.reduce((acc, curr) => acc + (curr.earnings || 0), 0);
    const platformTotal = deliveries.reduce((acc, curr) => acc + (curr.calculated_platform_fee || 0), 0);

    const filteredDeliveries = deliveries.filter((d: Delivery) =>
        d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Analytics Data Processing
    const chartData = [...filteredDeliveries].reverse().map(d => ({
        date: format(new Date(d.created_at), 'dd/MM'),
        volume: d.calculated_merchant_fee || 0,
        revenue: d.calculated_platform_fee || 0
    })).slice(-15);

    const storePerformance = deliveries.reduce((acc: any[], curr) => {
        const existing = acc.find(a => a.name === curr.store_name);
        if (existing) {
            existing.value += 1;
            existing.volume += curr.calculated_merchant_fee || 0;
        } else {
            acc.push({ name: curr.store_name, value: 1, volume: curr.calculated_merchant_fee || 0 });
        }
        return acc;
    }, []).sort((a: any, b: any) => b.volume - a.volume).slice(0, 5);

    const handleOpenDetails = (delivery: Delivery) => {
        setSelectedDelivery(delivery);
        setIsModalOpen(true);
    };

    const handleExportExcel = () => {
        const data = filteredDeliveries.map(d => ({
            'ID Pedido': d.items?.displayId || d.id.slice(-6).toUpperCase(),
            'Lojista': d.store_name,
            'Data': format(new Date(d.created_at), 'dd/MM/yyyy HH:mm'),
            'Valor Lojista (R$)': d.calculated_merchant_fee?.toFixed(2) || '0.00',
            'Repasse Entregador (R$)': d.earnings?.toFixed(2) || '0.00',
            'Receita Central (R$)': d.calculated_platform_fee?.toFixed(2) || '0.00'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Histórico Financeiro");
        XLSX.writeFile(wb, `guepardo_financeiro_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const head = [['ID', 'Lojista', 'Data/Hora', 'Vlr Lojista', 'Pág Entregador', 'Taxa (12.5%)']];
        const body = filteredDeliveries.map(d => [
            d.items?.displayId || d.id.slice(-6).toUpperCase(),
            d.store_name,
            format(new Date(d.created_at), 'dd/MM/yyyy HH:mm'),
            `R$ ${d.calculated_merchant_fee?.toFixed(2) || '0.00'}`,
            `R$ ${d.earnings?.toFixed(2) || '0.00'}`,
            `R$ ${d.calculated_platform_fee?.toFixed(2) || '0.00'}`
        ]);

        doc.text("Guepardo - Relatório Financeiro", 14, 15);
        autoTable(doc, {
            head: head,
            body: body,
            startY: 20,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [255, 107, 0] }
        });
        doc.save(`guepardo_financeiro_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleApprovePayout = async (payoutId: string) => {
        try {
            setIsProcessing(payoutId);
            
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError || !session) {
                throw new Error('Sessão expirada. Por favor, faça login novamente.');
            }

            const { data, error } = await supabase.functions.invoke('process-payout', {
                body: { payoutId }
            });
            
            if (error) {
                // Tentar extrair a mensagem de erro do corpo da resposta do Supabase
                let errorMessage = error.message || 'Erro ao processar pagamento';
                try {
                    const errorData = JSON.parse(error.message);
                    if (errorData.error) errorMessage = errorData.error;
                } catch (e) {}
                throw new Error(errorMessage);
            }

            if (data?.success === false) {
                throw new Error(data.error || 'Erro no processamento');
            }

            // Sucesso (Pode ser automático ou solicitação de PIX manual)
            if (data?.manual_required) {
                setManualPayoutData({ ...data.payout_details, id: payoutId, error: data.error });
            } else {
                alert(`Repasse realizado com sucesso! ID Transação Asaas: ${data?.data?.id || 'N/A'}`);
            }

            setPayouts(prev => prev.map(p => 
                p.id === payoutId 
                    ? { ...p, status: 'completed', processed_at: new Date().toISOString() } 
                    : p
            ));
            
            void fetchPayouts();
            void fetchFinanceData();

        } catch (err: any) {
            console.error('Error approving payout:', err);
            alert(err.message || 'Falha ao processar repasse');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleResetPayoutStatus = async (payoutId: string) => {
        try {
            setIsProcessing(payoutId);
            const { error } = await supabase
                .from('withdrawal_requests')
                .update({ status: 'pending', error_message: null, processed_at: null })
                .eq('id', payoutId);

            if (error) throw error;
            
            setPayouts(prev => prev.map(p => 
                p.id === payoutId ? { ...p, status: 'pending', error_message: null, processed_at: null } : p
            ));
            
            void fetchPayouts();
        } catch (err: any) {
            console.error('Error resetting status:', err);
            alert('Falha ao resetar status');
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-20">
            {/* Tab Switche */}
            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10 w-fit">
                <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3",
                        activeTab === 'history'
                            ? "bg-brand-gradient text-white shadow-glow"
                            : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                    )}
                >
                    <BarChart3 size={16} />
                    Histórico de Corridas
                </button>
                <button
                    onClick={() => setActiveTab('payouts')}
                    className={cn(
                        "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3",
                        activeTab === 'payouts'
                            ? "bg-brand-gradient text-white shadow-glow"
                            : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                    )}
                >
                    <Wallet size={16} />
                    Solicitações de Repasse
                    {payouts.filter(p => p.status === 'pending').length > 0 && (
                        <span className="bg-fluorescent-orange text-black px-2 py-0.5 rounded-full text-[10px] animate-pulse">
                            {payouts.filter(p => p.status === 'pending').length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('recharges')}
                    className={cn(
                        "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3",
                        activeTab === 'recharges'
                            ? "bg-brand-gradient text-white shadow-glow"
                            : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                    )}
                >
                    <ArrowDownLeft size={16} />
                    Solicitações de Recarga
                    {rechargeRequests.length > 0 && (
                        <span className="bg-fluorescent-orange text-black px-2 py-0.5 rounded-full text-[10px] animate-pulse">
                            {rechargeRequests.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'history' && (
                <>
            {/* Header section with stats summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] relative overflow-hidden group hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500 opacity-[0.02] group-hover:opacity-[0.05] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] text-[#A8A29E] font-black uppercase tracking-widest">Volume de Transação</span>
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shadow-glow-emerald transition-all group-hover:scale-110">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-3xl font-black text-white">R$ {totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-1.5 text-emerald-500">
                            <ArrowUpRight size={14} className="font-bold" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Acumulado Total</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] relative overflow-hidden group hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-guepardo-orange opacity-[0.02] group-hover:opacity-[0.05] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] text-[#A8A29E] font-black uppercase tracking-widest">Repasse Central (12.5%)</span>
                        <div className="p-3 bg-guepardo-orange/10 text-guepardo-orange rounded-2xl border border-guepardo-orange/20 shadow-glow-orange transition-all group-hover:scale-110">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-3xl font-black text-fluorescent-orange tracking-tighter">R$ {platformTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-1.5 text-guepardo-orange">
                            <ArrowUpRight size={14} className="font-bold" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Receita Líquida App</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] relative overflow-hidden group hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500 opacity-[0.02] group-hover:opacity-[0.05] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] text-[#A8A29E] font-black uppercase tracking-widest">Total Entregadores (87.5%)</span>
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 shadow-glow-blue transition-all group-hover:scale-110">
                            <Package className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-3xl font-black text-white">R$ {courierTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <div className="flex items-center gap-1.5 text-blue-400">
                            <ArrowUpRight size={14} className="font-bold" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Repasse aos Parceiros</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Table section */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="p-8 border-b border-white/10 flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <Calendar className="text-guepardo-orange w-5 h-5 shadow-glow-orange" />
                                <span className="text-fluorescent-orange">Histórico Financeiro</span>
                            </h3>
                            <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Relatório detalhado de transações</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E] group-focus-within:text-guepardo-orange transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar transação..."
                                    className="pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-guepardo-orange/50 transition-all w-full md:w-64 font-bold text-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 border-l border-white/10 pl-4 print:hidden">
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

                    <div className="flex flex-wrap items-center gap-4 bg-black/20 p-2 rounded-2xl border border-white/5 overflow-hidden">
                        <div className="flex items-center gap-2 pr-4 border-r border-white/10 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'all', label: 'Tudo' },
                                { id: 'today', label: 'Hoje' },
                                { id: '7days', label: '7 Dias' },
                                { id: '30days', label: '30 Dias' },
                                { id: 'custom', label: 'Personalizado' }
                            ].map((filter) => (
                                <button
                                    key={filter.id}
                                    onClick={() => setDateFilter(filter.id as 'all' | 'today' | '7days' | '30days' | 'custom')}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
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
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
                                                    <Store size={14} />
                                                </div>
                                                <span className="text-[11px] font-black text-white uppercase tracking-tight">{delivery.store_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-white">{format(new Date(delivery.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                                                <span className="text-[10px] text-[#A8A29E] flex items-center gap-1 mt-0.5 font-bold uppercase tracking-tight">
                                                    <Clock size={10} /> {format(new Date(delivery.created_at), 'HH:mm', { locale: ptBR })}h
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-sm font-black text-emerald-400">R$ {delivery.calculated_merchant_fee?.toFixed(2) || '0.00'}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-sm font-black text-blue-400">
                                                R$ {(delivery.earnings || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-[11px] font-black text-white bg-white/5 px-4 py-2 rounded-full border border-[#FF6B00] shadow-glow-orange transition-all group-hover:scale-105">
                                                R$ {delivery.calculated_platform_fee?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button
                                                onClick={() => handleOpenDetails(delivery)}
                                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[#A8A29E] hover:text-guepardo-orange transition-all active:scale-95"
                                            >
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

            {/* Analytics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.02] group-hover:opacity-[0.05] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-black text-white flex items-center gap-3">
                                <BarChart3 className="text-guepardo-orange w-5 h-5 shadow-glow-orange" />
                                <span>Volume de Vendas x Receita</span>
                            </h3>
                            <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Fluxo financeiro dos últimos 15 pedidos</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#A8A29E', fontSize: 10, fontWeight: 900 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#A8A29E', fontSize: 10, fontWeight: 900 }}
                                    tickFormatter={(value) => `R$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1A1C1E',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '900'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="volume"
                                    stroke="#FF6B00"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorVolume)"
                                    name="Volume Total"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10B981"
                                    strokeWidth={3}
                                    fill="transparent"
                                    name="Receita Central"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500 opacity-[0.02] group-hover:opacity-[0.05] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-black text-white flex items-center gap-3">
                                <PieChartIcon className="text-blue-400 w-5 h-5 shadow-glow-blue" />
                                <span>Performance por Lojista</span>
                            </h3>
                            <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Top 5 lojas com maior volume financeiro</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={storePerformance} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={120}
                                    tick={{ fill: '#E5E5E5', fontSize: 9, fontWeight: 900 }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{
                                        backgroundColor: '#1A1C1E',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        fontSize: '12px'
                                    }}
                                />
                                <Bar dataKey="volume" radius={[0, 4, 4, 0]} name="Volume Total">
                                    {storePerformance.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#FF6B00' : '#3B82F6'} fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Details Modal */}
            {isModalOpen && selectedDelivery && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1A1C1E] border border-white/10 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-white/5 bg-brand-gradient/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-brand-gradient rounded-2xl flex items-center justify-center shadow-glow">
                                        <Hash className="text-white w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Pedido</h2>
                                        <span className="text-guepardo-orange font-black text-lg tracking-tight">#{selectedDelivery.items?.displayId || selectedDelivery.id.slice(-6).toUpperCase()}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/50 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Column: Client & Store */}
                                <div className="space-y-6">
                                    <div className="bg-white/5 border border-white/5 p-6 rounded-3xl">
                                        <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest mb-4 block">Origem & Destino</span>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                                                    <Store size={16} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-white uppercase">{selectedDelivery.store_name}</span>
                                                    <span className="text-[8px] text-[#A8A29E] font-bold">Unidade Guepardo Parceira</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                                                    <User size={16} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-white uppercase">{selectedDelivery.customer_name || 'Consumidor'}</span>
                                                    <span className="text-[8px] text-[#A8A29E] font-bold leading-tight mt-0.5">{selectedDelivery.customer_address}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/5 p-6 rounded-3xl">
                                        <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest mb-4 block">Logística</span>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white/10 text-white rounded-lg">
                                                    <Truck size={16} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-white">{selectedDelivery.delivery_distance?.toFixed(2)} KM</span>
                                                    <span className="text-[8px] text-[#A8A29E] font-bold">Distância Percorrida</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black text-white block uppercase">{selectedDelivery.payment_method || 'A Definir'}</span>
                                                <span className="text-[8px] text-[#A8A29E] font-bold">Forma de Pagamento</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Financial Breakdown */}
                                <div className="space-y-6">
                                    <div className="bg-black/40 border border-white/5 p-6 rounded-3xl shadow-inner">
                                        <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest mb-4 block">Divisão de Valores</span>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between py-2 border-b border-white/5">
                                                <span className="text-[10px] font-bold text-[#A8A29E]">Valor Total Pago</span>
                                                <span className="text-sm font-black text-white">R$ {selectedDelivery.calculated_merchant_fee?.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2 border-b border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    <span className="text-[10px] font-bold text-[#A8A29E]">Ganhos Entregador</span>
                                                </div>
                                                <span className="text-[12px] font-black text-blue-400">- R$ {selectedDelivery.earnings?.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center justify-between pt-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-guepardo-orange shadow-glow"></div>
                                                    <span className="text-[10px] font-black text-guepardo-orange uppercase">Líquido Central</span>
                                                </div>
                                                <span className="text-2xl font-black text-white px-5 py-2 rounded-full border border-[#FF6B00] shadow-glow-orange bg-white/5">R$ {selectedDelivery.calculated_platform_fee?.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl">
                                        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                                            <CreditCard size={20} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Status de Repasse</span>
                                            <span className="text-[12px] font-bold text-white uppercase italic">Processado & Liquidado</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-center">
                            <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest">Guepardo Financial Ledger &copy; 2026 - Auditoria Verificada</span>
                        </div>
                    </div>
                </div>
            )}
                </>
            )}

            {activeTab === 'payouts' && (
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
                    <div className="p-8 border-b border-white/10 flex flex-col gap-2">
                        <h3 className="text-xl font-black text-white flex items-center gap-3">
                            <Wallet className="text-guepardo-orange w-5 h-5 shadow-glow-orange" />
                            <span className="text-fluorescent-orange">Solicitações de Repasse (Saque)</span>
                        </h3>
                        <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Gerencie os pagamentos aos entregadores parceiros</p>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20">
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Entregador</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Data Pedido</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Chave PIX</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-right">Valor Bruto</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {payouts.length > 0 ? (
                                    payouts.map((p) => (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-white uppercase">{p.profiles?.full_name || 'Entregador'}</span>
                                                    <span className="text-[9px] text-[#A8A29E] font-bold">{p.profiles?.phone}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-white">{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                                                    <span className="text-[9px] text-[#A8A29E] font-bold uppercase tracking-widest">{format(new Date(p.created_at), 'HH:mm', { locale: ptBR })}h</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-white bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 w-fit">{p.pix_key}</span>
                                                    <span className="text-[8px] text-[#A8A29E] font-black uppercase mt-1 tracking-widest">{p.pix_key_type || 'PIX'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="text-sm font-black text-white">R$ {Number(p.amount).toFixed(2)}</span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className={cn(
                                                    "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2",
                                                    p.status === 'pending' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                                                    p.status === 'completed' && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                                                    p.status === 'failed' && "bg-red-500/10 text-red-500 border border-red-500/20",
                                                    p.status === 'processing' && "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                                )}>
                                                    {p.status === 'pending' && <Clock size={12} />}
                                                    {p.status === 'completed' && <CheckCircle size={12} />}
                                                    {p.status === 'failed' && <AlertCircle size={12} />}
                                                    {p.status === 'processing' && <div className="w-3 h-3 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>}
                                                    {p.status === 'pending' ? 'Pendente' : 
                                                     p.status === 'completed' ? 'Pago' : 
                                                     p.status === 'failed' ? 'Falhou' : 'Processando'}
                                                </div>
                                            </td>
                                             <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-4">
                                                    {p.status === 'pending' && (
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => {
                                                                    setManualPayoutData({
                                                                        id: p.id,
                                                                        amount: Number(p.amount),
                                                                        pix_key: p.pix_key,
                                                                        error: 'Fluxo Manual Selecionado'
                                                                    });
                                                                }}
                                                                disabled={isProcessing !== null}
                                                                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all flex items-center gap-2"
                                                            >
                                                                <Copy size={12} />
                                                                Pagar Manual
                                                            </button>
                                                            <button
                                                                onClick={() => handleApprovePayout(p.id)}
                                                                disabled={isProcessing !== null}
                                                                className="px-4 py-2 bg-brand-gradient text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                                                            >
                                                                {isProcessing === p.id ? (
                                                                    <>
                                                                        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                                        Processando
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <ArrowDownLeft size={14} />
                                                                        Aprovar via API
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {p.status === 'processing' && (
                                                        <button
                                                            onClick={() => handleResetPayoutStatus(p.id)}
                                                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#A8A29E] hover:text-white text-[8px] font-black uppercase tracking-widest rounded-lg border border-white/10 transition-all flex items-center gap-1"
                                                        >
                                                            <X size={10} />
                                                            Reiniciar Status
                                                        </button>
                                                    )}
                                                    {(p.status === 'completed' || p.status === 'failed') && (
                                                        <div className="flex flex-col items-end gap-1">
                                                            {p.status === 'failed' && (
                                                                <span className="text-[8px] text-red-400 font-bold uppercase">{p.error_message || 'Erro Desconhecido'}</span>
                                                            )}
                                                            <button
                                                                onClick={() => handleResetPayoutStatus(p.id)}
                                                                disabled={isProcessing !== null}
                                                                className="text-[9px] text-[#A8A29E] hover:text-white underline font-bold flex items-center gap-1"
                                                            >
                                                                {isProcessing === p.id ? 'Resetando...' : (p.status === 'failed' ? 'Tentar Novamente (Resetar)' : 'Reiniciar Status')}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 text-[#A8A29E]">
                                                <Info size={40} className="opacity-20" />
                                                <span className="text-xs font-bold uppercase tracking-widest">Nenhuma solicitação de repasse encontrada</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'recharges' && (
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-md relative overflow-hidden animate-in slide-in-from-right duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase italic">
                                <ArrowDownLeft className="text-[#FF6B00] w-6 h-6 shadow-glow-orange" />
                                <span>Solicitações de Recarga Manual</span>
                            </h3>
                            <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Valide as transferências recebidas e libere o saldo</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Loja</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Data / Hora</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-right">Valor</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-center">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {rechargeRequests.length > 0 ? (
                                    rechargeRequests.map((r: any) => (
                                        <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                                                        <Store size={18} />
                                                    </div>
                                                    <span className="text-sm font-black text-white italic uppercase">{r.stores?.fantasy_name || r.stores?.company_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-white">{format(new Date(r.created_at), 'dd/MM/yyyy')}</span>
                                                    <span className="text-[10px] text-[#A8A29E] font-bold uppercase">{format(new Date(r.created_at), 'HH:mm')}h</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <span className="text-lg font-black text-[#FF6B00] italic">R$ {r.amount.toFixed(2)}</span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-amber-500/20 animate-pulse">
                                                    Aguardando Conferência
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button
                                                        onClick={() => handleRejectRecharge(r)}
                                                        disabled={isProcessing === r.id}
                                                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/20 transition-all hover:scale-105"
                                                    >
                                                        Recusar
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveRecharge(r)}
                                                        disabled={isProcessing === r.id}
                                                        className="px-6 py-2 bg-[#FF6B00] hover:bg-[#F37E32] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-glow-orange transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                                    >
                                                        {isProcessing === r.id ? (
                                                            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                        ) : (
                                                            <CheckCircle size={14} />
                                                        )}
                                                        Aprovar Recarga
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 text-[#A8A29E]">
                                                <div className="p-4 bg-white/5 rounded-2xl">
                                                    <Info size={40} className="opacity-20" />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-widest italic opacity-50">Nenhuma solicitação de recarga pendente</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* Manual Payout Helper Modal */}
            {manualPayoutData && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#1A1C1E] border-2 border-[#FF6B00]/30 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className="w-16 h-16 bg-[#FF6B00]/20 text-[#FF6B00] rounded-2xl flex items-center justify-center shadow-glow-orange">
                                <AlertTriangle size={32} />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white uppercase italic">
                                    {manualPayoutData.error === 'Fluxo Manual Selecionado' ? 'Pagamento PIX Manual' : 'Pagamento Manual Necessário'}
                                </h2>
                                <p className="text-xs text-[#A8A29E] font-bold leading-relaxed">
                                    {manualPayoutData.error === 'Fluxo Manual Selecionado' 
                                        ? 'Realize a transferência no aplicativo do seu banco usando os dados abaixo:' 
                                        : `O Asaas retornou um impedimento: ${manualPayoutData.error || 'Verifique o saldo'}. Realize o PIX manualmente:`}
                                </p>
                            </div>
                            
                            <div className="w-full space-y-4 bg-black/40 p-6 rounded-3xl border border-white/5">
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Valor do Repasse</span>
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xl font-black text-white italic">R$ {manualPayoutData.amount.toFixed(2)}</span>
                                        <button 
                                            onClick={() => { navigator.clipboard.writeText(manualPayoutData.amount.toFixed(2)); alert('Valor copiado!'); }} 
                                            className="text-[#FF6B00] hover:text-white p-2 transition-colors"
                                        >
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Chave PIX do Entregador</span>
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-sm font-black text-white break-all flex-1 text-left">{manualPayoutData.pix_key}</span>
                                        <button 
                                            onClick={() => { navigator.clipboard.writeText(manualPayoutData.pix_key); alert('Chave copiada!'); }} 
                                            className="text-[#FF6B00] hover:text-white p-2 transition-colors"
                                        >
                                            <Copy size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={async () => {
                                        try {
                                            const { error } = await supabase.from('withdrawal_requests')
                                                .update({ 
                                                    status: 'completed', 
                                                    processed_at: new Date().toISOString(),
                                                    error_message: 'Processado Manualmente (Block API)'
                                                })
                                                .eq('id', manualPayoutData.id);
                                            
                                            if (error) throw error;
                                            
                                            setPayouts(prev => prev.map(p => 
                                                p.id === manualPayoutData.id ? { ...p, status: 'completed' } : p
                                            ));
                                            setManualPayoutData(null);
                                            alert('Repasse confirmado com sucesso no sistema!');
                                        } catch (e) {
                                            alert('Erro ao confirmar no sistema. Mas se você pagou o PIX, o dinheiro foi enviado.');
                                        }
                                    }}
                                    className="w-full py-4 bg-brand-gradient text-white font-black uppercase tracking-widest rounded-2xl shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    Confirmar Pagamento Realizado
                                </button>
                                <button
                                    onClick={() => setManualPayoutData(null)}
                                    className="text-[10px] text-[#A8A29E] hover:text-white uppercase font-black transition-colors"
                                >
                                    Cancelar / Voltar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceManagement;
