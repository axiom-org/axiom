# Deployment

This directory contains code to deploy some persistent Axiom nodes to Google Cloud.

# Running a cluster on GCP

A single cluster can support multiple nodes.

### 1. Set up a GCP account and install the Cloud Tools

https://cloud.google.com/sdk/docs/

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

The build process takes a snapshot of the latest code on github,
creates a Docker image from that, and uploads it to Google's container
registry. This forces you to get your changes into master before deploying them.

From the `ops` directory:

```
./build.sh
```

The container and its presence on the registry is specific to your project, so this
won't interfere with other peoples' builds.

### 4. Start your cluster

You will need to specifically enable some APIs.

Enable logging at: https://console.cloud.google.com/flows/enableapi?apiid=logging.googleapis.com

Then let's make the cluster, named "testnet". Once you run this, it'll
start charging you money.

```
gcloud container clusters create testnet --num-nodes=1 --scopes https://www.googleapis.com/auth/logging.write,storage-ro
```

If you're going to run more than one server you can just start off
raising the `--num-nodes` flag.

### 5. Run an axiom node on your cluster

```
./deploy.sh 0
```

This same command should also update the deployment, when a new
"latest" image exists or when the yaml file has been updated.

To see if it worked, you can get some Kubernetes event logs from the
command line with:

```
kubectl describe pod hserver0-deployment
```

To get the application logs, go to `https://console.cloud.google.com/logs/viewer` and select "GKE container" from the first dropdown, and "hserver0" from the second.

To expose these servers to public internet ports, first reserve a static IP for the hserver.

```
gcloud compute addresses create hingress0-ip --global
```

you need to create a load balancer, which you can do with these scripts:

```
./hservice.sh 0
```

TODO: see if the certs cause a problem

You only need to create the load balancers once; you don't need to run that on every deploy. However, if
you change the firewall rules later, you may also need to change the firewall rules in
the Google Cloud config (as opposed to Kubernetes). See: https://console.cloud.google.com/networking/firewalls/list . This process is likely to break confusingly so be sure to emotionally steel yourself.

This process should also allocate you a static ip. Now is a good time
to set an A record for some domain to point to your
static ip. That will give you a host name (like `0.axiombootstrap.com`)
that you can share with other nodes.

### 6. Updating the server

When you've updated the code, just rebuild a container image and redeploy.

```
./build.sh
./deploy.sh 0
```

If you've only changed one of the servers, you only need to run one of the build commands.

