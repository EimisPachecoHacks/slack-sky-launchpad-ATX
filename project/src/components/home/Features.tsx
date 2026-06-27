import React from 'react';
import { Lightbulb, ShieldCheck, LineChart, Users, Clock, Lock, DollarSign, Share2, Cloud, Brain, Code } from 'lucide-react';
import Card from '../ui/Card';
import GlowingCardWrapper from '../ui/GlowingCardWrapper';

const Features: React.FC = () => {
  const benefits = [
    {
      icon: <Clock className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'Time Efficiency',
      description: 'Reduce architecture design time by 75% through AI-powered automation'
    },
    {
      icon: <Lock className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'Enhanced Security',
      description: 'Ensure consistent application of security best practices and compliance requirements'
    },
    {
      icon: <DollarSign className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'Cost Optimization',
      description: 'Achieve 40% cost savings through optimized architecture recommendations'
    },
    {
      icon: <Share2 className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'Collaboration',
      description: 'Improve team collaboration with shared architecture knowledge'
    }
  ];

  const beneficiaries = [
    {
      icon: <Cloud className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'Cloud Architects',
      points: [
        'Accelerated architecture design',
        'Best practice validation',
        'Automated documentation'
      ]
    },
    {
      icon: <Code className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'DevOps Engineers',
      points: [
        'Infrastructure as code generation',
        'Deployment automation',
        'Performance optimization'
      ]
    },
    {
      icon: <Brain className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'Solution Architects',
      points: [
        'Rapid prototyping',
        'Pattern recognition',
        'Cost estimation'
      ]
    },
    {
      icon: <Lightbulb className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />,
      title: 'Technical Leaders',
      points: [
        'Informed decision making',
        'Risk reduction',
        'Resource optimization'
      ]
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Why AI Architecture Assistant?</h2>
          <p className="text-xl dark:text-gray-300 light:text-gray-700 max-w-3xl mx-auto">
            Transforming cloud architecture design with AI-powered intelligence
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-24">
          <GlowingCardWrapper glowColor="red">
            <Card variant="glass" className="p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br dark:from-red-500/10 dark:to-red-600/10 light:bg-white/20 flex items-center justify-center dark:border dark:border-red-500/20 light:border-none icon-container">
                  <Lightbulb className="w-6 h-6 dark:text-red-400 light:text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-text-primary">The Challenge</h3>
              </div>
            
              <ul className="space-y-4">
                {[
                  'Time-consuming manual architecture design process',
                  'Inconsistent application of best practices',
                  'Complex decision-making across multiple cloud services',
                  'Difficulty in maintaining up-to-date documentation',
                  'Risk of security oversights and compliance issues'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <span className="text-red-400 text-xl mt-0.5">•</span>
                    <span className="text-text-secondary">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </GlowingCardWrapper>
          
          <GlowingCardWrapper glowColor="green">
            <Card variant="glass" className="p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br dark:from-green-500/10 dark:to-green-600/10 light:bg-white/20 flex items-center justify-center dark:border dark:border-green-500/20 light:border-none icon-container">
                  <ShieldCheck className="w-6 h-6 dark:text-green-400 light:text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-text-primary">Our Solution</h3>
              </div>
            
              <ul className="space-y-4">
                {[
                  'Automated architecture recommendations based on requirements',
                  'Real-time best practice validation',
                  'Intelligent service selection and configuration',
                  'Automated documentation generation',
                  'Built-in security and compliance checks'
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <span className="text-green-400 text-xl mt-0.5">•</span>
                    <span className="text-text-primary">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </GlowingCardWrapper>
        </div>
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Key Benefits</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {benefits.map((benefit, index) => (
            <GlowingCardWrapper key={index}>
              <Card variant="glass" className="p-8 text-center benefit-card" hover={true}>
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br dark:from-blue-500/10 dark:to-blue-600/10 light:from-transparent light:to-transparent flex items-center justify-center border dark:border-blue-500/20 light:border-none icon-container">
                    {benefit.icon}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-4 text-text-primary">{benefit.title}</h3>
                <p className="text-text-secondary">{benefit.description}</p>
              </Card>
            </GlowingCardWrapper>
          ))}
        </div>
        
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Who Benefits?</h2>
          <p className="text-xl dark:text-gray-300 light:text-gray-700 max-w-3xl mx-auto">
            Empowering professionals across the cloud architecture landscape
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {beneficiaries.map((item, index) => (
            <GlowingCardWrapper key={index}>
              <Card variant="glass" className="p-8" hover={true}>
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br dark:from-blue-500/10 dark:to-blue-600/10 light:from-transparent light:to-transparent flex items-center justify-center border dark:border-blue-500/20 light:border-none icon-container">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-text-primary">{item.title}</h3>
                </div>
              
                <ul className="space-y-3">
                  {item.points.map((point, pIndex) => (
                    <li key={pIndex} className="flex items-start space-x-2">
                      <span className="text-blue-400 text-lg">•</span>
                      <span className="text-text-secondary">{point}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </GlowingCardWrapper>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;