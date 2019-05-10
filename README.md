# coinkit
Tools for making cryptocurrency stuff.

## What is this

This code runs a custom blockchain protocol on which you can own and transfer
cryptocurrency.

The consensus mechanism is based on the Stellar Consensus Protocol,
aka SCP. See:

https://www.stellar.org/papers/stellar-consensus-protocol.pdf 

## How to install it

I provide OS X instructions only. Good luck.

First install Postgres and create a test database.

NOTE: this might have to be Postgres 10+, I don't know.

```
brew install postgres
brew services start postgresql
```

Then install go on your machine.

```
brew install go
```

You will need to set up a `GOPATH`, and then clone this repo into the `src`
directory under your gopath. I suggest making `~/go` your `GOPATH`. Then, you
should clone this repo into `$GOPATH/src/github.com/lacker/coinkit`.

When you build this repo, it creates multiple binaries in `$GOPATH/bin`.
I suggest adding `$GOPATH/bin` to your `$PATH` - if you don't, you'll have to run
`$GOPATH/bin/cclient` instead of just `cclient`, and so on.

```
# Install dependencies
cd ~/go/src/github.com/lacker/coinkit
go get -t ./...

# Create databases
# This expects your postgres setup to allow a login with your username
# and the password "test", and for your user to have createdb permissions.
# If you get an authentication failure you will have to set that up yourself.
./create-databases.sh

# Run the unit tests
go test ./...

# Build everything
go install ./...
```

If you have older databases set up, the tests might fail with some weird database errors. If this happens run:

```
clear-test.sh
```

## How to run it

Commands are from the `~/go/src/github.com/lacker/coinkit` directory.

To run a local cluster of four cservers:

```
./debug-local.sh
```

(Or `./start-local.sh` to run them in the background.)

To stop the local cluster:

```
./stop-local.sh
```

To clear the local databases:

```
./clear-local.sh
```

You can check the current account balance with:

```
cclient status [publicKey]
```

If no key is provided, it will prompt you for a passphrase. You can also
use this to create your own account - just use any passphrase, and then
note what the public key is so that other accounts can send you money.

To send money:

```
cclient send [user] [amount]
```

The send command will keep checking back to see when the money leaves the source
account. It should just take a second or two to send the money.

To start off with, all the money is in one account where the passphrase is "mint".
If you're just poking around, I recommend sending some money from the mint
to an account of your own and then checking your account's balance as a little
exercise.

To check the servers' health, go to `http://127.0.01:8000/healthz` in your browser. (Or 8001/8002/8003 for the other three servers.)

## Benchmarking

TODO: make sure these benchmarks are fast enough to run on typical machines.

```
# Testing a 4-server network with one client
go test ./network -run=zzz -bench=BenchmarkSendMoney1$ -benchtime=10s
```

## Code organization

* `cmd`: The code for the command-line tools, `cserver` and `cclient`.
* `consensus`: The logic to run the SCP. This is how blocks are formed.
* `data`: The code that handles operations for data manipulation.
* `local`: Configuration for running a testnet with all nodes on the local machine.
* `network`: The networking wrapper to run a server and communicate with peers.
* `util`: Encryption logic, tools used in lots of places, that sort of thing.
