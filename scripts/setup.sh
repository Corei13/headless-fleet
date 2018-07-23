#!/bin/bash

REPO=headless-fleet

curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -

apt-get update
apt-get install -y git nodejs build-essential tcl supervisor htop libx11-6 libx11-xcb1 libxcomposite1 libxcursor1 libxdamage1 libpango-1.0-0 libpangocairo-1.0-0 libnspr4 libcairo2 libcups2 libxss1 libasound2 libatk1.0-0 libgtk-3-0 libnss3
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
