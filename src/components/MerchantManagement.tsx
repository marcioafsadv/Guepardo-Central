import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    Store,
    Activity,
    Wallet,
    Power,
    ShieldCheck,
    FileText,
    Image as ImageIcon,
    Info,
    LayoutGrid,
    List as ListIcon,
    PauseCircle,
    X,
    MapPin,
    Building2,
    Calendar,
    Phone,
    CheckCircle2,
    AlertCircle,
    Copy,
    Check,
    Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Store as StoreType, Delivery } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const formatAddress = (address: StoreType['address']) => {
    if (!address) return 'N/A';
    if (typeof address === 'string') return address;
    
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.number) parts.push(address.number);
    if (address.district) parts.push(address.district);
    if (address.city) {
        let cityState = address.city;
        if (address.state) cityState += ` - ${address.state}`;
        parts.push(cityState);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'Endereço incompleto';
};

interface MerchantStats {
    completed: number;
    cancelled: number;
    active: number;
    revenue: number;
}

interface MerchantDetailsModalProps {
    store: StoreType;
    stats: MerchantStats;
    onClose: () => void;
    onOnboardingUpdate: (status: 'approved' | 'rejected', notes?: string) => Promise<void>;
    onStatusUpdate: (isActive: boolean) => Promise<void>;
    onPauseUpdate: (status: string | undefined) => Promise<void>;
}

const MerchantDetailsModal = ({ store, stats, onClose, onOnboardingUpdate, onStatusUpdate, onPauseUpdate }: MerchantDetailsModalProps) => {
    const [notes, setNotes] = useState(store.onboarding_notes || '');
    const [updating, setUpdating] = useState(false);

    const handleOnboarding = async (status: 'approved' | 'rejected') => {
        setUpdating(true);
        await onOnboardingUpdate(status, notes);
        setUpdating(false);
    };

    const docs = [
        { label: 'Logo da Empresa', url: store.logo_url, icon: ImageIcon },
        { label: 'RG do Sócio Responsável', url: store.document_url, icon: FileText },
        { label: 'Contrato Social', url: store.contract_url, icon: ShieldCheck },
        { label: 'Fachada da Loja', url: store.location_photo_url, icon: ImageIcon },
    ];

    const isOpen = ['open', 'aberta', 'online'].includes(store.status?.toLowerCase() || '') || !store.status;
    const isPaused = ['paused', 'pausado', 'pausada'].includes(store.status?.toLowerCase() || '');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-guepardo-brown-dark/95 border border-white/10 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col md:flex-row h-[85vh]">
                
                {/* Left Panel: Merchant Summary */}
                <div className="md:w-1/3 bg-black/30 border-r border-white/10 p-8 flex flex-col items-center text-center overflow-y-auto custom-scrollbar">
                    <div className="relative group mb-6">
                        <div className="absolute -inset-1 bg-brand-gradient rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                        <div className="w-32 h-32 rounded-3xl bg-guepardo-brown-light border-2 border-white/10 overflow-hidden relative shadow-2xl flex items-center justify-center">
                            {store.logo_url ? (
                                <img src={store.logo_url} alt={store.fantasy_name} className="w-full h-full object-cover" />
                            ) : (
                                <Store className="w-16 h-16 text-guepardo-orange/50" />
                            )}
                        </div>
                    </div>
                    
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2 leading-tight">
                        {store.fantasy_name || store.company_name}
                    </h3>

                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                        <span className={cn("px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest shadow-sm",
                            store.onboarding_status === 'approved' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                            store.onboarding_status === 'pending' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
                            'bg-red-500/20 text-red-500 border-red-500/30'
                        )}>
                            {store.onboarding_status === 'approved' ? 'ONBOARDING OK' :
                             store.onboarding_status === 'pending' ? 'AGUARDANDO APROVAÇÃO' : 'REJEITADO'}
                        </span>
                        <span className={cn("px-3 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest shadow-sm",
                            isOpen ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                            isPaused ? "bg-amber-500/20 text-amber-500 border-amber-500/30" :
                            "bg-red-500/20 text-red-400 border-red-500/30"
                        )}>
                            {isPaused ? 'PAUSADO' : isOpen ? 'ABERTO' : 'FECHADO'}
                        </span>
                    </div>

                    <div className="w-full space-y-3 text-left">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest leading-none mb-1">Documento</p>
                                <p className="text-white text-sm font-bold truncate">{store.cnpj || store.document || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-2 bg-guepardo-orange/10 text-guepardo-orange rounded-xl border border-guepardo-orange/20 shrink-0">
                                <Phone className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-guepardo-orange/70 uppercase tracking-widest leading-none mb-1">Contato</p>
                                <p className="text-white text-sm font-bold truncate">{store.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
                                <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-purple-400/70 uppercase tracking-widest leading-none mb-1">Localização</p>
                                <p className="text-white text-[10px] font-bold leading-relaxed">{formatAddress(store.address)}</p>
                            </div>
                        </div>
                        {store.created_at && (
                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest leading-none mb-1">PARCEIRO DESDE</p>
                                    <p className="text-white text-sm font-bold">{format(new Date(store.created_at), 'dd/MM/yyyy')}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full mt-6 grid grid-cols-2 gap-3">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-emerald-400">{stats.completed}</span>
                            <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest mt-1">Feitos</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-red-500">{stats.cancelled}</span>
                            <span className="text-[8px] font-black text-red-500/50 uppercase tracking-widest mt-1">Canc.</span>
                        </div>
                    </div>

                    <div className="mt-auto pt-8 w-full space-y-3">
                        {store.onboarding_status !== 'approved' ? (
                            <button
                                onClick={() => handleOnboarding('approved')}
                                disabled={updating}
                                className="w-full py-3 bg-brand-gradient rounded-xl font-black text-white text-sm shadow-glow hover:scale-[1.02] transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                            >
                                <CheckCircle2 className="w-4 h-4" /> Aprovar Lojista
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onPauseUpdate(store.status)}
                                    className={cn(
                                        "flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 uppercase tracking-widest border",
                                        isPaused ? "bg-amber-500/20 text-amber-500 border-amber-500/40 shadow-glow" : "bg-white/5 text-[#A8A29E] border-white/10"
                                    )}
                                >
                                    <PauseCircle className="w-4 h-4" /> {isPaused ? 'Retomar' : 'Pausar'}
                                </button>
                                <button
                                    onClick={() => onStatusUpdate(isOpen)}
                                    className={cn(
                                        "flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 uppercase tracking-widest border shadow-sm",
                                        isOpen 
                                            ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40 shadow-glow-emerald" 
                                            : "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
                                    )}
                                    title={isOpen ? 'Desativar Operações' : 'Ativar Operações'}
                                >
                                    <Power className="w-4 h-4" /> {isOpen ? 'Desativar' : 'Ativar'}
                                </button>
                            </div>
                        )}
                        {store.onboarding_status === 'pending' && (
                            <button
                                onClick={() => handleOnboarding('rejected')}
                                disabled={updating}
                                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl font-black text-red-500 text-sm transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                            >
                                <AlertCircle className="w-4 h-4" /> Recusar Cadastro
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-[#A8A29E] hover:text-white text-sm transition-all flex items-center justify-center gap-2"
                        >
                            <X className="w-4 h-4" /> FECHAR
                        </button>
                    </div>
                </div>

                {/* Right Panel: Detailed Vistoria */}
                <div className="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-10">
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                        <ShieldCheck className="text-guepardo-orange w-8 h-8" />
                        Vistoria Cadastral
                    </h2>

                    {/* Store Info */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-sm">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-black text-blue-400/70 uppercase tracking-[0.2em] leading-none">Dados Empresariais</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Razão Social</p>
                                <p className="text-white font-bold">{store.company_name || 'N/A'}</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Nome Fantasia</p>
                                <p className="text-white font-bold">{store.fantasy_name || 'N/A'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Documents Grid */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-sm">
                                <FileText className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-black text-purple-400/70 uppercase tracking-[0.2em] leading-none">Documentação Fotográfica</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {docs.map((doc, i) => {
                                const isPDF = doc.url?.toLowerCase().endsWith('.pdf');
                                return (
                                    <div key={i} className="space-y-2 group cursor-pointer transition-all duration-500 hover:scale-105">
                                        <div className="aspect-[4/3] bg-black/40 rounded-2xl border border-white/10 overflow-hidden relative shadow-inner group-hover:border-guepardo-orange/50">
                                            {doc.url ? (
                                                <>
                                                    {isPDF ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-guepardo-orange/40 bg-guepardo-orange/5">
                                                            <FileText className="w-12 h-12 mb-2" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-[#57534E]">Documento PDF</span>
                                                        </div>
                                                    ) : (
                                                        <img 
                                                            src={doc.url} 
                                                            alt={doc.label} 
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                                        />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                                                        <a 
                                                            href={doc.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-[10px] font-black text-white hover:bg-white/20 transition-colors uppercase tracking-widest"
                                                        >
                                                            {isPDF ? 'Abrir PDF' : 'Ver Original'}
                                                        </a>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold text-[#57534E] gap-2">
                                                    <AlertCircle className="w-5 h-5 opacity-20" />
                                                    NÃO ANEXADO
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-black text-center text-[#A8A29E] tracking-widest uppercase">{doc.label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Notes */}
                    <section className="bg-black/20 p-8 rounded-[2rem] border border-white/5 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <Info className="w-4 h-4 text-guepardo-orange" />
                            <h4 className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest leading-none">Notas Internas / Motivo de Rejeição</h4>
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Descreva observações sobre os documentos ou motivos para rejeição..."
                            className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-guepardo-orange/50 transition-all resize-none font-medium placeholder:text-[#57534E]"
                        />
                    </section>
                </div>
            </div>
        </div>
    );
};


interface RechargeModalProps {
    store: StoreType;
    onClose: () => void;
}

const RechargeModal = ({ store, onClose }: RechargeModalProps) => {
    const [amount, setAmount] = useState('20.00');
    const [loading, setLoading] = useState(false);
    const [pixData, setPixData] = useState<{ pixCode: string; pixImage: string; amount: number } | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'automated' | 'manual'>('automated');
    const [manualPixConfig, setManualPixConfig] = useState<{ pix_key?: string; bank_name?: string; receiver_name?: string } | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data } = await supabase
                    .from('guepardo_system_settings')
                    .select('value')
                    .eq('key', 'manual_pix_config')
                    .single();
                
                if (data && data.value) {
                    setManualPixConfig(data.value);
                } else {
                    const saved = localStorage.getItem('manual_pix_config');
                    if (saved) setManualPixConfig(JSON.parse(saved));
                }
            } catch (e) {
                const saved = localStorage.getItem('manual_pix_config');
                if (saved) setManualPixConfig(JSON.parse(saved));
            }
        };
        fetchConfig();
    }, []);

    const handleCreateCharge = async (billingType: 'PIX' | 'MANUAL' = 'PIX') => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 20) {
            alert('O valor mínimo para recarga é R$ 20,00');
            return;
        }

        setLoading(true);
        try {
            const functionName = billingType === 'MANUAL' ? 'process-manual-recharge' : 'asaas-create-charge';
            const { data, error } = await supabase.functions.invoke(functionName, {
                body: { 
                    storeId: store.id, 
                    amount: numAmount,
                    billingType: billingType
                }
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error);

            if (billingType === 'MANUAL') {
                alert('Transferência informada com sucesso! O saldo será creditado após a conferência do admin.');
                onClose();
            } else {
                setPixData(data);
            }
        } catch (err: any) {
            console.error('Erro ao gerar cobrança:', err);
            alert(`Erro: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!pixData) return;
        navigator.clipboard.writeText(pixData.pixCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-guepardo-brown-dark border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white tracking-tight uppercase">Recarregar Saldo</h3>
                            <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest leading-none mt-1">Crédito via PIX</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-[#A8A29E] hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {!pixData && (
                    <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5 mb-8">
                        <button 
                            onClick={() => setActiveTab('automated')}
                            className={cn(
                                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                activeTab === 'automated' ? "bg-white/10 text-white shadow-sm" : "text-[#A8A29E] hover:text-white"
                            )}
                        >
                            Automático (Taxa R$ 1,99)
                        </button>
                        <button 
                            onClick={() => setActiveTab('manual')}
                            className={cn(
                                "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                activeTab === 'manual' ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-[#A8A29E] hover:text-white"
                            )}
                        >
                            Manual (Grátis)
                        </button>
                    </div>
                )}

                {!pixData ? (
                    <div className="space-y-6">
                        {activeTab === 'automated' ? (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Valor da Recarga (Mín. R$ 20,00)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-emerald-500">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="20"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                                    <p className="text-[10px] font-bold text-[#A8A29E] uppercase leading-relaxed">
                                        <Info className="w-3 h-3 inline mr-1 text-guepardo-orange" />
                                        O saldo será liberado automaticamente após a confirmação do pagamento pelo Asaas.
                                    </p>
                                </div>

                                <button
                                    onClick={handleCreateCharge}
                                    disabled={loading}
                                    className="w-full py-5 bg-brand-gradient rounded-2xl font-black text-white text-lg shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-tighter"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />}
                                    Gerar PIX de Recarga
                                </button>
                            </>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Valor da Transferência (Mín. R$ 20,00)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-emerald-500">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="20"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-2xl font-black text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-[#A8A29E] uppercase tracking-widest">Chave PIX (Admin)</span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-black text-white">{manualPixConfig?.pix_key || '65.628.033/0001-26'}</span>
                                            {(manualPixConfig?.pix_key || '65.628.033/0001-26') && (
                                                <button 
                                                    onClick={() => { navigator.clipboard.writeText(manualPixConfig?.pix_key || '65.628.033/0001-26'); alert('Chave Copiada!'); }}
                                                    className="p-2 text-emerald-400 hover:text-white transition-colors"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest">Banco</span>
                                            <span className="text-[11px] font-black text-white italic">{manualPixConfig?.bank_name || 'Mercado Pago'}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[8px] font-black text-[#A8A29E] uppercase tracking-widest">Favorecido</span>
                                            <span className="text-[11px] font-black text-white">{manualPixConfig?.receiver_name || 'GUEPARDO DELIVERY'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 text-center">
                                    <p className="text-[11px] text-[#A8A29E] font-medium leading-relaxed">
                                        Realize a transferência e clique no botão abaixo. O saldo será liberado após conferência.
                                    </p>
                                    
                                    <button
                                        onClick={() => handleCreateCharge('MANUAL')}
                                        disabled={loading}
                                        className="w-full py-5 bg-[#FF6B00] rounded-2xl font-black text-white text-lg shadow-glow-orange hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-tighter mt-4"
                                    >
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                                        Informar Transferência
                                    </button>

                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 text-[9px] font-black uppercase tracking-widest mt-2">
                                        <AlertCircle size={12} />
                                        Pagamento Grátis (Sem Taxas)
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="relative p-4 bg-white rounded-[2rem] shadow-2xl">
                            <img 
                                src={`data:image/png;base64,${pixData.pixImage}`} 
                                alt="QR Code PIX" 
                                className="w-48 h-48"
                            />
                            <div className="absolute inset-0 border-[12px] border-white rounded-[2rem] pointer-events-none"></div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-sm font-black text-white uppercase tracking-widest">Total a Pagar</p>
                            <p className="text-4xl font-black text-emerald-400">R$ {pixData.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>

                        <button
                            onClick={copyToClipboard}
                            className={cn(
                                "w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all border uppercase tracking-widest",
                                copied 
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                                    : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                            )}
                        >
                            {copied ? (
                                <><Check className="w-5 h-5" /> Copiado!</>
                            ) : (
                                <><Copy className="w-5 h-5" /> Copiar Código PIX</>
                            )}
                        </button>

                        <p className="text-[10px] font-bold text-[#A8A29E] uppercase">
                            Após o pagamento, esta janela fechará automaticamente assim que o saldo cair. 
                            (Geralmente em menos de 1 minuto).
                        </p>
                        
                        <button onClick={() => setPixData(null)} className="text-xs font-bold text-[#57534E] hover:text-[#A8A29E] transition-colors uppercase tracking-widest underline">
                            Alterar Valor
                        </button>
                    </div>
                )}
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
    const [rechargeStore, setRechargeStore] = useState<StoreType | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const fetchData = useCallback(async () => {
        try {
            const [storesRes, deliveriesRes] = await Promise.all([
                supabase.from('stores').select('*').order('created_at', { ascending: false }),
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
    }, []);

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
    }, [fetchData, supabase]);

    const toggleIsActive = async (id: string, currentIsOpen: boolean) => {
        try {
            const nextActiveState = !currentIsOpen;
            const nextStatus = nextActiveState ? 'aberta' : 'fechada';
            
            const { data, error } = await supabase
                .from('stores')
                .update({ 
                    is_active: nextActiveState,
                    status: nextStatus 
                })
                .eq('id', id)
                .select();

            if (error) {
                console.error('Supabase update error:', error);
                alert(`Erro de Banco de Dados: ${error.message}`);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn('Update affected 0 rows. Check RLS policies.');
                alert('A atualização falhou (0 linhas afetadas). Provavelmente uma restrição de acesso (RLS) no Supabase.');
                return;
            }
            
            console.log('Update success:', data);
        } catch (err) {
            console.error('Error toggling active status:', err);
        }
    };

    const togglePause = async (id: string, currentStatus: string | undefined) => {
        try {
            const isCurrentlyPaused = ['paused', 'pausado', 'pausada'].includes(currentStatus?.toLowerCase() || '');
            const newStatus = isCurrentlyPaused ? 'aberta' : 'pausada';
            const { error } = await supabase
                .from('stores')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error toggling pause status:', err);
        }
    };

    const getMerchantStats = (storeId: string): MerchantStats => {
        const storeDeliveries = deliveries.filter(d => d.store_id === storeId);
        return {
            completed: storeDeliveries.filter(d => ['delivered', 'completed'].includes(d.status?.toLowerCase())).length,
            cancelled: storeDeliveries.filter(d => ['canceled', 'cancelled', 'rejected'].includes(d.status?.toLowerCase())).length,
            active: storeDeliveries.filter(d => ['picked_up', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery', 'pending', 'accepted'].includes(d.status?.toLowerCase())).length,
            revenue: 0 // Could be added if storage has it
        };
    };

    const handleUpdateOnboarding = async (storeId: string, status: 'approved' | 'rejected', notes?: string) => {
        try {
            const updates: Partial<StoreType> = { 
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
            
            if (selectedStore?.id === storeId) {
                setSelectedStore(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (err) {
            console.error('Error updating onboarding:', err);
        }
    };

    const handleManualAdjustment = async (storeId: string, currentBalance: number) => {
        const amountStr = prompt("Digite o valor para ADICIONAR ao saldo (ex: 50.00):");
        if (!amountStr) return;
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            alert("Valor inválido.");
            return;
        }

        const confirmText = prompt(`Você está prestes a ADICIONAR R$ ${amount.toFixed(2)} ao saldo da loja. Digite "SIM" para confirmar:`);
        if (confirmText?.toUpperCase() !== "SIM") return;

        try {
            const { error } = await supabase
                .from('stores')
                .update({ wallet_balance: (currentBalance || 0) + amount })
                .eq('id', storeId);

            if (error) throw error;
            alert("Saldo atualizado com sucesso!");
            fetchData();
        } catch (err: any) {
            alert(`Erro ao atualizar saldo: ${err.message}`);
        }
    };

    const filteredStores = stores.filter(store => {
        const matchesSearch = (store.fantasy_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (store.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (store.document?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        const s = store.status?.toLowerCase() || '';
        const isOpen = ['open', 'aberta', 'online'].includes(s) || !s;
        const isPaused = ['paused', 'pausado', 'pausada'].includes(s);
        const isClosed = !isOpen && !isPaused;

        let matchesStatus = statusFilter === 'all';
        if (statusFilter === 'open') matchesStatus = isOpen;
        if (statusFilter === 'paused') matchesStatus = isPaused;
        if (statusFilter === 'closed') matchesStatus = isClosed;
        
        const matchesOnboarding = onboardingFilter === 'all' || store.onboarding_status === onboardingFilter || (onboardingFilter === 'pending' && !store.onboarding_status);

        return matchesSearch && matchesStatus && matchesOnboarding;
    });

    const totalStats = stores.reduce((acc, store) => {
        const s = getMerchantStats(store.id);
        return {
            completed: acc.completed + s.completed,
            cancelled: acc.cancelled + s.cancelled,
            active: acc.active + s.active,
        };
    }, { completed: 0, cancelled: 0, active: 0 });

    const totalBalance = stores.reduce((acc, store) => acc + (store.wallet_balance || 0), 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Top Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Lojas Operando</span>
                        <div className="p-3 bg-orange-500/10 text-orange-400 rounded-2xl">
                            <Store className="w-5 h-5" />
                        </div>
                    </div>
                    <span className="text-3xl font-black text-white">
                        {stores.filter(store => {
                            const s = store.status?.toLowerCase() || '';
                            return ['open', 'aberta', 'online'].includes(s) || !s;
                        }).length} 
                        <span className="text-sm font-medium text-[#A8A29E]">/ {stores.length}</span>
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Total de Estabelecimentos</span>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm group relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Saldo em Carteira</span>
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                            <Wallet className="w-5 h-5" />
                        </div>
                    </div>
                    <span className="text-2xl font-black text-white">R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest">Recargas Acumuladas</span>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-all duration-500 shadow-2xl backdrop-blur-sm group relative overflow-hidden md:col-span-2">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">Volume de Operação (Todos Lojistas)</span>
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
                            <Activity className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase">Entregues</span>
                            <span className="text-xl font-black text-emerald-400">{totalStats.completed}</span>
                        </div>
                        <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase">Em Andamento</span>
                            <span className="text-xl font-black text-blue-400">{totalStats.active}</span>
                        </div>
                        <div className="flex flex-col border-l border-white/10 pl-4">
                            <span className="text-[10px] text-[#A8A29E] font-bold uppercase">Cancelados</span>
                            <span className="text-xl font-black text-red-500">{totalStats.cancelled}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-md">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <Building2 className="text-guepardo-orange" />
                        Gestão de Lojistas
                    </h2>
                    <p className="text-[10px] text-[#A8A29E] font-black uppercase tracking-widest">Vistoria e Monitoramento de Estabelecimentos</p>
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
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-guepardo-orange/50 transition-all text-white font-bold"
                    >
                        <option value="all">SITUAÇÃO: TODOS</option>
                        <option value="open">OPERANDO AGORA</option>
                        <option value="closed">FECHADOS</option>
                        <option value="paused">PAUSADOS</option>
                    </select>
                    <select
                        value={onboardingFilter}
                        onChange={(e) => setOnboardingFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-guepardo-orange/50 transition-all text-white font-bold"
                    >
                        <option value="all">VISTORIA: TODAS</option>
                        <option value="pending">AGUARDANDO APROVAÇÃO</option>
                        <option value="approved">APROVADOS</option>
                        <option value="rejected">REJEITADOS</option>
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
                        const s = getMerchantStats(store.id);
                        const status = store.status?.toLowerCase() || '';
                        const isOpen = ['open', 'aberta', 'online'].includes(status) || !status;
                        const isPaused = ['paused', 'pausado', 'pausada'].includes(status);

                        return (
                            <div 
                                key={store.id} 
                                className={cn(
                                    "bg-white/5 border border-white/10 rounded-[2.5rem] hover:bg-white/10 transition-all duration-500 relative group overflow-hidden shadow-xl",
                                    viewMode === 'list' ? "flex flex-row items-center p-6 gap-8" : "flex flex-col p-8 gap-6"
                                )}
                            >
                                <div className={cn(
                                    "absolute left-0 w-1 h-full",
                                    viewMode === 'grid' && "top-0 w-full h-1",
                                    isOpen ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]" : isPaused ? "bg-amber-500" : "bg-red-500"
                                )}></div>

                                {/* Header / Identity */}
                                <div className={cn("flex items-start justify-between gap-4", viewMode === 'list' ? "w-1/3 shrink-0" : "w-full")}>
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                                            {store.logo_url ? (
                                                <img src={store.logo_url} alt={store.fantasy_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Store className="text-guepardo-orange/30 w-6 h-6" />
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <h3 className="text-xl font-black text-white truncate leading-tight group-hover:text-guepardo-orange transition-colors">
                                                {store.fantasy_name || store.company_name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="text-[10px] font-black text-[#57534E] tracking-widest uppercase">
                                                    {store.cnpj || store.document || 'SEM DOCUMENTO'}
                                                </span>
                                                <span className={cn(
                                                    "text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border",
                                                    store.onboarding_status === 'approved' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                    store.onboarding_status === 'rejected' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                    "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                )}>
                                                    {store.onboarding_status === 'approved' ? 'VISTORIA OK' :
                                                     store.onboarding_status === 'rejected' ? 'REPROVADO' :
                                                     'PENDENTE'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleManualAdjustment(store.id, store.wallet_balance || 0)}
                                            className="shrink-0 p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl hover:bg-amber-500/20 transition-all shadow-inner hover:scale-110"
                                            title="Ajuste Manual de Saldo"
                                        >
                                            <Activity className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setRechargeStore(store)}
                                            className="shrink-0 p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all shadow-inner hover:scale-110"
                                            title="Gerar Cobrança"
                                        >
                                            <Wallet className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setSelectedStore(store)}
                                            className={cn(
                                                "shrink-0 p-3 rounded-2xl transition-all shadow-inner border hover:scale-110",
                                                store.onboarding_status === 'approved' 
                                                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20" 
                                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 shadow-glow"
                                            )}
                                            title="Vistoriar Lojista"
                                        >
                                            <ShieldCheck className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Stats Bar */}
                                <div className={cn("flex-1", viewMode === 'list' ? "px-8 border-x border-white/5" : "")}>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-lg font-black text-emerald-400">{s.completed}</span>
                                            <span className="text-[7px] font-black text-emerald-500/40 uppercase tracking-widest">Feitos</span>
                                        </div>
                                        <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-lg font-black text-blue-400">{s.active}</span>
                                            <span className="text-[7px] font-black text-blue-400/40 uppercase tracking-widest">Rota</span>
                                        </div>
                                        <div className="flex flex-col items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                                            <span className="text-lg font-black text-red-500">{s.cancelled}</span>
                                            <span className="text-[7px] font-black text-red-500/40 uppercase tracking-widest">Canc.</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Info & Actions */}
                                <div className={cn("flex items-center gap-4", viewMode === 'list' ? "w-64 justify-end" : "justify-between mt-auto pt-4 border-t border-white/5")}>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-[#57534E] uppercase tracking-widest leading-none mb-1">Status Operacional</span>
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", isOpen ? "bg-green-500 animate-pulse" : isPaused ? "bg-amber-500" : "bg-red-500")}></div>
                                            <span className={cn("text-[10px] font-black uppercase tracking-widest", 
                                                isOpen ? "text-green-500" : isPaused ? "text-amber-500" : "text-red-500")}>
                                                {isPaused ? "Pausado" : isOpen ? "Aberto" : "Fechado"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => togglePause(store.id, store.status)}
                                            className={cn(
                                                "p-3 rounded-xl transition-all border",
                                                isPaused ? "bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-glow" : "bg-white/5 text-[#A8A29E] border-white/10 hover:text-white"
                                            )}
                                        >
                                            <PauseCircle className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => toggleIsActive(store.id, isOpen)}
                                            className={cn(
                                                "p-3 rounded-xl transition-all border shadow-sm",
                                                isOpen 
                                                    ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/40 shadow-glow-emerald" 
                                                    : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                                            )}
                                            title={isOpen ? 'Desativar Operações' : 'Ativar Operações'}
                                        >
                                            <Power className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Merchant Details Modal */}
            {selectedStore && (
                <MerchantDetailsModal
                    store={selectedStore}
                    stats={getMerchantStats(selectedStore.id)}
                    onClose={() => setSelectedStore(null)}
                    onOnboardingUpdate={(status, notes) => handleUpdateOnboarding(selectedStore.id, status, notes)}
                    onStatusUpdate={(isOpen) => toggleIsActive(selectedStore.id, isOpen)}
                    onPauseUpdate={(status) => togglePause(selectedStore.id, status)}
                />
            )}
            {/* Recharge Modal */}
            {rechargeStore && (
                <RechargeModal
                    store={rechargeStore}
                    onClose={() => setRechargeStore(null)}
                />
            )}
        </div>
    );
};

export default MerchantManagement;
