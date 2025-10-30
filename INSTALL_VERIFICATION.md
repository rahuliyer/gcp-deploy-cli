# Installation Verification

## ✅ Dependencies Installed

Run to verify all dependencies are installed correctly:

```bash
npm list --depth=0
```

Expected output:
```
gcp-deploy-cli@1.0.0
├── @google-cloud/logging@11.x.x
├── @google-cloud/run@1.x.x
├── chalk@4.x.x
├── commander@11.x.x
├── dotenv@16.x.x
├── nanoid@3.x.x
├── ora@5.x.x
└── prompts@2.x.x
```

## ✅ CLI Commands Work

Test all commands:

```bash
# Version check
gcp-deploy --version
# Should output: 1.0.0

# Help
gcp-deploy --help
# Should show all commands

# Command-specific help
gcp-deploy deploy --help
gcp-deploy init --help
gcp-deploy list --help
gcp-deploy logs --help
gcp-deploy remove --help
```

## ✅ Prerequisites Checklist

Before deploying, verify:

- [ ] Node.js 18+ installed: `node --version`
- [ ] Docker installed: `docker --version`
- [ ] Docker running: `docker ps`
- [ ] gcloud CLI installed: `gcloud --version`
- [ ] gcloud authenticated: `gcloud auth list`
- [ ] GCP project set: `gcloud config get-value project`

## ✅ Test Installation

Quick test without deploying:

```bash
# Create a test directory
mkdir test-gcp-deploy
cd test-gcp-deploy

# Create a minimal package.json with Next.js
cat > package.json << 'PKGJSON'
{
  "name": "test-app",
  "dependencies": {
    "next": "^14.0.0"
  }
}
PKGJSON

# Try to initialize (will prompt for input)
gcp-deploy init
# Press Ctrl+C to cancel after seeing prompts work

# Clean up
cd ..
rm -rf test-gcp-deploy
```

## ✅ All Systems Go!

If all checks pass, you're ready to deploy! Try it with a real Next.js app:

```bash
cd your-nextjs-app
gcp-deploy init
gcp-deploy deploy --production
```

## 🔧 Troubleshooting

### npm link not working?

```bash
# Unlink and relink
npm unlink -g gcp-deploy-cli
npm link
```

### Command not found?

```bash
# Check npm global bin path
npm config get prefix
# Should show something like /usr/local or /opt/homebrew

# Add to PATH if needed (add to ~/.zshrc or ~/.bashrc)
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Permission errors?

```bash
# On macOS/Linux, you might need sudo for global npm operations
sudo npm link
```
