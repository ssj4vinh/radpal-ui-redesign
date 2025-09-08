#!/usr/bin/env python3
"""
Create icon files from SVG for RadPal application.
Creates PNG files in various sizes and ICO file for Windows.
"""

import os
import subprocess
import sys

def check_dependencies():
    """Check if required tools are installed."""
    try:
        subprocess.run(['convert', '--version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("ImageMagick not found. Installing...")
        try:
            subprocess.run(['sudo', 'apt-get', 'update'], check=True)
            subprocess.run(['sudo', 'apt-get', 'install', '-y', 'imagemagick'], check=True)
            return True
        except:
            print("Failed to install ImageMagick. Please install it manually.")
            return False

def create_png_sizes():
    """Create PNG files in various sizes needed for Electron."""
    sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    
    for size in sizes:
        output_file = f"icon_{size}x{size}.png"
        cmd = [
            'convert',
            '-background', 'none',
            '-density', '1200',
            'magnifying-glass.svg',
            '-resize', f'{size}x{size}',
            output_file
        ]
        
        try:
            subprocess.run(cmd, check=True)
            print(f"Created {output_file}")
        except subprocess.CalledProcessError as e:
            print(f"Failed to create {output_file}: {e}")
            return False
    
    # Create standard icon.png (256x256)
    try:
        subprocess.run(['cp', 'icon_256x256.png', 'icon.png'], check=True)
        print("Created icon.png (256x256)")
    except:
        print("Failed to create icon.png")
        return False
    
    return True

def create_ico_file():
    """Create ICO file for Windows containing multiple sizes."""
    cmd = [
        'convert',
        'icon_16x16.png',
        'icon_32x32.png',
        'icon_48x48.png',
        'icon_256x256.png',
        'icon.ico'
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("Created icon.ico")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to create icon.ico: {e}")
        return False

def main():
    """Main function to create all icon files."""
    # Change to icons directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print("Creating RadPal icons...")
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Create PNG files
    if not create_png_sizes():
        sys.exit(1)
    
    # Create ICO file
    if not create_ico_file():
        sys.exit(1)
    
    print("\nAll icons created successfully!")
    print("Icon files are located in:", script_dir)
    
    # List created files
    print("\nCreated files:")
    for file in sorted(os.listdir('.')):
        if file.endswith(('.png', '.ico')):
            size = os.path.getsize(file)
            print(f"  - {file} ({size:,} bytes)")

if __name__ == "__main__":
    main()