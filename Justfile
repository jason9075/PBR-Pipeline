set shell := ["sh", "-c"]

default: dev

# Install npm dependencies and link assets into public/
install:
  npm install --ignore-scripts
  mkdir -p public
  @[ -L public/assets ] || ln -sf "$(pwd)/assets" public/assets

# Start Vite dev server on :8080
dev:
  @[ -d node_modules ] || just install
  @echo "\033[36m[pbr-pipeline] Starting Vite dev server...\033[0m"
  node --require ./scripts/fix-noexec.cjs ./node_modules/vite/bin/vite.js --port 8080

# Production build → dist/
build:
  @[ -d node_modules ] || just install
  @[ -L public/assets ] || ln -sf "$(pwd)/assets" public/assets
  node --require ./scripts/fix-noexec.cjs ./node_modules/vite/bin/vite.js build

# Preview production build on :8080
preview: build
  node --require ./scripts/fix-noexec.cjs ./node_modules/vite/bin/vite.js preview --port 8080

# Remove build artifacts
clean:
  rm -rf dist node_modules public/assets
