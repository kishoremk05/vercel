import React from "react";
import SEO from "../components/SEO";

const ArrowIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5l7 7-7 7"
    />
  </svg>
);

interface HomePageProps {
  onTryFree: () => void;
  onDemo: () => void;
  onSelectPlan: (planId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  onTryFree,
  onDemo,
  onSelectPlan,
}) => {
  return (
    <>
      <SEO
        title="ReputationFlow360 | Automate Reviews & Manage Feedback"
        description="AI-powered platform to automate review collection, manage feedback, and grow your business reputation with SMS automation and real-time analytics."
        canonical="https://reputationflow360.com/"
        keywords="review automation software, customer feedback management, online reputation management, google reviews automation, sms review request system, feedback collection platform, small business review software"
      />
      <div className="min-h-screen home-grid-pattern">
        {/* Nav */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-3 lg:py-5 flex items-center justify-between">
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="h-8 w-8 lg:h-12 lg:w-12 rounded-lg bg-gray-900 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </div>
              <a href="#hero">
                <span className="text-lg lg:text-2xl font-semibold text-gray-900">
                  ReputationFlow
                </span>
              </a>
            </div>
            <nav className="hidden md:flex items-center gap-6 lg:gap-10 text-xs lg:text-base font-medium text-gray-600">
              <a
                href="#features"
                className="hover:text-gray-900 transition-colors"
              >
                Features
              </a>
              <a href="#how" className="hover:text-gray-900 transition-colors">
                How it works
              </a>
              <a
                href="#testimonials"
                className="hover:text-gray-900 transition-colors"
              >
                Customers
              </a>
              <a
                href="#pricing"
                className="hover:text-gray-900 transition-colors"
              >
                Pricing
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <button
                onClick={onDemo}
                className="hidden md:block px-4 py-2 text-xs lg:px-6 lg:py-3 lg:text-base text-gray-900 hover:bg-gray-50 font-medium transition-all duration-200 rounded-lg"
              >
                Log in
              </button>
              <button
                onClick={onTryFree}
                className="px-4 py-2 lg:px-6 lg:py-3 rounded-lg lg:rounded-xl bg-gray-900 text-white text-xs lg:text-base font-semibold hover:bg-gray-800 transition-all duration-200"
              >
                Sign up
              </button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section
          className="relative pt-12 pb-16 lg:pt-24 lg:pb-32 mx-6"
          id="hero"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="space-y-8 animate-fade-in">
                <h1 className="text-3xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1]">
                  Fuel your growth with a customer feedback survey tool
                </h1>
                <p className="text-base lg:text-2xl text-gray-600 leading-relaxed max-w-xl">
                  Uncover opportunities, figure out what's working, and fix what
                  isn't. It all starts with asking.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={onTryFree}
                    className="px-5 py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-all duration-200 text-sm"
                  >
                    Get started—it's free
                  </button>
                </div>
                
              </div>
              <div className="relative lg:block animate-fade-in-delayed">
                {/* Yellow Survey Mockup */}
                <div className="relative">
                  {/* Browser Window */}
                  <div className="bg-gradient-to-b from-yellow-300 to-yellow-400 rounded-t-2xl shadow-2xl overflow-hidden border-4 border-gray-900">
                    {/* Browser Dots */}
                    <div className="bg-yellow-200 px-3 py-2.5 flex items-center gap-2 border-b-2 border-yellow-500">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      </div>
                    </div>

                    {/* Survey Content */}
                    <div className="p-6 space-y-5">
                      {/* Question */}
                      <div className="space-y-4">
                        <p className="text-gray-800 text-base font-medium">
                          ⭐ How would you rate the{" "}
                          <span className="font-bold">value</span> for money?
                        </p>
                        <p className="text-xs text-gray-700">
                          1 means <span className="italic">very poor</span>, 5
                          means <span className="italic">excellent</span>
                        </p>
                      </div>

                      {/* Rating Thumbs */}
                      <div className="flex items-center justify-center gap-2.5 py-5">
                        <div className="text-4xl opacity-60">👍</div>
                        <div className="text-4xl opacity-70">👍</div>
                        <div className="text-4xl opacity-80">👍</div>
                        <div className="text-4xl opacity-90">👍</div>
                        <div className="text-4xl">👍</div>
                      </div>

                      {/* Rating Numbers */}
                      <div className="flex items-center justify-center gap-6 text-xs text-gray-700 font-medium">
                        <span>1</span>
                        <span>2</span>
                        <span>3</span>
                        <span>4</span>
                        <span>5</span>
                      </div>

                      {/* OK Button */}
                      <div className="pt-4">
                        <button className="px-5 py-2 bg-white text-gray-900 rounded-lg font-semibold border-2 border-gray-900 hover:bg-gray-100 transition-all text-sm">
                          OK ✓
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Stand */}
                  <div className="h-4 bg-gray-900 rounded-b-2xl"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial Quote */}
        <section className="py-12 bg-white/60">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <blockquote className="text-xl lg:text-3xl font-medium text-gray-900 leading-relaxed">
              "ReputationFlow allowed us to get to the core of what our product
              should be—what features to focus on, and where people are
              struggling."
            </blockquote>
            <p className="mt-5 text-gray-600 font-medium text-sm lg:text-base">
              — Sarah Chen, Product Lead at GrowthCo
            </p>
          </div>
        </section>

        {/* Features - Clean Cards */}
        <section id="features" className="py-16 bg-white/70">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-2xl lg:text-5xl font-bold text-gray-900 mb-3">
                Everything you need to understand your customers
              </h2>
              <p className="text-base text-gray-600 max-w-2xl mx-auto">
                Powerful feedback tools designed for modern businesses
              </p>
            </div>

            {/* Feature List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mx-6">
              <div className="space-y-4">
                <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white text-xl">
                  📊
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Real-time Analytics
                </h3>
                <p className="text-gray-600">
                  Track response rates, sentiment trends, and customer
                  satisfaction scores in beautiful dashboards
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white text-xl">
                  ⭐
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Smart Review Funneling
                </h3>
                <p className="text-gray-600">
                  Direct happy customers to public review sites, capture private
                  feedback from unsatisfied ones
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white text-xl">
                  💬
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Multi-channel Surveys
                </h3>
                <p className="text-gray-600">
                  Reach customers via SMS, email, WhatsApp, and web with
                  personalized survey experiences
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white text-xl">
                  🎯
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Targeted Campaigns
                </h3>
                <p className="text-gray-600">
                  Send surveys at the perfect moment based on customer behavior
                  and interaction timing
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white text-xl">
                  🔔
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Instant Alerts
                </h3>
                <p className="text-gray-600">
                  Get notified immediately when negative feedback arrives so you
                  can respond quickly
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white text-xl">
                  🤖
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  AI-Powered Insights
                </h3>
                <p className="text-gray-600">
                  Automatically categorize feedback and identify trends with
                  machine learning
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how" className="py-16 bg-white/60">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-2xl lg:text-5xl font-bold text-gray-900 mb-3">
                Get started in minutes
              </h2>
              <p className="text-base text-gray-600">
                No complicated setup. Just three simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto">
                  1
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Create your survey
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Choose from templates or build custom questions. Add your
                  branding and Google Review link.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto">
                  2
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Send to customers
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Upload your customer list and send personalized survey
                  requests via SMS, email, or WhatsApp.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto">
                  3
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Watch reviews grow
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Happy customers get directed to review sites. Unhappy ones
                  give private feedback you can act on.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section
          id="pricing"
          className="py-16 bg-gradient-to-b from-white/70 to-white/90"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-2xl lg:text-5xl font-bold text-gray-900 mb-3">
                Simple, transparent pricing
              </h2>
              <p className="text-base text-gray-600">
                Choose the plan that fits your business needs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* 1 Month Plan */}
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8 space-y-6 hover:border-gray-900 transition-all duration-300 hover:shadow-2xl">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900">Starter</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      $30
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      <strong>250 SMS credits</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Real-time analytics</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Smart review funneling</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Email support</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectPlan("starter_1m")}
                  className="w-full px-6 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-all duration-200"
                >
                  Get started
                </button>
              </div>

              {/* 3 Month Plan - Popular */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border-2 border-yellow-400 p-8 space-y-6 relative transform hover:scale-105 transition-all duration-300">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                    MOST POPULAR
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Growth</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">$75</span>
                    <span className="text-gray-300">/3 months</span>
                  </div>
                  <p className="text-sm text-gray-400">Save $15 vs monthly</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-white">
                    <svg
                      className="w-5 h-5 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      <strong>600 SMS credits</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-white">
                    <svg
                      className="w-5 h-5 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Everything in Starter</span>
                  </div>
                  <div className="flex items-center gap-3 text-white">
                    <svg
                      className="w-5 h-5 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Priority support</span>
                  </div>
                  <div className="flex items-center gap-3 text-white">
                    <svg
                      className="w-5 h-5 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Advanced analytics</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectPlan("growth_3m")}
                  className="w-full px-6 py-3 rounded-lg bg-yellow-400 text-gray-900 font-semibold hover:bg-yellow-300 transition-all duration-200"
                >
                  Get started
                </button>
              </div>

              {/* 6 Month Plan */}
              <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8 space-y-6 hover:border-gray-900 transition-all duration-300 hover:shadow-2xl">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Professional
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      $100
                    </span>
                    <span className="text-gray-600">/6 months</span>
                  </div>
                  <p className="text-sm text-gray-600">Save $80 vs monthly</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      <strong>900 SMS credits</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Everything in Growth</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Dedicated account manager</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Custom integrations</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectPlan("pro_6m")}
                  className="w-full px-6 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-all duration-200"
                >
                  Get started
                </button>
              </div>
            </div>

            <div className="text-center mt-12">
              <p className="text-sm text-gray-600">
                All plans include unlimited users, feedback collection, and
                review management
              </p>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section id="testimonials" className="py-16 bg-white/70">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="text-2xl lg:text-5xl font-bold text-gray-900 mb-3">
                Trusted by growing businesses
              </h2>
              <p className="text-base text-gray-600">
                Join thousands of companies using ReviewFlow to improve their
                online reputation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  quote:
                    "We tripled our Google reviews in just 2 months. The smart funneling feature is a game-changer for protecting our reputation.",
                  author: "Aarav Sharma",
                  role: "Owner, FreshBites Restaurant",
                },
                {
                  quote:
                    "Our response rate jumped from 7% to 28%. The analytics dashboard gives us incredible insights into customer satisfaction.",
                  author: "Maya Patel",
                  role: "Marketing Director, Glow Spa",
                },
                {
                  quote:
                    "Simple to use and incredibly effective. We catch negative feedback before it hits Google and turn it into improvements.",
                  author: "Rohit Verma",
                  role: "CEO, QuickFix Auto Repair",
                },
              ].map((testimonial, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl p-6 space-y-5">
                  <div className="flex gap-1 text-yellow-500 text-lg">
                    ★★★★★
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                  <div>
                    <p className="font-bold text-gray-900">
                      {testimonial.author}
                    </p>
                    <p className="text-xs text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-gray-900/90 text-white">
          <div className="mx-auto max-w-4xl px-6 text-center space-y-8">
            <h2 className="text-2xl lg:text-5xl font-bold">
              Ready to transform your online reputation?
            </h2>
            <p className="text-base text-gray-300">
              Start collecting more reviews and valuable feedback today. No
              credit card required.
            </p>
            <button
              onClick={onTryFree}
              className="px-5 py-2.5 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all duration-200 text-sm inline-flex items-center gap-2"
            >
              Get started—it's free
              <ArrowIcon className="w-5 h-5" />
            </button>
            <p className="text-sm text-gray-400">
              Join 1,000+ businesses already using ReviewFlow
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white/80">
          <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
                <nav className="flex flex-col gap-3 text-sm text-gray-600">
                  <a
                    href="#features"
                    className="hover:text-gray-900 transition-colors"
                  >
                    Features
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Pricing
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Integrations
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    API
                  </a>
                </nav>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
                <nav className="flex flex-col gap-3 text-sm text-gray-600">
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    About
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Blog
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Careers
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Contact
                  </a>
                </nav>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Resources</h4>
                <nav className="flex flex-col gap-3 text-sm text-gray-600">
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Help Center
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Community
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Templates
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Webinars
                  </a>
                </nav>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
                <nav className="flex flex-col gap-3 text-sm text-gray-600">
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Privacy
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Terms
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    Security
                  </a>
                  <a href="#" className="hover:text-gray-900 transition-colors">
                    GDPR
                  </a>
                </nav>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-gray-900 rounded"></div>
                <span className="font-semibold text-gray-900">
                  ReputationFlow
                </span>
              </div>
              <p>© 2025 ReputationFlow. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default HomePage;
