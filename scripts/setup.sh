#!/bin/bash

REPO=headless-fleet

curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -

apt-get update
apt-get install -y git nodejs build-essential tcl supervisor htop
npm i -g yarn

cd /home/ubuntu/
git clone https://github.com/Corei13/$REPO.git
cd $REPO
yarn
yarn build

service supervisor stop

cat > /etc/supervisor/conf.d/$REPO.conf << EOL
[program:${REPO}]
directory = /home/ubuntu/${REPO}
command = yarn worker
autorestart = true
stdout_logfile = /log/worker.log
stderr_logfile = /log/worker.err
environment = MASTER=REPLACE_WITH_MASTER_HOST
EOL

mkdir /log
service supervisor start
