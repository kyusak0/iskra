'use client';
import { useState, useRef } from 'react';

export default function VoiceRecorder() {
    const [recording, setRecording] = useState(false);
    const [recordings, setRecordings] = useState([]);
    const [playingId, setPlayingId] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioRefs = useRef({});

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const newRecording = {
                    id: Date.now(),
                    url: url,
                    blob: blob,
                    date: new Date().toLocaleString(),
                    duration: '0:00' // Можно добавить расчет длительности
                };
                
                setRecordings(prev => [newRecording, ...prev]);
                
                // Здесь отправка blob на сервер (fetch)
                // uploadToServer(blob);
            };

            mediaRecorder.start();
            setRecording(true);
        } catch (error) {
            console.error('Ошибка доступа к микрофону:', error);
            alert('Не удалось получить доступ к микрофону');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && recording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setRecording(false);
        }
    };

    const playRecording = (id) => {
        if (playingId === id) {
            audioRefs.current[id]?.pause();
            audioRefs.current[id].currentTime = 0;
            setPlayingId(null);
        } else {
            if (playingId) {
                audioRefs.current[playingId]?.pause();
                audioRefs.current[playingId].currentTime = 0;
            }
            
            audioRefs.current[id]?.play();
            setPlayingId(id);
        }
    };

    const deleteRecording = (id) => {
        setRecordings(prev => {
            const newRecordings = prev.filter(rec => rec.id !== id);
            // Очищаем URL из памяти
            const recordingToDelete = prev.find(rec => rec.id === id);
            if (recordingToDelete) {
                URL.revokeObjectURL(recordingToDelete.url);
            }
            return newRecordings;
        });
        
        if (playingId === id) {
            setPlayingId(null);
        }
    };

    const downloadRecording = (recording) => {
        const a = document.createElement('a');
        a.href = recording.url;
        a.download = `voice-${recording.id}.webm`;
        a.click();
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <div className="mb-6 text-center">
                <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`px-6 py-3 rounded-full font-semibold text-white transition-colors ${
                        recording 
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                            : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                >
                    {recording ? '⏹️ Остановить запись' : '🎙️ Начать запись'}
                </button>
                {recording && (
                    <p className="mt-2 text-red-500 font-medium">Идет запись...</p>
                )}
            </div>
            {recordings.length > 0 ? (
                <div className="space-y-3">
                    <h2 className="text-xl font-bold mb-4">Записи ({recordings.length})</h2>
                    {recordings.map((recording) => (
                        <div 
                            key={recording.id} 
                            className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600">
                                    {recording.date}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {recording.duration}
                                </span>
                            </div>
                            
                            <audio 
                                ref={el => audioRefs.current[recording.id] = el}
                                src={recording.url} 
                                className="w-full mb-3"
                                onEnded={() => setPlayingId(null)}
                                controls
                            />
                            
                            <div className="flex gap-2">
                                <button
                                    onClick={() => playRecording(recording.id)}
                                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                                        playingId === recording.id
                                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                                >
                                    {playingId === recording.id ? '⏸️ Пауза' : '▶️ Воспроизвести'}
                                </button>
                                
                                <button
                                    onClick={() => downloadRecording(recording)}
                                    className="py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors"
                                >
                                    💾 Скачать
                                </button>
                                
                                <button
                                    onClick={() => deleteRecording(recording.id)}
                                    className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-md font-medium transition-colors"
                                >
                                    🗑️ Удалить
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Нет записей. Нажмите кнопку записи чтобы начать</p>
                </div>
            )}
        </div>
    );
}