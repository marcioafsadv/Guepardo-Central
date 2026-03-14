import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { Bike, Package, Plus, Minus, Target, Layers, Sun, Moon, HelpCircle, X, Search, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Profile, Delivery, Store as StoreType } from '../types';
import { cn } from '../lib/utils';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons using Lucide
const createCustomIcon = (IconComponent: LucideIcon, color: string, pulseClass?: string) => {
    const html = renderToStaticMarkup(
        <div style={{ color }} className={cn(
            "bg-white p-1.5 rounded-full border-2 border-current shadow-lg flex items-center justify-center transition-all duration-500",
            pulseClass
        )}>
            <IconComponent size={20} strokeWidth={3} />
        </div>
    );
    return L.divIcon({
        html,
        className: 'custom-leaflet-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18], // Center it for pulse effect
    });
};

const driverIcon = (status: string, lastUpdate?: string) => {
    let color = '#3b82f6'; // Blue (Available)
    let pulse = 'pulse-blue';

    if (status === 'in_transit' || status === 'active') {
        color = '#10b981'; // Green (In Delivery)
        pulse = 'pulse-green';
    } else if (status === 'arrived_at_pickup' || status === 'pending') {
        color = '#f59e0b'; // Yellow (Waiting)
        pulse = 'pulse-amber';
    }

    // Check for "Vanished" status (> 5 min)
    if (lastUpdate) {
        const diff = (new Date().getTime() - new Date(lastUpdate).getTime()) / 60000;
        if (diff > 5) {
            color = '#ef4444'; // Red (Vanished)
            pulse = 'pulse-red';
        }
    }

    return createCustomIcon(Bike, color, pulse);
};

const deliveryIcon = createCustomIcon(Package, '#06b6d4'); // Cyan for distinction
const storeIcon = createCustomIcon(Store, '#ef4444', 'pulse-red'); // Red pulse for stores
const savanaIcon = createCustomIcon(Target, '#ea580c', 'pulse-orange'); // Orange pulse for base

const SAVANA_COORDS: [number, number] = [-23.2741476, -47.2876003];

interface RealTimeMapProps {
    selectedDeliveryId?: string | null;
}

const RealTimeMap: React.FC<RealTimeMapProps> = ({ selectedDeliveryId }) => {
    const [drivers, setDrivers] = useState<Profile[]>([]);
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [stores, setStores] = useState<StoreType[]>([]);
    const [routes, setRoutes] = useState<Record<string, [number, number][]>>({});
    const [center] = useState<[number, number]>(SAVANA_COORDS); // Sempre inicia na Savana do Guepardo
    const [trackingPoints, setTrackingPoints] = useState<[number, number][]>([]);
    const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Sempre inicia no modo dia, independente do tema principal
    const [mapMode, setMapMode] = useState<'streets' | 'satellite'>('streets');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const formatAddress = (address: any) => {
        if (!address) return 'Endereço não informado';
        if (typeof address === 'string') return address;

        try {
            const parts = [];
            if (address.street) parts.push(address.street);
            if (address.number) parts.push(address.number);
            if (address.complement) parts.push(address.complement);
            if (address.district) parts.push(address.district);
            if (address.city) parts.push(address.city);
            if (address.state) parts.push(address.state);

            return parts.length > 0 ? parts.join(', ') : 'Endereço formatado indisponível';
        } catch (e) {
            return 'Erro ao formatar endereço';
        }
    };

    // Derived state for search results
    const searchResults = drivers.filter(d =>
        searchQuery.trim().length > 0 &&
        d.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5); // Limit to 5 results

    useEffect(() => {
        // Initial setup only
    }, []);

    useEffect(() => {
        if (!selectedDeliveryId) {
            setTrackingPoints([]);
            return;
        }

        const fetchTrackingPoints = async () => {
            const { data, error } = await supabase
                .from('delivery_tracking')
                .select('*')
                .eq('delivery_id', selectedDeliveryId)
                .order('created_at', { ascending: true });

            if (!error && data) {
                const points = data.map(p => [p.latitude, p.longitude] as [number, number]);
                setTrackingPoints(points);

                if (points.length > 0 && mapInstance) {
                    mapInstance.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
                }
            }
        };

        fetchTrackingPoints();

        const channel = supabase
            .channel(`tracking - ${selectedDeliveryId} `)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'delivery_tracking',
                filter: `delivery_id=eq.${selectedDeliveryId}`
            }, (payload) => {
                const newPoint: [number, number] = [payload.new.latitude, payload.new.longitude];
                setTrackingPoints(prev => [...prev, newPoint]);
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedDeliveryId, mapInstance]);

    // 3. Auto-center on selected delivery/driver
    useEffect(() => {
        if (!selectedDeliveryId || !mapInstance || deliveries.length === 0) return;

        const delivery = deliveries.find(d => d.id === selectedDeliveryId);
        if (delivery) {
            const driverId = (delivery as any).driver_id || (delivery as any).courier_id;
            const driver = drivers.find(p => p.id === driverId);
            
            // Priority: Driver location -> Delivery location
            const targetLat = driver?.current_lat || driver?.latitude || delivery.latitude;
            const targetLng = driver?.current_lng || driver?.longitude || delivery.longitude;

            if (targetLat && targetLng) {
                mapInstance.flyTo([targetLat, targetLng], 15, { duration: 1.5 });
            }
        }
    }, [selectedDeliveryId, mapInstance, deliveries, drivers]);

    useEffect(() => {
        fetchMarkers();

        const driverSub = supabase
            .channel('drivers-location')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchMarkers();
            })
            .subscribe();

        const deliverySub = supabase
            .channel('deliveries-tracking')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
                fetchMarkers();
            })
            .subscribe();

        const storeSub = supabase
            .channel('stores-map')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
                fetchMarkers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(driverSub);
            supabase.removeChannel(deliverySub);
            supabase.removeChannel(storeSub);
        };
    }, []);

    const fetchMarkers = async () => {
        try {
            // Fetch Online Drivers
            const { data: driversData } = await supabase
                .from('profiles')
                .select('*');

            // Fetch Active Deliveries
            const { data: deliveriesData } = await supabase
                .from('deliveries')
                .select('*')
                .in('status', ['pending', 'accepted', 'in_transit', 'arrived_at_pickup', 'arrived_at_delivery', 'picked_up']);

            const { data: storesData } = await supabase
                .from('stores')
                .select('*');

            setDrivers(driversData || []);
            setDeliveries(deliveriesData || []);
            setStores(storesData || []);

            // Calculate routes for in_transit deliveries
            const newRoutes: Record<string, [number, number][]> = {};
            for (const delivery of deliveriesData || []) {
                const driverId = (delivery as any).driver_id || (delivery as any).courier_id;
                const driver = (driversData || []).find(d => d.id === driverId);
                if (driver && (driver.current_lat || driver.latitude) && (driver.current_lng || driver.longitude) && delivery.latitude && delivery.longitude) {
                    try {
                        const start = [driver.current_lat || driver.latitude, driver.current_lng || driver.longitude];
                        const end = [delivery.latitude, delivery.longitude];
                        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&access_token=${MAPBOX_TOKEN}`;

                        const response = await fetch(url);
                        const data = await response.json();

                        if (data.routes && data.routes.length > 0) {
                            newRoutes[delivery.id] = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
                        }
                    } catch (e) {
                        console.error("Mapbox Routing Error:", e);
                    }
                }
            }
            setRoutes(newRoutes);

        } catch (err) {
            console.error('Error fetching markers:', err);
        }
    };

    const getTileUrl = () => {
        if (mapMode === 'satellite') return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;

        return theme === 'light'
            ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`
            : `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
    };

    const tileUrl = getTileUrl();

    // Handlers para controles de mapa
    const handleZoomIn = () => mapInstance?.zoomIn();
    const handleZoomOut = () => mapInstance?.zoomOut();
    const handleRecenter = () => {
        const currentZoom = mapInstance?.getZoom() || 15;
        mapInstance?.flyTo(SAVANA_COORDS, currentZoom);
    };
    const handleToggleLayers = () => setMapMode(m => m === 'streets' ? 'satellite' : 'streets');
    const handleToggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    const handleSelectDriver = (driver: Profile) => {
        const lat = (driver as any).current_lat || driver.latitude;
        const lng = (driver as any).current_lng || driver.longitude;
        if (lat && lng) {
            mapInstance?.flyTo([lat, lng], 16);
            setSearchQuery('');
            setIsSearchFocused(false);
        }
    };

    return (
        <div className={`h-full w-full overflow-hidden relative shadow-2xl ${theme === 'light' ? 'bg-[#f1f5f9]' : 'bg-[#0c0a09]'}`}>
            <MapContainer
                center={center}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false} // Desabilita o controle de zoom nativo
                ref={setMapInstance}
            >
                <TileLayer
                    attribution='© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url={tileUrl}
                />

                {/* Ponto Base Fixa: Savana do Guepardo */}
                <Marker
                    position={SAVANA_COORDS}
                    icon={savanaIcon}
                >
                    <Popup>
                        <div className="p-1">
                            <p className="font-extrabold text-[#1c1917] text-base">Savana do Guepardo</p>
                            <p className="text-xs text-gray-500 mt-1 italic font-bold">Base de Operações Central</p>
                            <p className="text-xs text-gray-500">Av. José Augusto Pickardt, 95</p>
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest">Monitoramento Ativo</p>
                            </div>
                        </div>
                    </Popup>
                </Marker>

                {/* Store Markers (Red) */}
                {stores.map((store) => (
                    store.lat && store.lng && (
                        <Marker
                            key={store.id}
                            position={[store.lat, store.lng]}
                            icon={storeIcon}
                        >
                            <Popup>
                                <div className="p-1">
                                    <p className="font-bold text-[#1c1917] text-sm">{store.fantasy_name || store.company_name || 'Lojista sem nome'}</p>
                                    <p className="text-xs text-gray-500 mt-1">{formatAddress(store.address)}</p>
                                    <p className={cn(
                                        "text-[10px] font-black mt-2 uppercase tracking-wide",
                                        store.status === 'open' ? "text-green-500" : "text-red-500"
                                    )}>
                                        {store.status === 'open' ? 'Loja Aberta' : 'Loja Fechada'}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}

                {/* Render Routes */}
                {Object.entries(routes).map(([deliveryId, path]) => (
                    <Polyline
                        key={deliveryId}
                        positions={path}
                        color={theme === 'light' ? '#FF6B00' : '#E67E22'}
                        weight={4}
                        opacity={0.8}
                        dashArray="5, 10"
                    />
                ))}

                {drivers.filter(d => (d.role === 'courier' || (d as any).vehicle_type)).map((driver: Profile) => {
                    const lat = (driver as any).current_lat || driver.latitude;
                    const lng = (driver as any).current_lng || driver.longitude;
                    return lat && lng && (
                        <Marker
                            key={driver.id}
                            position={[lat, lng]}
                            icon={driverIcon(driver.status || 'available', driver.last_location_update)}
                        >
                            <Popup>
                                <div className="p-2 min-w-[180px]">
                                    <div className="flex items-center gap-3 mb-3 border-b border-gray-100 pb-2">
                                        <div className="w-10 h-10 rounded-full bg-guepardo-orange/10 flex items-center justify-center overflow-hidden border border-guepardo-orange/20">
                                            {driver.avatar_url ? (
                                                <img src={driver.avatar_url} className="w-full h-full object-cover" />
                                            ) : <Bike size={18} className="text-guepardo-orange" />}
                                        </div>
                                        <div>
                                            <p className="font-black text-sm text-[#1c1917] leading-none mb-1 uppercase tracking-tight">{driver.full_name || 'Guepardo'}</p>
                                            <div className="flex items-center gap-1">
                                                <div className={cn("w-1.5 h-1.5 rounded-full",
                                                    driver.status === 'in_transit' ? "bg-emerald-500" : "bg-amber-500"
                                                )}></div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                                                    {driver.status?.replace(/_/g, ' ') || 'Disponível'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-400 font-bold uppercase tracking-tighter">Último Sinal:</span>
                                            <span className="text-gray-900 font-black">
                                                {driver.last_location_update ? new Date(driver.last_location_update).toLocaleTimeString() : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-gray-400 font-bold uppercase tracking-tighter">Rating:</span>
                                            <span className="text-emerald-500 font-black">4.9 ★</span>
                                        </div>
                                        <button className="w-full mt-2 py-1.5 bg-guepardo-orange/10 text-guepardo-orange rounded-lg text-[10px] font-black uppercase hover:bg-guepardo-orange text-white transition-all">
                                            Abrir Percurso
                                        </button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {deliveries.map((delivery: Delivery) => (
                    delivery.latitude && delivery.longitude && (
                        <Marker
                            key={delivery.id}
                            position={[delivery.latitude, delivery.longitude]}
                            icon={deliveryIcon}
                        >
                            <Popup>
                                <div className="p-1">
                                    <p className="font-bold text-[#1c1917]">Pedido #{delivery.id.slice(0, 8)}</p>
                                    <p className="text-xs text-gray-500">Para: {delivery.customer_name}</p>
                                    <p className="text-xs font-semibold text-blue-600 capitalize">{delivery.status}</p>
                                </div>
                            </Popup>
                        </Marker>
                    )
                ))}
            </MapContainer>

            {/* Buscador de Guepardos */}
            <div className="absolute top-4 right-4 z-[1000] w-64 md:w-80 pointer-events-auto">
                <div className={`relative flex items-center rounded-xl shadow-lg border transition-all ${theme === 'light' ? 'bg-gray-900/90 border-gray-700 text-white focus-within:border-orange-500/50' : 'bg-white/95 border-gray-200 text-gray-900 focus-within:border-orange-500/50'}`}>
                    <Search size={16} className={`absolute left-3 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
                    <input
                        type="text"
                        placeholder="Buscar guepardo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                        className="w-full bg-transparent border-none py-2.5 pl-9 pr-8 text-sm focus:ring-0 outline-none placeholder:text-gray-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className={`absolute right-2 p-1 rounded-md hover:bg-black/10 transition-colors ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Dropdown de Resultados */}
                {isSearchFocused && searchQuery.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-xl ${theme === 'light' ? 'bg-gray-900/95 border-gray-700 text-white' : 'bg-white/95 border-gray-200 text-gray-900'}`}>
                        {searchResults.length > 0 ? (
                            <div className="py-1">
                                {searchResults.map(driver => (
                                    <button
                                        key={driver.id}
                                        onClick={() => handleSelectDriver(driver)}
                                        className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${theme === 'light' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <Bike size={14} className="text-green-500" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm leading-tight">{driver.full_name}</p>
                                                <p className={`text-[10px] mt-0.5 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>{driver.status}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className={`p-4 text-center text-sm ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                                Nenhum guepardo encontrado
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-6 right-6 bg-[#1c1917ea] backdrop-blur-md p-4 rounded-xl border border-[#292524] z-[1000] space-y-2 pointer-events-none">
                <h4 className="text-xs font-bold text-[#a8a29e] uppercase tracking-wider mb-2">Legenda</h4>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                    <span className="text-xs text-white font-medium">Entregadores (Azul)</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                    <span className="text-xs text-white font-medium">Entregas Ativas</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                    <span className="text-xs text-white font-medium">Lojistas (Vermelho)</span>
                </div>
                {selectedDeliveryId && (
                    <div className="flex items-center gap-3 pt-1 border-t border-white/10 mt-1">
                        <div className="w-6 h-1 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(255,107,0,0.5)]"></div>
                        <span className="text-xs text-orange-400 font-black uppercase tracking-tighter">Percurso do Courier</span>
                    </div>
                )}
            </div>

            {/* Controles Laterais Customizados */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2 pointer-events-auto">
                {/* Zoom */}
                <div className="glass-panel rounded-xl overflow-hidden shadow-2xl flex flex-col">
                    <button onClick={handleZoomIn} className="map-control-button border-b border-white/10" title="Aumentar Zoom">
                        <Plus size={20} />
                    </button>
                    <button onClick={handleZoomOut} className="map-control-button" title="Diminuir Zoom">
                        <Minus size={20} />
                    </button>
                </div>

                {/* Centralizar */}
                <div className="glass-panel rounded-xl overflow-hidden shadow-2xl flex flex-col gap-1">
                    <button onClick={handleRecenter} className="map-control-button" title="Centralizar Savana">
                        <Target size={20} className="text-[#D35400]" />
                    </button>
                    {selectedDeliveryId && trackingPoints.length > 0 && (
                        <button
                            onClick={() => mapInstance?.fitBounds(L.latLngBounds(trackingPoints))}
                            className="map-control-button bg-orange-500/20 text-orange-500"
                            title="Focar no Entregador"
                        >
                            <Bike size={20} />
                        </button>
                    )}
                </div>

                {/* Switchers (Camadas/Tema) */}
                <div className="glass-panel rounded-xl overflow-hidden shadow-2xl flex flex-col">
                    <button onClick={handleToggleLayers} className={`map-control-button border-b border-white/10 ${mapMode === 'satellite' ? 'text-blue-400' : ''}`} title="Alternar entre Satélite e Ruas">
                        <Layers size={18} />
                    </button>
                    <button onClick={handleToggleTheme} className="map-control-button" title={theme === 'dark' ? "Ativar Modo Claro" : "Ativar Modo Escuro"}>
                        {theme === 'dark' ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-blue-500" />}
                    </button>
                </div>

                {/* Ajuda */}
                <div className="glass-panel rounded-xl overflow-hidden shadow-2xl">
                    <button onClick={() => setIsHelpOpen(!isHelpOpen)} className={`map-control-button ${isHelpOpen ? 'text-purple-400' : ''}`} title="Ajuda">
                        <HelpCircle size={18} />
                    </button>
                </div>
            </div>

            {/* Painel de Ajuda */}
            {isHelpOpen && (
                <div className={`absolute right-20 top-1/2 -translate-y-[55%] z-[1000] w-72 rounded-2xl border shadow-2xl backdrop-blur-xl p-4 transition-all ${theme === 'dark' ? 'bg-gray-900/95 border-gray-700 text-white' : 'bg-white/95 border-gray-200 text-gray-900'}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <HelpCircle size={14} className="text-purple-400" />
                            </div>
                            <span className="font-bold text-sm">Ajuda — Controles do Mapa</span>
                        </div>
                        <button onClick={() => setIsHelpOpen(false)} className={`p-1 rounded-lg hover:bg-black/10 transition-colors ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            <X size={14} />
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        {[
                            { icon: Plus, label: '+ / −', desc: 'Aumentar e diminuir o zoom do mapa' },
                            { icon: Target, label: 'Centralizar', desc: 'Volta o mapa para a visão normal' },
                            { icon: Layers, label: 'Camadas', desc: 'Alterna entre mapa de ruas e satélite' },
                            { icon: Sun, label: 'Tema', desc: 'Alterna entre o modo dia (claro) e noite (escuro)' }
                        ].map(({ icon: Icon, label, desc }) => (
                            <div key={label} className={`flex items-start gap-3 p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800/60 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                    <Icon size={13} className="text-orange-500" />
                                </div>
                                <div>
                                    <p className="font-bold text-xs">{label}</p>
                                    <p className={`text-[11px] leading-tight mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RealTimeMap;
