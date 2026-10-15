# DollScene realtime server: presence, live headcounts and public chat over WebSockets.
# Cloud Run: gcloud run deploy dollscene-realtime --source server/realtime --region europe-west1 \
#   --allow-unauthenticated --timeout 3600 --session-affinity --min-instances 1 --max-instances 1 \
#   --set-secrets VATAR_SECRET=VATAR_SECRET:latest --set-env-vars ALLOWED_ORIGINS=https://<your-studio-domain>
# (one instance: presence lives in memory; see README for scaling past one instance)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY index.mjs moderation.mjs ./
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "index.mjs"]
