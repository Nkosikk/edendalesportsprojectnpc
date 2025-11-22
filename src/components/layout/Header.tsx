import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Settings, Calendar, Home, Users, Building, BarChart3, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import LogoImg from '../../assets/images/ESP-BLUE-2.png';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsProfileOpen(false);
  };

  const navigation = isAuthenticated ? [
    { name: 'Dashboard', href: '/app', icon: Home },
    { name: 'Bookings', href: '/app/bookings', icon: Calendar },
  ] : [];

  const adminNavigation = [
    { name: 'Dashboard', href: '/admin', icon: BarChart3 },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
    { name: 'Fields', href: '/admin/fields', icon: Building },
    { name: 'Revenue', href: '/admin/reports/revenue', icon: FileText },
    { name: 'Analytics', href: '/admin/reports/analytics', icon: BarChart3 },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-1">
          {/* Logo */}
          <Link to="/" className="flex flex-col items-center">
            <img
              src={LogoImg}
              alt="Edendale Sports Logo"
              className="h-32 w-auto object-contain"
            />
            <div className="text-center -mt-4">
              <div className="text-lg font-bold text-gray-900">Edendale Sports Projects</div>
              <div className="text-xs text-gray-600">(ESP)</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                  location.pathname === item.href
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.name}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <div className="relative">
                <button
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    location.pathname.startsWith('/admin')
                      ? 'text-primary-600 border-b-2 border-primary-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </button>
                {isAdminOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      {adminNavigation.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsAdminOpen(false)}
                        >
                          <item.icon className="h-4 w-4 mr-2" />
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{user?.first_name}</span>
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <Link
                        to="/app/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/"
                  className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    location.pathname === '/'
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Home className="h-4 w-4 mr-1" />
                  Home
                </Link>
                <Link to="/register">
                  <Button 
                    variant={location.pathname === '/register' ? 'primary' : 'outline'} 
                    size="sm"
                  >
                    Register
                  </Button>
                </Link>
                <Link to="/login">
                  <Button 
                    variant={location.pathname === '/login' ? 'primary' : 'outline'} 
                    size="sm"
                  >
                    Login
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    location.pathname === item.href
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              ))}
              {user?.role === 'admin' && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Admin</div>
                  {adminNavigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                        location.pathname === item.href
                          ? 'text-primary-600 bg-primary-50'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
              
              {/* Mobile Auth */}
              <div className="border-t border-gray-200 pt-4">
                {isAuthenticated ? (
                  <div className="space-y-1">
                    <Link
                      to="/app/profile"
                      className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <User className="h-5 w-5 mr-3" />
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="h-5 w-5 mr-3" />
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/"
                      className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Home className="h-5 w-5 mr-3" />
                      Home
                    </Link>
                    <Link
                      to="/register"
                      className="block w-full"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Button 
                        variant={location.pathname === '/register' ? 'primary' : 'outline'} 
                        size="sm" 
                        className="w-full"
                      >
                        Register
                      </Button>
                    </Link>
                    <Link
                      to="/login"
                      className="block w-full"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Button 
                        variant={location.pathname === '/login' ? 'primary' : 'outline'} 
                        size="sm" 
                        className="w-full"
                      >
                        Login
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;