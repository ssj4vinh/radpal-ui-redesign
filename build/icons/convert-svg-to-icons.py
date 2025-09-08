#!/usr/bin/env python3
"""
Convert SVG to PNG and ICO formats for Windows build
"""

import os
import sys

try:
    # Try using cairosvg for SVG to PNG conversion
    import cairosvg
    from PIL import Image
    import io
    
    print("Converting magnifying-glass.svg to PNG and ICO...")
    
    # Convert SVG to PNG at different sizes
    sizes = {
        'icon.png': 256,
        'icon_512x512.png': 512,
        'icon_32x32.png': 32,
        'icon_16x16.png': 16,
        'icon_48x48.png': 48,
        'icon_128x128.png': 128,
    }
    
    svg_path = 'magnifying-glass.svg'
    
    for filename, size in sizes.items():
        print(f"Creating {filename} ({size}x{size})...")
        png_data = cairosvg.svg2png(url=svg_path, output_width=size, output_height=size)
        with open(filename, 'wb') as f:
            f.write(png_data)
    
    # Create ICO file with multiple sizes
    print("Creating icon.ico...")
    img_256 = Image.open('icon.png')
    img_48 = Image.open('icon_48x48.png')
    img_32 = Image.open('icon_32x32.png')
    img_16 = Image.open('icon_16x16.png')
    
    # Save as ICO with multiple sizes
    img_256.save('icon.ico', format='ICO', sizes=[(256, 256), (48, 48), (32, 32), (16, 16)])
    
    print("✅ Successfully created all icon files!")
    
except ImportError as e:
    print(f"Error: Required libraries not installed: {e}")
    print("\nPlease install the required libraries:")
    print("pip install cairosvg pillow")
    print("\nAlternatively, you can use online converters:")
    print("1. Go to https://cloudconvert.com/svg-to-png")
    print("2. Upload magnifying-glass.svg")
    print("3. Convert to PNG at 256x256")
    print("4. Save as icon.png")
    print("\nThen go to https://cloudconvert.com/png-to-ico")
    print("1. Upload icon.png")
    print("2. Convert to ICO")
    print("3. Save as icon.ico")
    sys.exit(1)