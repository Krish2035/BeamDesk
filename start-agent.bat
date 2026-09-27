@echo off
title BeamDesk Windows Agent
cd /d "%~dp0"
echo Starting BeamDesk Windows Remote Control Agent...
node beamdesk-agent.js
pause
