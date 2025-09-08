#!/usr/bin/env python3
"""
RadPal - Speech Processing and Text-to-Speech Tools
Setup script for Python components
"""

from setuptools import setup, find_packages
import os

# Read the README file for long description
def read_readme():
    try:
        with open('README.md', 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return "RadPal - Speech Processing and Text-to-Speech Tools"

# Read requirements
def read_requirements():
    try:
        with open('requirements.txt', 'r', encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip() and not line.startswith('#')]
    except FileNotFoundError:
        return ['elevenlabs', 'requests']

setup(
    name="radpal",
    version="1.0.0",
    description="Speech Processing and Text-to-Speech Tools for Medical Transcription",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    author="RadPal Team",
    python_requires=">=3.8",
    
    # Python packages
    py_modules=[
        'generate_wavs'
    ],
    
    # Dependencies
    install_requires=read_requirements(),
    
    # Entry points for command-line tools
    entry_points={
        'console_scripts': [
            'radpal-generate-wavs=generate_wavs:main',
        ],
    },
    
    # Include data files
    include_package_data=True,
    package_data={
        '': ['*.txt', '*.md'],
    },
    
    # Classifiers
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Healthcare Industry",
        "Topic :: Multimedia :: Sound/Audio :: Speech",
        "Topic :: Scientific/Engineering :: Medical Science Apps.",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
    ],
    
    # Optional dependencies
    extras_require={
        'audio': ['soundfile', 'librosa', 'numpy'],
        'dev': ['pytest', 'black', 'flake8'],
    },
)