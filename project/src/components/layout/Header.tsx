import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, User, Settings, LogOut, FolderPlus, BarChart3, Boxes, GraduationCap, MonitorCheck } from 'lucide-react';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import { useAuth } from '../../hooks/useAuth';

const Header: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, user, mockSignOut } = useAuth();
  
  // Check if we're in the app (authenticated areas)
  const isInApp = isAuthenticated && (
    location.pathname.startsWith('/architecture') ||
    location.pathname.startsWith('/deployment') ||
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/projects') ||
    location.pathname.startsWith('/profile') ||
    location.pathname.startsWith('/apps') ||
    location.pathname.startsWith('/learning') ||
    location.pathname.startsWith('/self-test')
  );

  const publicNavItems = [
    { path: '/', label: 'Home' },
    { path: '/features', label: 'Features' },
    { path: '/pricing', label: 'Pricing' },
    { path: '/resources', label: 'Resources' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' }
  ];

  const appNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/projects', label: 'Projects', icon: FolderPlus },
    { path: '/architecture', label: 'Quick Start', icon: Brain },
    { path: '/apps', label: 'Deployed Apps', icon: Boxes },
    { path: '/learning', label: 'How It Learned', icon: GraduationCap },
    { path: '/self-test', label: 'UI Self-Test', icon: MonitorCheck },
  ];

  const handleSignOut = () => {
    mockSignOut();
    // Navigate to home page after sign out
    window.location.href = '/';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Glass Card Background with ONLY Bottom Border */}
      <div className="backdrop-blur-xl bg-background-glass/95 border-b-[3px] border-border-primary/40">
        {/* Content Layer */}
        <div className="relative z-10 container mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            to={isAuthenticated ? "/dashboard" : "/"} 
            className="flex items-center space-x-3 text-text-primary text-xl font-semibold group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-6 h-6 text-blue-400" />
            </div>
            <span className="hidden sm:block">Sky Launchpad</span>
            <span className="sm:hidden">Sky Launchpad</span>
          </Link>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {isInApp ? (
              // App Navigation (when user is logged in and in app)
              <>
                {appNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      className={`flex items-center space-x-2 transition-colors relative group ${
                        isActive 
                          ? 'text-text-accent' 
                          : 'text-text-primary hover:text-text-accent'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      <span className={`absolute -bottom-1 left-0 h-0.5 bg-text-accent transition-all duration-300 ${
                        isActive ? 'w-full' : 'w-0 group-hover:w-full'
                      }`}></span>
                    </Link>
                  );
                })}
              </>
            ) : (
              // Public Navigation (when user is not logged in or on public pages)
              <>
                {publicNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      className={`transition-colors relative group ${
                        isActive 
                          ? 'text-text-accent' 
                          : 'text-text-primary hover:text-text-accent'
                      }`}
                    >
                      {item.label}
                      <span className={`absolute -bottom-1 left-0 h-0.5 bg-text-accent transition-all duration-300 ${
                        isActive ? 'w-full' : 'w-0 group-hover:w-full'
                      }`}></span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
          
          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <ThemeToggle variant="button" size="md" />
            
            {isAuthenticated ? (
              // Authenticated User Menu
              <div className="flex items-center space-x-3">
                {/* Quick Action Button */}
                {!isInApp && (
                  <Link to="/architecture">
                    <Button size="sm" icon={<Brain className="w-4 h-4" />}>
                      Create Project
                    </Button>
                  </Link>
                )}
                
                {/* User Menu */}
                <div className="relative group">
                  <button className="user-menu flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="hidden sm:block text-text-primary text-sm">
                      {user?.email?.split('@')[0] || 'User'}
                    </span>
                  </button>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 top-full mt-2 w-48 bg-background-card border border-border-secondary rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                    <div className="py-2">
                      <Link
                        to="/profile"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-accent transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span>Profile</span>
                      </Link>
                      <Link
                        to="/settings"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-accent transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>Cloud Settings</span>
                      </Link>
                      <Link
                        to="/billing"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-accent transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Usage & Billing</span>
                      </Link>
                      <hr className="my-2 border-border-secondary" />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-text-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors w-full text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Guest User Actions
              <>
                <Link to="/signin">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="signup-button" icon={<User className="w-4 h-4" />}>
                    Sign Up
                  </Button>
                </Link>
                
                {/* Bolt.new Logo */}
                <a 
                  href="https://bolt.new" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center hover:scale-105 transition-all duration-300 ml-3 p-2 rounded-lg bg-surface-primary/50 border border-border-secondary/50 hover:bg-surface-hover hover:border-border-primary backdrop-blur-sm"
                  title="Powered by Bolt.new"
                >
                  <img 
                    src="/logotext_poweredby_360w.png" 
                    alt="Powered by Bolt.new" 
                    className="h-6 w-auto opacity-80 hover:opacity-100 transition-opacity duration-300"
                  />
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;