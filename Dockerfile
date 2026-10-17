FROM php:8.2-apache

# Install PDO MySQL extension and enable required Apache modules
RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite headers expires

# Use custom Apache configuration or default document root
WORKDIR /var/www/html
