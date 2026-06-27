import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ThemeToggle from '../components/ui/ThemeToggle';
import Particles from '../components/ui/Particles';
import { 
  User, 
  Mail, 
  Lock, 
  Bell, 
  Shield, 
  CreditCard, 
  Download,
  Eye,
  EyeOff,
  Check,
  X,
  Settings,
  Trash2,
  AlertTriangle,
  Palette,
  Monitor,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme, setLightTheme, setDarkTheme, isLight, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    fullName: user?.email?.split('@')[0] || 'Demo User',
    email: user?.email || 'demo@skyrchitect.com',
    company: 'Sky Launchpad Inc.',
    jobTitle: 'Cloud Architect',
    timezone: 'UTC-8 (Pacific Time)',
    language: 'English'
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    projectUpdates: true,
    deploymentAlerts: true,
    weeklyReports: false,
    marketingEmails: false
  });

  const [preferences, setPreferences] = useState({
    theme: theme,
    autoSave: true,
    compactMode: false,
    showTooltips: true,
    animationsEnabled: true
  });

  const [apiKeys] = useState([
    {
      id: '1',
      name: 'Production API Key',
      key: 'sk_prod_1234...5678',
      created: '2024-01-15',
      lastUsed: '2 hours ago',
      permissions: ['read', 'write']
    },
    {
      id: '2',
      name: 'Development API Key',
      key: 'sk_dev_abcd...efgh',
      created: '2024-01-10',
      lastUsed: '1 day ago',
      permissions: ['read']
    }
  ]);

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    console.log('Updating profile:', profileData);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call
    console.log('Changing password');
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handlePreferenceChange = (key: string, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    
    // Handle theme changes
    if (key === 'theme') {
      if (value === 'light') {
        setLightTheme();
      } else if (value === 'dark') {
        setDarkTheme();
      }
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'api', label: 'API Keys', icon: Settings },
    { id: 'billing', label: 'Billing', icon: CreditCard }
  ];

  const renderProfileTab = () => (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-6 text-text-primary">Profile Information</h3>
      
      <form onSubmit={handleProfileUpdate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={profileData.fullName}
              onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Company
            </label>
            <input
              type="text"
              value={profileData.company}
              onChange={(e) => setProfileData(prev => ({ ...prev, company: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Job Title
            </label>
            <input
              type="text"
              value={profileData.jobTitle}
              onChange={(e) => setProfileData(prev => ({ ...prev, jobTitle: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Timezone
            </label>
            <select
              value={profileData.timezone}
              onChange={(e) => setProfileData(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg focus:outline-none"
            >
              <option value="UTC-8 (Pacific Time)">UTC-8 (Pacific Time)</option>
              <option value="UTC-5 (Eastern Time)">UTC-5 (Eastern Time)</option>
              <option value="UTC+0 (GMT)">UTC+0 (GMT)</option>
              <option value="UTC+1 (CET)">UTC+1 (CET)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Language
            </label>
            <select
              value={profileData.language}
              onChange={(e) => setProfileData(prev => ({ ...prev, language: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button type="submit">
            Save Changes
          </Button>
        </div>
      </form>
    </Card>
  );

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      {/* Theme Settings */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 text-text-primary">Appearance & Theme</h3>
        
        <div className="space-y-6">
          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-4">
              Color Theme
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Theme */}
              <button
                onClick={() => handlePreferenceChange('theme', 'light')}
                className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                  isLight
                    ? 'border-border-accent bg-surface-hover'
                    : 'border-border-secondary hover:border-border-primary'
                }`}
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center">
                    <Sun className="w-4 h-4 text-gray-700" />
                  </div>
                  <span className="font-medium text-text-primary">Light</span>
                  {isLight && <Check className="w-5 h-5 text-text-accent ml-auto" />}
                </div>
                <div className="text-xs text-text-secondary text-left">
                  Clean and bright interface perfect for daytime use
                </div>
              </button>

              {/* Dark Theme */}
              <button
                onClick={() => handlePreferenceChange('theme', 'dark')}
                className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                  isDark
                    ? 'border-border-accent bg-surface-hover'
                    : 'border-border-secondary hover:border-border-primary'
                }`}
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Moon className="w-4 h-4 text-gray-300" />
                  </div>
                  <span className="font-medium text-text-primary">Dark</span>
                  {isDark && <Check className="w-5 h-5 text-text-accent ml-auto" />}
                </div>
                <div className="text-xs text-text-secondary text-left">
                  Easy on the eyes for extended use and low-light environments
                </div>
              </button>

              {/* System Theme */}
              <button
                className="p-4 rounded-lg border-2 border-border-secondary hover:border-border-primary transition-all duration-300"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Monitor className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-text-primary">System</span>
                </div>
                <div className="text-xs text-text-secondary text-left">
                  Automatically matches your system preference
                </div>
              </button>
            </div>
          </div>

          {/* Quick Theme Toggle */}
          <div className="flex items-center justify-between p-4 bg-surface-primary rounded-lg">
            <div>
              <h4 className="font-medium text-text-primary mb-1">Quick Theme Toggle</h4>
              <p className="text-sm text-text-secondary">Toggle between light and dark themes</p>
            </div>
            <ThemeToggle variant="switch" showLabel={false} />
          </div>
        </div>
      </Card>

      {/* Interface Preferences */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 text-text-primary">Interface Preferences</h3>
        
        <div className="space-y-6">
          {Object.entries({
            autoSave: { label: 'Auto-save changes', description: 'Automatically save your work as you make changes' },
            compactMode: { label: 'Compact mode', description: 'Use a more condensed interface layout' },
            showTooltips: { label: 'Show tooltips', description: 'Display helpful tooltips when hovering over elements' },
            animationsEnabled: { label: 'Enable animations', description: 'Show smooth transitions and animations' }
          }).map(([key, config]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-text-primary mb-1">{config.label}</h4>
                <p className="text-sm text-text-secondary">{config.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences[key as keyof typeof preferences] as boolean}
                  onChange={(e) => handlePreferenceChange(key, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-background-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 text-text-primary">Change Password</h3>
        
        <form onSubmit={handlePasswordChange} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full px-4 py-3 pr-12 rounded-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-accent"
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-4 py-3 pr-12 rounded-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-accent"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-4 py-3 pr-12 rounded-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-tertiary hover:text-text-accent"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button type="submit">
              Update Password
            </Button>
          </div>
        </form>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 text-text-primary">Two-Factor Authentication</h3>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium mb-1 text-text-primary">Authenticator App</h4>
            <p className="text-text-secondary text-sm">Use an authenticator app to generate verification codes</p>
          </div>
          <Button variant="outline">
            Enable 2FA
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderNotificationsTab = () => (
    <Card className="p-6">
      <h3 className="text-xl font-bold mb-6 text-text-primary">Notification Preferences</h3>
      
      <div className="space-y-6">
        {Object.entries(notifications).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <h4 className="font-medium mb-1 text-text-primary">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </h4>
              <p className="text-text-secondary text-sm">
                {key === 'emailNotifications' && 'Receive email notifications for important updates'}
                {key === 'projectUpdates' && 'Get notified when your projects are updated'}
                {key === 'deploymentAlerts' && 'Receive alerts about deployment status changes'}
                {key === 'weeklyReports' && 'Get weekly summary reports of your projects'}
                {key === 'marketingEmails' && 'Receive product updates and marketing communications'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => handleNotificationChange(key, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderApiTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-text-primary">API Keys</h3>
          <Button>
            Generate New Key
          </Button>
        </div>
        
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div key={key.id} className="p-4 bg-surface-primary rounded-lg border border-border-secondary">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-text-primary">{key.name}</h4>
                <div className="flex space-x-2">
                  <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4" />}>
                    Download
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />}>
                    Revoke
                  </Button>
                </div>
              </div>
              <div className="text-sm text-text-secondary mb-2">
                <span className="font-mono bg-surface-secondary px-2 py-1 rounded">{key.key}</span>
              </div>
              <div className="flex items-center space-x-4 text-xs text-text-tertiary">
                <span>Created: {key.created}</span>
                <span>Last used: {key.lastUsed}</span>
                <span>Permissions: {key.permissions.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderBillingTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 text-text-primary">Current Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-medium mb-1 text-text-primary">Professional Plan</h4>
            <p className="text-text-secondary">$29/month • Billed monthly</p>
          </div>
          <Button variant="outline">
            Change Plan
          </Button>
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 text-text-primary">Usage This Month</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold text-text-primary">12</div>
            <div className="text-text-secondary text-sm">Projects Created</div>
            <div className="text-xs text-text-tertiary">of 50 included</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">156</div>
            <div className="text-text-secondary text-sm">API Calls</div>
            <div className="text-xs text-text-tertiary">of 10,000 included</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-text-primary">8</div>
            <div className="text-text-secondary text-sm">Deployments</div>
            <div className="text-xs text-text-tertiary">of unlimited</div>
          </div>
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-6 text-text-primary">Payment Method</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">VISA</span>
            </div>
            <div>
              <div className="font-medium text-text-primary">•••• •••• •••• 4242</div>
              <div className="text-text-secondary text-sm">Expires 12/25</div>
            </div>
          </div>
          <Button variant="outline">
            Update
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen text-text-primary">
      <Particles />
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Account Settings</h1>
            <p className="text-text-secondary">Manage your account preferences and settings</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-4">
                <nav className="space-y-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                          activeTab === tab.id
                            ? 'bg-surface-hover text-text-accent border border-border-accent'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </Card>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
              {activeTab === 'profile' && renderProfileTab()}
              {activeTab === 'preferences' && renderPreferencesTab()}
              {activeTab === 'security' && renderSecurityTab()}
              {activeTab === 'notifications' && renderNotificationsTab()}
              {activeTab === 'api' && renderApiTab()}
              {activeTab === 'billing' && renderBillingTab()}
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Profile;