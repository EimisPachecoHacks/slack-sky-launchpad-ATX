import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import GlowingCardWrapper from '../components/ui/GlowingCardWrapper';
import Button from '../components/ui/Button';
import Particles from '../components/ui/Particles';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Send, 
  MessageCircle,
  Users,
  HelpCircle,
  Building,
  Zap,
  CheckCircle,
  Globe,
  Linkedin,
  Twitter,
  Github
} from 'lucide-react';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    subject: '',
    message: '',
    inquiryType: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const inquiryTypes = [
    { value: 'general', label: 'General Inquiry', icon: MessageCircle },
    { value: 'sales', label: 'Sales & Pricing', icon: Building },
    { value: 'support', label: 'Technical Support', icon: HelpCircle },
    { value: 'partnership', label: 'Partnership', icon: Users },
    { value: 'press', label: 'Press & Media', icon: Globe }
  ];

  const contactMethods = [
    {
      icon: <Mail className="w-6 h-6 text-blue-400" />,
      title: 'Email Us',
      description: 'Send us an email and we\'ll respond within 24 hours',
      contact: 'hello@skyrchitect.com',
      action: 'mailto:hello@skyrchitect.com'
    },
    {
      icon: <Phone className="w-6 h-6 text-green-400" />,
      title: 'Call Us',
      description: 'Speak directly with our team during business hours',
      contact: '+1 (555) 123-4567',
      action: 'tel:+15551234567'
    },
    {
      icon: <MessageCircle className="w-6 h-6 text-purple-400" />,
      title: 'Live Chat',
      description: 'Get instant help with our live chat support',
      contact: 'Available 24/7',
      action: '#'
    }
  ];

  const offices = [
    {
      city: 'San Francisco',
      address: '123 Market Street, Suite 400\nSan Francisco, CA 94105',
      phone: '+1 (555) 123-4567',
      email: 'sf@skyrchitect.com'
    },
    {
      city: 'New York',
      address: '456 Broadway, Floor 12\nNew York, NY 10013',
      phone: '+1 (555) 987-6543',
      email: 'ny@skyrchitect.com'
    },
    {
      city: 'London',
      address: '789 Oxford Street\nLondon W1C 1DX, UK',
      phone: '+44 20 7123 4567',
      email: 'london@skyrchitect.com'
    }
  ];

  const faqs = [
    {
      question: 'How quickly can I get started?',
      answer: 'You can start using Sky Launchpad immediately with our free plan. Simply sign up and begin creating your first architecture.'
    },
    {
      question: 'Do you offer custom enterprise solutions?',
      answer: 'Yes, we provide tailored enterprise solutions including on-premise deployment, custom integrations, and dedicated support.'
    },
    {
      question: 'What cloud providers do you support?',
      answer: 'We currently support AWS, Microsoft Azure, and Google Cloud Platform, with more providers coming soon.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Absolutely. We use enterprise-grade security measures and are SOC 2 Type II compliant to protect your data.'
    }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Particles />
        <Header />
        
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 py-16">
            <Card variant="glass" className="p-12 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Message Sent Successfully!</h1>
              <p className="text-gray-300 mb-8">
                Thank you for reaching out to us. We've received your message and will get back to you within 24 hours.
              </p>
              <div className="space-y-4">
                <Button onClick={() => setIsSubmitted(false)}>
                  Send Another Message
                </Button>
                <div className="text-sm text-gray-400">
                  Reference ID: MSG-{Date.now().toString().slice(-6)}
                </div>
              </div>
            </Card>
          </div>
        </main>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-text-primary">
      <Particles />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="inline-block bg-blue-900/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              💬 Get in Touch
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              We'd Love to
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 text-transparent bg-clip-text">
                Hear From You
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Have questions about Sky Launchpad? Want to discuss enterprise solutions? 
              Or just want to say hello? We're here to help.
            </p>
          </div>
        </section>

        {/* Contact Methods */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {contactMethods.map((method, index) => (
            <GlowingCardWrapper key={index}>
              <Card variant="glass" className="p-6 text-center" hover={true}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
                  {method.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{method.title}</h3>
                <p className="text-gray-300 mb-4">{method.description}</p>
                <a 
                  href={method.action}
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  {method.contact}
                </a>
              </Card>
            </GlowingCardWrapper>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Form */}
          <GlowingCardWrapper>
            <Card variant="glass" className="p-8">
              <h2 className="text-2xl font-bold mb-6">Send us a Message</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Inquiry Type */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-3">
                    What can we help you with?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {inquiryTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, inquiryType: type.value }))}
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                            formData.inquiryType === type.value
                              ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                              : 'bg-background-secondary border-border-secondary text-text-tertiary hover:border-blue-500/30'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name and Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-background-secondary border border-blue-500/30 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/60"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-background-secondary border border-blue-500/30 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/60"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                {/* Company and Subject */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Company
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-black/30 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60"
                      placeholder="Your company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-black/30 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60"
                      placeholder="Brief subject line"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Message *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-4 py-3 bg-black/30 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60 resize-none"
                    placeholder="Tell us more about your inquiry..."
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  icon={isSubmitting ? <Zap className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                >
                  {isSubmitting ? 'Sending Message...' : 'Send Message'}
                </Button>
              </form>
            </Card>
          </GlowingCardWrapper>

            {/* Office Locations & FAQ */}
            <div className="space-y-8">
              {/* Office Locations */}
              <GlowingCardWrapper>
                <Card variant="glass" className="p-8">
                  <h2 className="text-2xl font-bold mb-6">Our Offices</h2>
                <div className="space-y-6">
                  {offices.map((office, index) => (
                    <div key={index} className="border-b border-gray-700 last:border-b-0 pb-6 last:pb-0">
                      <h3 className="text-lg font-bold mb-3 flex items-center space-x-2">
                        <MapPin className="w-5 h-5 text-blue-400" />
                        <span>{office.city}</span>
                      </h3>
                      <div className="space-y-2 text-sm text-gray-300">
                        <p className="whitespace-pre-line">{office.address}</p>
                        <p className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-green-400" />
                          <span>{office.phone}</span>
                        </p>
                        <p className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-blue-400" />
                          <span>{office.email}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                </Card>
              </GlowingCardWrapper>

              {/* Business Hours */}
              <GlowingCardWrapper>
                <Card variant="glass" className="p-8">
                  <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                    <Clock className="w-6 h-6 text-blue-400" />
                    <span>Business Hours</span>
                  </h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monday - Friday</span>
                    <span className="text-white">9:00 AM - 6:00 PM PST</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Saturday</span>
                    <span className="text-white">10:00 AM - 4:00 PM PST</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sunday</span>
                    <span className="text-gray-500">Closed</span>
                  </div>
                  <div className="pt-3 border-t border-gray-700">
                    <p className="text-blue-400 text-xs">
                      💬 Live chat support available 24/7
                    </p>
                  </div>
                </div>
                </Card>
              </GlowingCardWrapper>

              {/* Social Links */}
              <GlowingCardWrapper>
                <Card variant="glass" className="p-8">
                  <h2 className="text-2xl font-bold mb-6">Follow Us</h2>
                <div className="flex space-x-4">
                  <a href="#" className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-colors">
                    <Twitter className="w-5 h-5" />
                  </a>
                  <a href="#" className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </a>
                  <a href="#" className="w-12 h-12 rounded-lg bg-gray-500/20 flex items-center justify-center text-gray-400 hover:bg-gray-500/30 transition-colors">
                    <Github className="w-5 h-5" />
                  </a>
                </div>
                </Card>
              </GlowingCardWrapper>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Quick answers to common questions. Can't find what you're looking for? 
              Send us a message above.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <GlowingCardWrapper key={index}>
                <Card variant="glass" className="p-6">
                  <h3 className="font-bold mb-3 flex items-start space-x-3">
                    <HelpCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>{faq.question}</span>
                  </h3>
                  <p className="text-gray-300 ml-8">{faq.answer}</p>
                </Card>
              </GlowingCardWrapper>
            ))}
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Contact;