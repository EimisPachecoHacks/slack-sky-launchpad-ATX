// Import types from external libraries
import type { User, Session } from '@supabase/supabase-js';

// Core Types
export type CloudProvider = 'aws' | 'azure' | 'gcp';
export type ResourceType = 'compute' | 'storage' | 'database' | 'network' | 'security' | 'serverless' | 'analytics' | 'ml' | 'container';
export type ConnectionType = 'HTTP/HTTPS' | 'TCP/IP' | 'Message Queue' | 'Event' | 'Database' | 'API' | 'WebSocket';
type OptimizationPreference = 'cost' | 'performance' | 'balanced';

// Position and Dimension Types
export interface Position {
  x: number;
  y: number;
}

interface Dimensions {
  width: number;
  height: number;
}

interface Bounds extends Position, Dimensions {}

// Diagram Node Types
export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  subLabel: string;
  icon: string;
  cost: number;
  description: string;
  isDragging: boolean;
  type: ResourceType;
  provider: CloudProvider;
  metadata?: Record<string, any>;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  type: ConnectionType;
  label?: string;
  cost?: number;
  bandwidth?: string;
  latency?: string;
}

// Architecture Component Types
export interface ArchitectureComponent {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  provider: CloudProvider;
  type: ResourceType;
  alternatives?: AlternativeComponent[];
  specifications?: ComponentSpecification;
}

export interface AlternativeComponent {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  performance: number;
  originalComponentId: string;
  type: ResourceType;
  provider: CloudProvider;
}

interface ComponentSpecification {
  cpu?: string;
  memory?: string;
  storage?: string;
  bandwidth?: string;
  availability?: string;
  scalability?: 'manual' | 'auto' | 'elastic';
}

// Architecture Types
export interface Architecture {
  id: string;
  name: string;
  description: string;
  provider: CloudProvider;
  components: ArchitectureComponent[];
  alternatives: AlternativeComponent[];
  diagram: DiagramData;
  optimizationPreference: OptimizationPreference;
  metadata: ArchitectureMetadata;
  createdAt: string;
  updatedAt: string;
}

interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewport: {
    zoom: number;
    pan: Position;
  };
  grid: {
    size: number;
    enabled: boolean;
    snapEnabled: boolean;
  };
}

interface ArchitectureMetadata {
  totalCost: number;
  estimatedPerformance: number;
  complexity: 'low' | 'medium' | 'high';
  tags: string[];
  lastModified: string;
  version: string;
}

// Use Case Types
interface UseCase {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  category: 'web' | 'mobile' | 'data' | 'ml' | 'iot' | 'enterprise';
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedCost: {
    min: number;
    max: number;
  };
  recommendedComponents: string[];
}

// User and Preferences Types
export interface UserPreferences {
  optimizationPreference: OptimizationPreference;
  defaultProvider: CloudProvider;
  currency: 'USD' | 'EUR' | 'GBP';
  notifications: NotificationSettings;
  ui: UIPreferences;
}

interface NotificationSettings {
  costAlerts: boolean;
  performanceAlerts: boolean;
  securityAlerts: boolean;
  maintenanceUpdates: boolean;
}

interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  autoSave: boolean;
  animationsEnabled: boolean;
}

// Deployment Types
export interface DeploymentConfig {
  id: string;
  name: string;
  provider: CloudProvider;
  region: string;
  architecture: Architecture;
  environment: 'development' | 'staging' | 'production';
  githubRepo?: string;
  cicdPipeline?: CICDConfig;
  monitoring?: MonitoringConfig;
  security?: SecurityConfig;
}

interface CICDConfig {
  provider: 'github' | 'gitlab' | 'azure' | 'jenkins';
  pipeline: string;
  triggers: string[];
  environment: Record<string, string>;
}

interface MonitoringConfig {
  enabled: boolean;
  metrics: string[];
  alerts: AlertConfig[];
  dashboardUrl?: string;
}

interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  action: 'email' | 'sms' | 'webhook';
}

interface SecurityConfig {
  encryption: boolean;
  backup: boolean;
  accessControl: 'rbac' | 'abac';
  compliance: string[];
}

// State Management Types
export interface AppState {
  auth: AuthState;
  architecture: ArchitectureState;
  ui: UIState;
  preferences: UserPreferences;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export interface ArchitectureState {
  current: Architecture | null;
  list: Architecture[];
  history: HistoryEntry[];
  loading: boolean;
  error: string | null;
  unsavedChanges: boolean;
}

export interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  fullscreenMode: boolean;
  activeTab: string;
  selectedNodes: string[];
  dragState: DragState;
  viewport: ViewportState;
}

export interface DragState {
  isDragging: boolean;
  nodeId: string | null;
  offset: Position;
  startPosition: Position;
}

export interface ViewportState {
  zoom: number;
  pan: Position;
  bounds: Bounds;
}

// History and Undo/Redo Types
export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  data: any;
  description: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  stack?: string;
}

// Canvas Types
export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
  gridSize: number;
  zoom: {
    min: number;
    max: number;
    step: number;
  };
  pan: {
    enabled: boolean;
    sensitivity: number;
  };
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  config: CanvasConfig;
  viewport: ViewportState;
}

// Event Types
export interface DiagramEvent {
  type: 'node:select' | 'node:deselect' | 'node:move' | 'node:delete' | 'edge:create' | 'edge:delete' | 'viewport:change';
  payload: any;
  timestamp: string;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: string;
  description: string;
}

// Resource Library Types
export interface ResourceTemplate {
  id: string;
  name: string;
  category: ResourceType;
  provider: CloudProvider;
  icon: string;
  description: string;
  defaultProperties: Partial<DiagramNode>;
  cost: {
    base: number;
    scaling: 'linear' | 'logarithmic' | 'stepped';
  };
}

// Export Types
export interface ExportOptions {
  format: 'png' | 'pdf' | 'svg' | 'json';
  quality: 'low' | 'medium' | 'high';
  includeBackground: boolean;
  includeGrid: boolean;
  resolution: {
    width: number;
    height: number;
  };
}

// Validation Types
export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  validate: (architecture: Architecture) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  message: string;
  suggestions?: string[];
  affectedComponents?: string[];
}

// Performance Types
export interface PerformanceMetrics {
  renderTime: number;
  nodeCount: number;
  edgeCount: number;
  memoryUsage: number;
  fps: number;
}

export interface OptimizationSuggestion {
  type: 'cost' | 'performance' | 'security' | 'reliability';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: {
    cost?: number;
    performance?: number;
  };
  implementation: string[];
}

// Third-party Integration Types
export interface Integration {
  id: string;
  name: string;
  type: 'monitoring' | 'deployment' | 'cost' | 'security';
  enabled: boolean;
  config: Record<string, any>;
  lastSync?: string;
}

// Cloud Provider Credentials Types
export interface CloudCredentials {
  id: string;
  provider: CloudProvider;
  accountId: string;
  accountName?: string;
  region?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  lastValidated?: string;
  status: 'active' | 'invalid' | 'expired';
}

export interface AWSCredentials extends CloudCredentials {
  provider: 'aws';
  roleArn: string;
  externalId?: string;
  sessionName?: string;
}

export interface AzureCredentials extends CloudCredentials {
  provider: 'azure';
  tenantId: string;
  clientId: string;
  subscriptionId: string;
}

export interface GCPCredentials extends CloudCredentials {
  provider: 'gcp';
  projectId: string;
  serviceAccountEmail?: string;
}

export type ProviderCredentials = AWSCredentials | AzureCredentials | GCPCredentials;

