FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=https://risk.saa-alliance.com
ARG VITE_CESIUM_ION_TOKEN
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CESIUM_ION_TOKEN=$VITE_CESIUM_ION_TOKEN
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
