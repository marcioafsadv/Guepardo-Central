import { supabase } from '../lib/supabase';
import { useState, useEffect, useRef } from 'react';
import { Send, X, ShieldAlert, MessageCircle, Bike, Store as StoreIcon } from 'lucide-react';
import type { Conversation, Message, Delivery } from '../types';
import { cn } from '../lib/utils';

interface ChatMultilateralProps {
    delivery: Delivery;
    onClose: () => void;
}

const ChatMultilateral: React.FC<ChatMultilateralProps> = ({ delivery, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeChat, setActiveChat] = useState<'courier-customer' | 'store-courier'>('courier-customer');
    const [newMessage, setNewMessage] = useState('');
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        setupConversation();
    }, [activeChat, delivery.id]);

    const setupConversation = async () => {
        setLoading(true);
        try {
            // Find or create conversation
            let { data: conv, error } = await supabase
                .from('conversations')
                .select('*')
                .eq('order_id', delivery.id)
                .eq('type', activeChat)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (!conv) {
                const { data: newConv, error: createError } = await supabase
                    .from('conversations')
                    .insert({ order_id: delivery.id, type: activeChat })
                    .select()
                    .single();
                
                if (createError) throw createError;
                conv = newConv;
            }

            setConversation(conv);
            if (conv) {
                fetchMessages(conv.id);
                subscribeToMessages(conv.id);
            }
        } catch (err) {
            console.error('Error setting up conversation:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (convId: string) => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });
        
        if (error) console.error('Error fetching messages:', error);
        else setMessages(data || []);
    };

    const subscribeToMessages = (convId: string) => {
        const subscription = supabase
            .channel(`chat-${convId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `conversation_id=eq.${convId}`
            }, (payload) => {
                setMessages((prev: Message[]) => [...prev, payload.new as Message]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !conversation) return;

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    content: newMessage,
                    is_admin_intervention: true // Admin is sending from here
                });

            if (error) throw error;
            setNewMessage('');
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
                        onClick={() => setActiveChat('courier-customer')}
                        className={cn(
                            "flex-1 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                            activeChat === 'courier-customer' 
                                ? "bg-white/10 text-white border border-white/10 shadow-inner" 
                                : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                        )}
                    >
                        <Bike className="w-4 h-4" /> Entregador x Cliente
                    </button>
                    <button
                        onClick={() => setActiveChat('store-courier')}
                        className={cn(
                            "flex-1 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                            activeChat === 'store-courier' 
                                ? "bg-white/10 text-white border border-white/10 shadow-inner" 
                                : "text-[#A8A29E] hover:text-white hover:bg-white/5"
                        )}
                    >
                        <StoreIcon className="w-4 h-4" /> Loja x Entregador
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
                        messages.map((msg: Message) => (
                            <div 
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[80%] gap-1",
                                    msg.is_admin_intervention ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                <div className={cn(
                                    "p-4 rounded-2xl text-sm font-medium relative group",
                                    msg.is_admin_intervention 
                                        ? "bg-brand-gradient text-white rounded-tr-none shadow-glow" 
                                        : "bg-white/10 text-white rounded-tl-none border border-white/10"
                                )}>
                                    {msg.is_admin_intervention && (
                                        <div className="flex items-center gap-1 mb-1 text-[9px] font-black uppercase tracking-tighter opacity-80">
                                            <ShieldAlert className="w-3 h-3" /> Intervenção Admin
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
                        disabled={!newMessage.trim() || !conversation}
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
