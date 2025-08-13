#!/bin/bash

cp frontend/.env.live frontend/.env.local

for i in frontend backend media-processor; do
    cd $i
    sudo docker build -t registry.fanjango.com.hk/vib3cod3r/fb-$i:latest .
    if [ $? = 0 ]; then sudo docker push registry.fanjango.com.hk/vib3cod3r/fb-$i:latest; fi
    cd ..
done

cp frontend/.env.dev frontend/.env.local

