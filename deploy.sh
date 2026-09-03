#!/bin/bash
# Deploy do CRM HotelEquip para produção
# Servidor: 84.247.142.28
# URL: crm.hotelequip.pt

set -e

echo "🏗️  A fazer build..."
npm run build

echo "📦 A fazer upload para o servidor..."
# Copiar dist para o servidor via scp
scp -r dist/* root@84.247.142.28:/var/www/crm.hotelequip.pt/

echo "✅ Deploy concluído!"
echo "🌐 CRM disponível em https://crm.hotelequip.pt"
