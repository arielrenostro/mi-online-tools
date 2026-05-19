#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /mnt/d/Users/ariel/Documents/Projetos/mi-fuel-tuner/frontend
npm run dev > /tmp/vite-dev.log 2>&1
