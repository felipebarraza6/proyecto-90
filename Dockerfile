# SPA estática de Proyecto 90. El backend vive en Yggdra API:
# nginx sirve la SPA y proxyea /api hacia el contenedor de Yggdra.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist/client /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
