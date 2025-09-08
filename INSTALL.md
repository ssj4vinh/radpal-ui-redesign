# RadPal Installation Guide

RadPal is a speech processing and medical transcription tool with both Electron app and Python components.

## System Requirements

- **Operating System**: Windows 10/11, macOS 10.14+, or Linux
- **Node.js**: 16.0 or higher (for Electron app)
- **Python**: 3.8 or higher (for speech processing components)
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 2GB free space

## Installation Options

### Option 1: Full Installation (Recommended for Work)

This installs both the Electron app and Python components.

#### Step 1: Install Node.js Dependencies
```bash
# Clone the repository
git clone <repository-url> radpal
cd radpal

# Install Node.js dependencies
npm install
```

#### Step 2: Install Python Components
```bash
# Create a virtual environment (recommended)
python -m venv radpal_env
source radpal_env/bin/activate  # On Windows: radpal_env\Scripts\activate

# Install Python dependencies
pip install -e .
```

#### Step 3: Set Up Environment Variables
Create a `.env` file in the project root:
```env
# ElevenLabs API Key (for TTS functionality)
ELEVENLABS_API_KEY=your_api_key_here

# Voice ID for TTS
ELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ
```

#### Step 4: Install Montreal Forced Aligner (Optional)
For phoneme alignment functionality:
```bash
# Using micromamba (recommended)
curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -xvj bin/micromamba
./bin/micromamba create -n mfa_align -c conda-forge montreal-forced-aligner=3.3.3
./bin/micromamba run -n mfa_align mfa model download acoustic english_us_arpa
./bin/micromamba run -n mfa_align mfa model download dictionary english_us_arpa
```

### Option 2: Python Components Only

If you only need the speech processing tools:

```bash
# Install from source
pip install git+<repository-url>

# Or install locally
pip install -e .
```

### Option 3: Electron App Only

If you only need the GUI application:

```bash
npm install
npm run build
npm run dist  # Creates distributable package
```

## Building Distributable Packages

### Windows Installer
```bash
npm run build
npm run dist:win
```
This creates an `.exe` installer in the `dist/` directory.

### macOS App
```bash
npm run build
npm run dist:mac
```
This creates a `.dmg` file in the `dist/` directory.

### Linux AppImage
```bash
npm run build
npm run dist
```

## Usage

### Running the Electron App
```bash
npm run electron
```

### Using Python Components
```bash
# Generate TTS audio files
python generate_wavs.py

# Or use the installed command
radpal-generate-wavs
```

### MFA Alignment
```bash
# Using micromamba installation
~/bin/micromamba run -n mfa_align mfa align "/path/to/input" english_us_arpa english_us_arpa "/path/to/output"
```

## Configuration

### Environment Variables
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key for TTS
- `ELEVENLABS_VOICE_ID`: Voice ID to use for TTS generation

### File Paths
Update paths in `generate_wavs.py` for your specific setup:
- `input_dir`: Directory containing text files
- `output_dir`: Directory for generated audio files

## Troubleshooting

### Common Issues

1. **Missing API Key**: Ensure `ELEVENLABS_API_KEY` is set in your environment
2. **MFA Installation**: Use micromamba instead of pip for MFA - it has complex dependencies
3. **Electron Build Issues**: Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
4. **Python Import Errors**: Ensure you're in the correct virtual environment

### Work Environment Setup

For deployment at work, consider:

1. **Security**: Remove API keys from code, use environment variables
2. **Network**: Some corporate networks may block certain package installations
3. **Permissions**: You may need admin rights for some installations
4. **Proxy**: Configure npm/pip to work with corporate proxies if needed

### Proxy Configuration (if needed)
```bash
# npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# pip proxy
pip install --proxy http://proxy.company.com:8080 package_name
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the project documentation
3. Check existing issues in the repository