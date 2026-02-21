FROM nginx:1.27.2-bookworm AS base
WORKDIR /usr/share/nginx/html
EXPOSE 80

FROM node:22-bookworm-slim AS build

# Telerik/Kendo UI License (passed as build argument)
ARG TELERIK_LICENSE
ENV TELERIK_LICENSE=${TELERIK_LICENSE}

WORKDIR /src/src/frontend-libraries

# Copy package files first for better layer caching
COPY src/frontend-libraries/package*.json ./

# Use npm ci for faster, reproducible builds
RUN npm ci

# Copy source code
COPY src/frontend-libraries/ ./

FROM build AS publish
RUN npm run build:prod


FROM base AS final
WORKDIR /usr/share/nginx/html
COPY --from=publish /src/src/frontend-libraries/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=publish /src/src/frontend-libraries/entrypoint.sh .
COPY --from=publish /src/src/frontend-libraries/dist/template-app/ .
RUN chmod +x ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
