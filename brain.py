import os
import pyaudio
import numpy as np
from openwakeword.model import Model
from dotenv import load_dotenv
import brain # This imports your brain.py file

load_dotenv()

# Initialize Wake Word Model
model = Model(wakeword_models=["models/hey_aman.onnx"])

def start_listening_for_command():
    print("🤖 Aman is listening... (Speak now)")
    
    # FUTURE STEP: Add Speech-to-Text here to replace this hardcoded line
    user_query = "Hello Aman, give me a quick tip of the day." 
    
    # Call the brain
    response = brain.get_ai_response(user_query, ai_choice="gemini")
    print(f"Aman says: {response}")

# Setup Audio Stream
CHUNK = 1280
audio = pyaudio.PyAudio()
mic_stream = audio.open(format=pyaudio.paInt16, channels=1, rate=16000, input=True, frames_per_buffer=CHUNK)

print("✅ System Online. Say 'Hey Aman'...")

try:
    while True:
        audio_data = mic_stream.read(CHUNK, exception_on_overflow=False)
        audio_frame = np.frombuffer(audio_data, dtype=np.int16)
        prediction = model.predict(audio_frame)

        if prediction.get("hey_aman", 0) > 0.6:
            start_listening_for_command()
            import time; time.sleep(1) # Brief pause after trigger
except KeyboardInterrupt:
    print("Stopping...")
finally:
    mic_stream.close()
    audio.terminate()
