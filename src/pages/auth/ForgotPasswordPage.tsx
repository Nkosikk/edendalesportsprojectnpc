import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await authService.forgotPassword(email);
      setSubmitted(true);
      toast.success('Check your email for password reset instructions');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <div className="mb-6">
          <Link 
            to="/login"
            className="inline-flex items-center gap-2 text-white hover:text-primary-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8">
          {!submitted ? (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-lg mb-4">
                  <Mail className="w-6 h-6 text-primary-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
                <p className="text-gray-600 text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  loading={loading}
                >
                  Send Reset Link
                </Button>
              </form>

              {/* Help Text */}
              <p className="text-center text-sm text-gray-600 mt-6">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
                  Sign In
                </Link>
              </p>
            </>
          ) : (
            <>
              {/* Success Message */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email</h2>
                <p className="text-gray-600 mb-6">
                  We've sent a password reset link to <span className="font-medium">{email}</span>
                </p>
                <p className="text-sm text-gray-500 mb-8">
                  The link will expire in 1 hour. If you don't see the email, check your spam folder.
                </p>

                <Button 
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Back to Login
                </Button>

                <button
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  className="w-full mt-3 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Try Another Email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
