# 🐆 GUEPARDO CENTRAL — Console de Liderança

![Guepardo Badge](https://img.shields.io/badge/Status-Operacional-orange?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Tecnologias-React%20%7C%20Supabase%20%7C%20Tailwind-blue?style=for-the-badge)

O **Guepardo Central** é o hub estratégico de comando para a operação de entregas da Guepardo. Desenvolvido para oferecer máxima visibilidade tática e controle operacional em tempo real, o sistema centraliza a gestão de entregadores, lojistas e métricas de performance em uma interface premium e dinâmica.

## 🚀 Pilares do Sistema

- **📍 Central Tática (Mapa em Tempo Real)**: Monitoramento ao vivo de entregadores e pedidos ativos utilizando Mapbox e Leaflet, com rotas inteligentes e telemetria de sinal.
- **📊 Matriz de Produtividade**: Dashboard analítico com KPIs de volume financeiro, taxa de eficiência (98%+), repasses e volume de pedidos por categoria.
- **🛵 Gestão de Guepardos**: Workflow completo de vistoria e aprovação de novos entregadores, verificação de documentos (CNH/CRLV) e status de frota.
- **🏢 Gestão de Lojistas**: Controle de parceiros, status de funcionamento (Aberto/Fechado) e histórico de solicitações.
- **💬 Comunicação Multilateral**: Chat integrado para resolução de exceções entre central, lojista e entregador.

## 🛠️ Stack Tecnológica

- **Frontend**: React 18 + Vite (HMR ultra-rápido)
- **Estilização**: Tailwind CSS (Design System customizado com gradientes e glassmorphism)
- **Backend/DB**: Supabase (PostgreSQL + Realtime Engine)
- **Geolocalização**: Leaflet + Mapbox API
- **Icons**: Lucide React

## 📦 Configuração e Instalação

### Pré-requisitos
- Node.js (v18 ou superior)
- Conta no Supabase
- Token de Acesso Mapbox

### Ambiente de Desenvolvimento
1. Clone o repositório:
   ```bash
   git clone https://github.com/marcioafsadv/Guepardo-Central.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente (`.env`):
   ```env
   VITE_SUPABASE_URL=seu_url_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima
   VITE_MAPBOX_TOKEN=seu_token_mapbox
   ```
4. Inicie o servidor:
   ```bash
   npm run dev
   ```

## 🔐 Segurança

Este repositório passou por um processo rigoroso de limpeza de segurança, garantindo que nenhum segredo ou credencial sensível esteja presente no código ou no histórico de commits. Todas as operações utilizam variáveis de ambiente protegidas.

---
*Guepardo Delivery — Velocidade e Inteligência em cada entrega.*
