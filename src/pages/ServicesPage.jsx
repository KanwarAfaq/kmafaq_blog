import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import SectionHeading from '../components/SectionHeading';
import ServiceCard from '../components/ServiceCard';
import { useServices } from '../hooks/useServices';

export default function ServicesPage() {
  const { services, loading } = useServices();

  return (
    <>
      <SEO
        title="Services"
        path="/services"
        description="Hire KM Afaq for AI automation, React web development, and practical technology consulting."
      />
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Professional services"
            title="Technology services built around outcomes"
            description="Choose a focused service or contact KM Afaq for a custom scope tailored to your workflow, product, or business."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl bg-gray-100" />)
              : services.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>

          <div className="mt-12 rounded-3xl bg-gradient-to-r from-primary to-secondary p-8 text-white sm:p-10">
            <h2 className="text-2xl font-bold sm:text-3xl">Need a custom solution?</h2>
            <p className="mt-3 max-w-2xl text-blue-50">Share your goal, current workflow, and desired result. You can then define the right technical scope before development begins.</p>
            <Link to="/contact" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-primary shadow-sm hover:bg-blue-50">
              Discuss your project
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
