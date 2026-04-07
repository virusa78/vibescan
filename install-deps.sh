#!/bin/bash
# VibeScan Dependency Installation Script
# Run with: sudo bash install-deps.sh

set -e

echo "=== VibeScan Dependency Installation ==="

# Detect OS
OS_NAME=$(uname -s)
echo "Detected OS: $OS_NAME"

# Install system dependencies
install_system_deps() {
    echo "Installing system dependencies..."

    if [[ "$OS_NAME" == "Linux" ]]; then
        # Check which package manager is available
        if command -v apt-get &> /dev/null; then
            echo "Using apt-get..."
            apt-get update -y
            apt-get install -y \
                curl \
                git \
                python3 \
                make \
                g++ \
                build-essential \
                libssl-dev \
                libpq-dev \
                postgresql-client
        elif command -v yum &> /dev/null; then
            echo "Using yum..."
            yum install -y epel-release
            yum install -y \
                curl \
                git \
                python3 \
                make \
                gcc-c++ \
                openssl-devel \
                postgresql
        elif command -v dnf &> /dev/null; then
            echo "Using dnf..."
            dnf install -y \
                curl \
                git \
                python3 \
                make \
                gcc-c++ \
                openssl-devel \
                postgresql
        elif command -v apk &> /dev/null; then
            echo "Using apk..."
            apk add --no-cache \
                curl \
                git \
                python3 \
                make \
                g++ \
                build-base \
                openssl-dev \
                postgresql-client
        else
            echo "ERROR: No supported package manager found (apt-get, yum, dnf, apk)"
            exit 1
        fi
    elif [[ "$OS_NAME" == "Darwin" ]]; then
        echo "macOS detected..."
        # Check if Homebrew is installed
        if ! command -v brew &> /dev/null; then
            echo "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install \
            curl \
            git \
            python3 \
            postgresql \
            redis
    else
        echo "WARNING: Unknown OS - skipping system package installation"
    fi
}

# Install Node.js via nvm
install_nodejs() {
    echo "Installing Node.js 24 via nvm..."

    # Check if nvm is already installed
    if [[ -z "$NVM_DIR" ]]; then
        export NVM_DIR="$HOME/.nvm"
    fi

    if ! command -v nvm &> /dev/null; then
        echo "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi

    # Install and use Node.js 24
    nvm install 24
    nvm use 24
    nvm alias default 24

    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
}

# Install project dependencies
install_project_deps() {
    echo "Installing VibeScan backend dependencies..."
    cd /home/virus/vibescan
    npm install

    echo "Installing VibeScan frontend dependencies..."
    cd /home/virus/vibescan/vibescan-ui
    npm install

    echo "All dependencies installed successfully!"
}

# Main execution
main() {
    echo "Starting dependency installation..."

    # Install system dependencies (requires sudo on Linux)
    if [[ "$OS_NAME" == "Linux" ]]; then
        echo "NOTE: System dependencies require sudo access"
        install_system_deps
    else
        echo "Skipping system package installation (not Linux)"
    fi

    # Install Node.js (no sudo required)
    install_nodejs

    # Install project dependencies
    install_project_deps

    echo ""
    echo "=== Installation Complete ==="
    echo ""
    echo "Next steps:"
    echo "1. Start infrastructure (PostgreSQL, Redis, MinIO):"
    echo "   cd /home/virus/vibescan && docker-compose up -d"
    echo ""
    echo "2. Run database migrations:"
    echo "   cd /home/virus/vibescan && npm run migrate"
    echo ""
    echo "3. Start development servers:"
    echo "   Backend: cd /home/virus/vibescan && npm run dev"
    echo "   Frontend: cd /home/virus/vibescan/vibescan-ui && npm run dev"
}

main "$@"
