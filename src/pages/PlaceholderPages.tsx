import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import { RegisterRequest } from '../types';

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterRequest & { confirmPassword: string }>();

  const password = watch('password');

  const onSubmit = async (data: RegisterRequest & { confirmPassword: string }) => {
    if (loading) return; // Prevent multiple submissions
    setFormError(null);
    try {
      setLoading(true);
      // Remove confirmPassword and format phone number before sending to API
      const { confirmPassword, ...registerData } = data;
      // Format phone number: remove leading 0 if present, then add +27
      if (registerData.phone) {
        const cleanPhone = registerData.phone.startsWith('0') 
          ? registerData.phone.slice(1) 
          : registerData.phone;
        registerData.phone = `+27${cleanPhone}`;
      }
      await registerUser(registerData);
      navigate('/app');
    } catch (error: any) {
      // Show backend error message if available
      const message = error?.response?.data?.message || error?.message || 'Registration failed';
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 pt-4 pb-2 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-2">
        <div>
          <div className="flex justify-center">
            <div className="h-12 w-12 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">ESP</span>
            </div>
          </div>
          <h2 className="mt-1 text-center text-xl font-bold text-gray-900">
            Create your account
          </h2>
          <p className="mt-1 text-center text-sm text-gray-700">
            Join thousands of athletes • Premium facilities • Easy booking
          </p>
          <p className="mt-1 text-center text-xs text-gray-600">
            Or{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>
        
        <form className="mt-2 space-y-2" onSubmit={handleSubmit(onSubmit)}>
          {formError && (
            <div className="mb-1 text-xs text-error-600 bg-error-100 p-2 rounded">
              {formError}
            </div>
          )}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="first_name" className="label">
                  First Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('first_name', {
                      required: 'First name is required',
                      minLength: {
                        value: 2,
                        message: 'First name must be at least 2 characters',
                      },
                    })}
                    type="text"
                    className="input pl-10"
                    placeholder="First name"
                  />
                </div>
                {errors.first_name && (
                  <p className="mt-0.5 text-xs text-error-600">{errors.first_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="last_name" className="label">
                  Last Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('last_name', {
                      required: 'Last name is required',
                      minLength: {
                        value: 2,
                        message: 'Last name must be at least 2 characters',
                      },
                    })}
                    type="text"
                    className="input pl-10"
                    placeholder="Last name"
                  />
                </div>
                {errors.last_name && (
                  <p className="mt-0.5 text-xs text-error-600">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  type="email"
                  className="input pl-10"
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-0.5 text-xs text-error-600">{errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="label">
                  Phone Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('phone', {
                      required: 'Phone number is required',
                      pattern: {
                        value: /^0?[0-9]{9}$/,
                        message: 'Please enter a valid 9-digit phone number (e.g., 828167854 or 0828167854)',
                      },
                    })}
                    type="tel"
                    className="input pl-10"
                    placeholder="0828167854"
                    maxLength={10}
                  />
                </div>
                {errors.phone && (
                  <p className="mt-0.5 text-xs text-error-600">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                      pattern: {
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-0.5 text-xs text-error-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === password || 'Passwords do not match',
                  })}
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-10"
                  placeholder="Confirm your password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-0.5 text-xs text-error-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-start pt-1">
            <input
              id="agree-terms"
              name="agree-terms"
              type="checkbox"
              required
              className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
            />
            <label htmlFor="agree-terms" className="ml-2 block text-xs text-gray-900">
              I agree to{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                Privacy Policy
              </a>
            </label>
          </div>

          <div>
            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              Create Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
// BookingsPage now has its own file
const BookingDetailsPage = () => <div>Booking Details Page - Coming Soon</div>;
const CreateBookingPage = () => <div>Create Booking Page - Coming Soon</div>;
const ProfilePage = () => <div>Profile Page - Coming Soon</div>;
const AdminDashboardPage = () => <div>Admin Dashboard - Coming Soon</div>;
const FieldManagementPage = () => <div>Field Management - Coming Soon</div>;
const UserManagementPage = () => <div>User Management - Coming Soon</div>;
const NotFoundPage = () => <div>404 - Page Not Found</div>;

export { 
  RegisterPage, 
  BookingDetailsPage, 
  CreateBookingPage, 
  ProfilePage, 
  AdminDashboardPage, 
  FieldManagementPage, 
  UserManagementPage, 
  NotFoundPage 
};