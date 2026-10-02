FROM nginx:alpine
COPY index.html style.css app.js text.js /usr/share/nginx/html/
