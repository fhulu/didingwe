#!/bin/bash

echo ""
echo "Didingwe Apache PHP Installer"
echo ""

default_app_dir=`pwd`
dest_dir=$1
app_dir=${dest_dir:-$default_app_dir}
cd $app_dir
project_name="$(basename $app_dir)"

# Configure domain name to access via web port 80, eg. http://example.local
default_domain_name=$project_name.local
read -r -p "Enter web domain name [$default_domain_name]: " domain_name
domain_name=${domain_name:-$default_domain_name}

read -r -p "Would you like to add this name to your local hosts file [N]: " add_host
add_host=${add_host:-N}
if [[ "$add_host" =~ ^[yY](es)?$ ]]; 
then
    default_host_ip=127.0.0.1
    read -r -p "Enter the ip address of the host machine [$default_host_ip]: " host_ip
    host_ip=${host_ip:-$default_host_ip}
    sudo echo "$host_ip $domain_name" >> /etc/hosts
fi

# Configure Didingwe start point
default_didi_dir=didingwe
read -r -p "Enter the directory in which the Didingwe framework resides [$default_didi_dir]: " didi_dir
didi_dir=${didi_dir:-$default_didi_dir}

# Create required directories
web_dir=web
mkdir -p $web_dir

vocab_dir=vocab
mkdir -p $vocab_dir

apache_dir=$app_dir/apache
mkdir -p $apache_dir

log_dir=log
mkdir -p $log_dir

# Make sure log directory is writable
default_web_user=www-data
read -r -p "User name of the web user [$default_web_user]: " web_user
web_user=${web_user:-$default_web_user}
sudo chown $web_user:$web_user $log_dir

# Configure Apache specific settings
apache_conf="$apache_dir/$project_name.conf"
site_dir=${app_dir//\//\\/}
sed "s/\$site_dir/${site_dir}/g; s/\$domain_name/${domain_name}/g" $didi_dir/apache/apache.conf >$apache_conf
default_sites_dir=/etc/apache2/sites-enabled
read -r -p "Enter Apache2 sites-enabled directory [$default_sites_dir]: " sites_dir
sites_dir=${sites_dir:-$default_sites_dir}
sudo ln -s $apache_conf $sites_dir/$project_name.conf
sudo a2enmod rewrite

# Install PHP
sudo apt install php7.4 php7.4-yaml

# Get PHP repostory
git clone https://github.com/fhulu/didingwe-php.git $php_dir
php_dir=didingwe-php
mkdir -p $php_dir

# Link PHP index page
ln -s ../$php_dir/index.php -t $web_dir

# Link PHP rewrite rules
ln -s ../$php_dir/.htaccess -t $web_dir

# Link Framework Web Assets 
ln -s ../$didi_dir/web $web_dir/didi

# Sample Git Ignore file -- can be overwitten
cp -p $didi_dir/.gitignore $app_dir/.gitignore

# Initial app configuration file 
didi_root=${didi_dir//\//\\/}
project_title=${project_name^}
sed "s/\$didi_root/${didi_root}/g; s/\$project_name/${project_name}/g; s/\$project_title/${project_title}/g" $didi_dir/vocab/sample-app-config.yml >$app_dir/vocab/app-config.yml

# Sample site-specific configuration file
sed "s/\$project_name/${project_name}/g" $didi_dir/vocab/sample-site-config.yml >$app_dir/vocab/.site-config.yml

# Reload apache with new settings
sudo service apache2 reload

echo ""
echo "Installation complete."
echo ""

exit 0

