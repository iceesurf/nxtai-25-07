# NXT.AI - Página Home

Uma página home moderna e atraente para o sistema NXT.AI, desenvolvida com HTML, CSS e JavaScript puros.

## Características

### Design
- **Minimalista e Futurista**: Design limpo com elementos neon e gradientes
- **Responsivo**: Adaptável para desktop, tablet e mobile
- **Animações Suaves**: Transições e efeitos visuais modernos
- **Tema Escuro**: Paleta de cores roxo e laranja sobre fundo escuro

### Funcionalidades
- **Navegação Suave**: Scroll suave entre seções
- **Modais Interativos**: Login, registro e formulário de contato
- **Formulários Funcionais**: Validação e feedback visual
- **Menu Mobile**: Interface adaptada para dispositivos móveis
- **Notificações**: Sistema de notificações para feedback do usuário

### Seções
1. **Header**: Navegação com logo e botões de login/registro
2. **Hero**: Seção principal com call-to-action
3. **Serviços**: Grid de serviços oferecidos
4. **Sobre**: Informações da empresa e estatísticas
5. **Contato**: Formulário de contato e informações
6. **Footer**: Links e redes sociais

## Estrutura de Arquivos

```
nxtai-home/
├── index.html          # Estrutura HTML principal
├── style.css           # Estilos CSS modernos
├── script.js           # Funcionalidades JavaScript
├── logo-nxtai.png      # Logo da empresa
└── README.md           # Esta documentação
```

## Como Usar

1. **Abrir Localmente**: Abra o arquivo `index.html` em qualquer navegador moderno
2. **Servidor Local**: Para melhor experiência, use um servidor local:
   ```bash
   # Com Python
   python -m http.server 8000
   
   # Com Node.js (http-server)
   npx http-server
   
   # Com PHP
   php -S localhost:8000
   ```
3. **Deploy**: Faça upload dos arquivos para qualquer servidor web

## Integração com Firebase

Para integrar com o sistema Firebase existente:

1. **Configurar Firebase**: Adicione as configurações do Firebase no `script.js`
2. **Autenticação**: Substitua as funções de login/registro pelas do Firebase Auth
3. **Firestore**: Conecte os formulários ao Firestore para persistir dados
4. **Hosting**: Use o Firebase Hosting para deploy

### Exemplo de Configuração Firebase

```javascript
// Adicionar no script.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Suas configurações do Firebase
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
```

## Personalização

### Cores
As cores principais estão definidas no `:root` do CSS:
- `--primary-purple`: #8b5cf6
- `--primary-orange`: #f97316
- `--dark-bg`: #0f0f23

### Logo
Substitua o arquivo `logo-nxtai.png` pela sua logo personalizada.

### Conteúdo
Edite o arquivo `index.html` para personalizar:
- Textos e títulos
- Serviços oferecidos
- Informações de contato
- Links das redes sociais

## Compatibilidade

- **Navegadores**: Chrome, Firefox, Safari, Edge (versões modernas)
- **Dispositivos**: Desktop, tablet, smartphone
- **Tecnologias**: HTML5, CSS3, ES6+ JavaScript

## Recursos Utilizados

- **Fontes**: Google Fonts (Inter)
- **Ícones**: Font Awesome 6
- **Animações**: CSS Animations e Transitions
- **Layout**: CSS Grid e Flexbox

## Próximos Passos

1. **Integração Backend**: Conectar formulários às APIs
2. **SEO**: Adicionar meta tags e estrutura de dados
3. **Analytics**: Implementar Google Analytics ou similar
4. **Performance**: Otimizar imagens e recursos
5. **Testes**: Implementar testes automatizados

## Suporte

Para dúvidas ou suporte, entre em contato através do email: samuel@dnxtai.com

