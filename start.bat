@echo off

echo Updating/Installing Bot Dependencies

call npm i

echo Starting Up ....

call node src/index.js
