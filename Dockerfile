# Use the official PHP image as a base image
FROM php:7.4-apache

# Set the working directory inside the container
WORKDIR /var/www/html

# Install necessary dependencies
RUN apt-get update && \
    apt-get install -y \
    libzip-dev \
    unzip \
    libzip-dev \
    && docker-php-ext-install zip pdo_mysql

# Enable Apache modules
RUN a2enmod rewrite

# Set the Apache configuration to allow directory indexes
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf
RUN echo "DirectoryIndex index.php" >> /etc/apache2/apache2.conf
RUN echo "Options Indexes FollowSymLinks" >> /etc/apache2/apache2.conf

# Create a virtual host configuration file for Apache
RUN echo '<VirtualHost *:80>' > /etc/apache2/sites-available/000-default.conf
RUN echo '    DocumentRoot /var/www/html/public' >> /etc/apache2/sites-available/000-default.conf
RUN echo '    <Directory /var/www/html>' >> /etc/apache2/sites-available/000-default.conf
RUN echo '        AllowOverride All' >> /etc/apache2/sites-available/000-default.conf
RUN echo '        Require all granted' >> /etc/apache2/sites-available/000-default.conf
RUN echo '    </Directory>' >> /etc/apache2/sites-available/000-default.conf
RUN echo '</VirtualHost>' >> /etc/apache2/sites-available/000-default.conf

# Copy the rest of the application code
COPY . /var/www/html/

# Install composer and dependencies
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer install 

# Set permissions for the storage directory
RUN chown -R www-data:www-data /var/www/html/storage

# Expose port 80 for the Apache server
EXPOSE 80

# Run the migration and seed command before hosting the application
CMD  php artisan migrate:refresh --seed -vvv && apache2-foreground