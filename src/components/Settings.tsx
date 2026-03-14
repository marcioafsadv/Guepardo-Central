import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '../lib/utils';

interface SettingsProps {
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
}

const Settings: React.FC<SettingsProps> = ({ theme, setTheme }) => {
    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-10">
                <h1 className="text-3xl font-black mb-2 tracking-tight text-white drop-shadow-xl font-display italic">Configurações do Sistema</h1>
                <p className="text-[#A8A29E] font-medium">Personalize a experiência e o comportamento do Painel Central.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>

                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                    <Monitor className="text-guepardo-orange w-6 h-6" />
                    Aparência
                </h2>

                <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Tema do Painel</h3>
                        <p className="text-xs text-[#A8A29E]">Escolha entre um visual adequado para leitura diurna ou a tradicional interface noturna.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => setTheme('light')}
                            className={cn(
                                "flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden",
                                theme === 'light'
                                    ? "bg-white/10 border-white/30 text-white shadow-glow"
                                    : "bg-black/20 border-white/5 text-[#A8A29E] hover:bg-white/5"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl transition-colors",
                                theme === 'light' ? "bg-amber-500/20 text-amber-500" : "bg-white/5 text-[#A8A29E]"
                            )}>
                                <Sun className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block font-bold mb-1">Modo Claro (Dia)</span>
                                <span className="block text-xs opacity-70">Cores leves e contrastantes para uso em ambientes iluminados.</span>
                            </div>
                            {theme === 'light' && (
                                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                            )}
                        </button>

                        <button
                            onClick={() => setTheme('dark')}
                            className={cn(
                                "flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden",
                                theme === 'dark'
                                    ? "bg-guepardo-brown-dark border-guepardo-accent/50 text-white shadow-glow"
                                    : "bg-black/20 border-white/5 text-[#A8A29E] hover:bg-white/5"
                            )}
                        >
                            <div className={cn(
                                "p-3 rounded-xl transition-colors",
                                theme === 'dark' ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-[#A8A29E]"
                            )}>
                                <Moon className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block font-bold mb-1">Modo Escuro (Noite)</span>
                                <span className="block text-xs opacity-70">O padrão Guepardo. Elegante, focado e descansado para os olhos.</span>
                            </div>
                            {theme === 'dark' && (
                                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
