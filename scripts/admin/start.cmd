@echo off
chcp 65001 >nul
rem 管理者用ページを起動する(デスクトップのショートカットから呼ばれる)。この画面を閉じると終了する
title Kagura Meguri Admin - close this window to stop
cd /d "%~dp0..\.."
node scripts\admin\server.mjs
if errorlevel 1 pause
