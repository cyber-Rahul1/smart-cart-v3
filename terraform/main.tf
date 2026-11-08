terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "SmartCart-GathrCart"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  default = "ap-south-1"
}

variable "environment" {
  default = "production"
}

# --- VPC & Networking ---
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "smartcart-vpc-${var.environment}" }
}

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags                    = { Name = "smartcart-pub-subnet-1" }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true
  tags                    = { Name = "smartcart-pub-subnet-2" }
}

resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"
  tags              = { Name = "smartcart-priv-subnet-1" }
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.20.0/24"
  availability_zone = "${var.aws_region}b"
  tags              = { Name = "smartcart-priv-subnet-2" }
}

# --- Application Load Balancer ---
resource "aws_security_group" "alb" {
  name        = "smartcart-alb-sg"
  description = "Allow inbound HTTPS"
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

resource "aws_lb" "api" {
  name               = "smartcart-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

# --- S3 Media Storage & CloudFront ---
resource "aws_s3_bucket" "media" {
  bucket = "smartcart-media-${var.environment}-assets"
}

resource "aws_s3_bucket_public_access_block" "media_block" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- SQS Event Queues ---
resource "aws_sqs_queue" "order_events" {
  name                       = "smartcart-order-events-${var.environment}"
  visibility_timeout_seconds = 300
  message_retention_seconds  = 86400 # 1 day
}

resource "aws_sqs_queue" "order_events_dlq" {
  name = "smartcart-order-events-dlq-${var.environment}"
}

# --- RDS PostgreSQL Instance ---
resource "aws_db_subnet_group" "rds" {
  name       = "smartcart-rds-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
}

resource "aws_db_instance" "postgres" {
  identifier            = "smartcart-postgres-${var.environment}"
  allocated_storage     = 20
  max_allocated_storage = 100
  engine                = "postgres"
  engine_version        = "16.1"
  instance_class        = "db.t4g.micro"
  db_name               = "smartcart_relational"
  username              = "smartcart_admin"
  password              = "ChangeMeInProdSecretsManager123!"
  db_subnet_group_name  = aws_db_subnet_group.rds.name
  skip_final_snapshot   = true
  storage_encrypted     = true
}

# --- ECS Cluster & Fargate Task ---
resource "aws_ecs_cluster" "main" {
  name = "smartcart-ecs-cluster-${var.environment}"
}
