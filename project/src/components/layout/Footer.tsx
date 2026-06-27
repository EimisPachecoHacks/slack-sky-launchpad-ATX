import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Github, Twitter, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-background-secondary backdrop-blur-sm text-text-primary py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="flex items-center space-x-2 mb-4">
              <Brain className="w-8 h-8 text-blue-400" />
              <span className="text-xl font-semibold text-text-primary">Sky Launchpad</span>
            </Link>
            <p className="text-text-secondary mb-4">
              Transform your cloud infrastructure design process with AI-powered intelligence
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-text-secondary hover:text-blue-400 transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-text-secondary hover:text-blue-400 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-text-secondary hover:text-blue-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4 text-text-primary">Product</h3>
            <ul className="space-y-2">
              <li><Link to="/features" className="text-text-secondary hover:text-blue-400 transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="text-text-secondary hover:text-blue-400 transition-colors">Pricing</Link></li>
              <li><Link to="/case-studies" className="text-text-secondary hover:text-blue-400 transition-colors">Case Studies</Link></li>
              <li><Link to="/documentation" className="text-text-secondary hover:text-blue-400 transition-colors">Documentation</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4 text-text-primary">Resources</h3>
            <ul className="space-y-2">
              <li><Link to="/blog" className="text-text-secondary hover:text-blue-400 transition-colors">Blog</Link></li>
              <li><Link to="/tutorials" className="text-text-secondary hover:text-blue-400 transition-colors">Tutorials</Link></li>
              <li><Link to="/webinars" className="text-text-secondary hover:text-blue-400 transition-colors">Webinars</Link></li>
              <li><Link to="/support" className="text-text-secondary hover:text-blue-400 transition-colors">Support</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4 text-text-primary">Company</h3>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-text-secondary hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link to="/careers" className="text-text-secondary hover:text-blue-400 transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="text-text-secondary hover:text-blue-400 transition-colors">Contact</Link></li>
              <li><Link to="/press" className="text-text-secondary hover:text-blue-400 transition-colors">Press</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border-secondary mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-text-tertiary text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Sky Launchpad. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <Link to="/privacy" className="text-text-tertiary hover:text-blue-400 text-sm transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-text-tertiary hover:text-blue-400 text-sm transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="text-text-tertiary hover:text-blue-400 text-sm transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;