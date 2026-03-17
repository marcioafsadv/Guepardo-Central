import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download, Activity, LayoutDashboard, Map as MapIcon,
  Settings, LogOut, TrendingUp, Package, Bike, Store, DollarSign, Clock, X,
  Calendar, ChevronDown, Trophy, Medal, User
} from 'lucide-react';
import { startOfDay, subDays } from 'date-fns';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import RealTimeMap from './components/RealTimeMap';
import LiveTrackingSidebar from './components/Dashboard/LiveTrackingSidebar';
import ProductivityMatrix from './components/Dashboard/ProductivityMatrix';
import ExceptionsWidget from './components/Dashboard/ExceptionsWidget';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
import DeliveryManagement from './components/DeliveryManagement';
import DriverManagement from './components/DriverManagement';
import SettingsView from './components/Settings';
import MerchantManagement from './components/MerchantManagement';
import FinanceManagement from './components/FinanceManagement';
import ChatMultilateral from './components/ChatMultilateral';
import type { Delivery } from './types';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('guepardo-theme') as 'dark' | 'light') || 'dark';
  });
  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(null);
  const [chatDelivery, setChatDelivery] = useState<Delivery | null>(null);
  const [allData, setAllData] = useState<{
    drivers: any[];
    stores: any[];
    deliveries: any[];
  }>({ drivers: [], stores: [], deliveries: [] });
  
  // New Filters
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [merchantSearch, setMerchantSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [driversRes, storesRes, deliveriesRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('stores').select('*'),
        supabase.from('deliveries').select('*')
      ]);

      const driversData = driversRes.data || [];
      const storesData = storesRes.data || [];
      const deliveriesData = deliveriesRes.data || [];

      const enrichedDeliveries = deliveriesData.map(d => {
        const driver = driversData?.find(p => p.id === (d.driver_id || d.courier_id));
        const store = storesData?.find(s => s.id === d.store_id);
        
        // Financial calculation
        const totalMerchant = 8.00 + ((d.delivery_distance || 0) * 1.32);
        const platformFee = totalMerchant - (d.earnings || 0);

        return {
          ...d,
          driver_name: d.driver_name || driver?.full_name || 'Guepardo',
          driver_photo: d.driver_photo || driver?.avatar_url,
          store_name: store?.fantasy_name || 'Lojista',
          totalMerchant,
          platformFee,
          displayId: d.items?.displayId?.toString() || d.id.slice(-6).toUpperCase()
        };
      });

      setAllData({
        drivers: driversData,
        stores: storesData,
        deliveries: enrichedDeliveries
      });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const filteredStats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    
    let filtered = allData.deliveries;

    // Date Filter
    if (dateFilter === 'today') {
      filtered = filtered.filter(d => new Date(d.created_at).getTime() >= today.getTime());
    } else if (dateFilter === '7d') {
      filtered = filtered.filter(d => new Date(d.created_at).getTime() >= subDays(today, 7).getTime());
    } else if (dateFilter === '30d') {
      filtered = filtered.filter(d => new Date(d.created_at).getTime() >= subDays(today, 30).getTime());
    }

    // Merchant Filter
    if (merchantSearch) {
      filtered = filtered.filter(d => 
        d.store_name?.toLowerCase().includes(merchantSearch.toLowerCase()) ||
        d.fantasy_name?.toLowerCase().includes(merchantSearch.toLowerCase())
      );
    }

    // Driver Filter
    if (driverSearch) {
      filtered = filtered.filter(d => 
        d.driver_name?.toLowerCase().includes(driverSearch.toLowerCase()) ||
        d.full_name?.toLowerCase().includes(driverSearch.toLowerCase())
      );
    }

    const delivered = filtered.filter(d => ['delivered', 'completed'].includes(d.status));
    const active = filtered.filter(d => ['accepted', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery', 'picked_up'].includes(d.status));
    const waiting = filtered.filter(d => ['pending', 'accepted', 'arrived_at_pickup'].includes(d.status));
    const cancelled = filtered.filter(d => ['canceled', 'cancelled'].includes(d.status));

    const totalRevenue = delivered.reduce((acc, curr) => acc + (curr.totalMerchant || 0), 0);
    const platformRevenue = delivered.reduce((acc, curr) => acc + (curr.platformFee || 0), 0);

    return {
      activeDeliveries: active.length,
      totalDelivered: delivered.length,
      waitingForPickup: waiting.length,
      cancelledOrders: cancelled.length,
      totalRevenue,
      platformRevenue
    };
  }, [allData.deliveries, dateFilter, merchantSearch, driverSearch]);

  useEffect(() => {
    fetchStats();

    const deliverySubscription = supabase
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      .channel('deliveries-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(deliverySubscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStats, supabase]);

  useEffect(() => {
    localStorage.setItem('guepardo-theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);


  const menuItems = [
    { id: 'dashboard', label: 'Painel Central', icon: LayoutDashboard },
    { id: 'deliveries', label: 'Gestão de Entregas', icon: Package },
    { id: 'map', label: 'Mapa em Tempo Real', icon: MapIcon },
    { id: 'merchants', label: 'Lojistas', icon: Store },
    { id: 'drivers', label: 'Entregadores', icon: Bike },
    { id: 'analytics', label: 'Relatórios Financeiros', icon: TrendingUp },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full text-[#E5E5E5] font-sans">
      {/* Sidebar */}
      <aside
        className="bg-chocolate-panel border-r border-white/5 transition-all duration-500 flex flex-col z-20 shadow-2xl w-24"
      >
        <div className="p-8 pb-4 flex flex-col items-center gap-4">
          {/* Espaço em branco no topo para manter alinhamento */}
          <div className="h-4"></div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto flex flex-col items-center mt-2 custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 group relative overflow-visible",
                activeTab === item.id
                  ? "bg-brand-gradient text-white shadow-glow-intense ring-2 ring-[#FF6B00]/30 animate-pulse-glow"
                  : "text-[#A8A29E] hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110", activeTab === item.id ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "group-hover:text-guepardo-orange")} />

              {/* Tooltip */}
              <div className="absolute left-full ml-4 px-3 py-2 bg-black/90 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10 transition-opacity duration-200">
                {item.label}
              </div>

              {activeTab === item.id && (
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 h-8 w-1.5 bg-[#FF6B00] rounded-r-full shadow-[2px_0_10px_rgba(255,107,0,0.8)] animate-in fade-in slide-in-from-left duration-300"></div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-white/10 bg-black/20 flex justify-center">
          <button className="w-12 h-12 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-xl transition-all group relative overflow-visible">
            <LogOut className="w-5 h-5 shrink-0 group-hover:rotate-12 transition-transform" />

            {/* Tooltip */}
            <div className="absolute left-full ml-4 px-3 py-2 bg-red-900/90 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-red-500/20 transition-opacity duration-200">
              Sair do Painel
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-chocolate-panel z-10 shadow-lg top-0 sticky">
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col">
              <h1 className="text-lg font-bold tracking-tight">Console de Liderança</h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Sistemas Operacionais</p>
              </div>
            </div>
          </div>

          {/* Logo Centralizada no Cabeçalho */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-6 group cursor-pointer hidden md:flex">
            <img
              src="/cheetah-scooter.png"
              alt="Guepardo"
              className="h-[72px] w-auto object-contain transform group-hover:scale-110 transition-transform duration-300 drop-shadow-md"
            />
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-left duration-300">
              <span className="text-white font-black italic text-3xl leading-none tracking-tighter shadow-sm">GUEPARDO</span>
              <span className="text-[#FF6B00] font-bold text-[12px] leading-none tracking-[0.3em] mt-1 shadow-sm">DELIVERY</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white">Administrador Master</p>
              <p className="text-[10px] text-guepardo-orange font-bold uppercase tracking-tighter">Acesso Total Guepardo</p>
            </div>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-brand-gradient rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>
              <div className="w-11 h-11 rounded-xl bg-guepardo-brown-light border border-white/20 relative flex items-center justify-center text-white font-black text-lg shadow-2xl">
                GC
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className={cn("flex-1 overflow-auto custom-scrollbar", activeTab === 'map' ? 'p-0 relative' : (activeTab === 'dashboard' ? 'p-0' : 'p-10'))}>
          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto p-10 space-y-12">
              <div className="flex flex-col gap-2 relative">
                <div className="flex items-center gap-4">
                  <h1 className="text-4xl font-display italic font-black tracking-tight text-white drop-shadow-2xl">Dashboard Guepardo Central</h1>
                  {isRefreshing && (
                    <div className="w-2 h-2 rounded-full bg-guepardo-orange animate-pulse shadow-[0_0_10px_#FF5F00]"></div>
                  )}
                </div>
                <p className="text-[#A8A29E] font-medium uppercase text-xs tracking-widest">Controle e monitoramento de performance global.</p>
              </div>

              {/* Advanced Filters Bar */}
              <div className="flex flex-col md:flex-row items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 w-full md:w-auto">
                  <Calendar className="w-4 h-4 text-guepardo-orange" />
                  <select 
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    className="bg-transparent text-white text-sm font-black focus:outline-none appearance-none cursor-pointer pr-8 uppercase tracking-tighter"
                  >
                    <option value="today" className="bg-[#1D0B04] text-white py-2">Hoje</option>
                    <option value="7d" className="bg-[#1D0B04] text-white py-2">Últimos 7 dias</option>
                    <option value="30d" className="bg-[#1D0B04] text-white py-2">Últimos 30 dias</option>
                    <option value="all" className="bg-[#1D0B04] text-white py-2">Histórico Total</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#A8A29E] -ml-6 pointer-events-none" />
                </div>

                <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 flex-1 w-full">
                  <Store className="w-4 h-4 text-[#A8A29E]" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por Lojista..." 
                    value={merchantSearch}
                    onChange={(e) => setMerchantSearch(e.target.value)}
                    className="bg-transparent text-sm font-medium w-full focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 bg-black/40 px-4 py-2.5 rounded-xl border border-white/5 flex-1 w-full">
                  <User className="w-4 h-4 text-[#A8A29E]" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por Entregador..." 
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    className="bg-transparent text-sm font-medium w-full focus:outline-none"
                  />
                </div>

                <button 
                  onClick={() => { setDateFilter('today'); setMerchantSearch(''); setDriverSearch(''); }}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#A8A29E] transition-colors"
                  title="Limpar Filtros"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats Grid - Financial (Row 1) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Volume Lojistas', value: currencyFormatter.format(filteredStats.totalRevenue), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Repasse Central', value: currencyFormatter.format(filteredStats.platformRevenue), icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-10 rounded-[2.5rem] hover:bg-white/10 hover:border-white/20 transition-all duration-500 group shadow-2xl relative overflow-hidden backdrop-blur-sm border-l-4 border-l-guepardo-orange">
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-8">
                      <span className="text-sm text-[#A8A29E] font-black uppercase tracking-widest">{stat.label}</span>
                      <div className={cn("p-4 rounded-2xl transition-all duration-500 group-hover:scale-110 shadow-lg", stat.bg, stat.color)}>
                        <stat.icon className="w-8 h-8" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-5xl font-black tracking-tighter text-white">{stat.value}</span>
                      <div className="flex items-center gap-1 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        <span className="text-[10px] text-green-500 font-bold uppercase">Performance Financeira Guepardo</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats Grid - Operational (Row 2) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Pendente de Coleta', value: filteredStats.waitingForPickup.toString(), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { label: 'Entregas em Rota', value: filteredStats.activeDeliveries.toString(), icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Cancelados', value: filteredStats.cancelledOrders.toString(), icon: X, color: 'text-red-400', bg: 'bg-red-500/10' },
                  { label: 'Pedidos Entregues', value: filteredStats.totalDelivered.toString(), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[2rem] hover:bg-white/10 hover:border-white/20 transition-all duration-500 group shadow-2xl relative overflow-hidden backdrop-blur-sm">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-gradient opacity-[0.03] group-hover:opacity-[0.08] rounded-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-xs text-[#A8A29E] font-bold uppercase tracking-widest">{stat.label}</span>
                      <div className={cn("p-3 rounded-2xl transition-all duration-500 group-hover:scale-110 shadow-lg", stat.bg, stat.color)}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-3xl font-black tracking-tighter text-white">{stat.value}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-1 h-1 rounded-full bg-green-500"></div>
                        <span className="text-[10px] text-green-500 font-bold uppercase">Consolidado em Tempo Real</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dual Ranking Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12 mb-12">
                {/* Driver Ranking */}
                <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight italic uppercase">Guepardos em Destaque</h2>
                        <p className="text-[#A8A29E] text-[10px] font-bold uppercase tracking-widest">Performance real dos nossos entregadores.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {allData.drivers
                      .map(driver => {
                        const completed = allData.deliveries.filter(d => 
                          (d.driver_id === driver.id || d.courier_id === driver.id) && 
                          ['delivered', 'completed'].includes(d.status)
                        ).length;
                        
                        let rank = 'Padrão';
                        let color = 'text-[#A8A29E]';
                        let Icon = Bike;
                        let score = '0';
                        let glowClass = '';

                        if (completed > 100) { rank = 'Lenda'; color = 'text-amber-400'; Icon = Trophy; score = '3'; glowClass = 'shadow-[0_0_15px_rgba(251,191,36,0.3)]'; }
                        else if (completed > 50) { rank = 'Expert'; color = 'text-slate-300'; Icon = Medal; score = '2'; glowClass = 'shadow-[0_0_15px_rgba(203,213,225,0.3)]'; }
                        else if (completed > 20) { rank = 'Pro'; color = 'text-orange-400'; Icon = Medal; score = '1'; glowClass = 'shadow-[0_0_15px_rgba(251,146,60,0.3)]'; }

                        return { ...driver, completed, rank, color, Icon, score, glowClass };
                      })
                      .sort((a, b) => b.completed - a.completed)
                      .slice(0, 5)
                      .map((driver, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:bg-black/40 transition-all group relative overflow-hidden">
                           <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg", driver.color, "bg-white/5", driver.glowClass)}>
                              <driver.Icon className="w-6 h-6" />
                           </div>
                           <div className="flex-1">
                              <h4 className="text-sm font-black text-white tracking-tight truncate">{driver.full_name || 'Guepardo'}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <span className={cn("text-[10px] font-black uppercase tracking-widest", driver.color)}>{driver.rank}</span>
                                 <span className="text-[#A8A29E] text-[10px] opacity-30">•</span>
                                 <span className="text-white/80 text-[10px] font-bold">{driver.completed} Entregas</span>
                              </div>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] text-[#A8A29E] font-black uppercase tracking-tighter opacity-50">Score</p>
                             <p className={cn("text-xl font-black leading-none", driver.color)}>{driver.score}</p>
                           </div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                {/* Merchant Ranking */}
                <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[80px] group-hover:bg-orange-500/10 transition-all"></div>
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-orange-500/10 text-guepardo-orange shadow-glow">
                        <Store className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white tracking-tight italic uppercase">Ranking de Lojistas</h2>
                        <p className="text-[#A8A29E] text-[10px] font-bold uppercase tracking-widest">Liderança em volume real de pedidos.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10">
                    {allData.stores
                      .map(store => {
                        const completed = allData.deliveries.filter(d => 
                          d.store_id === store.id && ['delivered', 'completed'].includes(d.status)
                        ).length;
                        
                        let rank = 'Cliente Novo';
                        let color = 'text-[#A8A29E]';
                        let Icon = Store;
                        let score = '0';
                        let glowClass = '';

                        if (completed > 500) { rank = 'Ouro'; color = 'text-amber-400'; Icon = Trophy; score = '3'; glowClass = 'shadow-[0_0_15px_rgba(251,191,36,0.3)]'; }
                        else if (completed > 250) { rank = 'Prata'; color = 'text-slate-300'; Icon = Medal; score = '2'; glowClass = 'shadow-[0_0_15px_rgba(203,213,225,0.3)]'; }
                        else if (completed > 50) { rank = 'Bronze'; color = 'text-orange-400'; Icon = Medal; score = '1'; glowClass = 'shadow-[0_0_15px_rgba(251,146,60,0.3)]'; }
                        else if (completed <= 20) { rank = 'Cliente Novo'; color = 'text-blue-400'; Icon = User; score = '0'; }
                        else { rank = 'Intermediário'; color = 'text-[#A8A29E]'; Icon = Store; score = '0'; }

                        return { ...store, completed, rank, color, Icon, score, glowClass };
                      })
                      .sort((a, b) => b.completed - a.completed)
                      .slice(0, 5)
                      .map((store, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:bg-black/40 transition-all group overflow-hidden">
                           <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg", store.color, "bg-white/5", store.glowClass)}>
                              <store.Icon className="w-6 h-6" />
                           </div>
                           <div className="flex-1">
                              <h4 className="text-sm font-black text-white tracking-tight truncate">{store.fantasy_name || 'Lojista'}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <span className={cn("text-[10px] font-black uppercase tracking-widest", store.color)}>{store.rank}</span>
                                 <span className="text-[#A8A29E] text-[10px] opacity-30">•</span>
                                 <span className="text-white/80 text-[10px] font-bold">{store.completed} Pedidos</span>
                              </div>
                           </div>
                           <div className="text-right">
                             <p className="text-[10px] text-[#A8A29E] font-black uppercase tracking-tighter opacity-50">Score</p>
                             <p className={cn("text-xl font-black leading-none", store.color)}>{store.score}</p>
                           </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>

              <ProductivityMatrix drivers={allData.drivers} merchants={allData.stores} deliveries={allData.deliveries} />
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div className="max-w-7xl mx-auto">
              <DeliveryManagement />
            </div>
          )}

          {activeTab === 'map' && (
            <div className="h-full flex flex-col md:flex-row relative bg-[#0c0a09]">
              {/* Central Map - Control Hub */}
              <div className="flex-1 relative min-h-[400px]">
                <div className="absolute top-8 left-8 z-[5] pointer-events-none">
                  <h1 className="text-3xl font-display italic font-black tracking-tight text-white drop-shadow-2xl flex items-center gap-3">
                    <Activity className="text-guepardo-orange w-8 h-8 animate-pulse" />
                    CENTRAL TÁRTICA
                  </h1>
                  <p className="text-[#A8A29E] font-bold text-[10px] uppercase tracking-[0.3em] mt-1 ml-11">Monitoramento Estratégico em Tempo Real</p>
                </div>

                <RealTimeMap selectedDeliveryId={selectedTrackingId} />

                {/* Overlay Widgets */}
                <div className="absolute bottom-0 left-0 right-0 p-8 z-[5] bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                  <ExceptionsWidget drivers={allData.drivers} deliveries={allData.deliveries} />
                </div>

                {/* Floating BI Export */}
                <button className="absolute bottom-8 right-8 z-10 w-14 h-14 bg-brand-gradient rounded-full shadow-glow-intense flex items-center justify-center text-white hover:scale-110 transition-transform group">
                  <Download className="w-6 h-6 group-hover:animate-bounce" />
                  <div className="absolute right-full mr-4 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                    Exportar Relatório BI
                  </div>
                </button>
              </div>

              {/* Sidebar Tracking */}
              <LiveTrackingSidebar
                deliveries={allData.deliveries}
                onSelectDelivery={(id) => setSelectedTrackingId(id)}
                onChat={(delivery) => setChatDelivery(delivery)}
                selectedId={selectedTrackingId}
              />
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="max-w-7xl mx-auto">
              <DriverManagement />
            </div>
          )}

          {activeTab === 'merchants' && (
            <div className="max-w-7xl mx-auto">
              <MerchantManagement />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="max-w-7xl mx-auto">
              <FinanceManagement />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-7xl mx-auto">
              <SettingsView theme={theme} setTheme={setTheme} />
            </div>
          )}

          {(activeTab !== 'dashboard' && activeTab !== 'map' && activeTab !== 'deliveries' && activeTab !== 'merchants' && activeTab !== 'drivers' && activeTab !== 'settings' && activeTab !== 'analytics') && (
            <div className="flex h-full flex-col items-center justify-center text-center p-12 bg-white/5 rounded-[3rem] border border-white/10 backdrop-blur-lg">
              <div className="relative group mb-10">
                <div className="absolute -inset-4 bg-brand-gradient rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="w-32 h-32 bg-guepardo-brown-dark rounded-full flex items-center justify-center relative border border-white/10 shadow-glow">
                  <Settings className="w-16 h-16 text-guepardo-accent animate-spin-slow" />
                </div>
              </div>
              <h2 className="text-3xl font-black mb-4 tracking-tight">Sistema em Fase de Expansão</h2>
              <p className="text-[#A8A29E] max-w-md font-medium leading-relaxed">O gateway para "{activeTab}" está sendo finalizado por nossa equipe de engenharia para oferecer máxima performance em sua gestão.</p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="mt-10 px-8 py-3 bg-brand-gradient rounded-xl font-bold text-sm shadow-glow hover:scale-105 transition-transform"
              >
                Voltar ao Painel Central
              </button>
            </div>
          )}
        </div>

        {chatDelivery && (
          <ChatMultilateral
            delivery={chatDelivery}
            onClose={() => setChatDelivery(null)}
          />
        )}
      </main >

      <style>{`
@keyframes spin - slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
}
@keyframes pulse - glow {
  0 %, 100 % { box- shadow: 0 0 20px rgba(255, 107, 0, 0.4), 0 0 10px rgba(255, 107, 0, 0.2); transform: scale(1);
}
50 % { box- shadow: 0 0 35px rgba(255, 107, 0, 0.7), 0 0 20px rgba(255, 107, 0, 0.4); transform: scale(1.05); }
        }
        .animate - spin - slow {
  animation: spin - slow 12s linear infinite;
}
        .animate - pulse - glow {
  animation: pulse - glow 2s ease -in -out infinite;
}
        .leaflet - container {
  background: #0c0a09!important;
}
        .custom - leaflet - icon {
  background: transparent!important;
  border: none!important;
}
        .custom - scrollbar:: -webkit - scrollbar {
  width: 8px;
  height: 8px;
}
        .custom - scrollbar:: -webkit - scrollbar - track {
  background: rgba(255, 255, 255, 0.05);
  border - radius: 4px;
}
        .custom - scrollbar:: -webkit - scrollbar - thumb {
  background: rgba(211, 84, 0, 0.5);
  border - radius: 4px;
}
        .custom - scrollbar:: -webkit - scrollbar - thumb:hover {
  background: rgba(211, 84, 0, 0.8);
}
body.theme - light.custom - scrollbar:: -webkit - scrollbar - track {
  background: rgba(0, 0, 0, 0.05);
}
        .font - display {
  font - family: 'Chakra Petch', sans - serif;
}
`}</style>
    </div >
  );
};

export default App;
