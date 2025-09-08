@echo off
echo Copying Windows binary files to electron folder...

cd /d "%~dp0.."

:: Download the Windows binary if not present
if not exist "temp_win_binary" mkdir temp_win_binary
cd temp_win_binary

echo Downloading Windows binary package...
curl -L -o llama-win.zip https://github.com/ggml-org/llama.cpp/releases/download/b6153/llama-b6153-bin-win-cpu-x64.zip

echo Extracting files...
tar -xf llama-win.zip

echo Copying to electron folder...
copy /Y llama-server.exe ..\electron\
copy /Y *.dll ..\electron\

cd ..
rmdir /s /q temp_win_binary

echo.
echo Done! Files copied to electron folder:
dir electron\llama-server.exe electron\*.dll /b 2>nul | find /c /v ""
echo files copied.

echo.
echo Now run: npm run electron
pause