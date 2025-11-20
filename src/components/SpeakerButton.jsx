import React, { useState } from 'react';
import papi from '../Axios/paxios';

const SpeakerButton = ({ text, language = 'en' }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    if (!text) return;
    setIsLoading(true);

    try {
      // Use papi instance to call the TTS endpoint
      const response = await papi.post('/api/speak', 
        { text: text, language: language.slice(0, 2) }, // Use first 2 letters of language
        { 
          responseType: 'blob',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.data) throw new Error("TTS failed");

      // Convert the raw response into a Blob
      const audioBlob = response.data;
      
      // Create a temporary URL for that Blob
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play it immediately
      const audio = new Audio(audioUrl);
      audio.play();

      // Cleanup the URL after playing
      audio.onended = () => URL.revokeObjectURL(audioUrl);

    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handlePlay} 
      disabled={isLoading || !text}
      className="ml-2 p-1 text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Listen"
      type="button"
    >
      {isLoading ? (
        // Loading Spinner
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      ) : (
        // Speaker Icon
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      )}
    </button>
  );
};

export default SpeakerButton;
