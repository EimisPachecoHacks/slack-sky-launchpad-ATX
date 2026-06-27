import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import GlowingCardWrapper from '../components/ui/GlowingCardWrapper';
import Button from '../components/ui/Button';
import Particles from '../components/ui/Particles';
import { 
  Check, 
  X, 
  Star, 
  Zap, 
  Crown, 
  Building, 
  Users, 
  Shield,
  Sparkles,
  ArrowRight,
  HelpCircle
} from 'lucide-react';

const Pricing: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for individuals and small projects',
      icon: <Zap className="w-8 h-8 text-blue-400" />,
      price: {
        monthly: 0,
        annual: 0
      },
      popular: false,
      features: [
        '3 architecture projects',
        'Basic AI recommendations',
        'Standard templates',
        'Community support',
        'Export to PNG/PDF',
        'Basic cost estimation'
      ],
      limitations: [
        'No team collaboration',
        'No custom templates',
        'No API access',
        'No priority support'
      ],
      cta: 'Get Started Free',
      highlight: false
    },
    {
      name: 'Professional',
      description: 'For growing teams and advanced projects',
      icon: <Star className="w-8 h-8 text-purple-400" />,
      price: {
        monthly: 29,
        annual: 24
      },
      popular: true,
      features: [
        'Unlimited projects',
        'Advanced AI recommendations',
        'Premium templates library',
        'Team collaboration (up to 5 members)',
        'Infrastructure as Code generation',
        'Advanced cost optimization',
        'Version control integration',
        'Priority email support',
        'Custom templates',
        'API access (10K calls/month)'
      ],
      limitations: [
        'Limited to 5 team members',
        'No enterprise security features',
        'No dedicated support'
      ],
      cta: 'Start Free Trial',
      highlight: true
    },
    {
      name: 'Enterprise',
      description: 'For large organizations with advanced needs',
      icon: <Crown className="w-8 h-8 text-gold-400" />,
      price: {
        monthly: 99,
        annual: 79
      },
      popular: false,
      features: [
        'Everything in Professional',
        'Unlimited team members',
        'Enterprise security & compliance',
        'SSO integration',
        'Advanced analytics & reporting',
        'Custom integrations',
        'Dedicated account manager',
        '24/7 phone & chat support',
        'On-premise deployment option',
        'Unlimited API calls',
        'Custom training sessions'
      ],
      limitations: [],
      cta: 'Contact Sales',
      highlight: false
    }
  ];

  const faqs = [
    {
      question: 'Can I change my plan at any time?',
      answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any billing differences.'
    },
    {
      question: 'What happens to my projects if I downgrade?',
      answer: 'Your existing projects remain accessible, but you may lose access to premium features. We\'ll help you transition smoothly.'
    },
    {
      question: 'Do you offer discounts for educational institutions?',
      answer: 'Yes, we offer special pricing for educational institutions and non-profit organizations. Contact our sales team for details.'
    },
    {
      question: 'Is there a free trial for paid plans?',
      answer: 'Yes, all paid plans come with a 14-day free trial. No credit card required to start your trial.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, PayPal, and can arrange invoicing for enterprise customers.'
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your billing period.'
    }
  ];

  const getPrice = (plan: typeof plans[0]) => {
    const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.annual;
    return price === 0 ? 'Free' : `$${price}`;
  };

  const getSavings = (plan: typeof plans[0]) => {
    if (plan.price.monthly === 0) return null;
    const monthlyCost = plan.price.monthly * 12;
    const annualCost = plan.price.annual * 12;
    const savings = Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
    return savings;
  };

  return (
    <div className="min-h-screen text-white">
      <Particles />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="inline-block bg-purple-900/30 text-purple-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              💎 Simple, Transparent Pricing
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Choose the Perfect Plan
              <span className="block bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-500 text-transparent bg-clip-text">
                For Your Team
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Start free and scale as you grow. All plans include our core features 
              with no hidden fees or surprise charges.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4">
              <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-400'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  billingCycle === 'annual' ? 'bg-purple-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm ${billingCycle === 'annual' ? 'text-white' : 'text-gray-400'}`}>
                Annual
              </span>
              {billingCycle === 'annual' && (
                <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-medium">
                  Save up to 20%
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                variant={plan.highlight ? 'gradient' : 'glass'} 
                className={`p-8 relative ${plan.highlight ? 'scale-105 border-2 border-purple-500/50' : ''}`}
                hover={true}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
                    {plan.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-gray-400 mb-6">{plan.description}</p>
                  
                  <div className="mb-6">
                    <div className="text-4xl font-bold mb-2">
                      {getPrice(plan)}
                      {plan.price.monthly > 0 && (
                        <span className="text-lg text-gray-400 font-normal">
                          /{billingCycle === 'monthly' ? 'month' : 'month'}
                        </span>
                      )}
                    </div>
                    {billingCycle === 'annual' && getSavings(plan) && (
                      <div className="text-green-400 text-sm">
                        Save {getSavings(plan)}% annually
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    className="w-full" 
                    variant={plan.highlight ? 'primary' : 'outline'}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">What's included:</h4>
                  <ul className="space-y-3">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start space-x-3">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {plan.limitations.length > 0 && (
                    <>
                      <h4 className="font-semibold text-lg mt-6">Not included:</h4>
                      <ul className="space-y-3">
                        {plan.limitations.map((limitation, lIndex) => (
                          <li key={lIndex} className="flex items-start space-x-3">
                            <X className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-500">{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Enterprise Features */}
        <section className="container mx-auto px-4 py-16">
          <GlowingCardWrapper glowColor="green">
            <Card variant="glass" className="p-12">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center space-x-3 mb-6">
                  <Building className="w-8 h-8 text-blue-400" />
                  <h2 className="text-3xl font-bold">Enterprise Solutions</h2>
                </div>
                <p className="text-xl text-gray-300 mb-8">
                  Need something more? We offer custom enterprise solutions with 
                  dedicated support, on-premise deployment, and tailored features.
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-green-400" />
                    <span>SOC 2 Type II compliance</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-green-400" />
                    <span>Unlimited team members</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <Sparkles className="w-5 h-5 text-green-400" />
                    <span>Custom integrations & features</span>
                  </li>
                </ul>
                <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                  Contact Sales Team
                </Button>
              </div>
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
                  <Crown className="w-16 h-16 text-gold-400" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Custom Pricing</h3>
                <p className="text-gray-400">
                  Tailored solutions for your organization's specific needs
                </p>
              </div>
              </div>
            </Card>
          </GlowingCardWrapper>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Got questions? We've got answers. If you can't find what you're looking for, 
              feel free to contact our support team.
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {faqs.map((faq, index) => (
                <GlowingCardWrapper key={index}>
                  <Card variant="glass" className="p-6">
                    <div className="flex items-start space-x-4">
                      <HelpCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-bold mb-3">{faq.question}</h3>
                        <p className="text-gray-300">{faq.answer}</p>
                      </div>
                    </div>
                  </Card>
                </GlowingCardWrapper>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <GlowingCardWrapper glowColor="purple">
            <Card variant="glass" className="p-12 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of architects and developers building the future of cloud infrastructure.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" icon={<Sparkles className="w-5 h-5" />}>
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline" icon={<Users className="w-5 h-5" />}>
                  Contact Sales
                </Button>
              </div>
            </Card>
          </GlowingCardWrapper>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Pricing;