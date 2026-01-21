import React, { useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { MainViewer } from './components/MainViewer';
import { SentinelProvider } from './context/SentinelContext';
import { useSentinel } from './hooks/useSentinel';
import { logger } from './services/logger';

const TacticalOverlay = React.lazy(() => import('./components/TacticalOverlay').then(m => ({ default: m.TacticalOverlay })));
const InfractionModal = React.lazy(() => import('./components/InfractionModal').then(m => ({ default: m.InfractionModal })));
import './index.css';

const SentinelApp = () => {
    const {
        directives,
        setDirectives,
        selectedLog,
        setSelectedLog,
        generateGeometry,
        startLiveFeed,
        onFileChange,
        isPlaying,
        setIsPlaying,
        addLog
    } = useSentinel();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFileSelect = () => {
        document.getElementById('file-up')?.click();
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileChange(file, videoRef);
        }
        e.target.value = '';
    };

    const handleStartLive = async () => {
        const stream = await startLiveFeed();
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().then(() => setIsPlaying(true));
        }
    };

    const toggleListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addLog('ERROR', 'Módulo de Voz: API de reconocimiento no soportada');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.onstart = () => addLog('INFO', 'Módulo de Voz: Escuchando comandos...');
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            addLog('AI', `Comando de Voz Recibido: "${transcript}"`);
            setDirectives(directives + `\n- ${transcript}`);
            generateGeometry(transcript);
        };
        recognition.start();
    };

    // Video sync effect
    React.useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.play().catch(() => { });
            else videoRef.current.pause();
        }
    }, [isPlaying]);

    return (
        <div className="h-screen w-screen bg-[#020617] text-slate-100 flex flex-col lg:flex-row overflow-hidden font-sans select-none">
            <Sidebar
                toggleListening={toggleListening}
                startLiveFeed={handleStartLive}
                onUploadClick={handleFileSelect}
            />

            <React.Suspense fallback={<div className="flex-1 bg-black animate-pulse" />}>
                <MainViewer
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                />
            </React.Suspense>

            <React.Suspense fallback={null}>
                <TacticalOverlay videoRef={videoRef} canvasRef={canvasRef} />
            </React.Suspense>

            <RightSidebar />

            <input id="file-up" type="file" className="hidden" accept="video/*" onChange={handleFileInput} />

            <React.Suspense fallback={null}>
                {selectedLog && <InfractionModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
            </React.Suspense>
        </div>
    );
};

export const App = () => (
    <SentinelProvider>
        <SentinelApp />
    </SentinelProvider>
);
