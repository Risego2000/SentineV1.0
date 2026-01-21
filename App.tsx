import React, { useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { MainViewer } from './components/MainViewer';
import { InfractionModal } from './components/InfractionModal';
import { SentinelProvider, useSentinel } from './context/SentinelContext';
import { TacticalOverlay } from './components/TacticalOverlay';
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

            <MainViewer
                videoRef={videoRef}
                canvasRef={canvasRef}
                startLiveFeed={handleStartLive}
                onUploadClick={handleFileSelect}
            />

            <TacticalOverlay videoRef={videoRef} canvasRef={canvasRef} />

            <RightSidebar />

            <input id="file-up" type="file" className="hidden" accept="video/*" onChange={handleFileInput} />
            {selectedLog && <InfractionModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};

export const App = () => (
    <SentinelProvider>
        <SentinelApp />
    </SentinelProvider>
);
