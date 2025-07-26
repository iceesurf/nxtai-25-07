import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard')
    } else {
      navigate('/login')
    }
  }

  const features = [
    {
      icon: '🤖',
      title: 'IA Conversacional',
      description: 'Chatbots inteligentes com Dialogflow CX para atendimento automatizado'
    },
    {
      icon: '📊',
      title: 'Analytics Avançado',
      description: 'Métricas detalhadas e insights sobre suas conversas e leads'
    },
    {
      icon: '🎯',
      title: 'Gestão de Campanhas',
      description: 'Crie e gerencie campanhas de marketing eficazes'
    },
    {
      icon: '💬',
      title: 'Chat Multicanal',
      description: 'WhatsApp, Telegram e outros canais integrados'
    },
    {
      icon: '🔗',
      title: 'CRM Integrado',
      description: 'Gerencie leads e clientes em um só lugar'
    },
    {
      icon: '⚡',
      title: 'Automação',
      description: 'Fluxos automatizados para aumentar sua produtividade'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">NXT.AI</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Começar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 mb-8">
            Transforme seu
            <span className="text-indigo-600"> Atendimento</span>
            <br />
            com Inteligência Artificial
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            Plataforma completa de IA conversacional para automatizar atendimento, 
            gerar leads qualificados e aumentar suas vendas através de chatbots inteligentes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleGetStarted}
              className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
            >
              Começar Agora
            </button>
            <button className="text-indigo-600 border border-indigo-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-50 transition-colors">
              Ver Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Recursos Poderosos
          </h2>
          <p className="text-xl text-gray-600">
            Tudo que você precisa para automatizar e escalar seu negócio
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-indigo-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Resultados Comprovados
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-white mb-2">+500%</div>
              <div className="text-indigo-200">Aumento em Conversões</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">24/7</div>
              <div className="text-indigo-200">Atendimento Automatizado</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">-80%</div>
              <div className="text-indigo-200">Redução de Custos</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gray-900 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto para Revolucionar seu Atendimento?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Junte-se a centenas de empresas que já transformaram seus resultados
          </p>
          <button
            onClick={handleGetStarted}
            className="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
          >
            Começar Gratuitamente
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-4">NXT.AI</h3>
            <p className="text-gray-400 mb-8">
              Inteligência Artificial para o Futuro dos Negócios
            </p>
            <div className="border-t border-gray-800 pt-8">
              <p className="text-gray-500">
                © 2025 NXT.AI. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}