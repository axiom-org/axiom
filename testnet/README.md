# Running a testnet

This directory contains operational tools for running the alpha testnet.

This instructions specifically explain how to deploy a miner to the Google Cloud Platform.

Estimated cost for keeping one miner running using these instructions:
* n1-standard-1 for the app servers is $25 a month
* db-f1-micro for the database is $8 a month
* 100 GB of database storage is another $9 a month
* Load balancing is $18 a month

# Running a cluster on GCP

A single cluster can support multiple miners.

### 1. Set up a GCP account and install the Cloud Tools

https://cloud.google.com/sdk/docs/

```
$ gcloud version
Google Cloud SDK 192.0.0
bq 2.0.29
core 2018.03.02
gsutil 4.28
```

Also use `gcloud` to install Kubernetes:

```
gcloud components install kubectl
```

Choose a name for your gcloud axiom project and create it:

```
gcloud projects create your-axiom-project-name
gcloud config set project your-axiom-project-name
```

It is handy to have `PROJECT_ID` set to the name of your GCP project in your shell,
so add this to your bash config and source it:

```
export PROJECT_ID="$(gcloud config get-value project -q)"
```

It seemed like Iowa "A" was the best place, so I set the `gcloud` defaults with:

```
gcloud config set compute/zone us-central1-a
```

Enable billing for your project: https://cloud.google.com/billing/docs/how-to/modify-project

Add `Kubernetes Engine` and `Container Registry` API access to your project:

```
gcloud services enable container.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 2. Install Docker

https://hub.docker.com/search/?type=edition&offering=community

You don't need the "enterprise edition".

```
$ docker version
Client:
 Version:           18.09.4
 API version:       1.39
 Go version:        go1.10.8
 Git commit:        d14af54266
 Built:             Wed Mar 27 18:35:44 2019
 OS/Arch:           linux/amd64
 Experimental:      false

Server: Docker Engine - Community
 Engine:
  Version:          18.09.4
  API version:      1.39 (minimum version 1.12)
  Go version:       go1.10.8
  Git commit:       d14af54
  Built:            Wed Mar 27 18:01:48 2019
  OS/Arch:          linux/amd64
  Experimental:     false
```

On Ubuntu, you may want to give your user Docker rights, so that you don't have to
sudo everything:

```
sudo groupadd docker
sudo gpasswd -a $USER docker
newgrp docker

# Then test that it's working
docker run hello-world
```

You will need to run `newgrp docker` in any new terminal you create,
until you log out and log in again.

Then set up gcloud to act as a Docker credential helper:

```
gcloud auth configure-docker
```

### 3. Make a container image

The build process takes a snapshot of the latest code on `github.com/axiom-org/axiom`,
creates a Docker image from that, and uses that to deploy. So get your changes into
master before trying to deploy them.

From the `testnet` directory, you'll need to build two containers, one for the blockchain
server and one for the hosting server, and upload them to Google's container
registry with:

```
./build.sh cserver
./build.sh hserver
```

The container and its presence on the registry is specific to your project, so this
won't interfere with other peoples' builds.

### 4. Start your cluster

You will need to specifically enable some APIs.

Enable logging at: https://console.cloud.google.com/flows/enableapi?apiid=logging.googleapis.com

Enable SQL at: https://console.cloud.google.com/flows/enableapi?apiid=sqladmin

Then let's make the cluster, named "testnet". Once you run this, it'll
start charging you money.

```
gcloud container clusters create testnet --num-nodes=1 --scopes https://www.googleapis.com/auth/logging.write,storage-ro
```

If you're going to run more than one miner you can just start off
raising the `--num-nodes` flag.

# Running a miner on your cluster

### 1. Generate a keypair for your miner

To generate a keypair, run:

```
cclient generate > keypair0.json
```

Then type in a bunch of random letters. Save `keypair0.json` somewhere secret.

To make this secret available to kubernetes, run:

```
kubectl create secret generic keypair0 --from-file=./keypair0.json
```

### 2. Start a database

These scripts are designed to deploy multiple miners to one cluster. The miners are differentiated by a number in `{0,1,2,3}`. From here on out, the instructions explain how to deploy miner 0, but if you want multiples just replace the 0 with a different number. Each miner will have its own database and its own cserver process.

Create a new database instance at https://console.cloud.google.com/projectselector/sql/instances . Pick postgres. Name it `db0` - that is your "instance name" or "instance id".

Generate a random password, but take note of it.

I chose PostgreSQL 11, and edited the resources to be the minimum, 1 shared cpu, 0.6 GB memory, 10 GB SSD storage. It isn't obvious that the "cores" slider goes even lower than the "1 core" default.

Go to the management UI for your database, from https://console.cloud.google.com/sql/instances . Go to Databases, Create a database, and name it "prod". You can drop and recreate the "prod" database from this UI later, if for some reason the content has become corrupted. It can catch back up from other servers.

You need a "service account" for your databases. If you have multiple miners, this can be shared across them. Create one at https://console.cloud.google.com/projectselector/iam-admin/serviceaccounts

Create a service account with the "Cloud SQL Client" role. Name it
`sql-client` and select "Furnish a new private key" using `JSON`
type. Hang on to the json file that your browser downloads. I named it `sql-client.json`.

Now you need to create a proxy user. For the database `db0` name the user `proxyuser0`.
Use that password you noted when you created the database instance.

```
gcloud sql users create proxyuser0 --instance=db0 --password=[PASSWORD]
```

Now we need to create some Kubernetes secrets. Both the service account and the proxy user require secrets to use them. The service account can be shared among multiple databases, but the proxy user is tied to a specific database.

To create a secret for the service account, named `cloudsql-instance-credentials`:

```
kubectl create secret generic cloudsql-instance-credentials --from-file=credentials.json=that-json-file-you-downloaded-which-I-named-sql-client.json
```

If you have multiple miners, the same `cloudsql-instance-credentials` will be used for all of them.

For the proxy user, create a secret named `cloudsql-db0-credentials` with:

```
kubectl create secret generic cloudsql-db0-credentials --from-literal=username=proxyuser0 --from-literal=password=[PASSWORD]
```

### 3. Deploy a cserver to your cluster

To deploy a `cserver` to your cluster, run:

```
./deploy.sh 0
```

This same command should also update the deployment, when a new
"latest" image exists or when the yaml file has been updated.

To see if it worked, you can get some Kubernetes event logs from the
command line with:

```
kubectl describe pod cserver0-deployment
```

To get the application logs, go to `https://console.cloud.google.com/logs/viewer` and select "GKE container" from the first dropdown, "cserver0" from the second.

To expose the `cserver` to public internet ports, you need to create a load balancer, which you can do with the `expose.sh` script:

```
./expose.sh 0
```

You only need to expose it once; you don't need to run that on every deploy.

To find the external ip, run:

```
kubectl get services
```

Once it displays an external ip, go to `your.external.ip:8000/healthz` in the browser.
You should see an `OK`.
Port `8000` is where the http interface is, port `9000` runs the peer-to-peer protocol.

You should also be able to access the black hole proxy at `your.external.ip:3000`, and your
WebTorrent tracker at `your.external.ip:4000/stats`.

You're going to want this IP to be static. Go to https://console.cloud.google.com/networking/addresses/list and use the dropdown to make this static. Name it something like `cservice0-ip`, because the IP is attached to the service. As long as you don't delete the load balancing service, it'll keep the same IP.

Once you have a static ip, it's a good time to set an A record for some domain to point to it. That will give you a host name (like `0.alphatest.network`) that you can share with other nodes.

### 4. Updating the server

When you've updated the code, just rebuild a container image and redeploy.

```
./build.sh cserver
./build.sh hserver
./deploy.sh 0
```

### 5. Running more miners

To run another miner, you'll have to add more nodes to your cluster. One node per miner. Then just use a different number in `{0, 1, 2, 3}` when running these steps.

# Cleaning up

If you don't want to keep things running, you can shut down the deployment, the service,
and the cluster itself:

```
kubectl delete service cservice0
kubectl delete deployment cserver0-deployment
gcloud container clusters delete testnet
```

You can delete databases from the UI, but be aware that you can't recreate one with the same name for a week or so.
