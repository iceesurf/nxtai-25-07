import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  BoltIcon, 
  EnvelopeIcon,
  ArrowLeftIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido')
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await resetPassword(data.email);
      setSentEmail(data.email);
      setEmailSent(true);
      toast.success('Email de recuperação enviado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email de recuperação');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Logo */}
          <div>
            <Link to="/" className="inline-flex items-center space-x-2">
              <BoltIcon className="h-12 w-12 text-blue-500" />
              <span className="text-3xl font-bold">NXT.AI</span>
            </Link>
          </div>

          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="h-8 w-8 text-white" />
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Email enviado!</h2>
            <p className="text-gray-400">
              Enviamos um link de recuperação de senha para:
            </p>
            <p className="text-white font-medium text-lg">{sentEmail}</p>
            <p className="text-gray-400 text-sm">
              Verifique sua caixa de entrada e spam. O link expira em 1 hora.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <button
              onClick={() => {
                setEmailSent(false);
                setSentEmail('');
              }}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition"
            >
              Enviar para outro email
            </button>
            
            <Link
              to="/login"
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition text-center"
            >
              Voltar ao login
            </Link>
          </div>

          {/* Help */}
          <div className="text-center text-sm text-gray-400">
            <p>Não recebeu o email?</p>
            <button
              onClick={() => onSubmit({ email: sentEmail })}
              className="text-blue-500 hover:text-blue-400 underline"
            >
              Reenviar email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center space-x-2">
            <BoltIcon className="h-12 w-12 text-blue-500" />
            <span className="text-3xl font-bold">NXT.AI</span>
          </Link>
          <h2 className="mt-6 text-3xl font-bold">Recuperar senha</h2>
          <p className="mt-2 text-gray-400">
            Insira seu email para receber o link de recuperação
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@email.com"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>
        </form>

        {/* Back to Login */}
        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-blue-500 hover:text-blue-400 transition"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar ao login
          </Link>
        </div>

        {/* Help Section */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold">Precisa de ajuda?</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <p>Verifique se o email está correto</p>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <p>Olhe na pasta de spam/lixo eletrônico</p>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <p>O link expira em 1 hora após o envio</p>
            </div>
          </div>
          <div className="pt-3 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Ainda com problemas?{' '}
              <a
                href="mailto:support@nxtai.com"
                className="text-blue-500 hover:text-blue-400"
              >
                Entre em contato
              </a>
            </p>
          </div>
        </div>

        {/* Alternative Login */}
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-900 text-gray-400">Ou tente</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition flex items-center justify-center">
              <img src="/google.svg" alt="Google" className="h-5 w-5 mr-2" />
              Google
            </button>
            <button className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition flex items-center justify-center">
              <img src="/github.svg" alt="GitHub" className="h-5 w-5 mr-2" />
              GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;