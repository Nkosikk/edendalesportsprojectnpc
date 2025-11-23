const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-2">
              <div className="h-6 w-6 bg-primary-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">ESP</span>
              </div>
              <span className="font-semibold text-sm">Edendale Sports Projects NPC</span>
            </div>
            <p className="text-gray-400 mb-2 text-xs">Premier sports facility booking platform.</p>
            <div className="text-xs text-gray-500">
              <p>© 2025 Edendale Sports Projects NPC.</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-xs">Quick Links</h3>
            <ul className="space-y-1 text-xs text-gray-400">
              <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="/login" className="hover:text-white transition-colors">Login</a></li>
              <li><a href="/register" className="hover:text-white transition-colors">Register</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-xs">Contact</h3>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>Email: info@edendalesports.co.za</li>
              <li>Phone: +27 (0)31 123 4567</li>
              <li>Edendale, KwaZulu-Natal</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;