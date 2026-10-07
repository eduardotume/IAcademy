@echo off
echo === Configurando IAcademy ===
call conda create -n iacademy python=3.11 -y
call conda activate iacademy
call conda install -c conda-forge pandas numpy pyarrow pillow -y
pip install -r requirements.txt
echo.
echo (Opcional) Para el modelo local de Hugging Face ejecuta:
echo     pip install -r requirements-local.txt
echo.
echo === Listo. Ejecuta: streamlit run app.py  (o npm run dev) ===
pause
