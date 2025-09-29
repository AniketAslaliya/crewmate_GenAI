import wave

with wave.open("harvard.wav", "rb") as wf:
    print("Channels:", wf.getnchannels())
    print("Sample width (bytes):", wf.getsampwidth())
    print("Frame rate (Hz):", wf.getframerate())
    print("Frames:", wf.getnframes())
    print("Duration (sec):", wf.getnframes() / float(wf.getframerate()))
