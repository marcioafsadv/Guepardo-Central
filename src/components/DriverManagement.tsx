import { useState, useEffect } from 'react';
import {
    Search,
    User,
    MapPin,
    CheckCircle2,
    XCircle,
    AlertCircle,
    LayoutGrid,
    List as ListIcon,
    Phone,
    Bike as BikeIcon,
    ShieldCheck,
    FileText,
    Map as MapIcon,
    CreditCard,
    X,
    RotateCw,
    Upload,
    ZoomIn,
    ZoomOut,
    ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface DriverWithDetails extends Profile {
    addresses?: any;
    vehicles?: any;
    bank_accounts?: any;
    stats?: {
        completed: number;
        accepted: number;
        cancelled: number;
        active: number;
        rejected: number;
    };
}

interface DriverDetailsModalProps {
    driver: DriverWithDetails;
    onClose: () => void;
    onStatusUpdate: (status: string) => void;
    onRefresh: () => void;
}

const BRAZILIAN_BANKS: Record<string, string> = {
    '001': 'Banco do Brasil',
    '033': 'Santander/Banespa',
    '104': 'Caixa Econômica Federal',
    '237': 'Bradesco',
    '341': 'Itaú Unibanco',
    '260': 'Nubank',
    '077': 'Banco Inter',
    '422': 'Banco Safra',
    '633': 'Banco Rendimento',
    '745': 'Citibank',
    '212': 'Banco Original',
    '655': 'Banco Votorantim',
    '041': 'Banrisul',
    '197': 'Stone',
    '290': 'PagSeguro'
};

const getBankName = (code?: string, name?: string) => {
    if (name && name !== 'N/A') return name;
    if (!code || code === 'N/A') return 'N/A';
    const cleanCode = code.toString().padStart(3, '0');
    return BRAZILIAN_BANKS[cleanCode] || `Banco (${code})`;
};

const DriverDetailsModal = ({ driver, onClose, onStatusUpdate, onRefresh }: DriverDetailsModalProps) => {
    const [updating, setUpdating] = useState(false);
    const [viewingPhoto, setViewingPhoto] = useState<{ url: string; label: string } | null>(null);
    const [rotation, setRotation] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [docUrls, setDocUrls] = useState({
        cnh_front: driver.vehicles?.cnh_front_url,
        cnh_back: driver.vehicles?.cnh_back_url,
        crlv: driver.vehicles?.crlv_url,
        bike_photo: driver.vehicles?.bike_photo_url,
        residence: driver.vehicles?.proof_of_residence_url,
        avatar: driver.avatar_url
    });

    useEffect(() => {
        setRotation(0);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, [viewingPhoto]);

    useEffect(() => {
        if (zoom === 1) setPosition({ x: 0, y: 0 });
    }, [zoom]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && zoom > 1) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleUpload = async (docType: string, file: File) => {
        setUploadingDoc(docType);
        try {
            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            
            const baseName = docType === 'CNH Frente' ? 'cnh_front' :
                             docType === 'CNH Verso' ? 'cnh_back' :
                             docType === 'CRLV' ? 'crlv' :
                             docType === 'Foto Veículo' ? 'bike_photo' : 
                             docType === 'Comprovante Residência' ? 'residence' : 'avatar';
            
            const fileName = `${baseName}.${ext}`;
            const filePath = `${driver.id}/${fileName}`;
            
            console.log('Uploading to:', filePath, 'Type:', file.type);
            
            const { error: uploadError } = await supabase.storage
                .from('courier-documents')
                .upload(filePath, file, { 
                    upsert: true,
                    contentType: file.type
                });

            if (uploadError) {
                console.error('Supabase Storage Error:', uploadError);
                throw uploadError;
            }

            const { data } = supabase.storage.from('courier-documents').getPublicUrl(filePath);
            const newUrl = `${data.publicUrl}?t=${Date.now()}`;
            
            // Update Database
            const docField = docType === 'CNH Frente' ? 'cnh_front_url' :
                             docType === 'CNH Verso' ? 'cnh_back_url' :
                             docType === 'CRLV' ? 'crlv_url' :
                             docType === 'Foto Veículo' ? 'bike_photo_url' : 
                             docType === 'Comprovante Residência' ? 'proof_of_residence_url' : 'avatar_url';

            if (docField === 'avatar_url') {
                const { error: avatarError } = await supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', driver.id);
                if (avatarError) throw avatarError;
            } else {
                // Ensure record exists in vehicles
                const { data: existingVehicle } = await supabase.from('vehicles').select('user_id').eq('user_id', driver.id).maybeSingle();
                
                if (existingVehicle) {
                    const { error: updateError } = await supabase.from('vehicles').update({ [docField]: newUrl }).eq('user_id', driver.id);
                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabase.from('vehicles').insert({ 
                        user_id: driver.id, 
                        [docField]: newUrl,
                        model: driver.vehicle_model || 'N/A',
                        plate: driver.vehicle_plate || 'N/A',
                        cnh_number: driver.cnh_number || 'N/A',
                        cnh_validity: new Date().toISOString().split('T')[0], // Default to today
                        plate_state: 'N/A',
                        plate_city: 'N/A',
                        year: new Date().getFullYear(),
                        color: 'N/A',
                        renavam: 'N/A'
                    });
                    if (insertError) throw insertError;
                }
            }

            const docKey = docType === 'CNH Frente' ? 'cnh_front' :
                           docType === 'CNH Verso' ? 'cnh_back' :
                           docType === 'CRLV' ? 'crlv' :
                           docType === 'Foto Veículo' ? 'bike_photo' : 
                           docType === 'Comprovante Residência' ? 'residence' : 'avatar';

            setDocUrls(prev => ({ ...prev, [docKey]: newUrl }));
            onRefresh();
            
        } catch (err: any) {
            console.error('Error uploading document:', err);
            alert(`Erro ao enviar documento: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setUploadingDoc(null);
        }
    };

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setViewingPhoto(null);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const handleUpdateStatus = async (newStatus: string) => {
        setUpdating(true);
        await onStatusUpdate(newStatus);
        setUpdating(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-guepardo-brown-dark/90 border border-white/10 w-full max-w-4xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col md:flex-row h-[85vh]">

                {/* Left Panel: Profile Summary */}
                <div className="md:w-1/3 bg-black/20 border-r border-white/10 p-8 flex flex-col items-center text-center overflow-y-auto">
                    <div 
                        className="relative group mb-6 cursor-pointer"
                        onClick={() => driver.avatar_url && setViewingPhoto({ url: driver.avatar_url, label: 'Foto de Perfil' })}
                    >
                        <div className="absolute -inset-1 bg-brand-gradient rounded-full blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                        <div className="w-32 h-32 rounded-full bg-guepardo-brown-light border-4 border-white/10 overflow-hidden relative shadow-2xl">
                            {docUrls.avatar ? (
                                <img src={docUrls.avatar} alt={driver.full_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white bg-guepardo-orange/20">
                                    {driver.full_name?.charAt(0) || 'D'}
                                </div>
                            )}
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2">{driver.full_name}</h3>
                    <span className={cn("px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest mb-6 shadow-sm",
                        driver.status === 'approved' || driver.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                            driver.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
                                'bg-red-500/20 text-red-400 border-red-500/30'
                    )}>
                        {driver.status === 'pending' ? 'AGUARDANDO APROVAÇÃO' : driver.status?.toUpperCase() || 'DESCONHECIDO'}
                    </span>

                    <div className="w-full space-y-4 text-left">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                                <Phone className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest leading-none mb-1">Contato</p>
                                <p className="text-white text-sm font-bold">{driver.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-2 bg-guepardo-orange/10 text-guepardo-orange rounded-xl border border-guepardo-orange/20 shrink-0">
                                <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-guepardo-orange/70 uppercase tracking-widest leading-none mb-1">Localização</p>
                                <p className="text-white text-sm font-bold">{driver.work_city || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                            <div className="p-2 bg-slate-500/10 text-slate-400 rounded-xl border border-slate-500/20 shrink-0">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400/70 uppercase tracking-widest leading-none mb-1">Documento (CPF)</p>
                                <p className="text-white text-sm font-bold">{driver.cpf || 'N/A'}</p>
                            </div>
                        </div>
                        {driver.created_at && (
                            <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest leading-none mb-1">MEMBRO DESDE</p>
                                    <p className="text-white text-sm font-bold">{format(new Date(driver.created_at), 'dd/MM/yyyy')}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full mt-8 grid grid-cols-2 gap-3">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-emerald-400">{driver.stats?.completed || 0}</span>
                            <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest mt-1">Feitas</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-blue-400">{driver.stats?.accepted || 0}</span>
                            <span className="text-[8px] font-black text-blue-500/50 uppercase tracking-widest mt-1">Aceitas</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-amber-400">{driver.stats?.active || 0}</span>
                            <span className="text-[8px] font-black text-amber-500/50 uppercase tracking-widest mt-1">Em Rota</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-xl font-black text-red-500">{driver.stats?.rejected || 0}</span>
                            <span className="text-[8px] font-black text-red-500/50 uppercase tracking-widest mt-1">Rejeitadas</span>
                        </div>
                    </div>

                    <div className="mt-auto pt-8 w-full space-y-3">
                        {driver.status === 'pending' && (
                            <button
                                onClick={() => handleUpdateStatus('approved')}
                                disabled={updating}
                                className="w-full py-3 bg-brand-gradient rounded-xl font-black text-white text-sm shadow-glow hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" /> APROVAR AGORA
                            </button>
                        )}
                        {(driver.status === 'approved' || driver.status === 'active') && (
                            <button
                                onClick={() => handleUpdateStatus('blocked')}
                                disabled={updating}
                                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl font-black text-red-500 text-sm transition-all flex items-center justify-center gap-2"
                            >
                                <XCircle className="w-4 h-4" /> BLOQUEAR ACESSO
                            </button>
                        )}
                        {driver.status === 'blocked' && (
                            <button
                                onClick={() => handleUpdateStatus('approved')}
                                disabled={updating}
                                className="w-full py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-xl font-black text-green-500 text-sm transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" /> DESBLOQUEAR
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-[#A8A29E] hover:text-white text-sm transition-all"
                        >
                            VOLTAR
                        </button>
                    </div>
                </div>

                {/* Right Panel: Detailed Info Docs */}
                <div className="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-10">
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                        <ShieldCheck className="text-guepardo-orange w-8 h-8" />
                        Vistoria de Cadastro
                    </h2>

                    {/* Address */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-sm transition-all group-hover:bg-blue-500/20">
                                <MapIcon className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-black text-blue-400/70 uppercase tracking-[0.2em] leading-none">Residência</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Logradouro</p>
                                <p className="text-white font-bold">{driver.addresses?.street || 'N/A'}, {driver.addresses?.number || ''}</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Bairro / Cidade</p>
                                <p className="text-white font-bold">{driver.addresses?.district || 'N/A'} • {driver.addresses?.city || 'N/A'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Vehicle */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-sm transition-all group-hover:bg-amber-500/20">
                                <BikeIcon className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-black text-amber-500/70 uppercase tracking-[0.2em] leading-none">Equipamento / Veículo</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Modelo / Cor</p>
                                <p className="text-white font-bold">{driver.vehicles?.model || 'N/A'} • {driver.vehicles?.color || 'N/A'}</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Placa</p>
                                <p className="text-white font-bold">{driver.vehicles?.plate || 'N/A'}</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">CNH</p>
                                <p className="text-white font-bold">{driver.vehicles?.cnh_number || 'N/A'}</p>
                            </div>
                        </div>
                    </section>
                    {/* Payment Info */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-sm transition-all group-hover:bg-emerald-500/20">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-black text-emerald-400/70 uppercase tracking-[0.2em] leading-none">Dados de Pagamento</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Banco</p>
                                <p className="text-white font-bold">{getBankName(driver.bank_accounts?.bank_code || driver.bank_code, driver.bank_accounts?.bank_name || driver.bank_name)}</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Agência / Conta</p>
                                <p className="text-white font-bold">{driver.bank_accounts?.agency || driver.bank_agency || 'N/A'} / {driver.bank_accounts?.account_number || driver.bank_account || 'N/A'}</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">CPF</p>
                                <p className="text-white font-bold">{driver.cpf || 'N/A'}</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-1">
                                <p className="text-[10px] font-bold text-[#57534E] uppercase">Chave PIX</p>
                                <p className={cn("font-bold", (driver.bank_accounts?.pix_key || driver.pix_key) ? "text-white" : "text-red-400/50 italic")}>
                                    {driver.bank_accounts?.pix_key || driver.pix_key || 'NÃO INFORMADO'}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Documents Grid */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-sm transition-all group-hover:bg-purple-500/20">
                                <FileText className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-black text-purple-400/70 uppercase tracking-[0.2em] leading-none">Documentação Fotográfica</h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {[
                                { label: 'CNH Frente', url: docUrls.cnh_front },
                                { label: 'CNH Verso', url: docUrls.cnh_back },
                                { label: 'CRLV', url: docUrls.crlv },
                                { label: 'Foto Veículo', url: docUrls.bike_photo },
                                { label: 'Comprovante Residência', url: docUrls.residence }
                            ].map((doc, i) => (
                                <div key={i} className="space-y-3 group/doc relative">
                                    <div 
                                        className="aspect-[4/3] bg-black/40 rounded-2xl border border-white/10 overflow-hidden relative shadow-inner group-hover/doc:border-guepardo-orange/50 transition-all cursor-pointer"
                                        onClick={() => doc.url && setViewingPhoto({ url: doc.url, label: doc.label })}
                                    >
                                        {doc.url ? (
                                            doc.url.toLowerCase().includes('.pdf') ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-red-500/5 text-red-400 gap-2">
                                                    <FileText className="w-10 h-10" />
                                                    <span className="text-[10px] font-black tracking-widest">VISUALIZAR PDF</span>
                                                </div>
                                            ) : (
                                                <img src={doc.url} alt={doc.label} className="w-full h-full object-cover transition-transform group-hover/doc:scale-110" />
                                            )
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold text-[#57534E] gap-2">
                                                <AlertCircle className="w-5 h-5 opacity-20" />
                                                NÃO ANEXADO
                                            </div>
                                        )}
                                        
                                        {uploadingDoc === doc.label && (
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                                                <div className="w-6 h-6 border-2 border-guepardo-orange/20 border-t-guepardo-orange rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-[10px] font-black text-[#A8A29E] tracking-widest uppercase">{doc.label}</p>
                                        <label className="cursor-pointer p-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-[#A8A29E] hover:text-white transition-all shadow-sm">
                                            <Upload className="w-3 h-3" />
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*,application/pdf"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleUpload(doc.label, file);
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            {/* Full Screen Photo Viewer Overlay */}
            {viewingPhoto && (
                <div 
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-4 md:p-10"
                    onClick={() => setViewingPhoto(null)}
                >
                    <div className="absolute top-6 right-6 flex items-center gap-4 z-[70]">
                        {/* Zoom Controls */}
                        {!viewingPhoto.url.toLowerCase().includes('.pdf') && (
                            <div className="flex bg-white/10 rounded-full p-1 border border-white/10 shadow-2xl backdrop-blur-md">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setZoom(prev => Math.max(prev - 0.25, 0.5));
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all active:scale-95"
                                    title="Diminuir Zoom"
                                >
                                    <ZoomOut className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setZoom(1);
                                    }}
                                    className="px-2 min-w-[3.5rem] flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors"
                                    title="Resetar Zoom"
                                >
                                    <span className="text-[10px] font-black text-white/50">{Math.round(zoom * 100)}%</span>
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setZoom(prev => Math.min(prev + 0.25, 4));
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all active:scale-95"
                                    title="Aumentar Zoom"
                                >
                                    <ZoomIn className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {viewingPhoto.url.toLowerCase().includes('.pdf') && (
                            <a 
                                href={viewingPhoto.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110 flex items-center gap-2 group/open"
                                onClick={(e) => e.stopPropagation()}
                                title="Abrir em Nova Aba"
                            >
                                <ExternalLink className="w-6 h-6" />
                                <span className="text-[10px] font-black uppercase tracking-widest pr-1">Abrir Original</span>
                            </a>
                        )}
                        <button 
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110 flex items-center gap-2 group/rotate"
                            onClick={(e) => {
                                e.stopPropagation();
                                setRotation(prev => (prev + 90) % 360);
                            }}
                            title="Girar Foto"
                        >
                            <RotateCw className="w-6 h-6 transition-transform group-hover:rotate-45" />
                            <span className="text-[10px] font-black uppercase tracking-widest pr-1">Girar</span>
                        </button>
                        <button 
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                setViewingPhoto(null);
                            }}
                        >
                            <X className="w-8 h-8" />
                        </button>
                    </div>
                    
                    <div 
                        className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-6 animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-full flex items-center justify-between">
                            <div className="flex flex-col">
                                <h3 className="text-2xl font-black text-white uppercase tracking-widest leading-none">{viewingPhoto.label}</h3>
                                <p className="text-guepardo-orange text-[10px] font-black uppercase tracking-[0.3em] mt-2">Conferência de Documentação</p>
                            </div>
                            <div className="hidden md:block px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                                <p className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-widest">{driver.full_name}</p>
                            </div>
                        </div>
                        
                        <div className="relative w-full flex-1 bg-black/40 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl group/viewer flex items-center justify-center">
                            <div className="absolute inset-0 bg-brand-gradient opacity-5"></div>
                            {!viewingPhoto.url.toLowerCase().includes('.pdf') && (
                                <div 
                                    className="absolute inset-0 overflow-hidden flex items-center justify-center p-12 custom-scrollbar"
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                >
                                    <img 
                                        src={viewingPhoto.url} 
                                        alt={viewingPhoto.label} 
                                        className={`transition-transform ${isDragging ? 'duration-0' : 'duration-300'} ease-out shadow-2xl origin-center select-none`}
                                        style={{ 
                                            transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                                            maxWidth: zoom === 1 ? '100%' : 'none',
                                            maxHeight: zoom === 1 ? '100%' : 'none',
                                            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                                        }}
                                        onMouseDown={handleMouseDown}
                                        onDragStart={(e) => e.preventDefault()}
                                        draggable={false}
                                    />
                                </div>
                            )}
                            {viewingPhoto.url.toLowerCase().includes('.pdf') && (
                                <iframe 
                                    src={viewingPhoto.url} 
                                    className="w-full h-full rounded-[2.5rem] relative z-10"
                                    title={viewingPhoto.label}
                                />
                            )}
                        </div>
                        
                        <p className="text-[#A8A29E] text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                            Clique fora para fechar • ESC para sair
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

const DriverManagement = () => {
    const [drivers, setDrivers] = useState<DriverWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('approved');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedDriver, setSelectedDriver] = useState<DriverWithDetails | null>(null);

    useEffect(() => {
        fetchDrivers();

        const profilesSub = supabase
            .channel('drivers-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchDrivers();
            })
            .subscribe();

        const deliveriesSub = supabase
            .channel('deliveries-stats-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                fetchDrivers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(profilesSub);
            supabase.removeChannel(deliveriesSub);
        };
    }, []);

    const fetchDrivers = async () => {
        try {
            const [
                { data: profiles, error: profError },
                { data: vehicles, error: vehError },
                { data: addresses, error: addrError },
                { data: bankAccounts, error: bankError },
                { data: deliveriesRaw, error: delError }
            ] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                supabase.from('vehicles').select('*'),
                supabase.from('addresses').select('*'),
                supabase.from('bank_accounts').select('*'),
                supabase.from('deliveries').select('driver_id, status, accepted_at').not('driver_id', 'is', null)
            ]);

            if (profError) throw profError;
            if (vehError) console.error('Error fetching vehicles:', vehError);
            if (addrError) console.error('Error fetching addresses:', addrError);
            if (bankError) console.error('Error fetching bank accounts:', bankError);
            if (delError) console.error('Error fetching delivery stats:', delError);

            // Aggregate stats
            const statsMap: Record<string, any> = {};
            (deliveriesRaw || []).forEach(d => {
                if (!d.driver_id) return;
                if (!statsMap[d.driver_id]) {
                    statsMap[d.driver_id] = { completed: 0, accepted: 0, cancelled: 0, active: 0, rejected: 0 };
                }
                const status = d.status?.toLowerCase();
                if (status === 'delivered' || status === 'completed') statsMap[d.driver_id].completed++;
                if (d.accepted_at) statsMap[d.driver_id].accepted++;
                if (status === 'cancelled') statsMap[d.driver_id].cancelled++;
                if (status === 'rejected') statsMap[d.driver_id].rejected++;
                if (['picked_up', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery'].includes(status)) statsMap[d.driver_id].active++;
            });

            const mappedDrivers = (profiles || []).map((d: any) => {
                const driverVehicles = (vehicles || []).filter(v => v.user_id === d.id);
                const driverAddresses = (addresses || []).filter(a => a.user_id === d.id);
                const driverBank = (bankAccounts || []).find(b => b.user_id === d.id);

                const vehicle = driverVehicles[0] || {
                    user_id: d.id,
                    model: d.vehicle_model || d.metadata?.vehicle?.model || 'N/A',
                    color: d.vehicle_color || d.metadata?.vehicle?.color || 'N/A',
                    plate: d.vehicle_plate || d.metadata?.vehicle?.plate || 'N/A',
                    cnh_number: d.cnh_number || d.metadata?.vehicle?.cnhNumber || 'N/A'
                };

                return {
                    ...d,
                    vehicles: vehicle,
                    addresses: driverAddresses[0] || null,
                    bank_accounts: driverBank || null,
                    stats: statsMap[d.id] || { completed: 0, accepted: 0, cancelled: 0, active: 0, rejected: 0 }
                };
            });

            setDrivers(mappedDrivers);
        } catch (err) {
            console.error('Error fetching drivers:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (userId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', userId);

            if (error) throw error;

            // Update local state if needed, or let realtime handle it
            setDrivers(prev => prev.map(d => d.id === userId ? { ...d, status: newStatus } : d));
            if (selectedDriver?.id === userId) {
                setSelectedDriver(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const handleSelectDriver = async (driver: DriverWithDetails) => {
        setSelectedDriver(driver);
        try {
            // Fetch additional details from 'addresses' table
            const { data: address } = await supabase
                .from('addresses')
                .select('*')
                .eq('user_id', driver.id)
                .maybeSingle();

            // Fetch additional details from 'vehicles' table
            const { data: vehicle } = await supabase
                .from('vehicles')
                .select('*')
                .eq('user_id', driver.id)
                .maybeSingle();

            // Fetch additional details from 'bank_accounts' table
            const { data: bankAccount } = await supabase
                .from('bank_accounts')
                .select('*')
                .eq('user_id', driver.id)
                .maybeSingle();

            // Synthesis logic with fallbacks
            const synthesizedAddress = address || {
                user_id: driver.id,
                city: driver.work_city || 'N/A',
                street: 'N/A',
                state: 'N/A',
                number: ''
            };

            const synthesizedVehicle = vehicle || {
                user_id: driver.id,
                model: 'N/A',
                plate: 'N/A',
                cnh_number: 'N/A',
                cnh_front_url: supabase.storage.from('courier-documents').getPublicUrl(`${driver.id}/cnh_front.jpg`).data.publicUrl,
                cnh_back_url: supabase.storage.from('courier-documents').getPublicUrl(`${driver.id}/cnh_back.jpg`).data.publicUrl,
                crlv_url: supabase.storage.from('courier-documents').getPublicUrl(`${driver.id}/crlv.jpg`).data.publicUrl,
                bike_photo_url: supabase.storage.from('courier-documents').getPublicUrl(`${driver.id}/bike_photo.jpg`).data.publicUrl,
            };

            setSelectedDriver(prev => (prev && prev.id === driver.id) ? {
                ...prev,
                addresses: synthesizedAddress,
                vehicles: synthesizedVehicle,
                bank_accounts: bankAccount
            } : prev);
        } catch (err) {
            console.error('Error fetching driver details:', err);
        }
    };

    const filteredDrivers = drivers.filter(d => {
        const matchesSearch = d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.cpf?.includes(searchTerm) ||
            d.work_city?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-md">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <User className="text-guepardo-orange shadow-glow-orange" />
                        <span className="text-fluorescent-orange">Gestão de Entregadores</span>
                    </h2>
                    <p className="text-xs text-[#A8A29E] font-medium uppercase tracking-widest">Controle de novos cadastros e frota ativa</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E] group-focus-within:text-guepardo-orange transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, CPF ou cidade..."
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
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-guepardo-orange/50 transition-all text-white"
                    >
                        <option value="pending">Pendentes de Vistoria</option>
                        <option value="approved">Entregadores Ativos</option>
                        <option value="blocked">Bloqueados</option>
                        <option value="all">Todos os Cadastros</option>
                    </select>
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
                    {filteredDrivers.map((driver) => (
                        <div
                            key={driver.id}
                            className={cn(
                                "group bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden hover:bg-white/10 hover:border-white/20 transition-all duration-500 relative hover:shadow-2xl",
                                viewMode === 'list' ? "flex items-center p-6 gap-6" : "flex flex-col p-8"
                            )}
                        >
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.02] group-hover:opacity-[0.05] rounded-full transition-all duration-700"></div>

                            {/* Header/Photo */}
                            <div className={cn("flex items-center gap-5", viewMode === 'list' ? "w-72 shrink-0" : "mb-8")}>
                                <div className="relative group/photo">
                                    <div className="absolute -inset-1.5 bg-brand-gradient rounded-full blur opacity-20 group-hover/photo:opacity-40 transition duration-500"></div>
                                    <div className="w-16 h-16 rounded-full bg-guepardo-brown-light border-2 border-white/10 overflow-hidden relative flex items-center justify-center shadow-xl">
                                        {driver.avatar_url ? (
                                            <img src={driver.avatar_url} alt={driver.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-black text-guepardo-orange/50">{driver.full_name?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className={cn(
                                        "absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-[#1A1C1E] z-10",
                                        driver.status === 'approved' || driver.status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                        driver.status === 'pending' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' :
                                        'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                                    )}></div>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <h3 className="font-black text-white text-lg truncate group-hover:text-guepardo-orange transition-colors leading-tight tracking-tight">{driver.full_name}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        <div className="flex items-center gap-1.5 text-[9px] text-blue-400 font-black uppercase tracking-widest bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 shadow-sm">
                                            <MapPin className="w-2.5 h-2.5" />
                                            {driver.work_city || 'S.P.'}
                                        </div>
                                        {driver.created_at && (
                                            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-sm">
                                                <ShieldCheck className="w-2.5 h-2.5" />
                                                MEMBRO
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Status and Stats Bar */}
                            <div className={cn("flex-1 min-w-0 flex flex-col gap-6", viewMode === 'list' ? "px-6 border-x border-white/5" : "mb-8")}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest leading-none mb-2 text-[8px]">Placa / CPF</span>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-white font-black text-xs">{driver.vehicles?.plate || 'S/ PLACA'}</span>
                                            <span className="text-[#A8A29E] font-medium text-[10px]">{driver.cpf || 'S/ CPF'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-[#57534E] uppercase tracking-widest leading-none mb-2 text-[8px]">Situação</span>
                                        <div className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-widest inline-block text-center",
                                            driver.status === 'approved' || driver.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                driver.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
                                                    'bg-red-500/20 text-red-500 border-red-500/30'
                                        )}>
                                            {driver.status === 'pending' ? 'PENDENTE' : driver.status?.toUpperCase() || 'OFF'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-5 gap-2.5 pt-6 border-t border-white/5">
                                    <div className="flex flex-col items-center p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-sm">
                                        <span className="text-[14px] font-black text-emerald-400">{driver.stats?.completed || 0}</span>
                                        <span className="text-[7px] font-black text-emerald-500/60 uppercase tracking-widest">Feitas</span>
                                    </div>
                                    <div className="flex flex-col items-center p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-sm">
                                        <span className="text-[14px] font-black text-blue-400">{driver.stats?.accepted || 0}</span>
                                        <span className="text-[7px] font-black text-blue-500/60 uppercase tracking-widest">Aceitas</span>
                                    </div>
                                    <div className="flex flex-col items-center p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-sm">
                                        <span className="text-[14px] font-black text-amber-500">{driver.stats?.active || 0}</span>
                                        <span className="text-[7px] font-black text-amber-500/60 uppercase tracking-widest">Rota</span>
                                    </div>
                                    <div className="flex flex-col items-center p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 shadow-sm">
                                        <span className="text-[14px] font-black text-red-500">{driver.stats?.rejected || 0}</span>
                                        <span className="text-[7px] font-black text-red-500/60 uppercase tracking-widest">Rejeit.</span>
                                    </div>
                                    <div className="flex flex-col items-center p-2.5 bg-slate-500/10 rounded-xl border border-slate-500/20 shadow-sm">
                                        <span className="text-[14px] font-black text-slate-400">{driver.stats?.cancelled || 0}</span>
                                        <span className="text-[7px] font-black text-slate-500/60 uppercase tracking-widest">Canc.</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className={cn("flex items-center gap-3", viewMode === 'list' ? "w-64 justify-end" : "justify-between mt-auto pt-6 border-t border-white/5")}>
                                <button
                                    onClick={() => handleSelectDriver(driver)}
                                    className="flex-1 flex items-center justify-center gap-3 px-6 py-3.5 bg-guepardo-orange/10 hover:bg-guepardo-orange/20 rounded-[1.25rem] transition-all text-[10px] font-black text-guepardo-orange border border-guepardo-orange/20 group-hover:border-guepardo-orange/40 shadow-glow uppercase tracking-widest"
                                >
                                    <ShieldCheck className="w-4 h-4" /> Vistoriar Cadastro
                                </button>
                                {driver.status === 'pending' && (
                                    <button
                                        onClick={() => handleUpdateStatus(driver.id, 'approved')}
                                        className="p-3.5 bg-emerald-500 text-white rounded-[1.25rem] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-110 active:scale-95 transition-all"
                                        title="Aprovar Imediatamente"
                                    >
                                        <CheckCircle2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {filteredDrivers.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white/5 rounded-[3rem] border border-white/10 border-dashed backdrop-blur-sm">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <User className="w-8 h-8 text-[#A8A29E]" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Sem entregadores nesta categoria</h3>
                            <p className="text-sm text-[#A8A29E] max-w-sm">No momento não há cadastros com os filtros selecionados.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Details Modal */}
            {selectedDriver && (
                <DriverDetailsModal
                    driver={selectedDriver}
                    onClose={() => setSelectedDriver(null)}
                    onStatusUpdate={(newStatus) => handleUpdateStatus(selectedDriver.id, newStatus)}
                    onRefresh={fetchDrivers}
                />
            )}
        </div>
    );
};

export default DriverManagement;
