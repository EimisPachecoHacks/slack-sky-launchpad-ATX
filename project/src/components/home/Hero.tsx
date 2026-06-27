import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, ExternalLink, Upload, Sparkles, MonitorPlay, CloudLightning } from 'lucide-react';
import Card from '../ui/Card';
import GlowingCardWrapper from '../ui/GlowingCardWrapper';

const Hero: React.FC = () => {
  return (
    <section className="min-h-screen pt-24 pb-16 flex items-center relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center mb-12">
          <Brain className="w-20 h-20 text-blue-400 mb-6 animate-pulse" />
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
            <span className="dark:bg-gradient-to-r dark:from-blue-400 dark:via-purple-400 dark:to-pink-500 dark:text-transparent dark:bg-clip-text light:text-slate-800" style={{ textShadow: 'none', filter: 'none', boxShadow: 'none' }}>
              Build Future-Proof Cloud Systems with AI Help.
            </span>
          </h1>
          
          <p className="text-2xl dark:text-gray-300 light:text-gray-700 max-w-3xl mx-auto mb-12">
            Use AI to turn your ideas into scalable architectures with real-time diagrams and ready-to-use infrastructure code.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mx-auto">
            <Link to="/architecture" className="group cursor-pointer block">
              <GlowingCardWrapper glowColor="blue-purple">
                <Card variant="glass" className="min-h-[140px]" hover={true}>
                  <div className="flex items-center space-x-6 pointer-events-none">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br dark:from-blue-500/10 dark:via-purple-500/10 dark:to-blue-500/10 light:from-transparent light:to-transparent flex items-center justify-center border dark:border-blue-500/20 light:border-none icon-container">
                      <Brain className="w-8 h-8 dark:text-blue-400 light:text-slate-700" />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-2xl font-bold mb-2 text-text-primary">Create New Architecture</h3>
                      <p className="text-text-secondary">Start from scratch with AI guidance</p>
                    </div>
                    <ExternalLink className="w-6 h-6 dark:text-blue-400 light:text-slate-700 transform transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </GlowingCardWrapper>
            </Link>

            <Link to="/image-analysis" className="group cursor-pointer block">
              <GlowingCardWrapper glowColor="purple">
                <Card variant="glass" className="min-h-[140px]" hover={true}>
                  <div className="flex items-center space-x-6 pointer-events-none">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br dark:from-purple-500/10 dark:via-pink-500/10 dark:to-purple-500/10 light:from-transparent light:to-transparent flex items-center justify-center border dark:border-purple-500/20 light:border-none icon-container">
                      <Upload className="w-8 h-8 dark:text-purple-400 light:text-slate-700" />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-2xl font-bold mb-2 text-text-primary">Upload Architecture Image</h3>
                      <p className="text-text-secondary">Generate code from existing diagrams</p>
                    </div>
                    <ExternalLink className="w-6 h-6 dark:text-purple-400 light:text-slate-700 transform transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </GlowingCardWrapper>
            </Link>
          </div>
        </div>
        
        <div className="relative mt-32">
          <div className="text-center py-16">
            <div className="group inline-block w-full max-w-5xl mx-auto">
              <GlowingCardWrapper glowColor="blue-purple">
                <Card variant="glass" className="aspect-video" hover={true}>
                  <div className="grid grid-cols-3 gap-4 p-6 h-full">
                    <div className="flex flex-col items-center text-center group">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <Sparkles className="w-8 h-8 dark:text-blue-400 light:text-slate-700 relative z-10" />
                      </div>
                      <p className="text-sm text-text-secondary transition-colors">AI-Powered Design Recommendations</p>
                    </div>
                    <div className="flex flex-col items-center text-center group">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <MonitorPlay className="w-8 h-8 dark:text-blue-400 light:text-slate-700 relative z-10" />
                      </div>
                      <p className="text-sm text-text-secondary transition-colors">Interactive Architecture Visualization</p>
                    </div>
                    <div className="flex flex-col items-center text-center group">
                      <div className="relative mb-3">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                        <CloudLightning className="w-8 h-8 dark:text-blue-400 light:text-slate-700 relative z-10" />
                      </div>
                      <p className="text-sm text-text-secondary transition-colors">Real-time Infrastructure as Code</p>
                    </div>
                  </div>
                </Card>
              </GlowingCardWrapper>
            </div>
          </div>
        </div>
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-blue-500/20 rounded-full filter blur-[150px] dark:block dark:opacity-20 hidden"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-purple-500/20 rounded-full filter blur-[150px] dark:block dark:opacity-10 hidden"></div>
      </div>
    </section>
  );
};

export default Hero;