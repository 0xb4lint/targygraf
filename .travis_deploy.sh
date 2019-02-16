#!/bin/bash

ssh -l www-data targygraf.hu \
	"sh -c ' \
	cd /var/www/targygraf.hu; \
	rm composer.lock; \
	git pull origin master && \
	composer install --no-dev --no-interaction && \
	php artisan migrate:refresh --seed --force -vvv'"
