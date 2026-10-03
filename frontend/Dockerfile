# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
# The official image renders /etc/nginx/templates/*.template with envsubst at startup.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/taskflow/browser /usr/share/nginx/html
ENV PORT=80 \
    BACKEND_URL=http://backend:8080
EXPOSE 80
