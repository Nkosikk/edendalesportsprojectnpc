const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">ESP</span>
              </div>
              <span className="font-semibold text-lg">Edendale Sports Projects NPC</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              Premier sports facility booking platform providing access to quality sports fields 
              and facilities across the region.
            </p>
            <div className="text-sm text-gray-400">
              <p>© 2025 Edendale Sports Projects NPC. All rights reserved.</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="/login" className="hover:text-white transition-colors">Login</a></li>
              <li><a href="/register" className="hover:text-white transition-colors">Register</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contact Info</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Email: info@edendalesports.co.za</li>
              <li>Phone: +27 (0)31 123 4567</li>
              <li>Address: Edendale, KwaZulu-Natal</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;