import React, { useRef } from 'react';
import { Save, Download, Upload } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useLayoutStore } from '../../stores/layoutStore';
import { useHelp } from '../../hooks/useHelp';

/**
 * ConfigManager Component.
 * Allows users to export and import the full system configuration,
 * including directives and geometry (ROIs), as a local JSON file.
 */
export const ConfigManager = () => {
  const sentinel = useSentinel();
  const layout = useLayoutStore();
  const { helpProps } = useHelp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyConfig = (config: any) => {
    try {
      if (config.sentinel) {
        if (config.sentinel.directives !== undefined)
          sentinel.setDirectives(config.sentinel.directives);
        if (config.sentinel.geometry !== undefined) sentinel.setGeometry(config.sentinel.geometry);
        if (config.sentinel.currentPreset !== undefined)
          sentinel.setPreset(config.sentinel.currentPreset);
        if (config.sentinel.isPoseEnabled !== undefined)
          sentinel.setIsPoseEnabled(config.sentinel.isPoseEnabled);
        if (config.sentinel.isAuditEnabled !== undefined)
          sentinel.setIsAuditEnabled(config.sentinel.isAuditEnabled);
        if (config.sentinel.currentAuditPreset !== undefined)
          sentinel.setAuditPreset(config.sentinel.currentAuditPreset);
        if (config.sentinel.currentKinematicPreset !== undefined)
          sentinel.setKinematicPreset(config.sentinel.currentKinematicPreset);
        if (config.sentinel.calibration !== undefined)
          sentinel.setCalibration(config.sentinel.calibration);
        if (config.sentinel.analysisGridSize !== undefined)
          sentinel.setAnalysisGridSize(config.sentinel.analysisGridSize);
        if (config.sentinel.selectedProtocolIds !== undefined)
          sentinel.setSelectedProtocolIds(config.sentinel.selectedProtocolIds);
      }

      if (config.layout) {
        if (config.layout.gridSize !== undefined) layout.setGridSize(config.layout.gridSize);
        if (config.layout.showDetections !== undefined)
          layout.setShowDetections(config.layout.showDetections);
        if (config.layout.showROIs !== undefined) layout.setShowROIs(config.layout.showROIs);
        if (config.layout.isSidebarCollapsed !== undefined)
          layout.setIsSidebarCollapsed(config.layout.isSidebarCollapsed);
      }

      sentinel.addLog('SUCCESS', 'Configuración cargada y sincronizada correctamente.');
    } catch (err) {
      console.error('Error applying config:', err);
      sentinel.addLog('ERROR', 'Error al aplicar la configuración.');
    }
  };

  const handleSave = async () => {
    const config = {
      version: '1.6',
      timestamp: new Date().toISOString(),
      sentinel: {
        directives: sentinel.directives,
        geometry: sentinel.geometry,
        currentPreset: sentinel.currentPreset,
        isPoseEnabled: sentinel.isPoseEnabled,
        isAuditEnabled: sentinel.isAuditEnabled,
        currentAuditPreset: sentinel.currentAuditPreset,
        currentKinematicPreset: sentinel.currentKinematicPreset,
        calibration: sentinel.calibration,
        analysisGridSize: sentinel.analysisGridSize,
        selectedProtocolIds: sentinel.selectedProtocolIds,
      },
      layout: {
        gridSize: layout.gridSize,
        showDetections: layout.showDetections,
        showROIs: layout.showROIs,
        isSidebarCollapsed: layout.isSidebarCollapsed,
      },
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel_config_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    sentinel.addLog('SUCCESS', 'Configuración exportada localmente.');
  };

  const handleLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const config = JSON.parse(content);
        applyConfig(config);
      } catch (err) {
        console.error('Error loading config:', err);
        sentinel.addLog(
          'ERROR',
          'Error al cargar la configuración: El archivo es inválido o está corrupto.'
        );
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-3">
      <h3
        className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
        {...helpProps(
          'GESTIÓN DE PERFILES: Permite exportar o importar la configuración completa del sistema, incluyendo directivas y zonas ROI.'
        )}
      >
        <Save size={14} className="text-blue-500" /> Preset
      </h3>
      <div className="flex flex-col gap-2">
        <div className="horizon-card rounded-[20px] p-1.5 flex items-center gap-2 relative overflow-hidden">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300 bg-white/[0.02] border border-white/5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30"
            {...helpProps('Cargar archivo JSON desde su ordenador.')}
          >
            <Upload size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Cargar</span>
          </button>

          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all duration-300 bg-white/[0.02] border border-white/5 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 hover:border-blue-500"
            {...helpProps('Guardar la configuración actual en un archivo JSON.')}
          >
            <Download size={18} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Guardar</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleLoad}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};
