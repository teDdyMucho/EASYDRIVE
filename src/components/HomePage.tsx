import { useEffect, useRef, useState } from 'react';
import { Truck, Package, MapPin, Clock, CheckCircle, ArrowRight, X } from 'lucide-react';

interface HomePageProps {
  onLogin: () => void;
}

export default function HomePage({ onLogin }: HomePageProps) {
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [gisReady, setGisReady] = useState(false);
  const [gisError, setGisError] = useState<string | null>(null);

  const openSignIn = () => setIsSignInOpen(true);
  const closeSignIn = () => setIsSignInOpen(false);

  useEffect(() => {
    if (!isSignInOpen) return;

    setGisError(null);
    setGisReady(false);

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setGisError('Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID in .env and restart the dev server.');
      return;
    }

    if ((window as any)?.google?.accounts?.id) {
      setGisReady(true);
      return;
    }

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      const timer = window.setInterval(() => {
        if ((window as any)?.google?.accounts?.id) {
          window.clearInterval(timer);
          setGisReady(true);
        }
      }, 50);
      window.setTimeout(() => window.clearInterval(timer), 5000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGisReady(true);
    script.onerror = () => setGisError('Failed to load Google Sign-In. Please try again.');
    document.head.appendChild(script);
  }, [isSignInOpen]);

  useEffect(() => {
    if (!isSignInOpen) return;
    if (!gisReady) return;
    if (!googleButtonRef.current) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const google = (window as any).google as any;
    if (!google?.accounts?.id) {
      setGisError('Google Sign-In is not available. Please refresh and try again.');
      return;
    }

    googleButtonRef.current.innerHTML = '';

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: any) => {
        const credential = response?.credential;
        if (!credential) {
          setGisError('Sign-in failed. Please try again.');
          return;
        }

        try {
          localStorage.setItem('ed_googleCredential', credential);
        } catch {
          // ignore
        }

        closeSignIn();
        onLogin();
      },
    });

    google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: googleButtonRef.current.clientWidth ? String(googleButtonRef.current.clientWidth) : undefined,
    });
  }, [gisReady, isSignInOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="hidden sm:block bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Truck className="w-8 h-8 text-cyan-500" />
              <span className="text-xl font-bold text-gray-800">EASYDRIVE</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#home" className="text-gray-700 hover:text-cyan-500 transition-colors">Home</a>
              <a href="#services" className="text-gray-700 hover:text-cyan-500 transition-colors">Services</a>
              <a href="#pricing" className="text-gray-700 hover:text-cyan-500 transition-colors">Pricing</a>
              <a href="#contact" className="text-gray-700 hover:text-cyan-500 transition-colors">Contact</a>
            </div>
            <button
              onClick={openSignIn}
              className="hidden sm:inline-flex bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600 transition-colors font-medium"
            >
              Sign In with Google
            </button>
          </div>
        </div>
      </nav>

      <div className="relative bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 text-white py-20 pb-32 overflow-visible min-h-[calc(10vh-4rem)] sm:min-h-[calc(85vh-4rem)] flex items-center">
        <div className="absolute inset-0 bg-black opacity-40"></div>
        <div className="absolute inset-0 hidden sm:block" style={{
          backgroundImage: 'url(https://images.pexels.com/photos/1213294/pexels-photo-1213294.jpeg?auto=compress&cs=tinysrgb&w=1920)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.3
        }}></div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            Vehicle Transportation
            <span className="block text-cyan-400 mt-2">Made Simple</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-3xl mx-auto">
            Get instant one-way transportation pricing, place orders, upload documents, and track your vehicle deliveries in real-time
          </p>
          <button
            onClick={openSignIn}
            className="inline-flex items-center bg-cyan-500 text-white px-8 py-4 rounded-lg hover:bg-cyan-600 transition-all transform hover:scale-105 font-semibold text-lg shadow-lg"
          >
            Get Started <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative -mt-16 mb-12 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="floating bg-white/25 backdrop-blur-xl rounded-lg p-8 border border-white/80 hover:border-cyan-300 hover:bg-white/65 transition-all duration-300 shadow-xl min-h-[120px] sm:min-h-[200px] flex flex-col justify-center">
              <div className="text-4xl font-bold text-gray-900">1000+</div>
              <div className="text-gray-900 mt-3 font-medium">Vehicles Transported</div>
            </div>
            <div className="floating bg-white/25 backdrop-blur-xl rounded-lg p-8 border border-white/80 hover:border-cyan-300 hover:bg-white/65 transition-all duration-300 shadow-xl min-h-[120px] sm:min-h-[200px] flex flex-col justify-center" style={{ animationDelay: '0.2s' }}>
              <div className="text-4xl font-bold text-gray-900">24/7</div>
              <div className="text-gray-900 mt-3 font-medium">Support Available</div>
            </div>
            <div className="floating bg-white/25 backdrop-blur-xl rounded-lg p-8 border border-white/80 hover:border-cyan-300 hover:bg-white/65 transition-all duration-300 shadow-xl min-h-[120px] sm:min-h-[200px] flex flex-col justify-center" style={{ animationDelay: '0.4s' }}>
              <div className="text-4xl font-bold text-gray-900">98%</div>
              <div className="text-gray-900 mt-3 font-medium">On-Time Delivery</div>
            </div>
          </div>
        </div>
      </div>

      {isSignInOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSignIn();
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <div className="text-lg font-semibold text-gray-900">Sign in</div>
                <div className="text-sm text-gray-500">Continue to EASYDRIVE</div>
              </div>
              <button
                type="button"
                onClick={closeSignIn}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5">
              {gisError && <div className="mb-3 text-sm font-medium text-red-600">{gisError}</div>}

              <div className="w-full">
                {!gisReady && !gisError && (
                  <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 text-center">
                    Loading Google Sign-In...
                  </div>
                )}
                <div ref={googleButtonRef} className="w-full flex justify-center"></div>
              </div>

              <div className="mt-4 text-xs text-gray-500 text-center">
                By continuing, you agree to our terms and privacy policy.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden bg-gradient-to-b from-gray-50 via-gray-50 to-white py-20" style={{
        background: 'linear-gradient(to bottom, rgba(249,250,251,0.5) 0%, rgba(249,250,251,0.8) 30%, rgb(255,255,255) 100%)',
        backdropFilter: 'blur(1px)'
      }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/60 via-white/30 to-transparent backdrop-blur-xl"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Why Choose EASYDRIVE?</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A complete transportation solution designed for car dealerships and retail customers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center group">
            <div className="bg-cyan-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-cyan-500 transition-colors">
              <MapPin className="w-8 h-8 text-cyan-500 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Instant Pricing</h3>
            <p className="text-gray-600">
              Get real-time quotes for pickup or delivery services instantly
            </p>
          </div>

          <div className="text-center group">
            <div className="bg-cyan-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-cyan-500 transition-colors">
              <Package className="w-8 h-8 text-cyan-500 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Easy Ordering</h3>
            <p className="text-gray-600">
              Place orders quickly with our streamlined booking process
            </p>
          </div>

          <div className="text-center group">
            <div className="bg-cyan-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-cyan-500 transition-colors">
              <Clock className="w-8 h-8 text-cyan-500 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Real-Time Tracking</h3>
            <p className="text-gray-600">
              Monitor your vehicle's journey from pickup to delivery
            </p>
          </div>

          <div className="text-center group">
            <div className="bg-cyan-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-cyan-500 transition-colors">
              <CheckCircle className="w-8 h-8 text-cyan-500 group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Document Upload</h3>
            <p className="text-gray-600">
              Securely upload vehicle release forms and work orders
            </p>
          </div>
        </div>
        </div>
      </div>

      <div className="bg-gray-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Perfect for Dealers & Retail Customers</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-cyan-400 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">One-Way Transportation</h4>
                    <p className="text-gray-300">Flexible pickup or delivery options to meet your needs</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-cyan-400 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Transparent Pricing</h4>
                    <p className="text-gray-300">No hidden fees, get accurate quotes instantly</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-cyan-400 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Secure Documentation</h4>
                    <p className="text-gray-300">Upload and manage all necessary paperwork digitally</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-6 h-6 text-cyan-400 mr-3 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Order Management</h4>
                    <p className="text-gray-300">Track all your transportation orders in one place</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-700 p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-6">Ready to Get Started?</h3>
              <p className="text-gray-300 mb-6">
                Join hundreds of dealers and customers who trust EASYDRIVE for their vehicle transportation needs.
              </p>
              <button
                onClick={openSignIn}
                className="w-full bg-cyan-500 text-white px-6 py-3 rounded-lg hover:bg-cyan-600 transition-colors font-semibold flex items-center justify-center"
              >
                Sign In with Google <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Truck className="w-6 h-6 text-cyan-500" />
            <span className="text-lg font-bold text-white">EASYDRIVE TRANSPORTATION PORTAL</span>
          </div>
          <p>&copy; 2024 EasyDrive Transportation. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
