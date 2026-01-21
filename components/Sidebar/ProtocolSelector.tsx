import React, { useState } from 'react';
import { Map, MapPin, Layers, CheckCircle2, ChevronDown, ChevronRight, Car, Truck, AlertTriangle } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

interface ZoneOption {
    id: string;
    label: string;
    category: 'access' | 'intersection' | 'urban_zone' | 'behavior_audit';
    context: string;
}

const DAGANZO_OPTIONS: ZoneOption[] = [
    // VIAS DE ACCESO
    { id: 'm100', label: 'Carretera M-100 (Acceso A2/Ajalvir)', category: 'access', context: 'Vía rápida interurbana doble sentido. Alta densidad en horas punta. Control de velocidad y adelantamiento prohibido.' },
    { id: 'm113', label: 'Carretera M-113 (Eje Ajalvir-Fresno)', category: 'access', context: 'Eje vertebrador norte-sur. Cruces peligrosos, visibilidad reducida en curvas y paradas de autobús en calzada.' },
    { id: 'm118', label: 'Carretera M-118 (Conexión Alcalá)', category: 'access', context: 'Conexión transversal este-oeste. Rotondas de acceso al municipio y tráfico agrícola ocasional.' },
    { id: 'camino_fresno', label: 'Camino de Fresno', category: 'access', context: 'Vía secundaria de conexión rural. Firme irregular, prioridad ciclista y agrícola.' },

    // INTERSECCIONES
    { id: 'type_rotonda', label: 'Rotondas / Glorietas', category: 'intersection', context: 'Intersección circular. Normas: Prioridad dentro del anillo, uso de intermitente para salir y prohibición de rectificar desde carril interior.' },
    { id: 'type_semaforo', label: 'Cruces Semaforizados', category: 'intersection', context: 'Intersección regulada por luz. Prioridad absoluta del semáforo. Riesgo: Saltarse el ámbar/rojo.' },
    { id: 'type_prioridad', label: 'Cruces con Stop / Ceda', category: 'intersection', context: 'Intersección sin semáforo. Prioridad marcada por señal vertical u horizontal. Riesgo: No detenerse completamente en STOP.' },
    { id: 'type_t_junction', label: 'Intersecciones en T', category: 'intersection', context: 'Incorporación lateral a vía principal. Visibilidad lateral crítica.' },
    { id: 'type_paso_peatones', label: 'Pasos de Peatones', category: 'intersection', context: 'Intersección de flujo peatonal. Prioridad absoluta del peatón. Prohibición de parada sobre el paso.' },
    { id: 'type_merge', label: 'Carriles de Incorporación', category: 'intersection', context: 'Accesos a vías rápidas (M-100/M-113). Control de velocidad de entrada y ceda el paso al tráfico pasante.' },

    // ZONAS MUNICIPIO (BARRIOS / POLÍGONOS / COLEGIOS)
    { id: 'casco_historico', label: 'Casco Histórico', category: 'urban_zone', context: 'Calles estrechas, aceras reducidas. Prioridad peatonal absoluta. Zonas de carga y descarga limitadas.' },
    { id: 'pol_los_frailes', label: 'Polígono Los Frailes', category: 'urban_zone', context: 'Área industrial mixta. Estacionamiento en doble fila y maniobras de vehículos pesados.' },
    { id: 'pol_el_globo', label: 'Polígono El Globo', category: 'urban_zone', context: 'Zona industrial perimetral. Accesos directos a carreteras secundarias.' },
    { id: 'pol_camino_ancho', label: 'Polígono Camino Ancho', category: 'urban_zone', context: 'Pequeña zona industrial integrada. Tráfico de furgonetas y distribución.' },
    { id: 'residencial_mirador', label: 'Residencial Mirador / Villa Daganzo', category: 'urban_zone', context: 'Nuevos desarrollos. Calles anchas residenciales, prioridad niños/familias. Control velocidad 30.' },

    // CENTROS EDUCATIVOS (PUNTOS CRÍTICOS)
    { id: 'colegio_angel_berzal', label: 'CEIP Ángel Berzal Fernández', category: 'urban_zone', context: 'ENTORNO ESCOLAR. Prohibición total de estacionamiento en doble fila. Cruces escolares vigilados.' },
    { id: 'colegio_salvador', label: 'CEIP Salvador de Madariaga', category: 'urban_zone', context: 'ENTORNO ESCOLAR. Zona de "Kiss & Ride". Riesgo de atropello en horas de entrada/salida.' },
    { id: 'ies_lazaro', label: 'SIES Lázaro Carreter', category: 'urban_zone', context: 'Instituto. Tráfico peatonal adolescente. Pasos de cebra elevados.' },
    { id: 'casa_ninos', label: 'Casa de Niños (Hnos. Álvarez Quintero)', category: 'urban_zone', context: 'Escuela infantil. Tráfico lento y paradas frecuentes.' },

    // ANÁLISIS DE COMPORTAMIENTO (GEOMETRÍA ESTRICTA)
    { id: 'inf_linea_continua', label: 'Cruce Línea Continua', category: 'behavior_audit', context: 'Invasión física de carril contrario o carril bus.' },
    { id: 'inf_giro_indebido', label: 'Giro Prohibido 2ª > Principal', category: 'behavior_audit', context: 'Giro prohibido desde vía secundaria (Stop/Ceda) hacia vía principal. Bloquear trayectorias Izquierda/Derecha según señalización.' },
    { id: 'inf_sentido_contrario', label: 'Sentido Contrario', category: 'behavior_audit', context: 'Vector de movimiento opuesto al flujo de la vía.' },
    { id: 'inf_invas_zona', label: 'Invasión Arcén / Isleta', category: 'behavior_audit', context: 'Circulación sobre zonas de exclusión geométrica.' },
    { id: 'inf_invas_peatonal', label: 'Invasión Paso Peatones', category: 'behavior_audit', context: 'Vehículo ocupando zona geométrica de paso cebra.' },
    { id: 'inf_estacionamiento', label: 'Estacionamiento Prohibido', category: 'behavior_audit', context: 'Objeto estático dentro de una zona de exclusión (Doble fila).' }
];

const CATEGORIES = [
    { id: 'access', label: 'Vías de Acceso', icon: MapPin },
    { id: 'intersection', label: 'Tipos de Intersección', icon: AlertTriangle },
    { id: 'urban_zone', label: 'Barrios y Zonas', icon: Map },
    { id: 'behavior_audit', label: 'Auditoría de Infracciones', icon: CheckCircle2 },
];

export const ProtocolSelector = () => {
    const { generateGeometry, setDirectives } = useSentinel();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [openCategories, setOpenCategories] = useState<string[]>(['access']); // Default open
    const [isGenerating, setIsGenerating] = useState(false);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleCategory = (catId: string) => {
        setOpenCategories(prev =>
            prev.includes(catId) ? prev.filter(x => x !== catId) : [...prev, catId]
        );
    };

    const applyProtocols = async () => {
        if (selectedIds.length === 0) return;
        setIsGenerating(true);

        const activeOptions = DAGANZO_OPTIONS.filter(o => selectedIds.includes(o.id));
        const contextSummary = activeOptions.map(o => `- [${o.category.toUpperCase()}] ${o.label}: ${o.context}`).join('\n');

        const fullPrompt = `ANÁLISIS TÁCTICO INTEGRAL - DAGANZO DE ARRIBA (MADRID):
        
        CONTEXTO MUNICIPAL SELECCIONADO:
        ${contextSummary}
        
        MISIÓN DE FUSIÓN DE DATOS (IMPORTANTE):
        1. ANALIZA LA IMAGEN/VIDEO ACTUAL (Análisis Espacial en Tiempo Real). Detecta la geometría visual de la vía (carriles, bordillos, señales visibles).
        2. COMPLEMENTA ese análisis visual con las REGLAS DEL CONTEXTO MUNICIPAL seleccionado arriba.
           - EJEMPLO: Si ves una calle estrecha y el usuario seleccionó "Casco Histórico", ASUME prioridad peatonal y crea líneas de restricción en bordes.
           - EJEMPLO: Si ves una vía ancha y se seleccionó "Polígono Los Frailes", PREPARA líneas para detectar giros de camiones.
           - EJEMPLO: Si detectas un paso de cebra y se seleccionó "Entorno Escolar", crea líneas de STOP estrictas antes del paso.
        
        OBJETIVO GEOMÉTRICO:
        Genera un JSON con líneas de detección (Horizontales, Verticales, Oblicuas) que representen la intersección lógica entre LO QUE VES y LO QUE SABES del municipio.
        `;

        const displayDirectives = `PROTOCOLO ACTIVO DAGANZO:\n${activeOptions.map(o => `- ${o.label}`).join('\n')}`;
        setDirectives(displayDirectives);

        await generateGeometry(fullPrompt);
        setIsGenerating(false);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <Map size={14} className="text-cyan-500" /> Selector Avanzado
                </h3>
                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                            {selectedIds.length} ACTIVOS
                        </span>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-[9px] text-slate-500 hover:text-white transition-colors uppercase"
                        >
                            Limpiar
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                {CATEGORIES.map(cat => (
                    <div key={cat.id} className="border-b border-white/5 last:border-0 pb-1">
                        <button
                            onClick={() => toggleCategory(cat.id)}
                            className="w-full flex items-center justify-between p-2 text-left hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <span className="text-[10px] font-black uppercase text-slate-300 flex items-center gap-2">
                                <cat.icon size={12} className="text-cyan-500" />
                                {cat.label}
                                {DAGANZO_OPTIONS.some(o => o.category === cat.id && selectedIds.includes(o.id)) && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse ml-2" />
                                )}
                            </span>
                            {openCategories.includes(cat.id) ? (
                                <ChevronDown size={12} className="text-slate-500" />
                            ) : (
                                <ChevronRight size={12} className="text-slate-500" />
                            )}
                        </button>

                        {openCategories.includes(cat.id) && (
                            <div className="pl-4 pr-1 py-1 space-y-1">
                                {DAGANZO_OPTIONS.filter(opt => opt.category === cat.id).map(opt => {
                                    const isSelected = selectedIds.includes(opt.id);
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => toggleSelection(opt.id)}
                                            className={`w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2 ${isSelected
                                                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-100'
                                                : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'
                                                }`}
                                        >
                                            <div className={`mt-0.5 w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-slate-600'
                                                }`}>
                                                {isSelected && <CheckCircle2 size={10} className="text-black" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold uppercase leading-none">{opt.label}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={applyProtocols}
                disabled={selectedIds.length === 0 || isGenerating}
                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${selectedIds.length > 0 && !isGenerating
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/25 hover:bg-cyan-400 active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                    }`}
            >
                {isGenerating ? (
                    <>
                        <Layers size={14} className="animate-spin" /> Procesando Vector...
                    </>
                ) : (
                    <>
                        <Layers size={14} /> Aplicar Configuración
                    </>
                )}
            </button>
        </div>
    );
};
