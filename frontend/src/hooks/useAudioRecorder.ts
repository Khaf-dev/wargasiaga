// frontend/src/hooks/useAudioRecorder.ts
import { useState, useRef } from 'react';

interface AudioRecorderState {
  isRecording: boolean;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetAudioBlob: () => void;
}

export const useAudioRecorder = (durationInMs: number): AudioRecorderState => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setAudioBlob(null);
      audioChunksRef.current =[];

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(blob);
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();

      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, durationInMs);

    } catch (err) {
      console.error("Gagal merekam audio:", err);
      setIsRecording(false);
      throw new Error("Izin mikrofon ditolak atau tidak tersedia.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const resetAudioBlob = () => setAudioBlob(null);

  return { isRecording, audioBlob, startRecording, stopRecording, resetAudioBlob };
};