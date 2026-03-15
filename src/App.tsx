import { useState, useEffect, useCallback } from 'react';
import {
  Download, Activity, LayoutDashboard, Map as MapIcon,
  Settings, LogOut, TrendingUp, Package, Bike, Store, DollarSign, Clock, X
} from 'lucide-react';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import RealTimeMap from './components/RealTimeMap';
import type { Stats } from './types';
import LiveTrackingSidebar from './components/Dashboard/LiveTrackingSidebar';
import ProductivityMatrix from './components/Dashboard/ProductivityMatrix';
import ExceptionsWidget from './components/Dashboard/ExceptionsWidget';
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
  const [stats, setStats] = useState<Stats>({
    activeDeliveries: 0,
    onlineDrivers: 0,
    activeMerchants: 0,
    registeredMerchants: 0,
    openMerchants: 0,
    closedMerchants: 0,
    todayRevenue: 0,
    totalDelivered: 0,
    totalRevenue: 0,
    platformRevenue: 0,
    waitingForPickup: 0,
    cancelledOrders: 0
  });
  const [selectedTrackingId, setSelectedTrackingId] = useState<string | null>(null);
  const [chatDelivery, setChatDelivery] = useState<Delivery | null>(null);
  const [allData, setAllData] = useState<{
    drivers: any[];
    stores: any[];
    deliveries: any[];
  }>({ drivers: [], stores: [], deliveries: [] });

  const fetchStats = useCallback(async () => {
    try {
      const { count: deliveriesCount, error: err1 } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .in('status', ['accepted', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery', 'picked_up']);
      if (err1) console.error('Error fetching deliveries:', err1);

      const { count: driversCount, error: err2 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      if (err2) console.error('Error fetching drivers:', err2);

      const { data: stores, error: err3 } = await supabase
        .from('stores')
        .select('*');
      if (err3) console.error('Error fetching stores:', err3);

      const registeredMerchantsCount = stores ? stores.length : 0;
      const openMerchantsCount = stores ? stores.filter(s => s.status === 'open' || !s.status).length : 0;
      const closedMerchantsCount = stores ? stores.filter(s => s.status === 'closed' || s.status === 'paused').length : 0;


      const { data: allDeliveries } = await supabase
        .from('deliveries')
        .select('status, earnings, created_at, delivery_distance');

      const deliveredOrders = allDeliveries?.filter(d => d.status === 'delivered' || d.status === 'completed') || [];

      const deliveriesWithFees = deliveredOrders.map(d => {
        const totalMerchant = 8.00 + ((d.delivery_distance || 0) * 1.32);
        const platformFee = totalMerchant - (d.earnings || 0);
        return { ...d, totalMerchant, platformFee };
      });

      const totalRevenue = deliveriesWithFees.reduce((acc, curr) => acc + curr.totalMerchant, 0);
      const platformRevenue = deliveriesWithFees.reduce((acc, curr) => acc + curr.platformFee, 0);

      const waitingForPickupCount = allDeliveries?.filter(d =>
        ['pending', 'accepted', 'arrived_at_pickup'].includes(d.status)
      ).length || 0;

      const cancelledOrdersCount = allDeliveries?.filter(d =>
        ['canceled', 'cancelled'].includes(d.status)
      ).length || 0;

      // Calculate today's revenue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = deliveriesWithFees.filter(d => new Date(d.created_at) >= today);
      const todayRevenue = todayOrders.reduce((acc, curr) => acc + curr.totalMerchant, 0);

      const { data: driversData } = await supabase.from('profiles').select('*');
      const { data: storesData } = await supabase.from('stores').select('*');
      const { data: deliveriesData } = await supabase.from('deliveries').select('*');

      const enrichedDeliveries = (deliveriesData || []).map(d => {
        const driver = driversData?.find(p => p.id === (d.driver_id || d.courier_id));
        return {
          ...d,
          driver_name: d.driver_name || driver?.full_name || 'Guepardo',
          driver_photo: d.driver_photo || driver?.avatar_url,
          displayId: d.items?.displayId?.toString() || d.id.slice(-6).toUpperCase()
        };
      });

      setAllData({
        drivers: driversData || [],
        stores: storesData || [],
        deliveries: enrichedDeliveries
      });

      setStats({
        activeDeliveries: deliveriesCount || 0,
        onlineDrivers: driversCount || 0,
        activeMerchants: openMerchantsCount || 0,
        registeredMerchants: registeredMerchantsCount || 0,
        openMerchants: openMerchantsCount || 0,
        closedMerchants: closedMerchantsCount || 0,
        todayRevenue: todayRevenue,
        totalDelivered: deliveredOrders.length,
        totalRevenue: totalRevenue,
        platformRevenue: platformRevenue,
        waitingForPickup: waitingForPickupCount,
        cancelledOrders: cancelledOrdersCount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

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
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 group cursor-pointer hidden md:flex">
            <img
              src="/cheetah-scooter.png"
              alt="Guepardo"
              className="h-12 w-auto object-contain transform group-hover:scale-110 transition-transform duration-300 drop-shadow-md"
            />
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-left duration-300">
              <span className="text-white font-black italic text-2xl leading-none tracking-tighter shadow-sm">GUEPARDO</span>
              <span className="text-[#FF6B00] font-bold text-[10px] leading-none tracking-[0.3em] mt-1 shadow-sm">DELIVERY</span>
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
              <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-display italic font-black tracking-tight text-white drop-shadow-2xl">Dashboard Guepardo Central</h1>
                <p className="text-[#A8A29E] font-medium uppercase text-xs tracking-widest">Controle e monitoramento de performance global.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                  { label: 'Aguardando coleta', value: stats.waitingForPickup.toString(), icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  { label: 'Entregas em Rota', value: stats.activeDeliveries.toString(), icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Pedidos Entregues', value: stats.totalDelivered.toString(), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Cancelados', value: stats.cancelledOrders.toString(), icon: X, color: 'text-red-400', bg: 'bg-red-500/10' },
                  { label: 'Volume Lojistas', value: `R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} `, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Repasse Central', value: `R$ ${stats.platformRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} `, icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-500/10' },
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
                        <span className="text-[10px] text-green-500 font-bold uppercase">Taxa de Eficiência 98%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Productivity Matrix in Dashboard */}
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

          {(activeTab !== 'dashboard' && activeTab !== 'map' && activeTab !== 'deliveries' && activeTab !== 'merchants' && activeTab !== 'drivers' && activeTab !== 'settings') && (
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
