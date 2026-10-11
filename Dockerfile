FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/sen-proxi-teranga-frontend/browser/ /usr/share/nginx/html/
EXPOSE 80
