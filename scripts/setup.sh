#!/bin/bash

REPO=headless-fleet

curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -

apt-get update
apt-get install -y git nodejs build-essential tcl supervisor htop

cd /home/ubuntu/
git clone https://Corei13@github.com/Backpack-Technologies/$REPO.git
cd $REPO
npm install
npm run build

service supervisor stop

cat > /etc/supervisor/conf.d/$REPO.conf << EOL
[program:${REPO}]
directory = /home/ubuntu/${REPO}
command = npm run worker
autorestart = true
stdout_logfile = /log/worker.log
stderr_logfile = /log/worker.err
environment = MASTER=REPLACE_WITH_MASTER_HOST
EOL

mkdir /log
service supervisor start
