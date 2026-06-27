import React from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import GlowingCardWrapper from '../components/ui/GlowingCardWrapper';
import Button from '../components/ui/Button';
import Particles from '../components/ui/Particles';
import { 
  Brain, 
  Users, 
  Target, 
  Award, 
  Globe, 
  Zap,
  Heart,
  Lightbulb,
  Shield,
  TrendingUp,
  Github,
  Linkedin,
  Twitter,
  Mail,
  MapPin,
  Calendar,
  Star
} from 'lucide-react';

const About: React.FC = () => {
  const team = [
    {
      name: 'Sarah Chen',
      role: 'CEO & Co-Founder',
      bio: 'Former AWS Solutions Architect with 10+ years in cloud infrastructure. Led architecture teams at Fortune 500 companies.',
      image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=400',
      social: {
        linkedin: '#',
        twitter: '#',
        github: '#'
      }
    },
    {
      name: 'Michael Rodriguez',
      role: 'CTO & Co-Founder',
      bio: 'AI/ML expert and former Google Cloud engineer. Specialized in building scalable systems and machine learning platforms.',
      image: 'https://images.pexels.com/photos/1181687/pexels-photo-1181687.jpeg?auto=compress&cs=tinysrgb&w=400',
      social: {
        linkedin: '#',
        twitter: '#',
        github: '#'
      }
    },
    {
      name: 'Emily Johnson',
      role: 'Head of Product',
      bio: 'Product leader with experience at Microsoft Azure. Passionate about creating intuitive tools for complex technical challenges.',
      image: 'https://images.pexels.com/photos/1181688/pexels-photo-1181688.jpeg?auto=compress&cs=tinysrgb&w=400',
      social: {
        linkedin: '#',
        twitter: '#'
      }
    },
    {
      name: 'David Kim',
      role: 'Lead AI Engineer',
      bio: 'PhD in Computer Science, former researcher at Stanford AI Lab. Expert in natural language processing and architectural reasoning.',
      image: 'https://images.pexels.com/photos/1181689/pexels-photo-1181689.jpeg?auto=compress&cs=tinysrgb&w=400',
      social: {
        linkedin: '#',
        github: '#'
      }
    }
  ];

  const values = [
    {
      icon: <Brain className="w-8 h-8 text-blue-400" />,
      title: 'Innovation First',
      description: 'We push the boundaries of what\'s possible with AI and cloud technology to solve real-world problems.'
    },
    {
      icon: <Users className="w-8 h-8 text-purple-400" />,
      title: 'Customer Obsession',
      description: 'Every decision we make is driven by our commitment to helping our customers succeed and grow.'
    },
    {
      icon: <Shield className="w-8 h-8 text-green-400" />,
      title: 'Trust & Security',
      description: 'We build with security and privacy at the core, ensuring your data and architectures are always protected.'
    },
    {
      icon: <Heart className="w-8 h-8 text-red-400" />,
      title: 'Inclusive Community',
      description: 'We believe diverse perspectives make better solutions and foster an inclusive environment for all.'
    }
  ];

  const milestones = [
    {
      year: '2023',
      title: 'Company Founded',
      description: 'Sky Launchpad was founded with a vision to democratize cloud architecture design through AI.'
    },
    {
      year: '2023',
      title: 'Seed Funding',
      description: 'Raised $5M in seed funding from leading VCs to accelerate product development.'
    },
    {
      year: '2024',
      title: 'Beta Launch',
      description: 'Launched private beta with 100+ enterprise customers and received overwhelming positive feedback.'
    },
    {
      year: '2024',
      title: 'Public Launch',
      description: 'Officially launched Sky Launchpad to the public, serving thousands of architects worldwide.'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Architectures Created' },
    { number: '500+', label: 'Enterprise Customers' },
    { number: '50+', label: 'Countries Served' },
    { number: '99.9%', label: 'Uptime SLA' }
  ];

  return (
    <div className="min-h-screen text-white">
      <Particles />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <div className="inline-block bg-purple-900/30 text-purple-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
              🚀 About Sky Launchpad
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Building the Future of
              <span className="block bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-500 text-transparent bg-clip-text">
                Cloud Architecture
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              We're on a mission to democratize cloud architecture design through AI, 
              making it accessible for everyone to build scalable, secure, and cost-effective 
              cloud infrastructures.
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <GlowingCardWrapper>
              <Card variant="glass" className="p-8">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                    <Target className="w-6 h-6 text-blue-400" />
                  </div>
                  <h2 className="text-2xl font-bold">Our Mission</h2>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  To empower every developer, architect, and organization to design and deploy 
                  world-class cloud infrastructures through intelligent automation, best practices, 
                  and collaborative tools. We believe that great architecture should be accessible 
                  to everyone, not just cloud experts.
                </p>
              </Card>
            </GlowingCardWrapper>

            <GlowingCardWrapper glowColor="purple">
              <Card variant="glass" className="p-8">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 flex items-center justify-center">
                    <Lightbulb className="w-6 h-6 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold">Our Vision</h2>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  A world where creating robust, scalable cloud architectures is as simple as 
                  describing your requirements in plain language. Where AI handles the complexity, 
                  best practices are automatically applied, and teams can focus on innovation 
                  rather than infrastructure concerns.
                </p>
              </Card>
            </GlowingCardWrapper>
          </div>
        </section>

        {/* Stats */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <Card key={index} variant="glass" className="p-6 text-center" hover={true}>
                <div className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                  {stat.number}
                </div>
                <div className="text-gray-400">{stat.label}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* Our Values */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Our Values</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              The principles that guide everything we do and every decision we make.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <GlowingCardWrapper key={index}>
                <Card variant="glass" className="p-8" hover={true}>
                  <div className="flex items-start space-x-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center flex-shrink-0">
                      {value.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                      <p className="text-gray-300">{value.description}</p>
                    </div>
                  </div>
                </Card>
              </GlowingCardWrapper>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Our Journey</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              From idea to reality - the key milestones in our mission to transform cloud architecture.
            </p>
          </div>
          
          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-blue-500 to-purple-500"></div>
            
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div key={index} className="relative">
                  <div className="absolute left-1/2 top-6 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full border-4 border-black z-10"></div>
                  
                  <div className={index % 2 === 0 ? 'ml-auto pr-8 lg:w-1/2 lg:pr-12' : 'mr-auto pl-8 lg:w-1/2 lg:pl-12'}>
                    <GlowingCardWrapper>
                      <Card variant="glass" className="p-6">
                        <div className="flex items-center space-x-3 mb-3">
                          <Calendar className="w-5 h-5 text-blue-400" />
                          <span className="text-blue-400 font-bold">{milestone.year}</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3">{milestone.title}</h3>
                        <p className="text-gray-300">{milestone.description}</p>
                      </Card>
                    </GlowingCardWrapper>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Meet Our Team</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              The passionate individuals behind Sky Launchpad, bringing together decades of experience 
              in cloud computing, AI, and product development.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <GlowingCardWrapper key={index}>
                <Card variant="glass" className="p-6 text-center" hover={true}>
                  <div className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden">
                    <img 
                      src={member.image} 
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{member.name}</h3>
                  <p className="text-blue-400 mb-4">{member.role}</p>
                  <p className="text-gray-300 text-sm mb-6">{member.bio}</p>
                  
                  <div className="flex justify-center space-x-3">
                    {member.social.linkedin && (
                      <a href={member.social.linkedin} className="text-gray-400 hover:text-blue-400 transition-colors">
                        <Linkedin className="w-5 h-5" />
                      </a>
                    )}
                    {member.social.twitter && (
                      <a href={member.social.twitter} className="text-gray-400 hover:text-blue-400 transition-colors">
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {member.social.github && (
                      <a href={member.social.github} className="text-gray-400 hover:text-blue-400 transition-colors">
                        <Github className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </Card>
              </GlowingCardWrapper>
            ))}
          </div>
        </section>

        {/* Investors & Partners */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Backed by the Best</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              We're proud to be supported by leading investors and partners who share our vision.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {['Sequoia Capital', 'Andreessen Horowitz', 'Google Ventures', 'AWS'].map((investor, index) => (
              <Card key={index} variant="glass" className="p-6 text-center" hover={true}>
                <div className="text-2xl font-bold text-gray-400">{investor}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="container mx-auto px-4 py-16">
          <GlowingCardWrapper glowColor="green">
            <Card variant="glass" className="p-12 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Want to Join Our Mission?
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                We're always looking for talented individuals who are passionate about 
                cloud technology and want to make a difference.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" icon={<Users className="w-5 h-5" />}>
                  View Open Positions
                </Button>
                <Button size="lg" variant="outline" icon={<Mail className="w-5 h-5" />}>
                  Contact Us
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

export default About;