# API Financeira
API para controle do sistema de organização financeira. O principal intuito deste projeto é aprimorar conhecimentos que possuo e desenvolver novas habilidades.

# Visão geral
API desenvolvido para solucionar um problema pessoa para organização financeira, o intuito é desenvolver para que eu use ela e deixe de usar planilhas.

# Features
- Lançamento de contas a pagar e receber;
- Cadastros personalizados para contas bancárias, categorias, contrapartes, métodos de pagamento e ativos de investimentos;
- Possibilidade de ter mais de uma carteira para controle;
- Possibilidade de ter dependentes na mesma carteira com mais de um usuário controlando e visualizando os lançamentos. (Tudo dependendo da permissão que o dependente vai ter);
- Visualização de gráficos e relatórios, todos com filtros personalizáveis para melhor visualização dos gastos e movimentações.

# Tech Stack
**Stack**
- Banco de Dados: PostgreSQL;
- Linguagem: JavaScript (Node.js);
- Gerenciamento de dependências: npm.


**Dependências**
- Express;
- pg;
- bcrypt;
- JWT;
- cors.

**Dev Dependências**
- eslint;
- nodemon.

# Como executar o projeto
```bash
git clone https://github.com/RaulDoug/api_financeiro.git
npm install
npm run dev
```