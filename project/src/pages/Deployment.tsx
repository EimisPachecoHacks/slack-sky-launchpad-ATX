import React, { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import DeploymentForm from '../components/deployment/DeploymentForm';
import Particles from '../components/ui/Particles';
import Card from '../components/ui/Card';
import { Architecture, DeploymentConfig } from '../types';
import { Loader, CheckCircle, GitBranch } from 'lucide-react';
import { api } from '../services/api';
import LiveNarrationToggle from '../components/LiveNarrationToggle';
import LearningPanel from '../components/learning/LearningPanel';
import SelfTestPanel from '../components/uitest/SelfTestPanel';
import AppsDashboard from '../components/apps/AppsDashboard';

const Deployment: React.FC = () => {
  const location = useLocation();
  const { architecture } = location.state as { architecture: Architecture } || {};

  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [deploymentUrl, setDeploymentUrl] = useState<string>('');
  const [gitlabMrUrl, setGitlabMrUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState(0);

  // Elapsed time ticker
  React.useEffect(() => {
    if (!isDeploying) return;
    setElapsedSeconds(0);
    const timer = setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [isDeploying]);

  const handleDeploy = async (config: DeploymentConfig) => {
    setIsDeploying(true);
    setDeploymentLogs([]);
    setError(null);
    setElapsedSeconds(0);

    try {
      console.log('🚀 Starting deployment...');
      setDeploymentLogs(prev => [...prev, '[INFO] Initializing deployment process...']);
      setDeploymentLogs(prev => [...prev, `[INFO] Deploying to ${config.provider.toUpperCase()} in ${config.region}...`]);

      const response = await api.deployArchitecture(architecture, config);

      if (response.success && response.data) {
        const { deployment_logs, endpoint, gitlab_mr_url } = response.data;

        deployment_logs.forEach((log: string, index: number) => {
          setTimeout(() => {
            setDeploymentLogs(prev => [...prev, log]);

            if (index === deployment_logs.length - 1) {
              setDeploymentUrl(endpoint || `https://${config.provider}-app.example.com`);
              if (gitlab_mr_url) setGitlabMrUrl(gitlab_mr_url);
              setFinalElapsed(elapsedSeconds);
              setIsDeploying(false);
              setDeploymentComplete(true);
              console.log('✅ Deployment completed successfully!');
            }
          }, (index + 1) * 500);
        });
      } else {
        throw new Error('Deployment failed');
      }
    } catch (err) {
      console.error('❌ Deployment error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Deployment failed';
      setError(errorMsg);
      setDeploymentLogs(prev => [...prev, `[ERROR] ${errorMsg}`]);
      setFinalElapsed(elapsedSeconds);
      setIsDeploying(false);
    }
  };
  
  // Redirect if no architecture is provided
  if (!architecture) {
    return <Navigate to="/architecture" replace />;
  }

  return (
    <div className="min-h-screen text-white">
      <Particles />
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">
            Deploy Your Architecture
          </h1>

          <div className="flex justify-end mb-4">
            <LiveNarrationToggle />
          </div>

          {!isDeploying && !deploymentComplete ? (
            <DeploymentForm architecture={architecture} onDeploy={handleDeploy} />
          ) : (
            <Card className="p-8 max-w-3xl mx-auto">
              <div className="flex items-center justify-center mb-6">
                {isDeploying ? (
                  <div className="flex flex-col items-center">
                    <Loader className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <h2 className="text-2xl font-bold">Deploying Architecture</h2>
                    <div className="text-3xl font-mono font-bold text-blue-400 mt-3">
                      {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                    </div>
                    <p className="text-gray-400 mt-2">Terraform is provisioning your infrastructure...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                    <h2 className="text-2xl font-bold">Deployment Complete!</h2>
                    <p className="text-gray-300 mt-2">
                      Your architecture has been successfully deployed to {architecture.provider.toUpperCase()}
                      {finalElapsed > 0 && (
                        <span className="block text-sm text-gray-400 mt-1">
                          Completed in {Math.floor(finalElapsed / 60)}m {finalElapsed % 60}s
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto">
                {deploymentLogs.map((log, index) => (
                  <div key={index} className="py-1">
                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>{' '}
                    <span 
                      className={
                        log.includes('error') || log.includes('Error') 
                          ? 'text-red-400' 
                          : log.includes('completed') || log.includes('success')
                            ? 'text-green-400'
                            : 'text-gray-300'
                      }
                    >
                      {log}
                    </span>
                  </div>
                ))}
                
                {isDeploying && (
                  <div className="py-1 flex items-center">
                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>{' '}
                    <span className="text-blue-400 ml-1 flex items-center">
                      Processing
                      <span className="ml-1 inline-flex">
                        <span className="animate-pulse">.</span>
                        <span className="animate-pulse delay-100">.</span>
                        <span className="animate-pulse delay-200">.</span>
                      </span>
                    </span>
                  </div>
                )}
              </div>
              
              {deploymentComplete && (
                <div className="mt-6 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <h3 className="font-bold text-green-400 mb-2">Deployment Summary</h3>
                  <ul className="text-sm text-gray-300 space-y-2">
                    <li>
                      <span className="text-gray-500">Provider:</span> {architecture.provider.toUpperCase()}
                    </li>
                    <li>
                      <span className="text-gray-500">Components:</span> {architecture.components.length} resources
                    </li>
                    <li>
                      <span className="text-gray-500">Estimated Monthly Cost:</span> ${
                        architecture.components.reduce((sum, comp) => sum + comp.cost, 0).toFixed(2)
                      }
                    </li>
                    <li>
                      <span className="text-gray-500">Deployment Status:</span> <span className="text-green-400">Successful</span>
                    </li>
                    <li>
                      <span className="text-gray-500">Access URL:</span> <a href={deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{deploymentUrl}</a>
                    </li>
                  </ul>

                  {gitlabMrUrl && (
                    <div className="mt-4 pt-4 border-t border-green-500/20">
                      <div className="flex items-center space-x-2 mb-2">
                        <GitBranch className="w-4 h-4 text-orange-400" />
                        <span className="text-orange-400 font-semibold text-sm">GitLab Duo — Code Committed</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        Deployment-validated Terraform code has been saved to GitLab via the Code Committer agent.
                      </p>
                      <a
                        href={gitlabMrUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-md text-orange-300 text-sm hover:bg-orange-500/30 transition-colors"
                      >
                        <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                        View Merge Request on GitLab
                      </a>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-6 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <h3 className="font-bold text-red-400 mb-2">Deployment Failed</h3>
                  <p className="text-sm text-gray-300">{error}</p>
                </div>
              )}
            </Card>
          )}

          <div className="mt-10">
            <LearningPanel />
          </div>

          <div className="mt-10">
            <AppsDashboard />
          </div>

          <div className="mt-10">
            <SelfTestPanel />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Deployment;