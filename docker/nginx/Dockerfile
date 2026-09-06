FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY resolve-upstreams.sh /app/resolve-upstreams.sh
COPY entrypoint.sh /app/entrypoint.sh
COPY backend.conf.template /etc/nginx/templates/backend.conf.template
COPY conf.d/site.conf.template /etc/nginx/templates/site.conf.template
COPY nginx.conf /etc/nginx/nginx.conf

RUN chmod +x /app/resolve-upstreams.sh /app/entrypoint.sh

EXPOSE 80 3000

ENTRYPOINT ["/app/entrypoint.sh"]
