import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import GlowingCardWrapper from '../components/ui/GlowingCardWrapper';
import Button from '../components/ui/Button';
import Particles from '../components/ui/Particles';
import { Brain, FolderPlus, Clock, DollarSign, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const recentProjects = [
    {
      id: '1',
      name: 'E-commerce Platform',
      provider: 'AWS',
      status: 'Active',
      cost: 245.50,
      lastModified: '2 hours ago'
    },
    {
      id: '2',
      name: 'Data Analytics Pipeline',
      provider: 'Azure',
      status: 'Deployed',
      cost: 189.20,
      lastModified: '1 day ago'
    },
    {
      id: '3',
      name: 'Mobile App Backend',
      provider: 'GCP',
      status: 'Draft',
      cost: 0,
      lastModified: '3 days ago'
    }
  ];

  const stats = [
    {
      label: 'Active Projects',
      value: '12',
      change: '+3',
      icon: FolderPlus,
      color: 'text-blue-400'
    },
    {
      label: 'Monthly Cost',
      value: '$1,247',
      change: '-12%',
      icon: DollarSign,
      color: 'text-green-400'
    },
    {
      label: 'Cost Savings',
      value: '$340',
      change: '+8%',
      icon: TrendingUp,
      color: 'text-purple-400'
    }
  ];

  return (
    <div className="min-h-screen text-text-primary">
      <Particles />
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Welcome back!</h1>
            <p className="text-text-secondary">Here's what's happening with your cloud architectures</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="p-6" hover={true}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-secondary text-sm mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className={`text-sm ${stat.color}`}>{stat.change} from last month</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Link to="/architecture">
              <GlowingCardWrapper>
                <Card variant="glass" className="p-6 group cursor-pointer" hover={true}>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold mb-1">Create New Architecture</h3>
                      <p className="text-gray-400 text-sm">Start building with AI assistance</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-blue-400 transform transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </GlowingCardWrapper>
            </Link>

            <Link to="/projects">
              <GlowingCardWrapper glowColor="purple">
                <Card variant="glass" className="p-6 group cursor-pointer" hover={true}>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                      <FolderPlus className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold mb-1">Browse Projects</h3>
                      <p className="text-gray-400 text-sm">View all your architectures</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-purple-400 transform transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </GlowingCardWrapper>
            </Link>

            <Link to="/templates">
              <GlowingCardWrapper glowColor="green">
                <Card variant="glass" className="p-6 group cursor-pointer" hover={true}>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold mb-1">Use Templates</h3>
                      <p className="text-gray-400 text-sm">Start from proven patterns</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-green-400 transform transition-transform group-hover:translate-x-1" />
                  </div>
                </Card>
              </GlowingCardWrapper>
            </Link>
          </div>

          {/* Recent Projects */}
          <GlowingCardWrapper>
            <Card variant="glass" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Recent Projects</h2>
                <Link to="/projects">
                  <Button variant="ghost" size="sm">
                    View All
                  </Button>
                </Link>
              </div>

              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-blue-500/20 hover:border-blue-500/40 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium">{project.name}</h3>
                        <p className="text-sm text-text-secondary">{project.provider} • {project.lastModified}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">${project.cost}/mo</p>
                        <p className={`text-xs ${
                          project.status === 'Active' ? 'text-green-400' :
                          project.status === 'Deployed' ? 'text-blue-400' :
                          'text-text-tertiary'
                        }`}>
                          {project.status}
                        </p>
                      </div>
                      
                      <Link to={`/architecture/${project.id}`}>
                        <Button variant="ghost" size="sm">
                          Open
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </GlowingCardWrapper>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Dashboard;