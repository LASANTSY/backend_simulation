# Service TensorFlow.js pour Prédictions Neuronales
# Image légère Node.js avec TensorFlow.js
FROM node:18-slim

# Installation des dépendances système pour TensorFlow.js
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les fichiers de configuration npm
COPY package.json ./

# Installer les dépendances de production uniquement
# Utilisation de npm install car pas de package-lock.json complet
# Pour production avec lockfile : remplacer par "npm ci --only=production"
RUN npm install --omit=dev && npm cache clean --force

# Copier le code source
COPY . .

# Exposer le port du service
EXPOSE 8501

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=8501

# Healthcheck pour Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8501/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Démarrer le service
CMD ["node", "index.js"]
