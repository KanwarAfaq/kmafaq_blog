import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Loader from './components/Loader';
import RequireAuth from './components/RequireAuth';

const HomePage = lazy(() => import('./pages/HomePage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'));
const LineSubscribePage = lazy(() => import('./pages/LineSubscribePage'));
const LinePreferencesPage = lazy(() => import('./pages/LinePreferencesPage'));
const PremiumAlertsPage = lazy(() => import('./pages/PremiumAlertsPage'));
const BusinessDirectoryPage = lazy(() => import('./pages/BusinessDirectoryPage'));
const BusinessDetailPage = lazy(() => import('./pages/BusinessDetailPage'));
const ToolsDirectoryPage = lazy(() => import('./pages/ToolsDirectoryPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const DigitalProductsPage = lazy(() => import('./pages/DigitalProductsPage'));
const DigitalProductDetailPage = lazy(() => import('./pages/DigitalProductDetailPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const PostJobPage = lazy(() => import('./pages/PostJobPage'));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'));
const AdminRevenuePage = lazy(() => import('./pages/AdminRevenuePage'));
const AdminMonetizationPage = lazy(() => import('./pages/AdminMonetizationPage'));

export default function App() {
  return (
    <Suspense fallback={<Loader label="Loading page..." />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="blog/urdu" element={<BlogPage language="ur" />} />
          <Route path="blog/english" element={<BlogPage language="en" />} />
          <Route path="blog/:slug" element={<BlogPostPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="line" element={<LineSubscribePage />} />
          <Route path="line/preferences" element={<LinePreferencesPage />} />
          <Route path="alerts" element={<RequireAuth><PremiumAlertsPage /></RequireAuth>} />
          <Route path="business" element={<BusinessDirectoryPage />} />
          <Route path="business/:slug" element={<BusinessDetailPage />} />
          <Route path="tools" element={<ToolsDirectoryPage />} />
          <Route path="shop" element={<DigitalProductsPage />} />
          <Route path="shop/:slug" element={<DigitalProductDetailPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/post" element={<PostJobPage />} />
          <Route path="jobs/:slug" element={<JobDetailPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="admin/revenue" element={<RequireAuth><AdminRevenuePage /></RequireAuth>} />
          <Route path="admin/monetization" element={<RequireAuth><AdminMonetizationPage /></RequireAuth>} />
          <Route path="login" element={<LoginPage />} />
          <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="profile/notifications" element={<RequireAuth><NotificationSettingsPage /></RequireAuth>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
