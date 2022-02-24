#!/bin/bash

echo ""
echo "Didingwe NGINX PHP Installer"
echo ""

default_sites_dir=/etc/nginx/sites-enabled
script_source_dir=$(dirname $BASH_SOURCE)
sample_web_server_conf=$script_source_dir/sample-nginx.conf
web_server_conf_dir=nginx
export default_sites_dir sample_web_server_conf web_server_conf_dir
$script_source_dir/install-debian-php.sh

# Reload php-fpm
sudo service php8.1-fpm reload

# Reload nginx with new site
sudo service nginx reload

echo ""
echo "Installation complete."
echo ""

exit 0

