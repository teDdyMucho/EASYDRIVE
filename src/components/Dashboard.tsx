import { useMemo } from 'react';
import { Truck, User, LogOut } from 'lucide-react';
import FileUploadSection from './FileUploadSection';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const accountLabel = useMemo(() => {
    try {
      const token = localStorage.getItem('ed_googleCredential');
      if (!token) return 'Account';

      const parts = token.split('.');
      if (parts.length < 2) return 'Account';

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

      const json = atob(padded);
      const payload = JSON.parse(json) as { name?: string; email?: string };
      return payload?.name || payload?.email || 'Account';
    } catch {
      return 'Account';
    }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('ed_googleCredential');
    } catch {
      // ignore
    }
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2">
              <Truck className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-500" />
              <span className="text-lg sm:text-xl font-bold text-gray-800">EASYDRIVE</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-gray-700">
                <User className="w-5 h-5" />
                <span className="font-medium">{accountLabel}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-cyan-500 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">Welcome to Your Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your transportation orders and documents</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 sm:p-6">
            <FileUploadSection />
          </div>
        </div>
      </div>
    </div>
  );
}
