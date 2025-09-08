#!/usr/bin/env python3
"""
Simple script to generate an ICO file from a PNG image.
Falls back to copying PNG as ICO if PIL is not available.
"""

import shutil
import os

try:
    from PIL import Image
    
    # Open the PNG file
    img = Image.open('icon.png')
    
    # Create ICO with multiple sizes
    icon_sizes = [(16, 16), (32, 32), (48, 48), (256, 256)]
    
    # Save as ICO
    img.save('icon.ico', format='ICO', sizes=icon_sizes)
    print("Successfully created icon.ico with PIL")
    
except ImportError:
    # Fallback: just copy the PNG as ICO (Windows can sometimes handle this)
    print("PIL not available, creating basic ICO file")
    shutil.copy('icon.png', 'icon.ico')
    print("Created basic icon.ico (copy of PNG)")