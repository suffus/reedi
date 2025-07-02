# Nginx server for static frontend files
FROM nginx:alpine

# Copy the static files (built locally)
COPY out/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx-static.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 