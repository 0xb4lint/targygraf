#!/bin/bash

eval "$(ssh-agent -s)"
base64 --decode <<< "$DEPLOY_PRIVATE_KEY" > deploy_key
chmod 600 deploy_key
ssh-add deploy_key
ssh -o "StrictHostKeyChecking no" -l root szekeres.me \
	"sudo -u www-data -H sh -c ' \
	cd /var/www/targygraf.hu; \
	rm composer.lock; \
	git pull origin master && \
	composer install --no-dev --no-interaction && \
	php artisan migrate:refresh --seed --force -vvv'"
