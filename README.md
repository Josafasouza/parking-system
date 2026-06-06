# 🚗 Pytá Parking System - Premium SaaS Edition

Este é um **Sistema de Gerenciamento de Estacionamento Completo, Inteligente e Responsivo**, desenvolvido utilizando as tecnologias mais modernas do ecossistema **C# .NET 9 (Core)** no backend e uma interface **Single Page Application (SPA) Web Premium** no frontend.

O sistema dispõe de controle de cancela de entrada, vagas em tempo real categorizadas por setores, processamento de checkout, faturamento diário automático com tolerância de tarifa, gerenciamento de impressões de tickets térmicos ou A4, relatórios gerenciais estruturados em PDF e integração chatbot para o WhatsApp.

---

## ✨ Recursos de Destaque

### 1. 🔐 Autenticação & Controle de Acesso (RBAC)
* **Tela de Login Integrada**: Tela moderna para autenticação, funcionando tanto em comunicação online com a API do servidor quanto em modo de simulação local (offline).
* **Níveis de Permissão (Roles)**:
  * **Administrador (`Admin`)**: Acesso total a todas as áreas, incluindo configurações de preços, gerenciamento de usuários, ajuste de capacidade e perfis de impressoras.
  * **Operador de Caixa (`Cashier`)**: Acesso exclusivo às funções operacionais (portaria/grid de vagas e histórico). As abas administrativas no menu e os botões de ação de salvamento são ocultados/bloqueados dinamicamente no frontend.
* **Alteração de Senha Segura**: Qualquer operador conectado pode alterar sua própria senha a qualquer momento através do modal dedicado (`#change-password-modal`), validando a senha atual tanto localmente quanto no backend.

### 2. 🖨️ Gerenciamento e Configuração de Impressão
* **Perfis de Impressoras**: Configuração no painel administrativo para diferentes formatos:
  * *Impressora Térmica Não Fiscal (58mm)*
  * *Impressora Térmica Não Fiscal (80mm)*
  * *Impressora Padrão (A4 / Impressora a Jato/Laser)*
  * *Impressora Virtual (Exibição apenas em tela)*
* **Visualização em Tempo Real (Live Preview)**: Um simulador interativo na tela renderiza e redimensiona dinamicamente o ticket virtual conforme o perfil de impressora selecionado.
* **Impressão Automática**: Opções ativáveis para abrir a fila de impressão do sistema operacional de forma automatizada ao registrar uma Entrada (Ticket) ou Saída (Recibo de Pagamento).

### 3. 📄 Relatórios Gerenciais em PDF
* **Exportação Financeira**: A partir da aba de histórico de transações, é possível aplicar filtros avançados por status, placa, modalidade e categoria.
* **Layout Executivo**: Ao clicar em **"Exportar PDF"**, o sistema consolida as métricas (Receita total filtrada, Permanência média, Veículos finalizados e a divisão de faturamento por tipo de veículo) em um layout executivo, estilizado para impressão direta em folha A4 ou gravação em PDF.

### 4. 🤖 Envio de Ticket Digital & Chatbot WhatsApp
* **Página de Ticket Digital (`ticket.html`)**: Uma página pública dedicada com visual premium e responsivo (tema escuro, glassmorphism e animações) para os clientes visualizarem em seus smartphones. Exibe a placa do veículo em um layout realista de **Placa Mercosul**, badges de status dinâmicos ("ATIVO" ou "PAGO") e um **QR Code em alta definição** com linha laser de escaneamento para leitura direta na cancela física do estacionamento.
* **Mecanismo Resiliente**: A página do ticket resolve os dados consumindo a API do backend ou, caso offline/simulado, faz o fallback transparente para o `localStorage` do navegador do cliente.
* **Simulador de Smartphone**: Uma réplica interativa de tela de chat de smartphone exibe o chatbot simulado gerando o ticket e enviando em tempo real para o cliente (incluindo o status "digitando..." e animações), onde o QR Code e o botão de visualização abrem a página `ticket.html`.
* **WhatsApp Web Integration**: Gera links e redirecionamentos diretos para a API oficial do WhatsApp Web com o telefone informado pelo operador, contendo os dados do ticket formatados e o link clicável direto para a página do ticket digital.

### 5. 🚦 Configuração de Capacidade de Vagas
* **Ajuste Dinâmico de Limites**: O administrador pode ajustar dinamicamente o número máximo de vagas dos setores A (Carros), B (Motos) e C (Utilitários).
* **Validação de Segurança**: O sistema impede a redução do número de vagas abaixo do total de veículos que já estão estacionados no pátio para aquela categoria no momento, gerando alertas no frontend e rollback de transação no banco de dados.

### 6. 📊 Dashboard Operacional & Logs
* **Ocupação Gráfica**: Gráfico de rosca SVG interativo e barras de progresso representam a taxa de ocupação instantânea dos setores.
* **Logs do Sistema**: Painel que monitora e mantém um histórico persistente dos últimos 100 eventos e notificações da aplicação (`ag_system_logs` no `localStorage`) com suporte a limpeza administrativa.

---

## 🛠️ Tecnologias Utilizadas

- **Backend (API Core)**:
  - **C# e .NET Core 9** (Mecanismo de rotas e injeção de dependência).
  - **Entity Framework Core 9** (Mapeamento Objeto-Relacional).
  - **SQLite Database** (Banco local de arquivos rápidos auto-inicializável).
  - **TokenService Customizado** (Emissão de sessões digitais assinadas por HMAC-SHA256).
  - **AuthorizeRole Filters** (Interceptação de requisições baseada em roles do cabeçalho `Authorization`).

- **Frontend (SPA Web)**:
  - **HTML5 Semântico** (Com excelente SEO e marcações descritivas).
  - **CSS3 Vanilla Premium** (Visual Glassmorphic, Modo Escuro nativo, variáveis de design fluidas e animações aceleradas por hardware).
  - **JavaScript Puro (ES6+)** (Controle de rotas/views, criptografia SHA-256 no client-side para contingência, iframe virtual para emissão de cupom térmico e lógica resiliente).

---

## 📂 Estrutura de Arquivos

```text
parking-system/
├── parking-system.sln       # Solução para Visual Studio / VS Code
├── ParkingSystem.csproj     # Dependências EF Core, SQLite e configurações .NET 9
├── Program.cs               # Arquivo principal (serviço web, inicialização DB, arquivos estáticos)
├── appsettings.json         # Configuração da conexão com banco SQLite
├── Models/                  # Modelos de Domínio C#
│   ├── VehicleType.cs       # Categoria do veículo (Car, Motorcycle, Truck)
│   ├── ParkingSpace.cs      # Vagas e ocupação
│   ├── Tariff.cs            # Tabelas de preços
│   ├── User.cs              # Usuários do sistema (Name, Username, Role, PasswordHash)
│   └── Ticket.cs            # Registros de estadias e transações
├── Services/
│   └── TokenService.cs      # Emissor e validador de tokens criptográficos
├── Filters/
│   └── AuthorizeRoleAttribute.cs # Filtro de privilégio das rotas API
├── Data/
│   └── ParkingDbContext.cs  # Contexto EF Core com seed-data das vagas, tarifas e usuários
├── Controllers/             # Controladores RESTful expostos
│   ├── AuthController.cs    # Autenticação de login e alteração de senha
│   ├── UsersController.cs   # Gerenciamento completo de usuários (Admin apenas)
│   ├── TariffsController.cs # API de taxas e preços
│   ├── SpacesController.cs  # API de capacidade de vagas e dashboard stats
│   └── TicketsController.cs # API de controle de entrada, cálculo de taxas e checkout
└── wwwroot/                 # Pasta de arquivos web servidos automaticamente pelo .NET
    ├── index.html           # Interface SPA completa do painel administrativo
    ├── css/
    │   └── styles.css       # Estilos Premium Modo Escuro e WhatsApp bubbles
    └── js/
        └── app.js           # Lógica do painel com contingência, impressão e chatbot
```

---

## 🚀 Como Executar o Projeto

Graças ao mecanismo de resiliência local, o sistema detecta se a API está online ou offline e ativa o **Modo Simulação** automaticamente caso o servidor esteja desligado.

### Credenciais Padrão do Sistema:
* **Administrador**: usuário `admin` / senha `admin`
* **Operador de Caixa**: usuário `caixa` / senha `caixa`

### Método 1: Execução Rápida (Client-Side / Offline)
Apenas abra o arquivo `index.html` localizado na pasta `wwwroot` diretamente em qualquer navegador moderno:
1. Navegue até: `D:\Projetos\Antigravity\parking-system\wwwroot\`
2. Dê um duplo clique no arquivo `index.html`.
3. O sistema detectará o servidor offline e iniciará no **Modo Simulação**, persistindo os dados no `localStorage`.

### Método 2: Execução Completa com Servidor .NET 9 & Banco de Dados
Para compilar e subir o backend .NET completo com persistência no banco SQLite:
1. Abra o PowerShell ou Prompt de Comando.
2. Navegue até a pasta raiz do projeto:
   ```bash
   cd "D:\Projetos\Antigravity\parking-system"
   ```
3. Execute o comando de compilação e execução:
   ```bash
   dotnet run
   ```
4. O console indicará a URL local ativa (geralmente `http://localhost:5000`). Acesse a URL no seu navegador.
5. O sistema se conectará automaticamente à API .NET e criará o arquivo de banco `parking.db` na raiz.
