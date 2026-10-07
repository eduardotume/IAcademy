@echo off
echo === Configurando IAcademy ===
call conda create -n iacademy python=3.11 -y
call conda activate iacademy
pip install -U -r requirements.txt
echo.
echo (Opcional) Para el modelo local de Hugging Face ejecuta:
echo     pip install -r requirements-local.txt
echo.
echo === Listo. Ejecuta: streamlit run app.py ===
pause
