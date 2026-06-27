import React, { useState, useEffect } from 'react';
import { Code, Copy, Check, Download, Loader } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Architecture } from '../../types';
import { api } from '../../services/api';

interface CodeGeneratorProps {
  architecture: Architecture;
}

const CodeGenerator: React.FC<CodeGeneratorProps> = ({ architecture }) => {
  const [activeTab, setActiveTab] = useState<'terraform' | 'cloudformation'>('terraform');
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{ terraform?: string; cloudformation?: string }>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;
    setElapsedSeconds(0);
    const timer = setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Generate code when component mounts or tab changes
  useEffect(() => {
    const generateCode = async (retryCount = 0) => {
      const maxRetries = 3;

      // Skip if code already generated
      if (generatedCode[activeTab]) return;

      setIsGenerating(true);
      setError(null);

      try {
        console.log(`🔨 Generating ${activeTab} code... (Attempt ${retryCount + 1}/${maxRetries})`);
        const response = await api.generateCode(architecture, activeTab);

        if (response.success && response.data.code) {
          setGeneratedCode(prev => ({
            ...prev,
            [activeTab]: response.data.code
          }));
          console.log(`✅ ${activeTab} code generated successfully`);
          setIsGenerating(false);
        } else {
          throw new Error('Code generation failed: Invalid response from server');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate code';
        console.error(`❌ Error generating code (Attempt ${retryCount + 1}/${maxRetries}):`, err);

        // Retry logic
        if (retryCount < maxRetries - 1) {
          console.log(`🔄 Retrying code generation... (${retryCount + 2}/${maxRetries})`);
          setTimeout(() => generateCode(retryCount + 1), 2000); // Wait 2 seconds before retry
          return;
        }

        // After 3 retries, show final error
        console.error(`❌ Code generation failed after ${maxRetries} attempts`);
        setError(`Failed to generate ${activeTab} code after ${maxRetries} attempts: ${errorMessage}`);
        setIsGenerating(false);
      }
    };

    if (!generatedCode[activeTab] && !isGenerating) {
      generateCode();
    }
  }, [activeTab, architecture]);

  const getFallbackCode = () => {
    // Use existing hardcoded templates as fallback
    return getCodeSnippet();
  };

  const getCodeSnippet = () => {
    if (architecture.provider === 'aws') {
      if (activeTab === 'terraform') {
        return `# Terraform code for AWS architecture
provider "aws" {
  region = "us-west-2"
}

# VPC and Networking
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
  
  tags = {
    Name = "main-vpc"
  }
}

resource "aws_subnet" "public" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"
  availability_zone = "us-west-2a"
  
  tags = {
    Name = "public-subnet"
  }
}

resource "aws_subnet" "private" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.2.0/24"
  availability_zone = "us-west-2b"
  
  tags = {
    Name = "private-subnet"
  }
}

# Security Groups
resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Security group for web servers"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Instance
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  subnet_id     = aws_subnet.public.id
  security_groups = [aws_security_group.web.id]
  
  tags = {
    Name = "web-server"
  }
}

# S3 Bucket
resource "aws_s3_bucket" "data" {
  bucket = "my-app-data-bucket"
  acl    = "private"
  
  versioning {
    enabled = true
  }
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

# RDS Database
resource "aws_db_instance" "database" {
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "mysql"
  engine_version       = "5.7"
  instance_class       = "db.t3.micro"
  name                 = "myapp"
  username             = "admin"
  password             = "password"
  parameter_group_name = "default.mysql5.7"
  skip_final_snapshot  = true
  db_subnet_group_name = aws_db_subnet_group.default.name
}

resource "aws_db_subnet_group" "default" {
  name       = "main"
  subnet_ids = [aws_subnet.private.id, aws_subnet.public.id]
}`;
      } else {
        return `{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "AWS CloudFormation Template for Application Architecture",
  "Resources": {
    "VPC": {
      "Type": "AWS::EC2::VPC",
      "Properties": {
        "CidrBlock": "10.0.0.0/16",
        "EnableDnsSupport": true,
        "EnableDnsHostnames": true,
        "Tags": [{ "Key": "Name", "Value": "main-vpc" }]
      }
    },
    "PublicSubnet": {
      "Type": "AWS::EC2::Subnet",
      "Properties": {
        "VpcId": { "Ref": "VPC" },
        "CidrBlock": "10.0.1.0/24",
        "AvailabilityZone": "us-west-2a",
        "Tags": [{ "Key": "Name", "Value": "public-subnet" }]
      }
    },
    "PrivateSubnet": {
      "Type": "AWS::EC2::Subnet",
      "Properties": {
        "VpcId": { "Ref": "VPC" },
        "CidrBlock": "10.0.2.0/24",
        "AvailabilityZone": "us-west-2b",
        "Tags": [{ "Key": "Name", "Value": "private-subnet" }]
      }
    },
    "WebSecurityGroup": {
      "Type": "AWS::EC2::SecurityGroup",
      "Properties": {
        "GroupDescription": "Security group for web servers",
        "VpcId": { "Ref": "VPC" },
        "SecurityGroupIngress": [
          {
            "IpProtocol": "tcp",
            "FromPort": 80,
            "ToPort": 80,
            "CidrIp": "0.0.0.0/0"
          },
          {
            "IpProtocol": "tcp",
            "FromPort": 443,
            "ToPort": 443,
            "CidrIp": "0.0.0.0/0"
          }
        ],
        "SecurityGroupEgress": [
          {
            "IpProtocol": "-1",
            "FromPort": 0,
            "ToPort": 0,
            "CidrIp": "0.0.0.0/0"
          }
        ]
      }
    },
    "WebInstance": {
      "Type": "AWS::EC2::Instance",
      "Properties": {
        "InstanceType": "t3.micro",
        "SecurityGroupIds": [{ "Ref": "WebSecurityGroup" }],
        "SubnetId": { "Ref": "PublicSubnet" },
        "ImageId": "ami-0c55b159cbfafe1f0",
        "Tags": [{ "Key": "Name", "Value": "web-server" }]
      }
    },
    "DataBucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {
        "BucketName": "my-app-data-bucket",
        "VersioningConfiguration": {
          "Status": "Enabled"
        },
        "BucketEncryption": {
          "ServerSideEncryptionConfiguration": [
            {
              "ServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
              }
            }
          ]
        }
      }
    },
    "DBSubnetGroup": {
      "Type": "AWS::RDS::DBSubnetGroup",
      "Properties": {
        "DBSubnetGroupDescription": "Subnet group for RDS database",
        "SubnetIds": [
          { "Ref": "PrivateSubnet" },
          { "Ref": "PublicSubnet" }
        ]
      }
    },
    "Database": {
      "Type": "AWS::RDS::DBInstance",
      "Properties": {
        "AllocatedStorage": 20,
        "StorageType": "gp2",
        "Engine": "mysql",
        "EngineVersion": "5.7",
        "DBInstanceClass": "db.t3.micro",
        "DBName": "myapp",
        "MasterUsername": "admin",
        "MasterUserPassword": "password",
        "DBSubnetGroupName": { "Ref": "DBSubnetGroup" },
        "VPCSecurityGroups": [{ "Ref": "WebSecurityGroup" }]
      }
    }
  }
}`;
      }
    } else if (architecture.provider === 'azure') {
      return `# Terraform code for Azure architecture
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "my-resource-group"
  location = "West US 2"
}

resource "azurerm_virtual_network" "main" {
  name                = "main-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_subnet" "internal" {
  name                 = "internal-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.2.0/24"]
}

resource "azurerm_network_interface" "main" {
  name                = "main-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.internal.id
    private_ip_address_allocation = "Dynamic"
  }
}

resource "azurerm_linux_virtual_machine" "main" {
  name                = "app-vm"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = "Standard_B2s"
  admin_username      = "adminuser"
  network_interface_ids = [
    azurerm_network_interface.main.id,
  ]

  admin_ssh_key {
    username   = "adminuser"
    public_key = file("~/.ssh/id_rsa.pub")
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "UbuntuServer"
    sku       = "18.04-LTS"
    version   = "latest"
  }
}

resource "azurerm_storage_account" "main" {
  name                     = "mystorageaccount"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "data" {
  name                  = "data"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_mssql_server" "main" {
  name                         = "my-sql-server"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = "adminuser"
  administrator_login_password = "P@ssw0rd1234!"
}

resource "azurerm_mssql_database" "main" {
  name           = "myapp-db"
  server_id      = azurerm_mssql_server.main.id
  collation      = "SQL_Latin1_General_CP1_CI_AS"
  license_type   = "LicenseIncluded"
  max_size_gb    = 2
  sku_name       = "Basic"
}`;
    } else if (architecture.provider === 'gcp') {
      return `# Terraform code for GCP architecture
provider "google" {
  project = "my-project"
  region  = "us-west1"
  zone    = "us-west1-a"
}

resource "google_compute_network" "vpc_network" {
  name                    = "my-vpc-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "my-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = "us-west1"
  network       = google_compute_network.vpc_network.id
}

resource "google_compute_firewall" "web" {
  name    = "web-firewall"
  network = google_compute_network.vpc_network.id

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web"]
}

resource "google_compute_instance" "vm_instance" {
  name         = "my-vm"
  machine_type = "e2-medium"
  tags         = ["web"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-10"
    }
  }

  network_interface {
    network    = google_compute_network.vpc_network.id
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      // Ephemeral IP
    }
  }
}

resource "google_storage_bucket" "data_bucket" {
  name          = "my-app-data-bucket"
  location      = "US"
  force_destroy = true

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

resource "google_sql_database_instance" "main" {
  name             = "my-database-instance"
  database_version = "MYSQL_5_7"
  region           = "us-west1"

  settings {
    tier = "db-f1-micro"
    ip_configuration {
      ipv4_enabled = true
    }
  }
}

resource "google_sql_database" "database" {
  name     = "my-database"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "users" {
  name     = "admin"
  instance = google_sql_database_instance.main.name
  password = "password"
}`;
    }
    
    return '# No code available for the selected provider';
  };
  
  const handleCopyCode = () => {
    const code = generatedCode[activeTab];
    if (!code) return;

    navigator.clipboard.writeText(code);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleDownloadCode = () => {
    const code = generatedCode[activeTab];
    if (!code) return;

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'terraform' ? 'main.tf' : 'template.json';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className={`${architecture.provider}-theme`}>
      <div className="component-glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-bold">Infrastructure as Code</h3>
            {isGenerating && (
              <div className="flex items-center space-x-2 text-sm text-blue-400">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Generating {activeTab} code... ({Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')})</span>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={activeTab === 'terraform' ? 'primary' : 'ghost'}
              onClick={() => setActiveTab('terraform')}
            >
              Terraform
            </Button>

            {architecture.provider === 'aws' && (
              <Button
                size="sm"
                variant={activeTab === 'cloudformation' ? 'primary' : 'ghost'}
                onClick={() => setActiveTab('cloudformation')}
              >
                CloudFormation
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          {!error && (
            <div className="absolute top-4 right-4 flex space-x-2 z-10">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyCode}
                icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                disabled={isGenerating || !generatedCode[activeTab]}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownloadCode}
                icon={<Download className="w-4 h-4" />}
                disabled={isGenerating || !generatedCode[activeTab]}
              >
                Download
              </Button>
            </div>
          )}
          <div className="bg-background-secondary rounded-lg p-4 overflow-auto border border-border-secondary min-h-[400px] max-h-[600px]">
            {error ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">❌</div>
                  <h3 className="text-xl font-bold text-red-400 mb-3">Code Generation Failed</h3>
                  <p className="text-gray-300 mb-4">{error}</p>
                  <p className="text-sm text-gray-500 mb-6">
                    Please try again or check your connection and backend status.
                  </p>
                  <Button
                    onClick={() => {
                      setError(null);
                      setGeneratedCode(prev => {
                        const updated = { ...prev };
                        delete updated[activeTab];
                        return updated;
                      });
                    }}
                    size="md"
                  >
                    Retry Code Generation
                  </Button>
                </div>
              </div>
            ) : isGenerating ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">GitLab Duo is generating your {activeTab} code...</p>
                  <div className="text-2xl font-mono font-bold text-blue-400 mt-3">
                    {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                  <p className="text-xs text-gray-600 mt-4">Automatic retry on failure (up to 3 attempts)</p>
                </div>
              </div>
            ) : generatedCode[activeTab] ? (
              <pre className="text-sm font-mono text-text-primary whitespace-pre-wrap break-words">
                <code>
                  {generatedCode[activeTab]}
                </code>
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeGenerator;