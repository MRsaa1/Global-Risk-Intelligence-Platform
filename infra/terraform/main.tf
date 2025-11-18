terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  backend "s3" {
    # Configure backend in terraform.tfvars or via environment variables
    bucket = "global-risk-platform-terraform-state"
    key    = "global-risk-platform/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

data "aws_eks_cluster" "cluster" {
  name = var.cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = var.cluster_name
}

# VPC and networking
module "vpc" {
  source = "./modules/vpc"
  
  name = "${var.project_name}-vpc"
  cidr = var.vpc_cidr
  
  azs             = var.availability_zones
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  
  enable_nat_gateway = true
  single_nat_gateway = false
  
  tags = var.tags
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"
  
  cluster_name    = var.cluster_name
  cluster_version = var.kubernetes_version
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  node_groups = {
    main = {
      desired_size = 3
      min_size     = 2
      max_size     = 10
      instance_types = ["m5.xlarge"]
    }
  }
  
  tags = var.tags
}

# RDS for PostgreSQL
module "rds" {
  source = "./modules/rds"
  
  identifier = "${var.project_name}-postgres"
  engine_version = "16.1"
  
  instance_class = var.rds_instance_class
  allocated_storage = 100
  
  db_name  = "risk_platform"
  username = var.db_username
  password = var.db_password
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnets
  security_group_ids = [module.rds.security_group_id]
  
  tags = var.tags
}

# ElastiCache for Redis
module "redis" {
  source = "./modules/elasticache"
  
  cluster_id = "${var.project_name}-redis"
  node_type  = "cache.r6g.large"
  num_cache_nodes = 1
  
  subnet_ids         = module.vpc.private_subnets
  security_group_ids = [module.redis.security_group_id]
  
  tags = var.tags
}

