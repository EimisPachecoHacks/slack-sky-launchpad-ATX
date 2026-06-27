import React, { useState } from 'react';
import { ChevronDown, Brain, Layout, Users } from 'lucide-react';
import Card from '../ui/Card';
import GlowingCardWrapper from '../ui/GlowingCardWrapper';

interface RoadmapItem {
  id: string;
  quarter: string;
  year: string;
  status: 'In Development' | 'Planning' | 'Released';
  icon: React.ReactNode;
  title: string;
  description: string;
  expanded: boolean;
}

const Roadmap: React.FC = () => {
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([
    {
      id: '1',
      quarter: 'Q2',
      year: '2025',
      status: 'In Development',
      icon: <Brain className="w-6 h-6 text-blue-400" />,
      title: 'Foundation Enhancement',
      description: 'Expanding core capabilities with multi-modal AI support and enhanced user experience',
      expanded: true
    },
    {
      id: '2',
      quarter: 'Q3',
      year: '2025',
      status: 'Planning',
      icon: <Layout className="w-6 h-6 text-purple-400" />,
      title: 'Advanced Visualization',
      description: 'Revolutionizing architecture visualization with 3D/AR capabilities',
      expanded: false
    },
    {
      id: '3',
      quarter: 'Q4',
      year: '2025',
      status: 'Planning',
      icon: <Users className="w-6 h-6 text-purple-400" />,
      title: 'Enterprise Features',
      description: 'Empowering team collaboration and enterprise integration',
      expanded: false
    }
  ]);

  const toggleExpanded = (id: string) => {
    setRoadmapItems(
      roadmapItems.map(item => 
        item.id === id ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Development':
        return 'bg-green-800 text-green-300';
      case 'Planning':
        return 'bg-blue-800 text-blue-300';
      case 'Released':
        return 'bg-purple-800 text-purple-300';
      default:
        return 'bg-gray-800 text-gray-300';
    }
  };

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="inline-block bg-blue-900/30 text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            Our Roadmap
          </div>
          
          <div className="flex items-center justify-center space-x-6 mb-6">
            <div className="inline-block bg-blue-500/10 border border-blue-500/20 rounded-full px-12 py-3">
              <span className="text-3xl font-bold text-white">2025</span>
            </div>
          </div>
        </div>
        
        <div className="relative">
          <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-blue-500 to-purple-500"></div>
          
          <div className="space-y-12">
            {roadmapItems.map((item, index) => (
              <div key={item.id} className="relative">
                <div className="absolute left-1/2 top-10 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-background-primary border-4 dark:border-blue-500 light:border-blue-600 rounded-full z-10"></div>
                
                <div className={index % 2 === 0 ? 'ml-auto pr-8 lg:ml-auto lg:w-1/2 lg:pr-12' : 'mr-auto pl-8 lg:mr-auto lg:w-1/2 lg:pl-12'}>
                  <GlowingCardWrapper>
                    <Card variant="glass" className="relative aspect-video light:shadow-lg">
                      <div 
                        className="p-6 cursor-pointer h-full flex flex-col"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-4">
                            <div className="text-2xl font-bold">{item.quarter}</div>
                            <div className={`text-xs px-3 py-1 rounded-full ${getStatusColor(item.status)}`}>
                              {item.status}
                            </div>
                          </div>
                          <ChevronDown 
                            className={`w-5 h-5 text-blue-400 transition-transform ${item.expanded ? 'transform rotate-180' : ''}`} 
                          />
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-4">
                          <div className="bg-background-secondary p-2 rounded-lg border border-blue-500/20">
                            {item.icon}
                          </div>
                          <h3 className="text-xl font-bold text-text-primary">{item.title}</h3>
                        </div>
                        <p className="mt-4 text-text-secondary flex-grow leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      
                      {item.expanded && (
                        <div className="p-6 border-t border-blue-500/20">
                          <ul className="space-y-3">
                            <li className="flex items-start space-x-3">
                              <span className="text-blue-400 text-lg mt-0.5">•</span>
                              <span className="text-text-secondary">Enhanced AI model integration for improved architecture recommendations</span>
                            </li>
                            <li className="flex items-start space-x-2">
                              <span className="text-blue-400 text-lg mt-0.5">•</span>
                              <span className="text-text-secondary">Support for multi-cloud hybrid deployments</span>
                            </li>
                            <li className="flex items-start space-x-2">
                              <span className="text-blue-400 text-lg mt-0.5">•</span>
                              <span className="text-text-secondary">Interactive architecture editor with real-time validation</span>
                            </li>
                            <li className="flex items-start space-x-2">
                              <span className="text-blue-400 text-lg mt-0.5">•</span>
                              <span className="text-text-secondary">Advanced cost optimization recommendations</span>
                            </li>
                          </ul>
                        </div>
                      )}
                    </Card>
                  </GlowingCardWrapper>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-blue-500 rounded-full filter blur-[150px] opacity-20"></div>
    </section>
  );
};

export default Roadmap;