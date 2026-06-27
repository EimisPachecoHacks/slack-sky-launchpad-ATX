import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import GlowingCardWrapper from '../components/ui/GlowingCardWrapper';
import Button from '../components/ui/Button';
import Particles from '../components/ui/Particles';
import { 
  Brain, 
  Zap, 
  Shield, 
  Code, 
  Cloud, 
  Users, 
  BarChart3, 
  Layers,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Target,
  Workflow,
  Database,
  Lock,
  Globe,
  Cpu,
  GitBranch,
  Monitor,
  Settings,
  TrendingUp
} from 'lucide-react';

const Features: React.FC = () => {
  const mainFeatures = [
    {
      icon: <Brain className="w-8 h-8 text-blue-400" />,
      title: 'AI-Powered Architecture Design',
      description: 'Leverage advanced AI to automatically generate optimized cloud architectures based on your requirements.',
      benefits: [
        'Intelligent service recommendations',
        'Best practice validation',
        'Cost optimization suggestions',
        'Security compliance checks'
      ]
    },
    {
      icon: <Code className="w-8 h-8 text-purple-400" />,
      title: 'Infrastructure as Code Generation',
      description: 'Automatically generate production-ready Terraform and CloudFormation templates from your designs.',
      benefits: [
        'Terraform configuration',
        'CloudFormation templates',
        'Version control integration',
        'Deployment automation'
      ]
    },
    {
      icon: <Workflow className="w-8 h-8 text-green-400" />,
      title: 'Interactive Architecture Diagrams',
      description: 'Create and edit beautiful, interactive diagrams with drag-and-drop simplicity.',
      benefits: [
        'Real-time collaboration',
        'Auto-layout algorithms',
        'Export to multiple formats',
        'Version history tracking'
      ]
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-orange-400" />,
      title: 'Cost Analysis & Optimization',
      description: 'Get detailed cost breakdowns and optimization recommendations for your cloud infrastructure.',
      benefits: [
        'Real-time cost estimation',
        'Budget alerts and tracking',
        'Resource optimization',
        'Multi-cloud cost comparison'
      ]
    },
    {
      icon: <Shield className="w-8 h-8 text-red-400" />,
      title: 'Security & Compliance',
      description: 'Built-in security scanning and compliance validation for industry standards.',
      benefits: [
        'Security best practices',
        'Compliance frameworks',
        'Vulnerability scanning',
        'Access control policies'
      ]
    },
    {
      icon: <Users className="w-8 h-8 text-cyan-400" />,
      title: 'Team Collaboration',
      description: 'Work together seamlessly with real-time collaboration and sharing features.',
      benefits: [
        'Real-time editing',
        'Comment and review system',
        'Role-based permissions',
        'Team workspaces'
      ]
    }
  ];

  const additionalFeatures = [
    {
      icon: <Cloud className="w-6 h-6 text-blue-400" />,
      title: 'Multi-Cloud Support',
      description: 'Support for AWS, Azure, Google Cloud, and hybrid architectures'
    },
    {
      icon: <GitBranch className="w-6 h-6 text-purple-400" />,
      title: 'Version Control',
      description: 'Track changes and manage architecture versions with Git integration'
    },
    {
      icon: <Monitor className="w-6 h-6 text-green-400" />,
      title: 'Real-time Monitoring',
      description: 'Monitor deployed architectures with integrated observability tools'
    },
    {
      icon: <Database className="w-6 h-6 text-orange-400" />,
      title: 'Template Library',
      description: 'Access hundreds of pre-built architecture templates and patterns'
    },
    {
      icon: <Lock className="w-6 h-6 text-red-400" />,
      title: 'Enterprise Security',
      description: 'SOC 2 compliant with enterprise-grade security and encryption'
    },
    {
      icon: <Globe className="w-6 h-6 text-cyan-400" />,
      title: 'Global Deployment',
      description: 'Deploy to any region worldwide with automated region selection'
    }
  ];

  const integrations = [
    { name: 'GitHub', logo: '🐙' },
    { name: 'GitLab', logo: '🦊' },
    { name: 'Jenkins', logo: '⚙️' },
    { name: 'Terraform', logo: '🏗️' },
    { name: 'Kubernetes', logo: '☸️' },
    { name: 'Docker', logo: '🐳' },
    { name: 'Slack', logo: '💬' },
    { name: 'Jira', logo: '📋' }
  ];

  return (
    <div className="min-h-screen text-white">
      <Particles />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="inline-block bg-blue-900/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              ✨ Powerful Features
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Everything You Need to Build
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-500 text-transparent bg-clip-text">
                Amazing Cloud Architectures
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              From AI-powered design to automated deployment, Sky Launchpad provides all the tools 
              you need to create, manage, and deploy world-class cloud infrastructures.
            </p>
          </div>
        </section>

        {/* Main Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {mainFeatures.map((feature, index) => (
              <GlowingCardWrapper key={index}>
                <Card variant="glass" className="p-8" hover={true}>
                  <div className="flex items-start space-x-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                      <p className="text-gray-300 mb-6">{feature.description}</p>
                      <ul className="space-y-2">
                        {feature.benefits.map((benefit, bIndex) => (
                          <li key={bIndex} className="flex items-center space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                            <span className="text-gray-300">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              </GlowingCardWrapper>
            ))}
          </div>
        </section>

        {/* Additional Features Grid */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">More Powerful Features</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Discover additional capabilities that make Sky Launchpad the most comprehensive 
              cloud architecture platform available.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {additionalFeatures.map((feature, index) => (
              <GlowingCardWrapper key={index}>
                <Card variant="glass" className="p-6 text-center" hover={true}>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-gray-300">{feature.description}</p>
                </Card>
              </GlowingCardWrapper>
            ))}
          </div>
        </section>

        {/* Integrations */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Seamless Integrations</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Connect with your favorite tools and services to create a unified workflow.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
            {integrations.map((integration, index) => (
              <Card key={index} variant="glass" className="p-6 text-center" hover={true}>
                <div className="text-4xl mb-3">{integration.logo}</div>
                <div className="text-sm font-medium">{integration.name}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <GlowingCardWrapper glowColor="purple">
            <Card variant="glass" className="p-12 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Ready to Experience the Future?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of architects and developers who are already building 
                amazing cloud infrastructures with Sky Launchpad.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" icon={<Sparkles className="w-5 h-5" />}>
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline" icon={<ArrowRight className="w-5 h-5" />}>
                  View Pricing
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

export default Features;