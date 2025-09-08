import os
import re
from elevenlabs import generate, save, set_api_key

# 🔑 API Setup
# Get API key from environment variable or replace with your key
api_key = os.environ.get("ELEVENLABS_API_KEY", "your_api_key_here")
set_api_key(api_key)

voice_name = "TX3LPaxmHKxFdv7VOQHJ"  # Replace with your voice ID
model = "eleven_monolingual_v1"

# 📁 Paths
input_dir = "/Users/vinh/Desktop/voice_datasets/MRI_ankle/spoken"
output_dir = "/Users/vinh/Desktop/voice_datasets/MRI_ankle/wav"
os.makedirs(output_dir, exist_ok=True)

# 🧠 IPA phoneme replacements using SSML
custom_pronunciations = {
    "Talocalcaneal": '<phoneme alphabet="ipa" ph="ˌteɪ.loʊ.kælˈkeɪ.ni.əl">Talocalcaneal</phoneme>',
    "Fascia": '<phoneme alphabet="ipa" ph="ˈfæʃ.ə">Fascia</phoneme>',
    "Talofibular": '<phoneme alphabet="ipa" ph="ˌteɪ.loʊˈfɪb.jə.lɚ">Talofibular</phoneme>',
    "Peroneus": '<phoneme alphabet="ipa" ph="ˌpɛɹ.oʊˈni.əs">Peroneus</phoneme>',
    "Peroneal": '<phoneme alphabet="ipa" ph="ˌpɛɹ.oʊˈni.əl">Peroneal</phoneme>',
    "Posterior": '<phoneme alphabet="ipa" ph="ˈpoʊ.stɪ.ɹi.ɚ">Posterior</phoneme>',
    "Tear": '<phoneme alphabet="ipa" ph="ˈtɛəɹ">Tear</phoneme>',
    "Tibiofibular": '<phoneme alphabet="ipa" ph="ˌtɪ.bi.oʊˈfɪb.jə.lɚ">Tibiofibular</phoneme>',
    "Brevis": '<phoneme alphabet="ipa" ph="ˈbrɛ.vɪs">Brevis</phoneme>',
    "Talar": '<phoneme alphabet="ipa" ph="ˈteɪ.lɚ">Talar</phoneme>',
    "Talus": '<phoneme alphabet="ipa" ph="ˈteɪ.lɪs">Talus</phoneme>',
    "Plafond": '<phoneme alphabet="ipa" ph="pləˈfɒnd">Plafond</phoneme>',
    "Subtalar": '<phoneme alphabet="ipa" ph="ˌsʌbˈteɪ.lɚ">Subtalar</phoneme>',
    "Tibiotalar": '<phoneme alphabet="ipa" ph="ˌtɪ.bi.oʊˈteɪ.lɚ">Tibiotalar</phoneme>',
    "1.5": '<phoneme alphabet="ipa" ph="wʌn pɔɪnt faɪv">1.5</phoneme>',
    "2.5": '<phoneme alphabet="ipa" ph="tu pɔɪnt faɪv">2.5</phoneme>',
    "3.5": '<phoneme alphabet="ipa" ph="θɹi pɔɪnt faɪv">3.5</phoneme>',

    "Calcaneocuboid": '<phoneme alphabet="ipa" ph="ˌkæl.keɪ.ni.oʊˈkjuː.bɔɪd">Calcaneocuboid</phoneme>',
    "calcaneo-cuboid": '<phoneme alphabet="ipa" ph="ˌkæl.keɪ.ni.oʊˈkjuː.bɔɪd">calcaneo-cuboid</phoneme>',
    "Tenosynovitis": '<phoneme alphabet="ipa" ph="ˌtiː.noʊ.sɪ.nəˈvaɪ.tɪs">Tenosynovitis</phoneme>',
    "Talonavicular": '<phoneme alphabet="ipa" ph="ˌteɪ.loʊ.nəˈvɪk.jə.lɚ">Talonavicular</phoneme>',
    "coronal": '<phoneme alphabet="ipa" ph="kɔɹʌnʌl">coronal</phoneme>'
}


def preprocess_text(text):
    for word, replacement in custom_pronunciations.items():
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        text = pattern.sub(replacement, text)
    return text

# 🔁 Loop and synthesize
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
            text = f"<speak>{text}</speak>"  # SSML wrapper

        print(f"🎤 Synthesizing: {filename}")
        try:
            audio = generate(text=text, voice=voice_name, model=model)
            save(audio, wav_path)
        except Exception as e:
            print(f"❌ Error generating {filename}: {e}")

print("✅ All available .wav files generated.")

def main():
    """Main entry point for command-line usage"""
    # This allows the script to be used as: radpal-generate-wavs
    # The main logic is already above
    pass

if __name__ == "__main__":
    main()
