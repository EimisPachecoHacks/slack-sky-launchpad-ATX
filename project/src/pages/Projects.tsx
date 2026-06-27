import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Particles from '../components/ui/Particles';
import { 
  Brain, 
  FolderPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit3, 
  Copy, 
  Trash2, 
  ExternalLink,
  Calendar,
  DollarSign,
  Cloud,
  Database,
  Server,
  Play,
  Pause,
  Settings,
  Download,
  Share2
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Project {
  id: string;
  name: string;
  description: string;
  provider: 'aws' | 'azure' | 'gcp';
  status: 'Active' | 'Deployed' | 'Draft' | 'Paused' | 'Error';
  cost: number;
  components: number;
  lastModified: string;
  createdAt: string;
  deploymentUrl?: string;
  tags: string[];
}

const Projects: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const projects: Project[] = [
    {
      id: '1',
      name: 'E-commerce Platform',
      description: 'Scalable e-commerce solution with microservices architecture',
      provider: 'aws',
      status: 'Active',
      cost: 245.50,
      components: 12,
      lastModified: '2 hours ago',
      createdAt: '2024-01-15',
      deploymentUrl: 'https://ecommerce.example.com',
      tags: ['production', 'microservices', 'high-traffic']
    },
    {
      id: '2',
      name: 'Data Analytics Pipeline',
      description: 'Real-time data processing and analytics infrastructure',
      provider: 'azure',
      status: 'Deployed',
      cost: 189.20,
      components: 8,
      lastModified: '1 day ago',
      createdAt: '2024-01-10',
      deploymentUrl: 'https://analytics.example.com',
      tags: ['analytics', 'real-time', 'big-data']
    },
    {
      id: '3',
      name: 'Mobile App Backend',
      description: 'Serverless backend for mobile application',
      provider: 'gcp',
      status: 'Draft',
      cost: 0,
      components: 6,
      lastModified: '3 days ago',
      createdAt: '2024-01-08',
      tags: ['mobile', 'serverless', 'api']
    },
    {
      id: '4',
      name: 'ML Training Platform',
      description: 'Machine learning model training and deployment platform',
      provider: 'aws',
      status: 'Paused',
      cost: 156.80,
      components: 10,
      lastModified: '1 week ago',
      createdAt: '2024-01-05',
      tags: ['machine-learning', 'gpu', 'training']
    },
    {
      id: '5',
      name: 'IoT Data Collector',
      description: 'IoT device data collection and processing system',
      provider: 'azure',
      status: 'Error',
      cost: 78.90,
      components: 7,
      lastModified: '2 days ago',
      createdAt: '2024-01-12',
      tags: ['iot', 'sensors', 'edge-computing']
    },
    {
      id: '6',
      name: 'Content Management System',
      description: 'Headless CMS with global CDN distribution',
      provider: 'gcp',
      status: 'Active',
      cost: 123.45,
      components: 9,
      lastModified: '5 hours ago',
      createdAt: '2024-01-18',
      deploymentUrl: 'https://cms.example.com',
      tags: ['cms', 'cdn', 'content']
    }
  ];

  const getProviderInfo = (provider: string) => {
    const providers = {
      aws: { name: 'AWS', icon: Cloud, color: 'text-orange-500', bg: 'bg-orange-500/10' },
      azure: { name: 'Azure', icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      gcp: { name: 'GCP', icon: Server, color: 'text-green-500', bg: 'bg-green-500/10' }
    };
    return providers[provider as keyof typeof providers];
  };

  const getStatusInfo = (status: string) => {
    const statuses = {
      'Active': { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
      'Deployed': { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
      'Draft': { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' },
      'Paused': { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
      'Error': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
    };
    return statuses[status as keyof typeof statuses];
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesProvider = filterProvider === 'all' || project.provider === filterProvider;
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    
    return matchesSearch && matchesProvider && matchesStatus;
  });

  const totalCost = filteredProjects.reduce((sum, project) => sum + project.cost, 0);
  const activeProjects = filteredProjects.filter(p => p.status === 'Active').length;

  const handleSelectProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProjects.length === filteredProjects.length) {
      setSelectedProjects([]);
    } else {
      setSelectedProjects(filteredProjects.map(p => p.id));
    }
  };

  const ProjectCard = ({ project }: { project: Project }) => {
    const providerInfo = getProviderInfo(project.provider);
    const statusInfo = getStatusInfo(project.status);
    const ProviderIcon = providerInfo.icon;

    return (
      <Card className="p-6 group relative" hover={true}>
        <div className="absolute top-4 right-4">
          <div className="relative">
            <button className="p-2 rounded-lg bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex items-start space-x-4 mb-4">
          <div className={`w-12 h-12 rounded-xl ${providerInfo.bg} flex items-center justify-center`}>
            <ProviderIcon className={`w-6 h-6 ${providerInfo.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg mb-1 truncate">{project.name}</h3>
            <p className="text-gray-400 text-sm line-clamp-2">{project.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}>
            {project.status}
          </span>
          <span className="text-sm text-gray-400">{project.components} components</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-400">Monthly Cost</div>
            <div className="font-bold text-lg">${project.cost.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Last Modified</div>
            <div className="text-sm">{project.lastModified}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {project.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-md">
              {tag}
            </span>
          ))}
          {project.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-500/10 text-gray-400 text-xs rounded-md">
              +{project.tags.length - 3} more
            </span>
          )}
        </div>

        <div className="flex space-x-2">
          <Link to={`/architecture/${project.id}`} className="flex-1">
            <Button size="sm" className="w-full" icon={<Edit3 className="w-4 h-4" />}>
              Edit
            </Button>
          </Link>
          {project.deploymentUrl && (
            <Button 
              size="sm" 
              variant="outline" 
              icon={<ExternalLink className="w-4 h-4" />}
              onClick={() => window.open(project.deploymentUrl, '_blank')}
            >
              View
            </Button>
          )}
        </div>
      </Card>
    );
  };

  const ProjectRow = ({ project }: { project: Project }) => {
    const providerInfo = getProviderInfo(project.provider);
    const statusInfo = getStatusInfo(project.status);
    const ProviderIcon = providerInfo.icon;

    return (
      <tr className="border-b border-gray-700 hover:bg-blue-500/5 transition-colors">
        <td className="px-4 py-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={selectedProjects.includes(project.id)}
              onChange={() => handleSelectProject(project.id)}
              className="w-4 h-4 rounded border-2 border-blue-500/30 bg-black/30 text-blue-500"
            />
            <div className={`w-10 h-10 rounded-lg ${providerInfo.bg} flex items-center justify-center`}>
              <ProviderIcon className={`w-5 h-5 ${providerInfo.color}`} />
            </div>
            <div>
              <div className="font-medium">{project.name}</div>
              <div className="text-sm text-gray-400 truncate max-w-xs">{project.description}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}>
            {project.status}
          </span>
        </td>
        <td className="px-4 py-4">
          <span className="font-medium">${project.cost.toFixed(2)}/mo</span>
        </td>
        <td className="px-4 py-4">
          <span className="text-sm">{project.components}</span>
        </td>
        <td className="px-4 py-4">
          <span className="text-sm text-gray-400">{project.lastModified}</span>
        </td>
        <td className="px-4 py-4">
          <div className="flex space-x-2">
            <Link to={`/architecture/${project.id}`}>
              <Button size="sm" variant="ghost" icon={<Edit3 className="w-4 h-4" />}>
                Edit
              </Button>
            </Link>
            {project.deploymentUrl && (
              <Button 
                size="sm" 
                variant="ghost" 
                icon={<ExternalLink className="w-4 h-4" />}
                onClick={() => window.open(project.deploymentUrl, '_blank')}
              >
                View
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen text-text-primary">
      <Particles />
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Projects</h1>
              <p className="text-text-secondary">Manage your cloud architecture projects</p>
            </div>
            
            <div className="flex items-center space-x-4 mt-4 lg:mt-0">
              <Link to="/architecture" className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 animate-pulse rounded-lg transition-opacity duration-300"></div>
                <Button icon={<FolderPlus className="w-5 h-5" />} className="relative">
                  New Project
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-sm mb-1">Total Projects</p>
                  <p className="text-2xl font-bold">{filteredProjects.length}</p>
                </div>
                <FolderPlus className="w-8 h-8 text-blue-400" />
              </div>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-sm mb-1">Active Projects</p>
                  <p className="text-2xl font-bold">{activeProjects}</p>
                </div>
                <Play className="w-8 h-8 text-green-400" />
              </div>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-sm mb-1">Total Monthly Cost</p>
                  <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-400" />
              </div>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-sm mb-1">Components</p>
                  <p className="text-2xl font-bold">{filteredProjects.reduce((sum, p) => sum + p.components, 0)}</p>
                </div>
                <Settings className="w-8 h-8 text-orange-400" />
              </div>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-background-secondary border border-blue-500/30 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/60 w-full sm:w-64"
                  />
                </div>

                {/* Provider Filter */}
                <select
                  value={filterProvider}
                  onChange={(e) => setFilterProvider(e.target.value)}
                  className="px-4 py-2 bg-background-secondary border border-blue-500/30 rounded-lg text-text-primary focus:outline-none focus:border-blue-500/60"
                >
                  <option value="all">All Providers</option>
                  <option value="aws">AWS</option>
                  <option value="azure">Azure</option>
                  <option value="gcp">GCP</option>
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 bg-background-secondary border border-blue-500/30 rounded-lg text-text-primary focus:outline-none focus:border-blue-500/60"
                >
                  <option value="all">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Deployed">Deployed</option>
                  <option value="Draft">Draft</option>
                  <option value="Paused">Paused</option>
                  <option value="Error">Error</option>
                </select>
              </div>

              <div className="flex items-center space-x-4">
                {/* View Mode Toggle */}
                <div className="flex bg-black/30 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-blue-500 text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-blue-500 text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    List
                  </button>
                </div>

                {/* Bulk Actions */}
                {selectedProjects.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">
                      {selectedProjects.length} selected
                    </span>
                    <Button size="sm" variant="ghost" icon={<Copy className="w-4 h-4" />}>
                      Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4" />}>
                      Export
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Projects Display */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/20 border-b border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedProjects.length === filteredProjects.length && filteredProjects.length > 0}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-2 border-blue-500/30 bg-black/30 text-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-400">Project</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Cost</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Components</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Last Modified</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => (
                      <ProjectRow key={project.id} project={project} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Empty State */}
          {filteredProjects.length === 0 && (
            <Card className="p-12 text-center">
              <FolderPlus className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No projects found</h3>
              <p className="text-gray-400 mb-6">
                {searchTerm || filterProvider !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first cloud architecture project to get started'
                }
              </p>
              {!searchTerm && filterProvider === 'all' && filterStatus === 'all' && (
                <Link to="/architecture" className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 animate-pulse rounded-lg transition-opacity duration-300"></div>
                  <Button icon={<FolderPlus className="w-5 h-5" />} className="relative">
                    Create Your First Project
                  </Button>
                </Link>
              )}
            </Card>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Projects;