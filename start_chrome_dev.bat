@echo off
"C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir="%TEMP%\chrome_dev" http://localhost:8000/index.html
