#!/bin/bash

# give the container an unique name
redis_name="red351is"
mailsender_name="mailsender1553iU5"

# ensure redis is running. if not, run it.
# TODO: more sophisticated check to see if it's available / running.
echo "verifying redis"
docker run -d --name ${redis_name} redis || echo "ok, redis is running"

# start the node app in her shiny little container and let it do it's job
# TODO: use an init script to ensure that the modules are available

echo "starting send script with $@"
docker run -ti --rm  --link ${redis_name}:redis --name ${mailsender_name} -v $(pwd):/srv -w /srv/ node node app.js "$@"

