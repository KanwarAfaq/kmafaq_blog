import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import GoogleAnalytics from './components/GoogleAnalytics';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <GoogleAnalytics />
        <AuthProvider>
          <App />
          <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);

// Privacy-friendly, cookieless analytics (Vercel Web Analytics + Speed Insights), loaded after the page is idle.
const startAnalytics = () => {
  if (import.meta.env.DEV || navigator.webdriver) return;
  import('@vercel/analytics').then((m) => m.inject()).catch(() => {});
  import('@vercel/speed-insights').then((m) => m.injectSpeedInsights()).catch(() => {});
};
if (document.readyState === 'complete') setTimeout(startAnalytics, 1500);
else window.addEventListener('load', () => setTimeout(startAnalytics, 1500), { once: true });
