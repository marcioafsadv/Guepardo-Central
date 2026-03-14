import { useState, useEffect } from 'react';
import {
    Search,
    Store,
    Activity,
    Wallet,
    Power,
    TrendingDown,
    ShieldCheck,
    FileText,
    Image as ImageIcon,
    Info,
    X,
    LayoutGrid,
    List as ListIcon,
    PauseCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Store as StoreType, Delivery } from '../types';
import { cn } from '../lib/utils';

interface FunnelStats {
    pending: number;
    accepted: number;
    inTransit: number;
    delivered: number;
    canceled: number;
}

interface OnboardingReviewModalProps {
    store: StoreType;
    onClose: () => void;
    onUpdate: (status: 'approved' | 'rejected', notes?: string) => Promise<void>;
}

const OnboardingReviewModal = ({ store, onClose, onUpdate }: OnboardingReviewModalProps) => {
    const [notes, setNotes] = useState(store.onboarding_notes || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAction = async (status: 'approved' | 'rejected') => {
        setIsSubmitting(true);
        await onUpdate(status, notes);
        setIsSubmitting(false);
        onClose();
    };

    const docs = [
        { label: 'Documento de Identidade', url: store.document_url, icon: FileText },
        { label: 'Contrato Assinado', url: store.contract_url, icon: ShieldCheck },
        { label: 'Foto do Estabelecimento', url: store.location_photo_url, icon: ImageIcon },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-guepardo-brown-dark border border-white/10 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-guepardo-orange/10 text-guepardo-orange rounded-2xl border border-guepardo-orange/20">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Onboarding: {store.fantasy_name || store.company_name}</h2>
                            <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest mt-0.5">Revisão de documentos e conformidade</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-[#A8A29E] transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {docs.map((doc, idx) => (
                            <div key={idx} className="space-y-3">
                                <span className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.2em] flex items-center gap-2">
                                    <doc.icon className="w-3 h-3" /> {doc.label}
                                </span>
                                <div className="aspect-[4/3] bg-black/40 rounded-3xl border border-white/5 overflow-hidden relative group">
                                    {doc.url ? (
                                        <>
                                            <img src={doc.url} alt={doc.label} className="w-full h-full object-cover transition-all group-hover:scale-110" />
                                            <a 
                                                href={doc.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                                            >
                                                <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-xs font-black text-white border border-white/20">Visualizar</span>
                                            </a>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-black text-[#57534E] gap-2">
                                            <Info className="w-6 h-6 opacity-20" />
                                            NÃO ANEXADO
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-black/20 p-6 rounded-3xl border border-white/5 space-y-4">
                        <span className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest flex items-center gap-2">
                            <Info className="w-3 h-3" /> Notas da Central (Motivo de rejeição ou observações)
                        </span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Descreva observações ou motivos caso precise rejeitar o cadastro..."
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-guepardo-orange/50 transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="p-8 border-t border-white/10 bg-black/20 flex items-center justify-end gap-4">
                    <button
                        onClick={() => handleAction('rejected')}
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        Rejeitar Cadastro
                    </button>
                    <button
                        onClick={() => handleAction('approved')}
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-brand-gradient text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-glow hover:scale-[1.02] transition-all disabled:opacity-50"
                    >
                        Aprovar Lojista
                    </button>
                </div>
            </div>
        </div>
    );
};

const MerchantManagement = () => {
    const [stores, setStores] = useState<StoreType[]>([]);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [onboardingFilter, setOnboardingFilter] = useState('all');
    const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        fetchData();

        const storesSubscription = supabase
            .channel('stores-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
                fetchData();
            })
            .subscribe();

        const deliveriesSubscription = supabase
            .channel('deliveries-changes-merchants')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(storesSubscription);
            supabase.removeChannel(deliveriesSubscription);
        };
    }, []);

    const fetchData = async () => {
        try {
            const [storesRes, deliveriesRes] = await Promise.all([
                supabase.from('stores').select('*'),
                supabase.from('deliveries').select('id, status, store_id, created_at')
            ]);

            if (storesRes.error) throw storesRes.error;
            if (deliveriesRes.error) throw deliveriesRes.error;

            setStores(storesRes.data || []);
            setDeliveries(deliveriesRes.data || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleIsActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('stores')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            setStores(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
        } catch (err) {
            console.error('Error toggling active status:', err);
        }
    };

    const togglePause = async (id: string, currentStatus: string | undefined) => {
        try {
            const newStatus = currentStatus === 'paused' ? 'open' : 'paused';
            const { error } = await supabase
                .from('stores')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            setStores(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
        } catch (err) {
            console.error('Error toggling pause status:', err);
        }
    };

    const getStoreFunnel = (storeId: string): FunnelStats => {
        const storeDeliveries = deliveries.filter(d => d.store_id === storeId);
        return {
            pending: storeDeliveries.filter(d => d.status === 'pending').length,
            accepted: storeDeliveries.filter(d => d.status === 'accepted').length,
            inTransit: storeDeliveries.filter(d => d.status === 'in_transit').length,
            delivered: storeDeliveries.filter(d => d.status === 'delivered' || d.status === 'completed').length,
            canceled: storeDeliveries.filter(d => d.status === 'canceled' || d.status === 'cancelled').length,
        };
    };

    const handleUpdateOnboarding = async (storeId: string, status: 'approved' | 'rejected', notes?: string) => {
        try {
            const updates: any = { 
                onboarding_status: status,
                onboarding_notes: notes 
            };

            // Se aprovado, ativa o cadastro automaticamente. Se rejeitado, desativa.
            if (status === 'approved') {
                updates.is_active = true;
            } else if (status === 'rejected') {
                updates.is_active = false;
            }

            const { error } = await supabase
                .from('stores')
                .update(updates)
                .eq('id', storeId);

            if (error) throw error;
            
            setStores(prev => prev.map(s => s.id === storeId ? { ...s, ...updates } : s));
        } catch (err) {
            console.error('Error updating onboarding:', err);
        }
    };

    const filteredStores = stores.filter(store => {
        const matchesSearch = (store.fantasy_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (store.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (store.document?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || store.status === statusFilter || (statusFilter === 'open' && !store.status);
        
        const matchesOnboarding = onboardingFilter === 'all' || store.onboarding_status === onboardingFilter || (onboardingFilter === 'pending' && !store.onboarding_status);

        return matchesSearch && matchesStatus && matchesOnboarding;
    });

    const totalFunnel = stores.reduce((acc, store) => {
        const funnel = getStoreFunnel(store.id);
        return {
            pending: acc.pending + funnel.pending,
            accepted: acc.accepted + funnel.accepted,
            inTransit: acc.inTransit + funnel.inTransit,
            delivered: acc.delivered + funnel.delivered,
            canceled: acc.canceled + funnel.canceled,
        };
    }, { pending: 0, accepted: 0, inTransit: 0, delivered: 0, canceled: 0 });

    const totalBalance = stores.reduce((acc, store) => acc + (store.balance || 0), 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Top Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 hover:border-white/20 transition-all duration-500 shadow-2xl backdrop-blur-sm group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Loja Aberta / Fechada</span>
                        <div className="p-3 bg-orange-500/10 text-orange-400 rounded-2xl">
                            <Store className="w-5 h-5" />
                        </div>
                    </div>
                    <span className="text-3xl font-black text-white">{stores.filter(s => s.status === 'open' || !s.status).length} <span className="text-sm font-medium text-[#A8A29E]">/ {stores.filter(s => s.status === 'closed' || s.status === 'paused').length}</span></span>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">{stores.length} Cadastrados</span>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 hover:border-white/20 transition-all duration-500 shadow-2xl backdrop-blur-sm group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Saldo Retido</span>
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                            <Wallet className="w-5 h-5" />
                        </div>
                    </div>
                    <span className="text-3xl font-black text-white">R$ {totalBalance.toFixed(2)}</span>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 hover:border-white/20 transition-all duration-500 shadow-2xl backdrop-blur-sm group relative overflow-hidden md:col-span-2">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Funnel Global Master</span>
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
                            <Activity className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase">Produção</span>
                            <span className="text-xl font-black text-white">{totalFunnel.pending}</span>
                        </div>
                        <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase">Aguardando</span>
                            <span className="text-xl font-black text-white">{totalFunnel.accepted}</span>
                        </div>
                        <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase">Em Rota</span>
                            <span className="text-xl font-black text-guepardo-orange">{totalFunnel.inTransit}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-md">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Store className="text-guepardo-orange" />
                        Gestão de Lojistas
                    </h2>
                    <p className="text-xs text-[#A8A29E] font-medium uppercase tracking-widest">Controle operacional e financeiro</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E] group-focus-within:text-guepardo-orange transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar lojista ou documento..."
                            className="pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-guepardo-orange/50 transition-all w-full md:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-guepardo-orange/50 transition-all text-white"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="open">Abertos</option>
                        <option value="closed">Fechados</option>
                        <option value="paused">Pausados</option>
                    </select>
                    <select
                        value={onboardingFilter}
                        onChange={(e) => setOnboardingFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-guepardo-orange/50 transition-all text-white"
                    >
                        <option value="all">Filtro Onboarding: Todos</option>
                        <option value="pending">Aguardando Avaliação</option>
                        <option value="approved">Aprovados</option>
                        <option value="rejected">Rejeitados</option>
                    </select>

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
                </div>
            </div>

            {/* Merchant Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-12 h-12 border-4 border-guepardo-orange/20 border-t-guepardo-orange rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className={cn(
                    "grid gap-6",
                    viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                )}>
                    {filteredStores.map(store => {
                        const funnel = getStoreFunnel(store.id);
                        const isOpen = store.status === 'open' || !store.status;
                        const isPaused = store.status === 'paused';

                        return (
                            <div 
                                key={store.id} 
                                className={cn(
                                    "bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 hover:border-white/20 transition-all duration-500 relative group overflow-hidden shadow-xl",
                                    viewMode === 'list' ? "flex flex-row items-center p-6 gap-8" : "flex flex-col p-6 gap-6"
                                )}
                            >
                                <div className={cn(
                                    "absolute left-0 w-1 h-full",
                                    viewMode === 'grid' && "top-0 w-full h-1",
                                    isOpen ? "bg-green-500" : isPaused ? "bg-yellow-500" : "bg-red-500"
                                )}></div>

                                {/* Header / Identity */}
                                <div className={cn("flex items-start justify-between gap-4", viewMode === 'list' ? "w-1/3 shrink-0" : "w-full")}>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <h3 className="text-lg font-black text-white truncate" title={store.fantasy_name || store.company_name || 'Desconhecido'}>
                                            {store.fantasy_name || store.company_name || 'Desconhecido'}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-bold text-[#A8A29E] tracking-wider uppercase">
                                                {store.tipo_pessoa === 'PF' ? 'CPF' : 'CNPJ'}: {store.document || 'N/A'}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter w-fit",
                                                (store.is_active ?? true) ? "bg-emerald-500/20 text-emerald-400" : "bg-stone-500/20 text-stone-400"
                                            )}>
                                                {(store.is_active ?? true) ? 'Cadastro Ativo' : 'Cadastro Inativo'}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter w-fit border",
                                                store.onboarding_status === 'approved' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                store.onboarding_status === 'rejected' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                            )}>
                                                {store.onboarding_status === 'approved' ? 'Onboarding OK' :
                                                 store.onboarding_status === 'rejected' ? 'Rejeitado' :
                                                 'Aguardando'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedStore(store)}
                                            className={cn(
                                                "shrink-0 p-2.5 rounded-xl transition-all shadow-inner border",
                                                store.onboarding_status === 'approved' 
                                                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20" 
                                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 shadow-glow"
                                            )}
                                            title="Ver Onboarding"
                                        >
                                            <ShieldCheck className="w-5 h-5" />
                                        </button>
                                        <div className={cn(
                                            "shrink-0 p-2.5 rounded-xl border flex items-center justify-center",
                                            isOpen
                                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                                : isPaused
                                                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                                    : "bg-red-500/10 text-red-500 border-red-500/20"
                                        )}>
                                            <div className={cn("w-2 h-2 rounded-full", isOpen ? "bg-green-500 animate-pulse" : isPaused ? "bg-yellow-500" : "bg-red-500")}></div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                togglePause(store.id, store.status);
                                            }}
                                            className={cn(
                                                "shrink-0 p-2.5 rounded-xl transition-all shadow-inner border",
                                                isPaused
                                                    ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/40 hover:bg-yellow-500/30 shadow-glow"
                                                    : "bg-white/5 text-[#A8A29E] border-white/10 hover:bg-white/10 hover:text-white"
                                            )}
                                            title={isPaused ? "Retomar Operação" : "Pausar Estabelecimento"}
                                        >
                                            <PauseCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Middle Section (Only in list mode) - Financial & Funnel Summary */}
                                {viewMode === 'list' && (
                                    <div className="flex flex-1 items-center gap-12 border-x border-white/5 px-8">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                                                <Wallet className="w-3 h-3" /> Saldo
                                            </span>
                                            <span className="text-lg font-black text-white">
                                                R$ {(store.balance || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-3 gap-4">
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-black text-white">{funnel.pending}</span>
                                                <span className="text-[8px] text-[#A8A29E] font-bold uppercase tracking-tighter">Produção</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-black text-blue-400">{funnel.accepted}</span>
                                                <span className="text-[8px] text-blue-400/80 font-bold uppercase tracking-tighter">Espera</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-black text-guepardo-orange">{funnel.inTransit}</span>
                                                <span className="text-[8px] text-guepardo-orange/80 font-bold uppercase tracking-tighter">Rota</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Financial Info (Only in grid mode) */}
                                {viewMode === 'grid' && (
                                    <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                <Wallet className="w-3 h-3" /> Saldo Recarga
                                            </span>
                                            <span className="text-xl font-black text-white mt-1">
                                                R$ {(store.balance || 0).toFixed(2)}
                                            </span>
                                        </div>
                                        <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all text-white shadow-inner">
                                            Recarregar
                                        </button>
                                    </div>
                                )}

                                {/* Funnel (Only in grid mode) */}
                                {viewMode === 'grid' && (
                                    <div className="space-y-3">
                                        <span className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <Activity className="w-3 h-3" /> Status do Funil de Pedidos
                                        </span>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                                                <span className="text-xl font-black text-white">{funnel.pending}</span>
                                                <span className="text-[9px] text-[#A8A29E] font-bold uppercase tracking-tighter mt-1">Produção</span>
                                            </div>
                                            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-xl font-black text-blue-400">{funnel.accepted}</span>
                                                <span className="text-[9px] text-blue-400/80 font-bold uppercase tracking-tighter mt-1">Aguardando</span>
                                            </div>
                                            <div className="bg-guepardo-orange/10 p-3 rounded-xl border border-guepardo-orange/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-xl font-black text-guepardo-orange">{funnel.inTransit}</span>
                                                <span className="text-[9px] text-guepardo-orange/80 font-bold uppercase tracking-tighter mt-1">Em Rota</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Card Footer Actions (Only in list mode) */}
                                {viewMode === 'list' && (
                                    <div className="flex items-center gap-4 shrink-0">
                                        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all text-white shadow-inner">
                                            Recarregar
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                togglePause(store.id, store.status);
                                            }}
                                            className={cn(
                                                "shrink-0 p-3 rounded-xl transition-all shadow-inner border",
                                                isPaused
                                                    ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/40 hover:bg-yellow-500/30 shadow-glow"
                                                    : "bg-white/5 text-[#A8A29E] border-white/10 hover:bg-white/10 hover:text-white"
                                            )}
                                            title={isPaused ? "Retomar" : "Pausar"}
                                        >
                                            <PauseCircle className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => toggleIsActive(store.id, store.is_active ?? true)}
                                            className={cn(
                                                "shrink-0 p-3 rounded-xl transition-all shadow-inner border",
                                                (store.is_active ?? true)
                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                                    : "bg-stone-500/10 text-stone-400 border-stone-500/20 hover:bg-stone-500/20"
                                            )}
                                        >
                                            <Power className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}

                                {/* Cancel Rate (Only in grid mode) */}
                                {viewMode === 'grid' && (
                                    <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-wider flex items-center gap-1">
                                                <TrendingDown className="w-3 h-3" /> Taxa de Cancelamento
                                            </span>
                                            <span className={cn(
                                                "text-xs font-black",
                                                (store.cancel_rate || 0) > 10 ? "text-red-500" : "text-green-500"
                                            )}>
                                                {store.cancel_rate || 0}%
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-1000",
                                                    (store.cancel_rate || 0) > 10 ? "bg-red-500" : "bg-green-500"
                                                )}
                                                style={{ width: `${Math.min(store.cancel_rate || 0, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Onboarding Review Modal */}
            {selectedStore && (
                <OnboardingReviewModal
                    store={selectedStore}
                    onClose={() => setSelectedStore(null)}
                    onUpdate={(status, notes) => handleUpdateOnboarding(selectedStore.id, status, notes)}
                />
            )}
        </div>
    );
};

export default MerchantManagement;
