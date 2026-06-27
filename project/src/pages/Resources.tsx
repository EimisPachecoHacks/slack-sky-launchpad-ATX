import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import GlowingCardWrapper from '../components/ui/GlowingCardWrapper';
import Button from '../components/ui/Button';
import Particles from '../components/ui/Particles';
import { 
  BookOpen, 
  Video, 
  FileText, 
  Download, 
  ExternalLink, 
  Search,
  Filter,
  Clock,
  User,
  Star,
  Play,
  Calendar,
  Tag,
  ArrowRight,
  Lightbulb,
  Code,
  Zap,
  Users,
  Globe,
  Bookmark
} from 'lucide-react';

const Resources: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { id: 'all', label: 'All Resources', icon: Globe },
    { id: 'guides', label: 'Guides & Tutorials', icon: BookOpen },
    { id: 'videos', label: 'Video Content', icon: Video },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'webinars', label: 'Webinars', icon: Users },
    { id: 'case-studies', label: 'Case Studies', icon: Lightbulb }
  ];

  const resources = [
    {
      id: 1,
      title: 'Getting Started with Cloud Architecture',
      description: 'A comprehensive guide to designing your first cloud architecture with best practices and common patterns.',
      category: 'guides',
      type: 'Guide',
      duration: '15 min read',
      difficulty: 'Beginner',
      author: 'Sarah Chen',
      date: '2024-01-15',
      tags: ['beginner', 'aws', 'architecture'],
      featured: true,
      image: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 2,
      title: 'Microservices Architecture Patterns',
      description: 'Learn how to design scalable microservices architectures with proper service boundaries and communication patterns.',
      category: 'guides',
      type: 'Guide',
      duration: '25 min read',
      difficulty: 'Advanced',
      author: 'Michael Rodriguez',
      date: '2024-01-12',
      tags: ['microservices', 'patterns', 'scalability'],
      featured: false,
      image: 'https://images.pexels.com/photos/1181677/pexels-photo-1181677.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 3,
      title: 'Cost Optimization Strategies for AWS',
      description: 'Master the art of cloud cost optimization with proven strategies and tools for AWS environments.',
      category: 'videos',
      type: 'Video',
      duration: '45 min',
      difficulty: 'Intermediate',
      author: 'David Kim',
      date: '2024-01-10',
      tags: ['aws', 'cost-optimization', 'finops'],
      featured: true,
      image: 'https://images.pexels.com/photos/1181676/pexels-photo-1181676.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 4,
      title: 'E-commerce Platform Template',
      description: 'Production-ready e-commerce architecture template with auto-scaling, CDN, and payment processing.',
      category: 'templates',
      type: 'Template',
      duration: 'Ready to use',
      difficulty: 'Intermediate',
      author: 'Sky Launchpad Team',
      date: '2024-01-08',
      tags: ['e-commerce', 'template', 'production'],
      featured: false,
      image: 'https://images.pexels.com/photos/1181678/pexels-photo-1181678.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 5,
      title: 'Building Resilient Cloud Systems',
      description: 'Join our expert panel discussion on designing fault-tolerant and resilient cloud architectures.',
      category: 'webinars',
      type: 'Webinar',
      duration: '60 min',
      difficulty: 'Advanced',
      author: 'Expert Panel',
      date: '2024-01-05',
      tags: ['resilience', 'fault-tolerance', 'webinar'],
      featured: false,
      image: 'https://images.pexels.com/photos/1181679/pexels-photo-1181679.jpeg?auto=compress&cs=tinysrgb&w=800'
    },
    {
      id: 6,
      title: 'Netflix: Scaling to 200M+ Users',
      description: 'How Netflix built and scaled their cloud architecture to serve over 200 million users worldwide.',
      category: 'case-studies',
      type: 'Case Study',
      duration: '20 min read',
      difficulty: 'Advanced',
      author: 'Industry Analysis',
      date: '2024-01-03',
      tags: ['netflix', 'scaling', 'case-study'],
      featured: true,
      image: 'https://images.pexels.com/photos/1181680/pexels-photo-1181680.jpeg?auto=compress&cs=tinysrgb&w=800'
    }
  ];

  const featuredResources = resources.filter(resource => resource.featured);

  const filteredResources = resources.filter(resource => {
    const matchesCategory = activeCategory === 'all' || resource.category === activeCategory;
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-400 bg-green-500/10';
      case 'Intermediate': return 'text-yellow-400 bg-yellow-500/10';
      case 'Advanced': return 'text-red-400 bg-red-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Guide': return <BookOpen className="w-4 h-4" />;
      case 'Video': return <Video className="w-4 h-4" />;
      case 'Template': return <FileText className="w-4 h-4" />;
      case 'Webinar': return <Users className="w-4 h-4" />;
      case 'Case Study': return <Lightbulb className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen text-text-primary">
      <Particles />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="inline-block bg-green-900/30 text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              📚 Learning Resources
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Learn, Build, and
              <span className="block bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 text-transparent bg-clip-text">
                Master Cloud Architecture
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Explore our comprehensive collection of guides, tutorials, templates, and case studies 
              to accelerate your cloud architecture journey.
            </p>
          </div>
        </section>

        {/* Featured Resources */}
        <section className="container mx-auto px-4 py-16">
          <div className="flex items-center space-x-3 mb-8">
            <Star className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-bold">Featured Resources</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {featuredResources.map((resource) => (
            <GlowingCardWrapper key={resource.id}>
              <Card variant="glass" className="overflow-hidden group" hover={true}>
                <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-600/20 relative overflow-hidden">
                  <img 
                    src={resource.image} 
                    alt={resource.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(resource.difficulty)}`}>
                      {resource.difficulty}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                      {getTypeIcon(resource.type)}
                      <span className="text-xs font-medium">{resource.type}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-3 group-hover:text-blue-400 transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-gray-300 mb-4 line-clamp-2">{resource.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{resource.duration}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>{resource.author}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {resource.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <Button className="w-full" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                    {resource.type === 'Video' ? 'Watch Now' : 
                     resource.type === 'Template' ? 'Download' : 'Read More'}
                  </Button>
                </div>
              </Card>
            </GlowingCardWrapper>
            ))}
          </div>
        </section>

        {/* Search and Filter */}
        <section className="container mx-auto px-4 py-16">
          <GlowingCardWrapper>
            <Card variant="glass" className="p-6 mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-background-secondary border border-blue-500/30 rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:border-blue-500/60 w-full sm:w-64"
                  />
                </div>
              </div>

              <div className="text-sm text-gray-400">
              <div className="text-sm text-text-tertiary">
                {filteredResources.length} resources found
              </div>
              </div>
              </div>
            </Card>
          </GlowingCardWrapper>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-3 mb-8">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    activeCategory === category.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-black/30 text-gray-400 hover:text-white hover:bg-blue-500/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{category.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* All Resources */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredResources.map((resource) => (
              <GlowingCardWrapper key={resource.id}>
                <Card variant="glass" className="overflow-hidden group" hover={true}>
                  <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-600/20 relative overflow-hidden">
                  <img 
                    src={resource.image} 
                    alt={resource.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(resource.difficulty)}`}>
                      {resource.difficulty}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                      {getTypeIcon(resource.type)}
                      <span className="text-xs font-medium">{resource.type}</span>
                    </div>
                  </div>
                  {resource.type === 'Video' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-3 group-hover:text-blue-400 transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-gray-300 mb-4 line-clamp-2">{resource.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{resource.duration}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(resource.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {resource.tags.slice(0, 2).map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-md">
                        {tag}
                      </span>
                    ))}
                    {resource.tags.length > 2 && (
                      <span className="px-2 py-1 bg-gray-500/10 text-gray-400 text-xs rounded-md">
                        +{resource.tags.length - 2}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button className="flex-1" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
                      {resource.type === 'Video' ? 'Watch' : 
                       resource.type === 'Template' ? 'Download' : 'Read'}
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Bookmark className="w-4 h-4" />}>
                      Save
                    </Button>
                  </div>
                </div>
                </Card>
              </GlowingCardWrapper>
            ))}
          </div>

          {filteredResources.length === 0 && (
            <GlowingCardWrapper>
              <Card variant="glass" className="p-12 text-center">
                <Search className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">No resources found</h3>
                <p className="text-gray-400 mb-6">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
                <Button onClick={() => { setSearchTerm(''); setActiveCategory('all'); }}>
                  Clear Filters
                </Button>
              </Card>
            </GlowingCardWrapper>
          )}
        </section>

        {/* Newsletter Signup */}
        <section className="container mx-auto px-4 py-16">
          <GlowingCardWrapper glowColor="green">
            <Card variant="glass" className="p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Stay Updated with New Resources
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Get notified when we publish new guides, templates, and case studies. 
                Join our community of cloud architects.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-black/30 border border-blue-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60"
                />
                <Button icon={<ArrowRight className="w-5 h-5" />}>
                  Subscribe
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

export default Resources;