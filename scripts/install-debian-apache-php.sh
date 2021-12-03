#!/bin/bash

echo ""
echo "Didingwe Apache PHP Installer"
echo ""

default_sites_dir=/etc/apache2/sites-enabled
script_source_dir=$(dirname $BASH_SOURCE)
sample_web_server_conf=$script_source_dir/sample-apache2.conf
web_server_conf_dir=apache2
export default_sites_dir sample_web_server_conf web_server_conf_dir
$script_source_dir/install-debian-php.sh

# Link PHP rewrite rules and enable Apache Rewrite module
ln -s dididngwe-php/.htaccess -t web
sudo a2enmod rewrite

# Reload apache with new settings
sudo service apache2 reload

echo ""
echo "Installation complete."
echo ""

exit 0

