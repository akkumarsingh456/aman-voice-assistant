import os
import requests
import pyaudio
import numpy as np
import openwakeword
from openwakeword.model import Model
from dotenv import load_dotenv

# 1. Load the API keys from your .env file automatically
load_dotenv()

# 2. Access the API keys
TELEGRAM_BOT_TOKEN = os.getenv("VITE_TELEGRAM_BOT_TOKEN")
GOOGLE_API_KEY = os.getenv("VITE_GOOGLE_API_KEY")
SUPABASE_API_KEY = os.getenv("VITE_SUPABASE_API_KEY")
TWILIO_API_KEY = os.getenv("VITE_TWILIO_API_KEY")

print("--- API Keys Loaded Successfully ---")
if TELEGRAM_BOT_TOKEN: print("✅ Telegram Key is ready")
if GOOGLE_API_KEY: print("✅ Google Key is ready")
if SUPABASE_API_KEY: print("✅ Supabase Key is ready")
if TWILIO_API_KEY: print("✅ Twilio Key is ready")
print("------------------------------------")

# 3. Initialize with your custom 'Project Aman Kumar' model
# NOTE: Ensure the "models" directory exists and has "hey_aman.onnx" inside it
try:
    model = Model(wakeword_models=["models/hey_aman.onnx"])
except Exception as e:
    print("\n⚠️ Warning: Could not load the wakeword model 'models/hey_aman.onnx'.")
    print("Continuing with the default models for demonstration...\n")
    model = Model()

# Set up microphone audio stream using PyAudio
CHUNK = 1280
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000

audio = pyaudio.PyAudio()
mic_stream = audio.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)

def start_listening_for_command():
    print("🤖 Aman is listening... What can I do for you?")
    
    # ----------------------------------------------------------------
    # HERE IS WHERE THE APIS ARE USED:
    # --------------------------------
import os
import requests
import pyaudio
import numpy as np
import openwakeword
from openwakeword.model import Model
from dotenv import load_dotenv

# 1. Load the API keys from your .env file automatically
load_dotenv()

# 2. Access the API keys
TELEGRAM_BOT_TOKEN = os.getenv("VITE_TELEGRAM_BOT_TOKEN")
GOOGLE_API_KEY = os.getenv("VITE_GOOGLE_API_KEY")
SUPABASE_API_KEY = os.getenv("VITE_SUPABASE_API_KEY")
TWILIO_API_KEY = os.getenv("VITE_TWILIO_API_KEY")

print("--- API Keys Loaded Successfully ---")
if TELEGRAM_BOT_TOKEN: print("✅ Telegram Key is ready")
if GOOGLE_API_KEY: print("✅ Google Key is ready")
if SUPABASE_API_KEY: print("✅ Supabase Key is ready")
if TWILIO_API_KEY: print("✅ Twilio Key is ready")
print("------------------------------------")

# 3. Initialize with your custom 'Project Aman Kumar' model
# NOTE: Ensure the "models" directory exists and has "hey_aman.onnx" inside it
try:
    model = Model(wakeword_models=["models/hey_aman.onnx"])
except Exception as e:
    print("\n⚠️ Warning: Could not load the wakeword model 'models/hey_aman.onnx'.")
    print("Continuing with the default models for demonstration...\n")
    model = Model()

# Set up microphone audio stream using PyAudio
CHUNK = 1280
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000

audio = pyaudio.PyAudio()
mic_stream = audio.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)

def start_listening_for_command():
    print("🤖 Aman is listening... What can I do for you?")
    
    # ----------------------------------------------------------------
    # HERE IS WHERE THE APIS ARE USED:
    # ----------------------------------------------------------------
    
    # Example 1: Use Twilio to send an SMS
    # twilio_url = "https://api.twilio.com/2010-04-01/Accounts/.../Messages.json"
    # requests.post(twilio_url, auth=("YOUR_SID", TWILIO_API_KEY), data={"To": "+12345", "From": "+67890", "Body": "Aman is listening!"})
    
    # Example 2: Use Telegram to send a message
    # tg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    # requests.post(tg_url, json={"chat_id": "YOUR_CHAT_ID", "text": "Voice command triggered."})
    
    # Example 3: Send audio or text to your own FastAPI/Flask backend
    # response = requests.post("http://localhost:5000/command", json={"status": "listening", "google_auth": GOOGLE_API_KEY})

print("\nListening for wake word 'Hey Aman'...")

# Continuous loop for Persistent Listening
try:
    while True:
        # Get audio_frame from your microphone capture layer
        audio_data = mic_stream.read(CHUNK, exception_on_overflow=False)
        audio_frame = np.frombuffer(audio_data, dtype=np.int16)

        # Feed the audio frame into the model
        prediction = model.predict(audio_frame)

        # Threshold for detection
        for wakeword, score in prediction.items():
            if score > 0.6: 
                start_listening_for_command()
                # To prevent rapid multiple triggers, pause briefly
                import time; time.sleep(2)

except KeyboardInterrupt:
    print("\nStopping listener...")
finally:
    # Clean up the audio stream when exiting
    mic_stream.stop_stream()
    mic_stream.close()
    audio.terminate()

user_query = "What is the weather?" # Example captured text
response = brain.get_ai_response(user_query, ai_choice="gemini")
print(response)
