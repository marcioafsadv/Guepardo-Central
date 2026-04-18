import { supabase } from '../lib/supabase';
import { useState, useEffect, useRef } from 'react';
import { Send, X, ShieldAlert, MessageCircle, Bike, Store as StoreIcon, Headset } from 'lucide-react';
import type { Delivery } from '../types';
import { cn } from '../lib/utils';

interface ChatMultilateralProps {
    delivery: Delivery;
    onClose: () => void;
}

const ChatMultilateral: React.FC<ChatMultilateralProps> = ({ delivery, onClose }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<'STORE_COURIER' | 'STORE_CENTRAL' | 'COURIER_CENTRAL'>('STORE_COURIER');
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        fetchMessages();
        const subscription = subscribeToMessages();
        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [activeChat, delivery.id]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('order_messages')
                .select('*')
                .eq('order_id', delivery.id)
                .eq('room_type', activeChat)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = () => {
        const channel = supabase
            .channel(`order-chat-${delivery.id}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'order_messages',
                filter: `order_id=eq.${delivery.id}`
            }, (payload) => {
                // Sincronizar qualquer mensagem do pedido, mas só mostrar se for da sala atual
                if (payload.new.room_type === activeChat) {
                    setMessages((prev) => {
                        if (prev.some(m => m.id === payload.new.id)) return prev;
                        return [...prev, payload.new];
                    });
                }
            })
            .subscribe();

        return channel;
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const textToSend = newMessage.trim();
        setNewMessage('');

        try {
            const { error } = await supabase
                .from('order_messages')
                .insert({
                    order_id: delivery.id,
                    room_type: activeChat,
                    sender_type: 'CENTRAL',
                    sender_name: 'Atendimento Guepardo',
                    content: textToSend,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1C1917] w-full max-w-2xl h-[600px] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-gradient rounded-2xl shadow-glow">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white italic">CHAT MULTILATERAL</h2>
                            <p className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-widest">Pedido #{delivery.id.slice(0, 8)}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition-all text-[#A8A29E] hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-2 bg-black/20 gap-2">
                    <button
                        onClick={() => setActiveChat('STORE_COURIER')}
                        className={cn(
                            "flex-1 py-3 rounded-2xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-1",
                            activeChat === 'STORE_COURIER' 
                                ? "bg-white/10 text-white border border-white/10 shadow-inner" 
                                : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                        )}
                    >
                        <StoreIcon className="w-4 h-4" /> Loja x Entregador
                    </button>
                    <button
                        onClick={() => setActiveChat('STORE_CENTRAL')}
                        className={cn(
                            "flex-1 py-3 rounded-2xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-1",
                            activeChat === 'STORE_CENTRAL' 
                                ? "bg-guepardo-orange/20 text-guepardo-orange border border-guepardo-orange/20 shadow-inner" 
                                : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Headset className="w-4 h-4" /> Suporte Loja
                    </button>
                    <button
                        onClick={() => setActiveChat('COURIER_CENTRAL')}
                        className={cn(
                            "flex-1 py-3 rounded-2xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-1",
                            activeChat === 'COURIER_CENTRAL' 
                                ? "bg-guepardo-orange/20 text-guepardo-orange border border-guepardo-orange/20 shadow-inner" 
                                : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Headset className="w-4 h-4" /> Suporte Entregador
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/40">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-8 h-8 border-2 border-guepardo-orange/20 border-t-guepardo-orange rounded-full animate-spin"></div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#A8A29E] gap-2">
                            <MessageCircle className="w-12 h-12 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma mensagem ainda</p>
                        </div>
                    ) : (
                        messages.map((msg: any) => (
                            <div 
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[80%] gap-1",
                                    msg.sender_type === 'CENTRAL' ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                <div className={cn(
                                    "p-4 rounded-2xl text-sm font-medium relative group",
                                    msg.sender_type === 'CENTRAL' 
                                        ? "bg-brand-gradient text-white rounded-tr-none shadow-glow" 
                                        : "bg-white/10 text-white rounded-tl-none border border-white/10"
                                )}>
                                    {msg.sender_type === 'CENTRAL' && (
                                        <div className="flex items-center gap-1 mb-1 text-[9px] font-black uppercase tracking-tighter opacity-80">
                                            <ShieldAlert className="w-3 h-3" /> Intervenção Central
                                        </div>
                                    )}
                                    {!msg.sender_type?.includes('CENTRAL') && (
                                        <div className="flex items-center gap-1 mb-1 text-[9px] font-black uppercase tracking-tighter text-guepardo-orange">
                                            {msg.sender_name}
                                        </div>
                                    )}
                                    {msg.content}
                                </div>
                                <span className="text-[9px] text-[#A8A29E] font-black uppercase tracking-widest px-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={sendMessage} className="p-6 bg-white/5 border-t border-white/5 flex gap-4">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Intervir na conversa..."
                        className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm font-medium text-white placeholder:text-[#A8A29E] focus:outline-none focus:border-guepardo-orange/50 transition-all shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-brand-gradient text-white p-4 rounded-2xl shadow-glow hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                        <Send className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatMultilateral;
