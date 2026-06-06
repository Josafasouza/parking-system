# 🚗 Antigravity Parking System - Premium SaaS Edition

Este é um **Sistema de Gerenciamento de Estacionamento Completo, Inteligente e Responsivo**, desenvolvido utilizando as tecnologias mais modernas do ecossistema **C# .NET 9 (Core)** no backend e uma interface **Single Page Application (SPA) Web Premium** no frontend.

O sistema dispõe de controle de cancela de entrada, vagas em tempo real categorizadas por setores, processamento de checkout, faturamento diário automático com tolerância de tarifa, e relatórios fiscais.

---

## ✨ Recursos de Destaque

1. **Dashboard Operacional Dinâmico**:
   - Resumo gráfico da taxa de ocupação instantânea via anel de progresso SVG.
   - Distribuição de ocupação por categoria (Carros, Motociclistas, Utilitários).
   - Faturamento do dia e métricas de tempo de permanência calculadas em tempo real.

2. **Controle de Portaria & Cancelas (Gate)**:
   - Formulário inteligente de entrada de veículos com autoatribuição inteligente de vagas com base na categoria escolhida.
   - Simulador de cobrança detalhado no checkout com exibição de duração, tarifa utilizada e valor a pagar.
   - Gerador de **Comprovantes Digitais (Cupom Fiscal Térmico)** estilizados com código QR simulado para a entrada e a saída.

3. **Mapa de Vagas Interativo**:
   - Grid físico com status de vagas livre (verde) ou ocupada (vermelho).
   - Eventos de hover detalhando ocupante e placa.
   - Modal com ações rápidas para estacionar veículos ou liberar administrativamente vagas diretamente do mapa.

4. **Configurações Flexíveis de Tarifas**:
   - Ajustes de preços para a Primeira Hora, Horas Adicionais, Tempo de Tolerância e Teto de Preço Limite Diário, individualizados por tipo de veículo.

5. **Mecanismo de Resiliência "Fallback Inteligente"**:
   - O frontend detecta automaticamente se a API do servidor C# .NET 9 está offline. Em caso afirmativo, ele ativa silenciosamente o **Modo Simulação**, mantendo toda a aplicação 100% funcional (salvando e lendo dados de vagas, tickets, tarifas e histórico diretamente no armazenamento `localStorage` do navegador)! 

---

## 🛠️ Tecnologias Utilizadas

- **Backend (API Core)**:
  - **C# e .NET Core 9** (Mecanismo de rotas e injeção de dependência).
  - **Entity Framework Core 9** (Mapeamento Objeto-Relacional).
  - **SQLite Database** (Banco local de arquivos rápidos auto-inicializável).
  - **CORS Policies & JSON Converters** (Para comunicação e padronização rápida).

- **Frontend (SPA Web)**:
  - **HTML5 Semântico** (Com excelente SEO e marcações descritivas).
  - **CSS3 Vanilla Premium** (Uso extensivo de variáveis CSS, Glassmorphism fosco, Modo Escuro nativo, transições aceleradas por hardware e design ultra responsivo).
  - **JavaScript Puro (ES6+)** (Consumo da API, controle de estados da UI e simulador de resiliência local).

---

## 📂 Estrutura de Arquivos

```text
parking-system/
├── parking-system.sln       # Arquivo de solução para Visual Studio / VS Code
├── ParkingSystem.csproj     # Dependências EF Core, SQLite e configurações .NET 9
├── Program.cs               # Arquivo principal (serviço web, inicialização DB, arquivos estáticos)
├── appsettings.json         # Configuração da conexão com banco SQLite
├── Models/                  # Modelos de Domínio C#
│   ├── VehicleType.cs       # Enum de categorias (Car, Motorcycle, Truck)
│   ├── ParkingSpace.cs      # Modelo de vaga e ocupação
│   ├── Tariff.cs            # Modelo de tabelas de preços
│   └── Ticket.cs            # Registro de estadias e transações
├── Data/
│   └── ParkingDbContext.cs  # Contexto EF Core com seed-data das vagas e tarifas
├── Controllers/             # Controladores RESTful expostos
│   ├── TariffsController.cs # API de taxas e preços
│   ├── SpacesController.cs  # API de vagas e dashboard stats
│   └── TicketsController.cs # API de controle de entrada, cálculo de taxas e saída
└── wwwroot/                 # Pasta de arquivos web servidos automaticamente pelo .NET
    ├── index.html           # Interface SPA completa do painel
    ├── css/
    │   └── styles.css       # Visual Glassmorphic Premium e Modo Escuro
    └── js/
        └── app.js           # Lógica cliente com resiliência de simulador offline
```

---

## 🚀 Como Executar o Projeto

Como o sistema possui a resiliência inteligente do **Modo Simulação**, você pode testá-lo instantaneamente de duas formas:

### Método 1: Execução Rápida (Client-Side / Offline)
Apenas abra o arquivo `index.html` localizado na pasta `wwwroot` diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, etc.):
1. Navegue até: `C:\Users\LENOVO T14 INTEL\.gemini\antigravity\scratch\parking-system\wwwroot\`
2. Dê um duplo clique no arquivo `index.html`.
3. Pronto! O sistema detectará que a API não está de pé e iniciará o **Modo Simulação**. Todas as operações funcionarão perfeitamente, salvando os dados na memória do seu navegador!

### Método 2: Execução Completa com Servidor .NET 9 & Banco de Dados
Para compilar e subir o backend .NET completo servindo a aplicação web de forma profissional:
1. Abra o prompt de comando ou PowerShell.
2. Navegue até a pasta raiz do projeto:
   ```bash
   cd "C:\Users\LENOVO T14 INTEL\.gemini\antigravity\scratch\parking-system"
   ```
3. Execute o comando de compilação e inicialização:
   ```bash
   dotnet run
   ```
4. O servidor compilará a aplicação e começará a escutar por requisições. O banco de dados SQLite `parking.db` será criado e populado automaticamente na raiz!
5. Abra o seu navegador e acesse a URL indicada no console (geralmente `http://localhost:5000` ou similar).
6. O sistema se conectará automaticamente à API de banco de dados do .NET, permitindo persistência física e relatórios duradouros.
