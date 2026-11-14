@echo off
chcp 65001 >nul
rem 管理者用ページを起動する(デスクトップのショートカットから呼ばれる)。この画面を閉じると終了する
title Kagura Meguri Admin - close this window to stop
cd /d "%~dp0..\.."
rem KAGURA_ADMIN_START: このショートカットから起動したしるし(画面の「開き直す」が使える)。引数(--no-open など)は、そのまま渡す
set KAGURA_ADMIN_START=1
node scripts\admin\server.mjs %*
if errorlevel 1 pause
