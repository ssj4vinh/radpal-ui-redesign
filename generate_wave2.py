import os
import re
from elevenlabs import generate, save, set_api_key

# 🔑 Step 1: API + Voice Config
set_api_key("sk_ebc6c993b40c1c09e68a388cfa775a707e263ddfdea2ae05")  # Replace with your ElevenLabs key
voice_name = "TX3LPaxmHKxFdv7VOQHJ"
model = "eleven_monolingual_v1"

# 📁 Step 2: Folder Paths
input_dir = "/Users/vinh/Desktop/voice datasets/MRI ankle/spoken"
output_dir = "/Users/vinh/Desktop/voice datasets/MRI ankle/wav"
os.makedirs(output_dir, exist_ok=True)

# 🧠 Step 3: Custom Pronunciations (with stress emphasis)
custom_pronunciations = {
    "Talocalcaneal": "TAYlo-cal-KAYneel",
    "Fascia": "fashia", #
    "Talofibular": "taylo-fibuler",
    "Calcaneocuboid": "cal-KAYneo-cuboid",
    "calcaneo-cuboid": "cal-KAYneo-cuboid",
    "Tenosynovitis": "teeno-SINno-vydus",
    "Peroneus": "pairra-NEEiss", #
    "Peroneal": "pairra-NEEL", #
    "Talonavicular": "taylor-naVICKular",
    "Posterior": "poeSTEEReer",
    "Tear": "TARE",
    "Tibiofibular": "TIBio-FIBuler",
    "Brevis": "BREViss",
    "Talar": "TAYlor",
    "Talus": "TAYluss",
    "Coronal": "coronuhl", #
    "Plafond": "pluFFOND", #
    "Subtalar": "sub-TAYlor",
    "1.5": "one point FIVE",
    "2.5": "two point FIVE",
    "3.5": "three point FIVE",
    "Tibiotalar": "TIBio-TAYlor"
}

# 🔁 Step 4: Preprocessing Function
def preprocess_text(text):
    for word, replacement in custom_pronunciations.items():
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        text = pattern.sub(replacement, text)
    return text

# 🚀 Step 5: Generate WAVs (skip existing files)
for filename in os.listdir(input_dir):
    if filename.endswith(".txt"):
        txt_path = os.path.join(input_dir, filename)
        wav_filename = filename.replace(".txt", ".wav")
        wav_path = os.path.join(output_dir, wav_filename)

        if os.path.exists(wav_path):
            print(f"⏭️ Skipping (already exists): {wav_filename}")
            continue

        with open(txt_path, "r") as f:
            raw_text = f.read().strip()
            text = preprocess_text(raw_text)

        print(f"🎤 Synthesizing: {filename}")
        try:
            audio = generate(text=text, voice=voice_name, model=model)
            save(audio, wav_path)
        except Exception as e:
            print(f"❌ Error generating {filename}: {e}")

print("✅ All available .wav files generated.")
